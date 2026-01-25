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

		finishedDownloads.set(
			data.download.filter((d) => d.status === 'finished' || d.status === 'error')
		);

		evtSource.onmessage = (event) => {
			try {
				const updates: DownloadUpdate[] = JSON.parse(event.data);

				activeDownloads.set(
					updates.filter((d) => ['downloading', 'pending', 'queued'].includes(d.status))
				);

				const finished = updates.filter((d) => ['finished', 'error'].includes(d.status));

				const current = get(finishedDownloads);

				for (const d of finished) {
					if (!current.find((c) => c.id === d.id)) {
						finishedDownloads.update((f) => [...f, d]);
					}
				}
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

		parts.push(`${d.progress.toFixed(1)}%`);
		if (d.size) parts.push(d.size);
		if (d.speed) parts.push(d.speed);
		if (d.eta) parts.push(`ETA ${d.eta}`);
		if (d.fragment) parts.push(`Frag ${d.fragment.current}/${d.fragment.total}`);

		return parts.join(' · ');
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
								<button class="btn btn-ghost btn-xs" title="Link kopieren">
									<Copy class="size-4"></Copy>
								</button>
								<button class="btn text-error btn-ghost btn-xs" title="Abbrechen">
									<Cancel class="size-4"></Cancel>
								</button>
							</div>
						</div>

						<div class="mt-2 h-2 w-full rounded bg-gray-300">
							<div
								class="h-2 rounded bg-primary transition-all"
								style="width: {d.progress.toFixed(1)}%;"
							></div>
						</div>

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
								<td class="space-x-1 text-right">
									{#if d.status === 'finished'}
										<button class="btn btn-ghost btn-xs">
											<Download class="size-4"></Download>
										</button>
									{/if}
									{#if d.status === 'error'}
										<button class="btn btn-ghost btn-xs">
											<Retry class="size-4"></Retry>
										</button>
									{/if}
									<form
										action="?/removeDownload"
										method="post"
										class="btn text-error btn-ghost btn-xs"
									>
										<button>
											<Trash class="size-4"></Trash>
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
