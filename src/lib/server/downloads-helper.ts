import { ytdlp } from '$lib/server/ytdlp';
import { sanitizeFilename } from '$lib/server/utils';
import type { DownloadAdd } from '$lib/server/db/schema';

const URL_PATTERN = /^(https?:\/\/).+$/i;
const MAX_FILENAME_LENGTH = 200;

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
 * Hilfsfunktion: versuche aus der URL einen brauchbaren Fallback-Namen zu bauen.
 * Beispiele: YouTube ?v=ID → ID, sonst letzter Pfadteil, sonst 'video'.
 */
function deriveNameFromUrl(videoUrl: string): string {
	try {
		const u = new URL(videoUrl);
		// common youtube id param
		const v = u.searchParams.get('v');
		if (v) return v;
		// last non-empty path segment
		const parts = u.pathname.split('/').filter(Boolean);
		if (parts.length > 0) return parts[parts.length - 1];
	} catch {
		// ignore
	}
	return 'video';
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
		let info = null;
		try {
			info = await ytdlp.getInfoAsync(videoUrl);
		} catch {
			// Nicht fatal — wenn Metadaten nicht verfügbar sind, behandeln wir den Eintrag
			// als einzelnes Video ohne Titel/Playlist-Expansion.
			info = { _type: 'video', title: null };
		}

		// Hilfsfunktion um Namen zu resolven und validieren
		const buildName = (
			baseName: string | null,
			titleFromMeta?: string | null,
			urlForFallback?: string
		) => {
			// Standardverhalten: wenn baseName nicht gesetzt → benutze titleFromMeta fallend,
			// sonst Template '%(title)s' ersetzen durch Fallback (id/path) oder 'video'.
			let name: string;
			if (baseName && baseName.trim() !== '') {
				name = baseName;
			} else if (titleFromMeta && titleFromMeta.trim() !== '') {
				name = titleFromMeta;
			} else {
				// kein baseName und kein titleFromMeta → benutze einen Fallback aus der URL
				const fallback = urlForFallback ? deriveNameFromUrl(urlForFallback) : 'video';
				name = fallback;
			}

			// Falls appendTitle gewünscht ist und es einen titleFromMeta gibt, anhängen
			if (appendTitle && titleFromMeta && titleFromMeta.trim() !== '' && name !== titleFromMeta) {
				name = `${name} - ${titleFromMeta}`;
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

		if (info && info._type === 'playlist' && Array.isArray(info.entries)) {
			// Expand playlist: jedes Video einzeln behandeln
			for (const entry of info.entries) {
				const entryUrl = entry.url || entry.webpage_url || entry.id;
				const entryTitle = entry.title ?? null;
				if (!entryUrl) {
					// weiter mit nächstem Eintrag; fehlende URL kann vorkommen
					continue;
				}

				// Wenn der Benutzer einen Dateinamen für das Playlist-Input angegeben hat,
				// benutzen wir diesen als Basis, ansonsten nehmen wir entryTitle oder fallback.
				const resolvedName = buildName(fileName ?? null, entryTitle, entryUrl);
				result.push({
					videoUrl: entryUrl,
					fileName: resolvedName,
					appendTitle,
					quality,
					status: 'pending'
				});
			}
		} else {
			// Single video (auch der Fall, wenn getInfoAsync fehlgeschlagen ist)
			const title = info && 'title' in info ? (info.title ?? null) : null;

			// Wenn kein fileName explizit angegeben wurde, versuchen wir title, sonst Fallback aus URL
			if (!fileName || fileName.trim() === '') fileName = title ?? null;

			const resolvedName = buildName(fileName, title, videoUrl);
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
