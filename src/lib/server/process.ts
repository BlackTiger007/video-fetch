import PQueue from 'p-queue';
import { concurrency, downloads, paused } from '$lib/server/store';
import { get } from 'svelte/store';
import { startDownload } from './download';

const initialConcurrency = Number(get(concurrency) ?? 1);
const queue = new PQueue({ concurrency: initialConcurrency });

concurrency.subscribe((value) => {
	queue.concurrency = Number(value) || 1;
});

paused.subscribe((isPaused) => {
	if (isPaused) queue.pause();
	else queue.start();
});

function waitIfPaused() {
	return new Promise<void>((resolve) => {
		const check = () => {
			if (!get(paused)) resolve();
			else setTimeout(check, 500);
		};
		check();
	});
}

export function processDownloads() {
	const list = get(downloads).filter((d) => d.status === 'pending');

	for (const item of list) {
		// Prevent double-adding
		item.status = 'queued';

		queue.add(async () => {
			await waitIfPaused();
			try {
				await startDownload(item);
			} catch (err) {
				console.error('startDownload error', err);
				item.status = 'error';
			}
		});
	}
}
