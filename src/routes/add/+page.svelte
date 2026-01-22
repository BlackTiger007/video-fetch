<script lang="ts">
	import { enhance } from '$app/forms';
	import { writable } from 'svelte/store';

	// Tab state
	let active: 'single' | 'batch' = 'single';

	// Batch textarea/file preview
	let importText = '';
	let importFile: File | null = null;
	let fileInput: HTMLInputElement | null = null;
	const preview = writable([] as { url: string; filename: string | null }[]);

	function parseTSV(text: string) {
		const lines = text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean);
		const rows: { url: string; filename: string | null }[] = [];
		for (const line of lines) {
			const cols = line.split('\t');
			rows.push({ url: (cols[0] || '').trim(), filename: (cols[1] || '').trim() || null });
		}
		preview.set(rows);
	}

	function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const f = input.files && input.files[0];
		if (f) {
			importFile = f;
			f.text().then((t) => {
				importText = t; // Datei wird in Textarea geladen
				parseTSV(t);
			});
		} else {
			importFile = null;
			preview.set([]);
		}
	}

	function onTextEdit() {
		// Sobald der Nutzer manuell editiert, Datei bewusst verwerfen
		if (fileInput) fileInput.value = '';
		importFile = null;
	}

	$: if (importText !== undefined) parseTSV(importText);
</script>

<div class="w-full max-w-4xl px-4">
	<div role="tablist" class="tabs-border mb-4 tabs">
		<button
			class={`tab ${active === 'single' ? 'tab-active' : ''}`}
			onclick={() => (active = 'single')}
		>
			Einzeln hinzufügen
		</button>
		<button
			class={`tab ${active === 'batch' ? 'tab-active' : ''}`}
			onclick={() => (active = 'batch')}
		>
			Batch importieren
		</button>
	</div>

	{#if active === 'single'}
		<form
			method="POST"
			action="?/addUrl"
			class="mb-6 rounded-lg bg-base-100 p-6 shadow-lg"
			use:enhance
		>
			<div class="grid gap-4">
				<label class="flex flex-col">
					<span class="font-medium">Video URL</span>
					<input
						name="video_url"
						type="url"
						required
						placeholder="https://"
						class="input-bordered input w-full"
					/>
				</label>

				<label class="flex flex-col">
					<span class="font-medium">Qualität</span>
					<select name="quality" class="select-bordered select w-full">
						<option value="best">Beste Qualität</option>
						<option value="worst">Schlechteste Qualität</option>
						<option value="audio">Nur Audio</option>
					</select>
				</label>

				<label class="flex flex-col">
					<span class="font-medium">Optionaler Dateiname</span>
					<input
						name="filename"
						type="text"
						class="input-bordered input w-full"
						placeholder="Meine Datei (Episode 1)"
					/>
					<span class="text-sm text-gray-500">
						Erlaubt: Buchstaben, Zahlen, Leerzeichen, (), [], -, _ (max. 50)
					</span>
				</label>

				<label class="flex items-center gap-3">
					<input name="append_title" type="checkbox" class="checkbox" />
					<span>Seitentitel an Dateinamen anhängen</span>
				</label>

				<button class="btn w-full btn-primary" type="submit">Hinzufügen</button>
			</div>
		</form>
	{/if}

	{#if active === 'batch'}
		<form
			method="POST"
			action="?/importBatch"
			enctype="multipart/form-data"
			class="mb-6 rounded-lg bg-base-100 p-6 shadow-lg"
			use:enhance
		>
			<div class="grid gap-4">
				<div>
					<label for="import_file" class="font-medium">Import-Datei (.txt, Tab-getrennt)</label>
					<input
						bind:this={fileInput}
						type="file"
						name="import_file"
						id="import_file"
						accept=".txt"
						class="file-input-bordered file-input mt-2 w-full"
						onchange={onFileChange}
					/>
					<span class="mt-1 block text-sm text-gray-500">
						Format: URL\tDateiname (Dateiname optional). Jede Zeile ein Eintrag.
					</span>
				</div>

				<div>
					<label for="import_text" class="font-medium">Oder: TSV einfügen</label>
					<textarea
						name="import_text"
						id="import_text"
						rows={8}
						oninput={onTextEdit}
						bind:value={importText}
						class="textarea-bordered textarea mt-2 w-full"
						placeholder="https://example.com/video1\tMein Video 1\nhttps://example.com/video2\t"
					></textarea>
				</div>

				<div>
					<p class="font-medium">Vorschau</p>
					<div class="mt-2 max-h-56 overflow-auto rounded border p-2">
						{#if $preview.length === 0}
							<p class="text-sm text-gray-500">Keine Zeilen zum Anzeigen.</p>
						{:else}
							<table class="table w-full">
								<thead>
									<tr>
										<th>#</th>
										<th>URL</th>
										<th>Dateiname</th>
									</tr>
								</thead>
								<tbody>
									{#each $preview as row, i}
										<tr>
											<th>{i + 1}</th>
											<td class="max-w-xs truncate">{row.url}</td>
											<td>{row.filename ?? '—'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>

				<button type="submit" class="btn w-full btn-primary">Importieren ({$preview.length})</button
				>
			</div>
		</form>
	{/if}
</div>
