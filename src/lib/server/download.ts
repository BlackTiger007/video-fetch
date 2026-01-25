import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { DOWNLOAD_FOLDER } from './config';
import { mapQualityToFormat } from './ks';
import { setStatus } from './db';
import type { DownloadItem } from '$lib/types/download';
import { downloads } from './store';

export async function startDownload(item: DownloadItem, signal?: AbortSignal): Promise<void> {
	const ytDlpPath = path.resolve('./bin/yt-dlp.exe');

	let filename = item.fileName;
	if (!filename || filename.trim() === '') filename = '%(title)s';
	if (item.appendTitle && filename !== '%(title)s') filename += ' - %(title)s';

	const output = path.join(DOWNLOAD_FOLDER, `${filename}.%(ext)s`);
	const qualityArgs = mapQualityToFormat(item.quality);

	await setStatus(item.id, 'downloading');

	return new Promise<void>((resolve) => {
		const args: string[] = [item.videoUrl];
		if (qualityArgs.format) args.push('-f', qualityArgs.format);
		if (qualityArgs.sort) args.push('-S', qualityArgs.sort);
		args.push('-o', output, '--newline', '--no-playlist');

		const proc = spawn(import.meta.env.DEV ? ytDlpPath : 'yt-dlp', args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true
		});

		// Abort
		const abortHandler = async () => {
			try {
				if (!proc.killed) {
					if (process.platform === 'win32') {
						// Windows: Nutze taskkill, um yt-dlp.exe + evtl. Kindprozesse zu beenden
						const { exec } = await import('child_process');
						exec(`taskkill /PID ${proc.pid} /T /F`);
					} else {
						// Linux/macOS
						proc.kill('SIGKILL');
					}
				}
			} catch (err) {
				console.warn('Failed to kill child process on abort:', err);
			}
		};

		if (signal) {
			if (signal.aborted) {
				// falls Signal bereits abgebrochen ist -> sofort beenden
				try {
					abortHandler();
				} catch {
					// ignorieren
				}
				downloads.update((items) =>
					items.map((d) =>
						d.id === item.id ? { ...d, status: 'error', errorMessage: 'aborted' } : d
					)
				);
				return resolve();
			}
			// hinzufügt Listener (einmalig)
			try {
				signal?.addEventListener(
					'abort',
					() => {
						setImmediate(() => abortHandler());
					},
					{ once: true }
				);
			} catch (err) {
				console.warn('Failed to add abort listener:', err);
			}
		}

		// Prozess Ende
		proc.on('close', async (code) => {
			// safe remove listener
			try {
				signal?.removeEventListener('abort', abortHandler);
			} catch {
				// ignorieren
			}

			// ... Rest bleibt gleich
			if (signal?.aborted) {
				await setStatus(item.id, 'error');
				downloads.update((items) =>
					items.map((d) =>
						d.id === item.id ? { ...d, errorMessage: 'Vom Benutzer abgebrochen' } : d
					)
				);
				return resolve();
			}

			if (code === 0) {
				// ---- Datei-Info ermitteln ----
				const files = fs.readdirSync(DOWNLOAD_FOLDER);
				const downloadedFile = files.find((f) => f.includes(filename.split(' - ')[0]));
				if (downloadedFile) {
					const stats = fs.statSync(path.join(DOWNLOAD_FOLDER, downloadedFile));
					downloads.update((items) =>
						items.map((d) =>
							d.id === item.id
								? {
										...d,
										fileName: downloadedFile,
										size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
									}
								: d
						)
					);
				}
				await setStatus(item.id, 'finished');
			}
			resolve();
		});
	});
}
