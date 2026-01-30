import { exec as execChild } from 'child_process';
import path from 'path';
import { DOWNLOAD_FOLDER } from './config';
import { setStatus } from './db';
import type { DownloadItem } from '$lib/types/download';
import { downloads } from './store';
import { ytdlp } from './ytdlp';
import type { VideoProgress } from 'ytdlp-nodejs';

export async function startDownload(item: DownloadItem, signal?: AbortSignal): Promise<void> {
	const output = path.join(DOWNLOAD_FOLDER, `${item.fileName}.%(ext)s`);
	const stderrBuffer: string[] = [];

	await setStatus(item.id, 'downloading');

	const result = ytdlp.download(item.videoUrl, {
		output: output,
		progress: true,
		abortOnError: true
		// format: {
		// 	filter: 'mergevideo',
		// 	quality: item.quality ?? undefined
		// }
	});

	// stderr sammeln
	result.stderr.on('data', (data) => {
		const msg = data.toString().trim();
		if (msg) {
			stderrBuffer.push(msg);
			console.error('[yt-dlp]', msg);
		}
	});

	result.on('progress', (progress: VideoProgress) => {
		downloads.update((items) =>
			items.map((d) => (d.id === item.id ? { ...d, progress: progress } : d))
		);
	});

	result.on('close', (code, closeSignal) => {
		if (code === 0 && closeSignal === null) {
			// Download war technisch erfolgreich
			setStatus(item.id, 'finished');
		} else {
			// Fehler beim Download
			setStatus(item.id, 'error', stderrBuffer.filter((v) => v.startsWith('ERROR')).join('\n'));
		}

		// Listener entfernen (falls noch vorhanden)
		try {
			signal?.removeEventListener('abort', onAbort);
		} catch {
			// ignorieren
		}
	});

	// robustes Beenden des Child-Prozesses
	const killProcess = () => {
		try {
			if (!result.killed) {
				if (process.platform === 'win32') {
					// Windows: taskkill + Kindprozesse
					try {
						execChild(`taskkill /PID ${result.pid} /T /F`, (err) => {
							if (err) console.warn('taskkill failed:', err);
						});
					} catch (err) {
						console.warn('taskkill exec failed:', err);
					}
				} else {
					// Unix: SIGKILL
					result.kill('SIGKILL');
				}
			}
		} catch (err) {
			console.warn('Failed to kill child process on abort:', err);
		}
	};

	const onAbort = () => {
		// kill im nächsten Tick, um möglichen Sync-Problemen aus dem Weg zu gehen
		setImmediate(killProcess);
	};

	// Falls das Signal schon abgebrochen ist -> kill und still resolve (Status wurde von caller gesetzt)
	if (signal?.aborted) {
		onAbort();
		return;
	}

	// Register Abort-Listener (einmalig)
	if (signal) {
		signal.addEventListener('abort', onAbort, { once: true });
	} else {
		console.warn('Kein Abbruch signal');
	}
}
