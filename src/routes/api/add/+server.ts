import { prepareDownloadItems, ValidationError } from '$lib/server/downloads-helper';
import { addDownloads } from '$lib/server/db';
import { processDownloads } from '$lib/server/process';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		// data kann ein Objekt oder Array sein
		const items = await prepareDownloadItems(data);
		await addDownloads(items);
		void processDownloads();

		return new Response(JSON.stringify({ message: 'Downloads added to queue' }), { status: 201 });
	} catch (err) {
		if (err instanceof ValidationError) {
			return new Response(JSON.stringify({ error: err.message }), { status: err.status });
		}
		return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
	}
};
