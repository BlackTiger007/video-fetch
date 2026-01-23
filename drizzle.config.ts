import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_PATH) throw new Error('DATABASE_PATH is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.DATABASE_PATH },
	verbose: true,
	strict: true
});
