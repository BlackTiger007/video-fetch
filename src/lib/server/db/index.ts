import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

if (!env.DATABASE_PATH) throw new Error('DATABASE_PATH is not set');
fs.mkdirSync(path.dirname(env.DATABASE_PATH), { recursive: true });

const client = new Database(env.DATABASE_PATH);

export const db = drizzle(client, { schema });
