import { env as public_env } from '$env/dynamic/public';

export const maxConcurrency = parseInt(public_env.PUBLIC_MAX_CONCURRENCY || '5', 10); // maximal erlaubter Wert
