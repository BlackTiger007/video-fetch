import type { DownloadQuality, DownloadStatus } from '$lib/types/download';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const downloads = sqliteTable(
	'downloads',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		videoUrl: text('video_url').notNull(),
		fileName: text('file_name'),
		appendTitle: integer('append_title', { mode: 'boolean' }).notNull(),
		quality: text('quality').notNull().$type<DownloadQuality>(),
		status: text('status').notNull().$type<DownloadStatus>(),
		errorMessage: text('error_message'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$onUpdateFn(() => new Date()),
		finishedAt: integer('finished_at', { mode: 'timestamp' })
	},
	(t) => [uniqueIndex('uq_downloads_video_url').on(t.videoUrl)]
);

export type DownloadAdd = typeof downloads.$inferInsert;
export type Download = typeof downloads.$inferSelect;
