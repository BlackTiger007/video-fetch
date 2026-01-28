<script lang="ts">
	import { enhance } from '$app/forms';
	import { maxConcurrency } from '$lib';
	import Cancel from '$lib/assets/cancel.svelte';
	import Copy from '$lib/assets/copy.svelte';
	import Download from '$lib/assets/download.svelte';
	import Retry from '$lib/assets/retry.svelte';
	import Trash from '$lib/assets/trash.svelte';
	import type { DownloadUpdate } from '$lib/types/download';
	import type { PageProps } from './$types';
	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store';

	let { data }: PageProps = $props();

	const activeDownloads = writable<DownloadUpdate[]>([]);
	const finishedDownloads = writable<DownloadUpdate[]>([]);

	onMount(() => {
		const evtSource = new EventSource('/api/downloads');

		// Initiale fertige Downloads setzen
		const initialFinished = data.download.filter((d) => ['finished', 'error'].includes(d.status));
		finishedDownloads.set(initialFinished);

		const initialActive = data.download.filter((d) =>
			['downloading', 'pending', 'queued', 'paused'].includes(d.status)
		);
		activeDownloads.set(initialActive);

		evtSource.onmessage = (event) => {
			try {
				const updates: DownloadUpdate[] = JSON.parse(event.data);

				// Fertige Downloads (finished / error)
				const finished = updates.filter((d) => ['finished', 'error'].includes(d.status));

				// Aktuelle fertige Downloads
				const currentFinished = get(finishedDownloads);

				// Neue fertige Downloads hinzufügen
				const newFinished = finished.filter((d) => !currentFinished.find((f) => f.id === d.id));
				if (newFinished.length) {
					finishedDownloads.update((f) => [...f, ...newFinished]);
				}

				// IDs der fertigen Downloads
				const finishedIds = finished.map((d) => d.id);

				// Aktive Downloads: nur die, die noch nicht fertig sind
				activeDownloads.set(
					updates.filter(
						(d) =>
							['downloading', 'pending', 'queued', 'paused'].includes(d.status) &&
							!finishedIds.includes(d.id)
					)
				);
			} catch (err) {
				console.error('Invalid SSE data', err);
			}
		};

		return () => evtSource.close();
	});

	function statusLabel(status: string) {
		switch (status) {
			case 'downloading':
				return 'Lädt herunter';
			case 'queued':
				return 'In Warteschlange';
			case 'pending':
				return 'Wird vorbereitet';
			case 'finished':
				return 'Fertig';
			case 'error':
				return 'Fehler';
			default:
				return status;
		}
	}

	function formatInfo(d: DownloadUpdate) {
		const parts: string[] = [];

		if (!d.progress) return 'Keine Infos';

		parts.push(d.progress.percentage_str);
		parts.push(d.progress.total_str);
		parts.push(d.progress.speed_str);
		if (d.progress.eta) parts.push(`ETA ${d.progress.eta_str}`);
		parts.push(d.progress.downloaded_str + '/' + d.progress.total_str);

		return parts.join(' · ');
	}

	async function copyUrl(url?: string) {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			alert('URL in die Zwischenablage kopiert!');
		} catch (err) {
			console.error('Kopieren fehlgeschlagen', err);
		}
	}

	function removeFromStores(id: string) {
		activeDownloads.update((list) => list.filter((d) => d.id !== id));
		finishedDownloads.update((list) => list.filter((d) => d.id !== id));
	}
</script>

