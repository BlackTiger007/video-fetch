import PQueue from 'p-queue';
import { concurrency, downloads, paused } from '$lib/server/store.svelte';
import { get } from 'svelte/store';
import { startDownload } from './download';

const queue = new PQueue({ concurrency: get(concurrency) });

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
	const list = downloads.filter((d) => d.status === 'pending');

	list.forEach((item) => {
		queue.add(async () => {
			await waitIfPaused();
			item.status = 'downloading';
			await startDownload(item);
		});
	});
}
