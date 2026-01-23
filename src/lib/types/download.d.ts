type DownloadStatus = 'pending' | 'downloading' | 'queued' | 'paused' | 'finished' | 'error';

type DownloadItem = {
	videoUrl: string;
	filename: string | null;
	appendTitle: boolean;
	quality: DownloadQuality;
	status: DownloadStatus;
	progress: number; // 0-100%
	downloadedBytes?: number;
	totalBytes?: number;
	speed?: string;
	eta?: string;
	finishedAt?: number;
};

interface DownloadUpdate {
	filename: string | null;
	status: DownloadStatus;
	progress: number; // 0-100
	speed?: string;
	eta?: string;
	size?: string;
}

type DownloadQuality =
	| 'best'
	| 'worst'
	| '2160p'
	| '1440p'
	| '1080p'
	| '720p'
	| '480p'
	| '360p'
	| '240p'
	| 'audio';

type YtDlpFormat = {
	format?: string; // für -f
	sort?: string; // für -S
};
