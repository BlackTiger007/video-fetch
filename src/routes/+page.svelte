<script lang="ts">
	import { enhance } from '$app/forms';
	import { maxConcurrency } from '$lib';
	import type { DownloadUpdate } from '$lib/types/download';
	import type { PageProps } from './$types';
	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store';

	let { data }: PageProps = $props();

	// Stores für Downloads
	const activeDownloads = writable<DownloadUpdate[]>([]);
	const finishedDownloads = writable<DownloadUpdate[]>([]);

	// SSE-Verbindung
	onMount(() => {
		const evtSource = new EventSource('/api/downloads');

		// bereits fertige Downloads initial setzen
		finishedDownloads.set(
			data.download.filter((d) => d.status === 'finished' || d.status === 'error')
		);

		evtSource.onmessage = (event) => {
			try {
				const updates: DownloadUpdate[] = JSON.parse(event.data);

				// laufende Downloads filtern
				activeDownloads.set(
					updates.filter(
						(d) => d.status === 'downloading' || d.status === 'pending' || d.status === 'queued'
					)
				);

				// fertiggestellte Downloads
				const finished = updates.filter((d) => d.status === 'finished' || d.status === 'error');
				const currentFinished = get(finishedDownloads);

				for (const d of finished) {
					if (!currentFinished.find((fd) => fd.id === d.id)) {
						finishedDownloads.update((f) => [...f, d]);
					}
				}
			} catch (err) {
				console.error('Invalid SSE data', err);
			}
		};

		return () => evtSource.close();
	});

	// Hilfsfunktion für Info-Text unter Fortschrittsbalken
	function formatDownloadInfo(d: DownloadUpdate) {
		const parts: string[] = [];

		parts.push(`${d.progress.toFixed(1)}%`);
		if (d.size) parts.push(`Größe: ${d.size}`);
		if (d.speed) parts.push(`Speed: ${d.speed}`);
		if (d.eta) parts.push(`ETA: ${d.eta}`);
		if (d.fragment) parts.push(`Frag: ${d.fragment.current}/${d.fragment.total}`);

		return parts.join(' | ');
	}
</script>

<div class="w-full max-w-3xl px-4">
	<section class="mb-4 w-full rounded-lg bg-base-100 p-4 shadow">
		<!-- Parallele Downloads -->
		<form method="POST" action="?/setConcurrency" class="flex flex-col" use:enhance>
			<label for="concurrency" class="mb-1 font-medium">Parallele Downloads</label>
			<input
				type="range"
				id="concurrency"
				name="concurrency"
				min="1"
				max={maxConcurrency}
				value={data.parallelDownloads}
				class="range w-full range-primary"
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			/>
			<p class="mt-1 text-sm text-gray-500">Aktuell: {data.parallelDownloads}</p>
		</form>

		<!-- Pause / Start -->
		<form method="POST" action="?/setPause" class="flex flex-col gap-3" use:enhance>
			<input type="hidden" name="pause" value={data.isPaused ? 'false' : 'true'} />
			<button type="submit" class="btn w-full btn-outline">
				{data.isPaused ? 'Start' : 'Stop'}
			</button>
		</form>
	</section>

	<!-- Laufende Downloads -->
	<section class="mb-4 w-full rounded-lg bg-base-100 p-4 shadow">
		<h2 class="mb-3 text-lg font-semibold">Laufende Downloads</h2>
		{#if $activeDownloads.length > 0}
			{#each $activeDownloads as d (d.id)}
				<div class="mb-3">
					<div class="flex justify-between">
						<span class="truncate font-medium">{d.fileName ?? 'Unbenannt'}</span>
						<span class="text-sm text-gray-500 capitalize">{d.status}</span>
					</div>
					<div class="mt-1 h-2 w-full overflow-hidden rounded bg-gray-200">
						<div
							class="h-2 bg-blue-500"
							style="width: {d.progress.toFixed(1)}%; transition: width 0.3s;"
						></div>
					</div>
					<div class="mt-1 text-sm text-gray-500">
						{formatDownloadInfo(d)}
					</div>
				</div>
			{/each}
		{:else}
			<div class="text-sm text-gray-500">Keine aktuell laufenden Downloads.</div>
		{/if}
	</section>

	<!-- Fertige Downloads -->
	<section class="w-full rounded-lg bg-base-100 p-4 shadow">
		<h2 class="mb-3 text-lg font-semibold">Heruntergeladen</h2>
		{#if $finishedDownloads.length > 0}
			{#each $finishedDownloads as d (d.id)}
				<div class="mb-1 flex justify-between">
					<span class="truncate">{d.fileName ?? 'Unbenannt'}</span>
					<span class="text-sm text-gray-500" class:text-error={d.status === 'error'}>
						{d.status === 'finished' ? 'Fertig' : 'Fehler'}
					</span>
				</div>
			{/each}
		{:else}
			<div class="text-sm text-gray-500">Noch keine heruntergeladenen Dateien.</div>
		{/if}
	</section>
</div>
