import type { DownloadQuality, YtDlpFormat } from '$lib/types/download';

export function mapQualityToFormat(quality: DownloadQuality): YtDlpFormat {
	switch (quality) {
		case 'highest':
			return { format: 'bestvideo*+bestaudio/best' };

		case 'lowest':
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
