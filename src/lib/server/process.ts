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

	// Abort asynchron, und in try/catch einbetten, damit ein eventuell
	// fehlerhafter 'abort' listener nicht synchron die Node-Process beendet.
	try {
		setImmediate(() => {
			try {
				if (!controller.signal.aborted) controller.abort();
			} catch (err) {
				// Nur loggen — nicht throwen.
				console.warn('AbortController.abort threw:', err);
			}
		});
	} catch {
		// Fallback: falls setImmediate nicht verfügbar ist (sehr unwahrscheinlich),
		// versuche trotzdem abort in geschütztem Block.
		try {
			if (!controller.signal.aborted) controller.abort();
		} catch (err2) {
			console.warn('Abort failed:', err2);
		}
	}

	controllers.delete(id);

	downloads.update((items) =>
		items.map((i) =>
			i.id === id ? { ...i, status: 'error', errorMessage: 'Vom Benutzer abgebrochen' } : i
		)
	);

	await setStatus(id, 'error');
}

export async function processDownloads() {
	const list = get(downloads).filter((d) => d.status === 'pending');

	for (const item of list) {
		await setStatus(item.id, 'queued');

		const controller = new AbortController();
		controllers.set(item.id, controller);

		// WICHTIG: wir geben das gleiche controller.signal an queue *und* an startDownload,
		// damit alle Listener das gleiche Signal verwenden.
		queue.add(async () => {
			await waitIfPaused();

			// controller.signal hier bevorzugen, weil wir controller.abort() verwenden.
			if (controller.signal.aborted) return;

			try {
				await startDownload(item, controller.signal);
			} catch {
				// doppelte Behandlung unnötig
			}
		});
	}
}
