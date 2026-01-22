import { defaultConcurrency, maxConcurrency } from '$lib';
import { writable } from 'svelte/store';

/**
 * Liste aller Downloads, die aktuell in der Queue oder in Bearbeitung sind.
 * Jeder Eintrag ist vom Typ DownloadItem (enthält URL, optionalen Dateinamen, Status, Fortschritt etc.).
 */
export const downloads = writable<DownloadItem[]>([]);

/**
 * Anzahl paralleler Downloads.
 * Typisch: 1–3, initial auf 1 gesetzt.
 */
export const concurrency = writable(Math.min(defaultConcurrency, maxConcurrency));

/**
 * Flag, ob alle Downloads aktuell pausiert sind.
 * true → Downloads werden nicht gestartet, false → Downloads laufen wie erlaubt.
 */
export const paused = writable(false);
