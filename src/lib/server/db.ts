import { eq } from 'drizzle-orm';
import { db } from './db/index';
import { downloads as downloadsSchema } from './db/schema';
import { downloads } from './store';
import type { DownloadStatus } from '$lib/types/download';

export async function addDownload(download: typeof downloadsSchema.$inferInsert) {
	const newDownload = await db.insert(downloadsSchema).values(download).returning();

	downloads.update((d) => [...d, ...newDownload.map((item) => ({ ...item, progress: 0 }))]);
}

export async function addDownloads(download: (typeof downloadsSchema.$inferInsert)[]) {
	const newDownloads = await db.insert(downloadsSchema).values(download).returning();

	downloads.update((d) => [...d, ...newDownloads.map((item) => ({ ...item, progress: 0 }))]);
}

export async function setStatus(id: string, status: DownloadStatus) {
	const now = new Date();

	// 1️⃣ Update Store
	downloads.update((items) =>
		items.map((item) =>
			item.id === id
				? { ...item, status, finishedAt: status === 'finished' ? now : item.finishedAt }
				: item
		)
	);

	// 2️⃣ Update DB (await!)
	await db
		.update(downloadsSchema)
		.set({
			status,
			updatedAt: now,
			finishedAt: status === 'finished' ? now : null
		})
		.where(eq(downloadsSchema.id, id));
}

export async function removeDownload(id: string) {
	await db.delete(downloadsSchema).where(eq(downloadsSchema.id, id));

	downloads.update((d) => d.filter((i) => i.id !== id));
}
