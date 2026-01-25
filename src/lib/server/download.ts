import { spawn } from 'child_process';
import path from 'path';
import { DOWNLOAD_FOLDER } from './config';
import { mapQualityToFormat } from './ks';
import { setStatus } from './db';
import type { DownloadItem } from '$lib/types/download';
import { downloads } from './store';

export async function startDownload(item: DownloadItem) {
	const ytDlpPath = path.resolve('./bin/yt-dlp.exe');

	// Standard-Dateiname
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
	item.progress = 0;

	return new Promise<void>((resolve, reject) => {
		const args: string[] = [item.videoUrl];

		if (qualityArgs.format) args.push('-f', qualityArgs.format);
		if (qualityArgs.sort) args.push('-S', qualityArgs.sort);

		args.push('-o', output, '--newline', '--no-playlist');

		const proc = spawn(import.meta.env.DEV ? ytDlpPath : 'yt-dlp', args, {
			stdio: ['ignore', 'pipe', 'pipe'], // stdin ignorieren, stdout/stderr als Stream
			windowsHide: true
		});

		// stdout nur relevante Zeilen
		proc.stdout.on('data', (data) => {
			const lines = data.toString().split('\n');

			for (const line of lines) {
				const regex =
					/(\d+(?:\.\d+)?)%.*?at\s+([\d.]+[KMG]?i?B\/s).*?ETA\s+(\S+)(?:.*?\(frag\s+(\d+)\/(\d+)\))?/;
				const match = line.match(regex);

				if (match) {
					const [, progressStr, speedStr, etaStr, fragNumStr, fragTotalStr] = match;

					downloads.update((items) =>
						items.map((d) =>
							d.id === item.id
								? {
										...d,
										progress: parseFloat(progressStr),
										speed: speedStr,
										eta: etaStr,
										fragment:
											fragNumStr && fragTotalStr
												? { current: +fragNumStr, total: +fragTotalStr }
												: undefined
									}
								: d
						)
					);
				}
			}
		});

		// stderr nur loggen
		proc.stderr.on('data', (data) => {
			console.error('[yt-dlp]', data.toString());
			downloads.update((items) =>
				items.map((i) =>
					i.id === item.id ? { ...i, errorMessage: data.toString().slice(0, 1000) } : i
				)
			);
		});

		// Prozess beendet
		proc.on('close', async (code) => {
			// Status setzen
			if (code === 0) {
				await setStatus(item.id, 'finished');

				resolve();
			} else {
				await setStatus(item.id, 'error');
				reject(new Error(`Download failed with code ${code}`));
			}

			// **Aufräumen nach Prozessende**
			proc.stdout.destroy();
			proc.stderr.destroy();
			proc.removeAllListeners();
		});
	});
}