<div class="mx-auto w-full max-w-4xl space-y-4 px-4">
	<!-- Einstellungen -->
	<section class="space-y-3 rounded-lg bg-base-100 p-4 shadow">
		<form method="POST" action="?/setConcurrency" use:enhance>
			<span class="font-medium">Parallele Downloads</span>
			<input
				type="range"
				name="concurrency"
				min="1"
				max={maxConcurrency}
				value={data.parallelDownloads}
				class="range range-primary"
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			/>
			<p class="text-sm text-gray-500">
				Aktuell: {data.parallelDownloads}
			</p>
		</form>

		<form method="POST" action="?/setPause" use:enhance>
			<input type="hidden" name="pause" value={data.isPaused ? 'false' : 'true'} />
			<button class="btn w-full btn-outline">
				{data.isPaused ? 'Start' : 'Pause'}
			</button>
		</form>
	</section>

	<!-- Laufende Downloads -->
	<section class="rounded-lg bg-base-100 p-4 shadow">
		<h2 class="mb-3 text-lg font-semibold">Laufende Downloads</h2>

		{#if $activeDownloads.length}
			<div class="space-y-3">
				{#each $activeDownloads as d (d.id)}
					<div class="rounded-lg border bg-base-200 p-3">
						<div class="flex justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate font-medium">
									{d.fileName ?? 'Unbenannt'}
								</p>
								<p class="text-xs text-gray-500">
									{statusLabel(d.status)}
								</p>
							</div>

							<div class="flex gap-1">
								<button
									class="btn btn-ghost btn-xs"
									title="Link kopieren"
									onclick={() => copyUrl(d.videoUrl)}
								>
									<Copy class="size-4"></Copy>
								</button>
								<form
									action="?/cancelDownload"
									method="post"
									class="btn text-error btn-ghost btn-xs"
									use:enhance
									title="Abbrechen"
								>
									<input type="hidden" name="id" value={d.id} />
									<button>
										<Cancel class="size-4"></Cancel>
									</button>
								</form>
							</div>
						</div>

						{#if d.progress?.percentage}
							<div class="mt-2 h-2 w-full rounded bg-gray-300">
								<div
									class="h-2 rounded bg-primary transition-all"
									style="width: {d.progress.percentage.toFixed(1)}%;"
								></div>
							</div>
						{/if}

						<p class="mt-1 text-xs text-gray-500">
							{formatInfo(d)}
						</p>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-gray-500">Keine laufenden Downloads.</p>
		{/if}
	</section>

	<!-- Abgeschlossene / Fehler -->
	<section class="rounded-lg bg-base-100 p-4 shadow">
		<h2 class="mb-3 text-lg font-semibold">Abgeschlossen</h2>

		{#if $finishedDownloads.length}
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Name</th>
							<th>Status</th>
							<th>Info</th>
							<th class="text-right">Aktionen</th>
						</tr>
					</thead>
					<tbody>
						{#each $finishedDownloads as d (d.id)}
							<tr class={d.status === 'error' ? 'bg-error/10' : ''}>
								<td class="max-w-xs truncate" title={d.fileName ?? 'Unbenannt'}>
									{d.fileName ?? 'Unbenannt'}
								</td>
								<td class={d.status === 'error' ? 'text-error' : 'text-success'}>
									{statusLabel(d.status)}
								</td>
								<td
									class="text-xs text-gray-500"
									title={d.status === 'error' ? (d.errorMessage ?? 'Unbekannter Fehler') : '—'}
								>
									{d.status === 'error' ? (d.errorMessage ?? 'Unbekannter Fehler') : '—'}
								</td>
								<td class="flex justify-end space-x-1">
									<!-- {#if d.status === 'finished'}
										<button class="btn btn-ghost btn-xs">
											<Download class="size-4"></Download>
										</button>
									{/if} -->
									{#if d.status === 'error'}
										<form
											action="?/retryDownload"
											method="post"
											class="btn btn-ghost btn-xs"
											use:enhance
										>
											<input type="hidden" name="id" value={d.id} />
											<button>
												<Retry class="size-4"></Retry>
											</button>
										</form>
									{/if}
									<button
										class="btn btn-ghost btn-xs"
										title="Link kopieren"
										onclick={() => copyUrl(d.videoUrl)}
									>
										<Copy class="size-4"></Copy>
									</button>
									<form
										action="?/deleteDownload"
										method="post"
										use:enhance={() => {
											activeDownloads.update((list) => list.filter((l) => l.id !== d.id));
											finishedDownloads.update((list) => list.filter((l) => l.id !== d.id));
										}}
										class="btn text-error btn-ghost btn-xs"
									>
										<input type="hidden" name="id" value={d.id} />
										<button type="submit">
											<Trash class="size-4" />
										</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-sm text-gray-500">Noch keine abgeschlossenen Downloads.</p>
		{/if}
	</section>
</div>
