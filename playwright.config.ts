import { defineConfig } from 'playwright/test';

const PLAYWRIGHT_SERVER_URL = new URL('http://127.0.0.1:4273');

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	timeout: 30_000,
	use: {
		baseURL: PLAYWRIGHT_SERVER_URL.origin,
		headless: true,
	},
	webServer: {
		command: `bun run dev --host ${PLAYWRIGHT_SERVER_URL.hostname} --port ${PLAYWRIGHT_SERVER_URL.port} --strictPort`,
		url: PLAYWRIGHT_SERVER_URL.origin,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
