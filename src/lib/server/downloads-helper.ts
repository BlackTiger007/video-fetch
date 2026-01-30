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
 * Helper function: try to derive a usable fallback name from the URL.
 * Examples: YouTube ?v=ID → ID, otherwise last path segment, otherwise 'video'.
 */
function deriveNameFromUrl(videoUrl: string): string {
	try {
		const u = new URL(videoUrl);
		// common YouTube ID parameter
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
 * Normalize input (single item or array), validate, and expand playlists.
 * Returns an array of DownloadAdd ready to be inserted into the DB.
 */
export async function prepareDownloadItems(
	input: IncomingDownload | IncomingDownload[]
): Promise<DownloadAdd[]> {
	const rawItems = Array.isArray(input) ? input : [input];
	if (rawItems.length === 0) {
		throw new ValidationError(400, 'No download data provided');
	}

	const result: DownloadAdd[] = [];

	for (const [index, raw] of rawItems.entries()) {
		const videoUrl = (raw.videoUrl || '').toString().trim();
		let fileName = raw.fileName ? String(raw.fileName).trim() : null;
		const appendTitle = !!raw.appendTitle;
		const quality = (raw.quality as DownloadAdd['quality']) ?? 'highest';

		if (!videoUrl) {
			throw new ValidationError(400, `Empty URL in entry ${index + 1}`);
		}
		if (!URL_PATTERN.test(videoUrl)) {
			throw new ValidationError(400, `Invalid URL in entry ${index + 1}: ${videoUrl}`);
		}

		// Fetch metadata (may be a playlist or a single video)
		let info = null;
		try {
			info = await ytdlp.getInfoAsync(videoUrl);
		} catch {
			// Not fatal — if metadata is unavailable, treat the entry
			// as a single video without title/playlist expansion.
			info = { _type: 'video', title: null };
		}

		// Helper function to resolve and validate the file name
		const buildName = (
			baseName: string | null,
			titleFromMeta?: string | null,
			urlForFallback?: string
		) => {
			// Default behavior: if baseName is not set → use titleFromMeta if available,
			// otherwise replace '%(title)s' with a fallback (id/path) or 'video'.
			let name: string;
			if (baseName && baseName.trim() !== '') {
				name = baseName;
			} else if (titleFromMeta && titleFromMeta.trim() !== '') {
				name = titleFromMeta;
			} else {
				// no baseName and no titleFromMeta → use a fallback derived from the URL
				const fallback = urlForFallback ? deriveNameFromUrl(urlForFallback) : 'video';
				name = fallback;
			}

			// If appendTitle is requested and a titleFromMeta exists, append it
			if (appendTitle && titleFromMeta && titleFromMeta.trim() !== '' && name !== titleFromMeta) {
				name = `${name} - ${titleFromMeta}`;
			}

			name = sanitizeFilename(name);
			if (name.length > MAX_FILENAME_LENGTH) {
				throw new ValidationError(
					400,
					`Filename too long (max. ${MAX_FILENAME_LENGTH} characters): ${name}`
				);
			}
			return name;
		};

		if (info && info._type === 'playlist' && Array.isArray(info.entries)) {
			// Expand playlist: handle each video individually
			for (const entry of info.entries) {
				const entryUrl = entry.url || entry.webpage_url || entry.id;
				const entryTitle = entry.title ?? null;
				if (!entryUrl) {
					// continue with next entry; missing URLs can occur
					continue;
				}

				// If the user provided a filename for the playlist input,
				// use it as the base; otherwise use entryTitle or a fallback.
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
			// Single video (also the case if getInfoAsync failed)
			const title = info && 'title' in info ? (info.title ?? null) : null;

			// If no fileName was explicitly provided, try the title, otherwise fall back to the URL
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
