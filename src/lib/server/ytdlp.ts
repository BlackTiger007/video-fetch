import path from 'path';
import { YtDlp } from 'ytdlp-nodejs';

export const ytdlp = new YtDlp(
	import.meta.env.DEV
		? {
				binaryPath: path.resolve('./bin/yt-dlp.exe'),
				ffmpegPath: path.resolve('./bin/ffmpeg.exe')
			}
		: {
				binaryPath: '/usr/local/bin/yt-dlp',
				ffmpegPath: '/usr/local/bin/ffmpeg'
			}
);
