import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { processDownloads } from '$lib/server/process';
import { addDownload, addDownloads } from '$lib/server/db';
import { sanitizeFilename } from '$lib/server/utils';
import type { DownloadAdd } from '$lib/server/db/schema';
import type { DownloadQuality } from '$lib/types/download';
import { ytdlp } from '$lib/server/ytdlp';

const urlPattern = /^(https?:\/\/).+$/i;

export const actions: Actions = {
	addUrl: async ({ request }) => {
		try {
			const formData = await request.formData();

			const videoUrl = formData.get('video_url')?.toString() || '';
			let fileName = formData.get('filename')?.toString() || null;
			const appendTitle = formData.get('append_title') === 'on';
			const quality = (formData.get('quality')?.toString() as DownloadQuality) ?? 'highest';

			if (!urlPattern.test(videoUrl)) {
				return fail(400, { error: 'Ungültige URL' });
			}

			if (fileName) fileName = sanitizeFilename(fileName);
			if (fileName && fileName.length > 250) {
				return fail(400, { error: 'Dateiname zu lang (max. 250 Zeichen)' });
			}

			const videoInfos = await ytdlp.getInfoAsync(videoUrl);

			console.log('playlist:', videoInfos._type === 'playlist');

			if (!fileName || fileName.trim() === '') fileName = videoInfos.title;
			if (appendTitle && fileName !== videoInfos.title) fileName += ' - ' + videoInfos.title;

			if (fileName) fileName = sanitizeFilename(fileName);
			else fileName = '%(title)s';

			console.log('fileName:', fileName);

			if (videoInfos._type === 'video') {
				await addDownload({
					videoUrl,
					fileName,
					appendTitle,
					quality,
					status: 'pending'
				});

				void processDownloads();
			}
		} catch (error) {
			return fail(400, { error: (error as Error).message });
		}

		redirect(302, '/');
	},

	importBatch: async ({ request }) => {
		try {
			const formData = await request.formData();
			const file = formData.get('import_file') as File | null;
			const text = formData.get('import_text')?.toString() || '';

			let content = '';

			// WICHTIG: Textarea hat Vorrang vor Datei
			if (text.trim()) {
				content = text;
			} else if (file && file.size > 0) {
				// Datei ist .txt mit Tab-getrennten Werten: url	filename
				content = await file.text();
			}

			if (!content.trim()) {
				return fail(400, { error: 'Keine Importdaten gefunden' });
			}

			const lines = content
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter(Boolean);
			if (lines.length === 0) return fail(400, { error: 'Keine gültigen Zeilen gefunden' });

			const items: DownloadAdd[] = [];

			for (const [index, line] of lines.entries()) {
				const cols = line.split('\t');
				const videoUrl = (cols[0] || '').trim();
				let fileName = (cols[1] || '').trim() || null;

				if (!videoUrl) {
					return fail(400, { error: `Leere URL in Zeile ${index + 1}` });
				}

				if (!urlPattern.test(videoUrl)) {
					return fail(400, { error: `Ungültige URL in Zeile ${index + 1}: ${videoUrl}` });
				}

				if (fileName) fileName = sanitizeFilename(fileName);
				if (fileName && fileName.length > 250) {
					return fail(400, { error: `Dateiname zu lang in Zeile ${index + 1}` });
				}

				items.push({
					videoUrl,
					fileName: fileName,
					appendTitle: false,
					quality: 'highest',
					status: 'pending'
				});
			}

			await addDownloads(items);
			void processDownloads();
		} catch (error) {
			return fail(400, { error: (error as Error).message });
		}

		redirect(302, '/');
	}
};
