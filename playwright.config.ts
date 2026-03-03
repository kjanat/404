import { execSync } from 'node:child_process';
import { defineConfig, devices } from 'playwright/test';

const PLAYWRIGHT_SERVER_URL = new URL('http://127.0.0.1:4273');

function hasLinuxLibrary(libraryName: string): boolean {
	if (process.platform !== 'linux') return true;

	try {
		const dynamicLibraryCache = execSync('ldconfig -p', {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		return dynamicLibraryCache.includes(libraryName);
	} catch {
		return false;
	}
}

const canRunWebKit = process.platform !== 'linux'
	|| (
		hasLinuxLibrary('libicu.so.74')
		&& hasLinuxLibrary('libxml2.so.2')
		&& hasLinuxLibrary('libflite.so.1')
	);

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	workers: process.env.CI ? 2 : undefined,
	timeout: 30_000,
	use: {
		baseURL: PLAYWRIGHT_SERVER_URL.origin,
		headless: true,
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
			},
		},
		{
			name: 'firefox',
			use: {
				...devices['Desktop Firefox'],
			},
		},
		{
			name: 'webkit',
			use: {
				...devices['Desktop Safari'],
			},
			...(canRunWebKit ? {} : { testIgnore: ['**/*'] }),
		},
	],
	webServer: {
		command: `bun run dev --host ${PLAYWRIGHT_SERVER_URL.hostname} --port ${PLAYWRIGHT_SERVER_URL.port} --strictPort`,
		url: PLAYWRIGHT_SERVER_URL.origin,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
