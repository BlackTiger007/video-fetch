import path from 'path';
import fs from 'fs';
import { env as private_env } from '$env/dynamic/private';

// Pfad entweder aus ENV oder Default './downloads'
export const DOWNLOAD_FOLDER = private_env.DOWNLOAD_PATH
	? path.resolve(private_env.DOWNLOAD_PATH)
	: path.resolve('./downloads');

// Stelle sicher, dass der Ordner existiert
if (!fs.existsSync(DOWNLOAD_FOLDER)) {
	fs.mkdirSync(DOWNLOAD_FOLDER, { recursive: true });
	console.log(`Download folder created: ${DOWNLOAD_FOLDER}`);
} else {
	console.log(`Download folder exists: ${DOWNLOAD_FOLDER}`);
}
