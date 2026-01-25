import PQueue from 'p-queue';
import { downloads, paused } from '$lib/server/store';
import { get } from 'svelte/store';
import { startDownload } from './download';
import { setStatus } from './db';

const queue = new PQueue({ concurrency: 1 });

// Map: Download-ID → AbortController
const controllers = new Map<string, AbortController>();

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

export async function removeFromQueue(id: string) {
	const controller = controllers.get(id);
	if (!controller) return;

	controller.abort(); // Task abbrechen
	controllers.delete(id); // Cleanup

	downloads.update((items) =>
		items.map((i) => (i.id === id ? { ...i, errorMessage: 'User cancelled' } : i))
	);

	await setStatus(id, 'error'); // oder 'cancelled'
}

export async function processDownloads() {
	const list = get(downloads).filter((d) => d.status === 'pending');

	for (const item of list) {
		await setStatus(item.id, 'queued');

		const controller = new AbortController();
		controllers.set(item.id, controller);

		queue.add(
			async ({ signal }) => {
				await waitIfPaused();

				if (signal?.aborted) {
					throw new Error('aborted');
				}

				try {
					await startDownload(item, signal);
				} catch (err) {
					if (signal?.aborted) {
						await setStatus(item.id, 'error'); // oder 'cancelled'
						return;
					}
					throw err;
				}
			},
			{ signal: controller.signal }
		);
	}
}
