import { defaultConcurrency, maxConcurrency } from '$lib';
import { writable } from 'svelte/store';
import { db } from './db/index';
import { downloads as downloadsSchema } from './db/schema';
import type { DownloadItem } from '$lib/types/download';
import { processDownloads, setConcurrency, setPause } from './process';
import { inArray } from 'drizzle-orm';

/**
 * Liste aller Downloads, die aktuell in der Queue oder in Bearbeitung sind.
 * Jeder Eintrag ist vom Typ DownloadItem (enthält URL, optionalen Dateinamen, Status, Fortschritt etc.).
 */
export const downloads = writable<DownloadItem[]>([]);

(async () => {
	// Alle "hängenden" Downloads als Fehler markieren
	await db
		.update(downloadsSchema)
		.set({
			status: 'error',
			errorMessage: 'Download wurde durch einen Neustart oder Absturz beendet.'
		})
		.where(inArray(downloadsSchema.status, ['downloading', 'queued', 'pending']));

	// Neu aus DB laden
	const items = await db.select().from(downloadsSchema);

	downloads.set(
		items.map((item) => ({
			...item,
			progress: null
		}))
	);

	// Queue neu starten (nur pending Downloads werden berücksichtigt)
	void processDownloads();
})();

/**
 * Anzahl paralleler Downloads.
 * Typisch: 1–3, initial auf 1 gesetzt.
 */
export const concurrency = writable(Math.min(defaultConcurrency, maxConcurrency));

concurrency.subscribe((value) => {
	setConcurrency(value);
});

/**
 * Flag, ob alle Downloads aktuell pausiert sind.
 * true → Downloads werden nicht gestartet, false → Downloads laufen wie erlaubt.
 */
export const paused = writable(false);

paused.subscribe((isPaused) => {
	setPause(isPaused);
});
