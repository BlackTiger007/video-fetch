import type { Download } from '$lib/server/db/schema';

export type DownloadStatus = 'pending' | 'queued' | 'downloading' | 'paused' | 'finished' | 'error';

interface fragment {
	current: number;
	total: number;
}

export interface DownloadItem extends Download {
	progress: number; // 0-100%
	speed?: string;
	eta?: string;
	fragment?: fragment;
}

export interface DownloadUpdate {
	id: string;
	fileName: string | null;
	status: DownloadStatus;
	errorMessage: string | null;
	progress: number; // 0-100
	speed?: string;
	eta?: string;
	size?: string;
	fragment?: fragment;
}

export type DownloadQuality =
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

export type YtDlpFormat = {
	format?: string; // für -f
	sort?: string; // für -S
};
