// Ungültige Dateiname-Zeichen für Windows: \ / : * ? " < > |
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

// Steuerzeichen: 0–31 + 128–159
const CONTROL_CHARS = /\p{C}/gu; // Alle Unicode Control Characters

// Mehrfache Leerzeichen normalisieren
const MULTI_SPACE = /\s+/g;

export function sanitizeFilename(input: string): string {
	return input
		.replace(INVALID_FILENAME_CHARS, '-') // Verbotene Zeichen ersetzen
		.replace(CONTROL_CHARS, '') // Steuerzeichen entfernen
		.replace(MULTI_SPACE, ' ') // Spaces normalisieren
		.replace(/[. ]+$/, '') // Punkte/Spaces am Ende entfernen
		.trim();
}
