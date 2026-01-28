import { addDownloads } from '$lib/server/db';
import type { DownloadAdd } from '$lib/server/db/schema';
import { processDownloads } from '$lib/server/process';
import { sanitizeFilename } from '$lib/server/utils';
import type { RequestHandler } from './$types';

const urlPattern = /^(https?:\/\/).+$/i;

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();

	if (!Array.isArray(data)) {
		return new Response(JSON.stringify({ error: 'Ungültige Datenformatierung' }), { status: 400 });
	}

	const items: DownloadAdd[] = [];

	for (const [index, download] of data.entries()) {
		const videoUrl = (download.videoUrl || '').trim();
		let fileName = (download.fileName || '').trim() || null;
		const appendTitle = download.appendTitle ?? false;
		const quality = download.quality ?? 'highest';

		if (!videoUrl) {
			return new Response(JSON.stringify({ error: `Leere URL in Zeile ${index}` }), {
				status: 400
			});
		}

		if (!urlPattern.test(videoUrl)) {
			return new Response(JSON.stringify({ error: `Ungültige URL in Zeile ${index}` }), {
				status: 400
			});
		}

		if (fileName) {
			fileName = sanitizeFilename(fileName);
			if (fileName.length > 250) {
				return new Response(
					JSON.stringify({ error: `Dateiname zu lang in Zeile ${index} (max. 250 Zeichen)` }),
					{ status: 400 }
				);
			}
		}

		items.push({
			videoUrl,
			fileName,
			appendTitle,
			quality,
			status: 'pending'
		});
	}

	await addDownloads(items);
	void processDownloads();

	return new Response(JSON.stringify({ message: 'Downloads added to queue' }), { status: 201 });
};
