export function mapQualityToFormat(quality: DownloadQuality): YtDlpFormat {
	switch (quality) {
		case 'best':
			return { format: 'bestvideo*+bestaudio/best' };

		case 'worst':
			// KEIN -f → verhindert HLS-Crash
			return { sort: '+res,+br,+size' };

		case 'audio':
			return { format: 'bestaudio' };

		default: {
			// z. B. "1080p" → height<=1080
			const height = parseInt(quality.replace('p', ''), 10);

			// Für HLS/Streams einfach "best[height<=XYZ]" verwenden
			return { format: `best[height<=${height}]` };
		}
	}
}
