import { spawn } from 'child_process';
import path from 'path';
import { DOWNLOAD_FOLDER } from './config';
import { mapQualityToFormat } from './ks';

export async function startDownload(item: DownloadItem) {
	const ytDlpPath = path.resolve('./bin/yt-dlp.exe');

	// Standard-Dateiname
	let filename = item.filename;
	if (!filename || filename.trim() === '') {
		filename = '%(title)s';
	}

	if (item.appendTitle && filename !== '%(title)s') {
		filename += ' - %(title)s';
	}

	const output = path.join(DOWNLOAD_FOLDER, `${filename}.%(ext)s`);
	const qualityArgs = mapQualityToFormat(item.quality);

	item.status = 'downloading';
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
				const progressMatch = line.match(/(\d+(?:\.\d+)?)%.*?ETA\s+(\S+)/);
				const speedMatch = line.match(/([\d.]+[KMG]?i?B\/s)/);

				if (progressMatch) {
					item.progress = parseFloat(progressMatch[1]);
					item.eta = progressMatch[2];
				}

				if (speedMatch) {
					item.speed = speedMatch[1];
				}
			}
		});

		// stderr nur loggen
		proc.stderr.on('data', (data) => {
			console.error('[yt-dlp]', data.toString());
		});

		// Prozess beendet
		proc.on('close', (code) => {
			// Status setzen
			if (code === 0) {
				item.status = 'finished';
				item.finishedAt = Date.now();
				item.progress = 100;

				if (!item.filename || item.filename.trim() === '') {
					item.filename = filename.replace(/%\(.+?\)s/g, '').trim();
				}

				resolve();
			} else {
				item.status = 'error';
				reject(new Error(`Download failed with code ${code}`));
			}

			// **Aufräumen nach Prozessende**
			proc.stdout.destroy();
			proc.stderr.destroy();
			proc.removeAllListeners();
		});
	});
}
