import { ytdlp } from '$lib/server/ytdlp';
import { sanitizeFilename } from '$lib/server/utils';
import type { DownloadAdd } from '$lib/server/db/schema';

const URL_PATTERN = /^(https?:\/\/).+$/i;
const MAX_FILENAME_LENGTH = 250;

export type IncomingDownload = {
	videoUrl: string;
	fileName?: string | null;
	appendTitle?: boolean;
	quality?: string;
};

export class ValidationError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

/**
 * Normalize input (single item or array), validate and expand playlists.
 * Returns an array of DownloadAdd ready to insert to DB.
 */
export async function prepareDownloadItems(
	input: IncomingDownload | IncomingDownload[]
): Promise<DownloadAdd[]> {
	const rawItems = Array.isArray(input) ? input : [input];
	if (rawItems.length === 0) {
		throw new ValidationError(400, 'Keine Download-Daten übergeben');
	}

	const result: DownloadAdd[] = [];

	for (const [index, raw] of rawItems.entries()) {
		const videoUrl = (raw.videoUrl || '').toString().trim();
		let fileName = raw.fileName ? String(raw.fileName).trim() : null;
		const appendTitle = !!raw.appendTitle;
		const quality = (raw.quality as DownloadAdd['quality']) ?? 'highest';

		if (!videoUrl) {
			throw new ValidationError(400, `Leere URL in Eintrag ${index + 1}`);
		}
		if (!URL_PATTERN.test(videoUrl)) {
			throw new ValidationError(400, `Ungültige URL in Eintrag ${index + 1}: ${videoUrl}`);
		}

		// Hole Metadaten (kann playlist oder video sein)
		let info;
		try {
			info = await ytdlp.getInfoAsync(videoUrl);
		} catch {
			throw new ValidationError(400, `Fehler beim Abruf der Metadaten für URL: ${videoUrl}`);
		}

		// Hilfsfunktion um Namen zu resolven und validieren
		const buildName = (baseName: string | null, titleFromMeta?: string) => {
			let name = baseName && baseName.trim() !== '' ? baseName : (titleFromMeta ?? '%(title)s');
			if (appendTitle && titleFromMeta) {
				// only append if baseName is different from title
				if (name !== titleFromMeta) name = `${name} - ${titleFromMeta}`;
			}
			name = sanitizeFilename(name);
			if (name.length > MAX_FILENAME_LENGTH) {
				throw new ValidationError(
					400,
					`Dateiname zu lang (max. ${MAX_FILENAME_LENGTH} Zeichen): ${name}`
				);
			}
			return name;
		};

		if (info._type === 'playlist' && Array.isArray(info.entries)) {
			// Expand playlist: jedes Video einzeln behandeln
			for (const entry of info.entries) {
				const entryUrl = entry.url || entry.webpage_url || entry.id;
				const entryTitle = entry.title || 'untitled';
				if (!entryUrl) {
					// weiter mit nächstem Eintrag, aber protokollieren wäre sinnvoll
					continue;
				}
				// If user provided a filename for the playlist input, use it as base for each entry
				const resolvedName = buildName(fileName, entryTitle);
				result.push({
					videoUrl: entryUrl,
					fileName: resolvedName,
					appendTitle,
					quality,
					status: 'pending'
				});
			}
		} else {
			// Single video
			const title = info.title ?? undefined;
			if (!fileName || fileName.trim() === '') fileName = title ?? null;
			const resolvedName = buildName(fileName, title);
			result.push({
				videoUrl,
				fileName: resolvedName,
				appendTitle,
				quality,
				status: 'pending'
			});
		}
	}

	return result;
}
