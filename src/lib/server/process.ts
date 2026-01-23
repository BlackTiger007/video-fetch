import PQueue from 'p-queue';
import { downloads, paused } from '$lib/server/store';
import { get } from 'svelte/store';
import { startDownload } from './download';
import { setStatus } from './db';

const queue = new PQueue({ concurrency: 1 });

export function setConcurrency(value: number) {
	queue.concurrency = Number(value) || 1;
}

export function setPause(isPaused: boolean) {
	if (isPaused) queue.pause();
	else queue.start();
}

function waitIfPaused() {
	return new Promise<void>((resolve) => {
		const check = () => {
			if (!get(paused)) resolve();
			else setTimeout(check, 500);
		};
		check();
	});
}

export async function processDownloads() {
	const list = get(downloads).filter((d) => d.status === 'pending');

	for (const item of list) {
		// Prevent double-adding
		await setStatus(item.id, 'queued');

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
