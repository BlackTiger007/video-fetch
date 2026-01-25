import { spawn } from 'child_process';
import path from 'path';
import { DOWNLOAD_FOLDER } from './config';
import { mapQualityToFormat } from './ks';
import { setStatus } from './db';
import type { DownloadItem } from '$lib/types/download';
import { downloads } from './store';

export async function startDownload(item: DownloadItem, signal?: AbortSignal): Promise<void> {
	const ytDlpPath = path.resolve('./bin/yt-dlp.exe');

	let filename = item.fileName;
	if (!filename || filename.trim() === '') {
		filename = '%(title)s';
	}

	if (item.appendTitle && filename !== '%(title)s') {
		filename += ' - %(title)s';
	}

	const output = path.join(DOWNLOAD_FOLDER, `${filename}.%(ext)s`);
	const qualityArgs = mapQualityToFormat(item.quality);

	await setStatus(item.id, 'downloading');

	return new Promise<void>((resolve, reject) => {
		const args: string[] = [item.videoUrl];

		if (qualityArgs.format) args.push('-f', qualityArgs.format);
		if (qualityArgs.sort) args.push('-S', qualityArgs.sort);

		args.push('-o', output, '--newline', '--no-playlist');

		const proc = spawn(import.meta.env.DEV ? ytDlpPath : 'yt-dlp', args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true
		});

		/* ============================
		   Abort / Cancel Handling
		   ============================ */
		const abortHandler = () => {
			if (!proc.killed) {
				proc.kill('SIGTERM'); // unter Windows ausreichend
			}
		};

		if (signal) {
			if (signal.aborted) {
				abortHandler();
				return reject(new Error('aborted'));
			}
			signal.addEventListener('abort', abortHandler, { once: true });
		}

		/* ============================
		   stdout (Progress)
		   ============================ */
		proc.stdout.on('data', (data) => {
			const lines = data.toString().split('\n');

			for (const line of lines) {
				const regex =
					/(\d+(?:\.\d+)?)%.*?at\s+([\d.]+[KMG]?i?B\/s).*?ETA\s+(\S+)(?:.*?\(frag\s+(\d+)\/(\d+)\))?/;

				const match = line.match(regex);
				if (!match) continue;

				const [, progressStr, speedStr, etaStr, fragCur, fragTotal] = match;

				downloads.update((items) =>
					items.map((d) =>
						d.id === item.id
							? {
									...d,
									progress: parseFloat(progressStr),
									speed: speedStr,
									eta: etaStr,
									fragment:
										fragCur && fragTotal ? { current: +fragCur, total: +fragTotal } : undefined
								}
							: d
					)
				);
			}
		});

		/* ============================
		   stderr (Errors)
		   ============================ */
		proc.stderr.on('data', (data) => {
			const msg = data.toString();
			console.error('[yt-dlp]', msg);

			downloads.update((items) =>
				items.map((i) => (i.id === item.id ? { ...i, errorMessage: msg.slice(0, 1000) } : i))
			);
		});

		/* ============================
		   Process exit
		   ============================ */
		proc.on('close', async (code) => {
			signal?.removeEventListener('abort', abortHandler);

			if (signal?.aborted) {
				await setStatus(item.id, 'error'); // oder 'cancelled'
				return resolve();
			}

			if (code === 0) {
				await setStatus(item.id, 'finished');
				resolve();
			} else {
				await setStatus(item.id, 'error');
				reject(new Error(`Download failed with code ${code}`));
			}
		});
	});
}
