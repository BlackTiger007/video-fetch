<script lang="ts">
	import { enhance } from '$app/forms';
	import { maxConcurrency } from '$lib';
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

		finishedDownloads.set(data.download.filter((d) => d.status === 'finished'));

		evtSource.onmessage = (event) => {
			try {
				const updates: DownloadUpdate[] = JSON.parse(event.data);

				// Laufende Downloads
				activeDownloads.set(
					updates.filter(
						(d) => d.status === 'downloading' || d.status === 'pending' || d.status === 'queued'
					)
				);

				// Fertige Downloads
				const finished = updates.filter((d) => d.status === 'finished');

				const currentFinished = get(finishedDownloads);

				for (const d of finished) {
					// Nur hinzufügen, wenn noch nicht vorhanden
					if (!currentFinished.find((fd) => fd.filename === d.filename)) {
						finishedDownloads.update((f) => [...f, d]);
					}
				}
			} catch (err) {
				console.error('Invalid SSE data', err);
			}
		};

		return () => evtSource.close();
	});
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
			{#each $activeDownloads as d}
				<div class="mb-2">
					<div class="flex justify-between">
						<span class="font-medium">{d.filename}</span>
						<span class="text-sm text-gray-500">{d.status}</span>
					</div>
					<div class="mt-1 h-2 w-full overflow-hidden rounded bg-gray-200">
						<div
							class="h-2 bg-blue-500"
							style="width: {d.progress.toFixed(1)}%; transition: width 0.3s;"
						></div>
					</div>
					<div class="mt-1 text-sm text-gray-500">
						{d.progress.toFixed(1)}%
						{#if d.size}
							| {d.size}
						{/if}
						{#if d.speed}
							| {d.speed}
						{/if}
						{#if d.eta}
							| ETA: {d.eta}
						{/if}
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
			{#each $finishedDownloads as d}
				<div class="flex justify-between">
					<span>{d.filename}</span>
					<span class="text-sm text-gray-500">{d.status}</span>
				</div>
			{/each}
		{:else}
			<div class="text-sm text-gray-500">Noch keine heruntergeladenen Dateien.</div>
		{/if}
	</section>
</div>
