import { spawn } from 'child_process';
import path from 'path';
import { DOWNLOAD_FOLDER } from './config';
import { mapQualityToFormat } from './ks';

export async function startDownload(item: DownloadItem) {
	const ytDlpPath = path.resolve('./bin/yt-dlp.exe');

	// Wenn kein Dateiname angegeben, verwende Titel
	let filename = item.filename;
	if (!filename || filename.trim() === '') {
		filename = '%(title)s';
	}

	// Falls appendTitle aktiv ist, hänge Titel an (wenn filename != title, z.B. vom User gesetzt)
	if (item.appendTitle && filename !== '%(title)s') {
		filename += ' - %(title)s';
	}

	const output = path.join(DOWNLOAD_FOLDER, `${filename}.%(ext)s`);

	// Qualität: Format + Sortierung
	const qualityArgs = mapQualityToFormat(item.quality);

	item.status = 'downloading';
	item.progress = 0;

	return new Promise<void>((resolve, reject) => {
		const args: string[] = [item.videoUrl];

		// Format setzen
		if (qualityArgs.format) args.push('-f', qualityArgs.format);
		if (qualityArgs.sort) args.push('-S', qualityArgs.sort);

		args.push('-o', output, '--newline', '--no-playlist');

		const proc = spawn(import.meta.env.DEV ? ytDlpPath : 'yt-dlp', args);

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

		proc.stderr.on('data', (data) => {
			console.error('[yt-dlp]', data.toString());
		});

		proc.on('close', (code) => {
			if (code === 0) {
				item.status = 'finished';
				item.finishedAt = Date.now();
				item.progress = 100;

				// Stelle sicher, dass filename nie null ist
				if (!item.filename || item.filename.trim() === '') {
					item.filename = filename.replace(/%\(.+?\)s/g, '').trim(); // Entfernt Platzhalter
				}

				resolve();
			} else {
				item.status = 'error';
				reject(new Error(`Download failed with code ${code}`));
			}
		});
	});
}
