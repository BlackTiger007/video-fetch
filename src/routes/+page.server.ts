// +page.server.ts
import { concurrency, downloads, paused } from '$lib/server/store';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { get } from 'svelte/store';
import { processDownloads } from '$lib/server/process';

export const load: PageServerLoad = () => {
	const download = get(downloads);
	const isPaused = get(paused);
	const parallelDownloads = get(concurrency);

	return {
		download,
		isPaused,
		parallelDownloads
	};
};

export const actions = {
	addUrl: async ({ request }) => {
		try {
			const formData = await request.formData();

			const videoUrl = formData.get('video_url')?.toString() || '';
			const filename = formData.get('filename')?.toString() || null;
			const appendTitle = formData.get('append_title') === 'on'; // Checkbox liefert "on" wenn angehakt
			const quality = (formData.get('quality')?.toString() as DownloadQuality) ?? 'best';

			const payload: DownloadItem = {
				videoUrl,
				filename,
				appendTitle,
				quality,
				status: 'pending',
				progress: 0
			};

			downloads.update((e) => [...e, payload]);

			// Ausgabe in der Konsole
			console.log('Neuer Download hinzugefügt:', payload);

			processDownloads();

			// Optional: Erfolgsmeldung zurück ans Frontend
			return { success: true };
		} catch (error) {
			return fail(400, { error: (error as Error).message });
		}
	},
	setPause: async ({ request }) => {
		try {
			const formData = await request.formData();

			const pause = formData.get('pause') === 'true'; // Checkbox liefert "on" wenn angehakt

			paused.set(pause);

			// Ausgabe in der Konsole
			console.log('Form payload:', pause);

			// Optional: Erfolgsmeldung zurück ans Frontend
			return { success: true };
		} catch (error) {
			return fail(400, { error: (error as Error).message });
		}
	},
	setConcurrency: async ({ request }) => {
		try {
			const formData = await request.formData();

			const newConcurrency = parseInt(formData.get('concurrency')?.toString() || '1', 10);

			concurrency.set(newConcurrency);

			// Ausgabe in der Konsole
			console.log('Form payload:', newConcurrency);

			// Optional: Erfolgsmeldung zurück ans Frontend
			return { success: true };
		} catch (error) {
			return fail(400, { error: (error as Error).message });
		}
	}
} satisfies Actions;
