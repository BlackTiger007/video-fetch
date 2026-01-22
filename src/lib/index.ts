import { env as public_env } from '$env/dynamic/public';

/**
 * Maximal erlaubter paralleler Downloads
 * Minimum: 1
 */
export const maxConcurrency = Math.max(1, parseInt(public_env.PUBLIC_MAX_CONCURRENCY || '3', 10));

/**
 * Standardwert für parallele Downloads
 * Muss zwischen 1 und maxConcurrency liegen
 */
export const defaultConcurrency = Math.min(
	Math.max(1, parseInt(public_env.PUBLIC_DEFAULT_CONCURRENCY || '1', 10)),
	maxConcurrency
);
