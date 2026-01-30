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
		output,
		progress: true,
		abortOnError: true
	});

	let finished = false;

	/** Abort-Handler MUSS vor cleanup existieren */
	const onAbort = () => {
		if (finished) return;

		setImmediate(() => {
			try {
				if (!result.killed) {
					if (process.platform === 'win32') {
						execChild(`taskkill /PID ${result.pid} /T /F`, () => {});
					} else {
						result.kill('SIGKILL');
					}
				}
			} catch (err) {
				console.warn('Failed to kill child process:', err);
			}
		});
	};

	const cleanup = () => {
		try {
			result.stderr?.removeAllListeners('data');
			result.removeAllListeners('progress');
			result.removeAllListeners('close');
			signal?.removeEventListener('abort', onAbort);
		} catch {
			/* ignore */
		}
	};

	result.stderr?.on('data', (data) => {
		const msg = data.toString().trim();
		if (msg) {
			stderrBuffer.push(msg);
			console.error('[yt-dlp]', msg);
		}
	});

	result.on('progress', (progress: VideoProgress) => {
		downloads.update((items) => items.map((d) => (d.id === item.id ? { ...d, progress } : d)));
	});

	return await new Promise<void>((resolve) => {
		result.on('close', async (code, closeSignal) => {
			if (finished) return;
			finished = true;

			const ok = code === 0 && closeSignal === null;
			const errorMsg = stderrBuffer.filter((v) => v.startsWith('ERROR')).join('\n') || undefined;

			if (ok) {
				await setStatus(item.id, 'finished');
			} else {
				await setStatus(item.id, 'error', errorMsg);
			}

			cleanup();
			resolve();
		});

		if (signal) {
			if (signal.aborted) {
				onAbort();
				cleanup();
				resolve();
				return;
			}
			signal.addEventListener('abort', onAbort, { once: true });
		}
	});
}
