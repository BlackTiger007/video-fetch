import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { prepareDownloadItems, ValidationError } from '$lib/server/downloads-helper';
import { addDownloads } from '$lib/server/db';
import { processDownloads } from '$lib/server/process';

export const actions: Actions = {
	addUrl: async ({ request }) => {
		try {
			const formData = await request.formData();
			const videoUrl = (formData.get('video_url')?.toString() || '').trim();
			const fileName = formData.get('filename')?.toString() || null;
			const appendTitle = formData.get('append_title') === 'on';
			const quality = formData.get('quality')?.toString() ?? 'highest';

			const items = await prepareDownloadItems({
				videoUrl,
				fileName,
				appendTitle,
				quality
			});

			await addDownloads(items);
			void processDownloads();
		} catch (err) {
			if (err instanceof ValidationError) return fail(err.status, { error: err.message });
			return fail(400, { error: (err as Error).message });
		}

		redirect(302, '/');
	},

	importBatch: async ({ request }) => {
		try {
			const formData = await request.formData();
			const file = formData.get('import_file') as File | null;
			const text = formData.get('import_text')?.toString() || '';

			let content = '';
			if (text.trim()) content = text;
			else if (file && file.size > 0) content = await file.text();

			if (!content.trim()) return fail(400, { error: 'No import data found' });

			const lines = content
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter(Boolean);
			if (lines.length === 0) return fail(400, { error: 'No valid lines found' });

			// Create input array for prepareDownloadItems
			const raw: Array<{ videoUrl: string; fileName?: string | null }> = lines.map((line) => {
				const [url, filename] = line.split('\t');
				return { videoUrl: (url || '').trim(), fileName: (filename || '').trim() || null };
			});

			const items = await prepareDownloadItems(raw);
			await addDownloads(items);
			void processDownloads();
		} catch (err) {
			if (err instanceof ValidationError) return fail(err.status, { error: err.message });
			return fail(400, { error: (err as Error).message });
		}

		redirect(302, '/');
	}
};
