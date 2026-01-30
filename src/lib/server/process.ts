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

	// Entferne Controller sofort aus Map — verhindert weitere Starts.
	controllers.delete(id);

	// Controller asynchron aborten, damit ein fehlerhafter listener nicht synchron ins Node-Stack wirft.
	try {
		setImmediate(() => {
			try {
				if (!controller.signal.aborted) controller.abort();
			} catch (err) {
				console.warn('AbortController.abort threw:', err);
			}
		});
	} catch {
		// Fallback synchronous abort (sehr unwahrscheinlich)
		try {
			if (!controller.signal.aborted) controller.abort();
		} catch (err2) {
			console.warn('Abort failed:', err2);
		}
	}

	// UI/Store sofort aktualisieren — download.ts behandelt den ChildProcess-Kill,
	// aber der sichtbare Status soll hier sofort 'abgebrochen' werden.
	await setStatus(id, 'error', 'Cancelled by user');
}

export async function processDownloads() {
	const list = get(downloads).filter((d) => d.status === 'pending');

	for (const item of list) {
		await setStatus(item.id, 'queued');

		const controller = new AbortController();
		controllers.set(item.id, controller);

		// Gib das Signal an startDownload weiter; task in queue nutzt ebenfalls dasselbe Signal.
		queue.add(async () => {
			await waitIfPaused();

			if (controller.signal.aborted) return;

			try {
				await startDownload(item, controller.signal);
			} catch (err) {
				// StartDownload meldet Fehler in store/db; hier kein zusätzliches Handling
				console.warn('startDownload failed for', item.id, err);
			}
		});
	}
}
