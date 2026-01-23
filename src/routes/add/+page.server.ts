import { downloads } from '$lib/server/store';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { processDownloads } from '$lib/server/process';

const urlPattern = /^(https?:\/\/).+$/i;

export const actions: Actions = {
	addUrl: async ({ request }) => {
		try {
			const formData = await request.formData();

			const videoUrl = formData.get('video_url')?.toString() || '';
			const filename = formData.get('filename')?.toString() || null;
			const appendTitle = formData.get('append_title') === 'on';
			const quality = (formData.get('quality')?.toString() as DownloadQuality) ?? 'best';

			if (!urlPattern.test(videoUrl)) {
				return fail(400, { error: 'Ungültige URL' });
			}

			if (filename && filename.length > 50) {
				return fail(400, { error: 'Dateiname zu lang (max. 50 Zeichen)' });
			}

			const payload: DownloadItem = {
				videoUrl,
				filename,
				appendTitle,
				quality,
				status: 'pending',
				progress: 0
			};

			downloads.update((e) => [...e, payload]);

			processDownloads();
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

			const items: DownloadItem[] = [];

			for (const [index, line] of lines.entries()) {
				const cols = line.split('\t');
				const videoUrl = (cols[0] || '').trim();
				const filename = (cols[1] || '').trim() || null;

				if (!videoUrl) {
					return fail(400, { error: `Leere URL in Zeile ${index + 1}` });
				}

				if (!urlPattern.test(videoUrl)) {
					return fail(400, { error: `Ungültige URL in Zeile ${index + 1}: ${videoUrl}` });
				}

				if (filename && filename.length > 250) {
					return fail(400, { error: `Dateiname zu lang in Zeile ${index + 1}` });
				}

				items.push({
					videoUrl,
					filename,
					appendTitle: false,
					quality: 'best',
					status: 'pending',
					progress: 0
				});
			}

			downloads.update((e) => [...e, ...items]);
			processDownloads();
		} catch (error) {
			return fail(400, { error: (error as Error).message });
		}

		redirect(302, '/');
	}
};
