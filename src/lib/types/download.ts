import type { Download } from '$lib/server/db/schema';
import type { VideoProgress } from 'ytdlp-nodejs';

export type DownloadStatus = 'pending' | 'queued' | 'downloading' | 'paused' | 'finished' | 'error';

export interface DownloadItem extends Download {
	progress: VideoProgress | null;
}

export interface DownloadUpdate {
	id: string;
	videoUrl: string;
	fileName: string | null;
	status: DownloadStatus;
	errorMessage: string | null;
	progress: VideoProgress | null;
}

export type DownloadQuality = 'highest' | 'lowest';

export type YtDlpFormat = {
	format?: string; // für -f
	sort?: string; // für -S
};
