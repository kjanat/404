import { execSync } from 'node:child_process';
import { defineConfig, devices } from 'playwright/test';

const PLAYWRIGHT_SERVER_URL = new URL('http://127.0.0.1:4273');
const dynamicLibraryCache = process.platform === 'linux'
	? loadDynamicLibraryCache()
	: '';
const dynamicLibrarySonames = new Set(
	dynamicLibraryCache
		.split('\n')
		.flatMap((line) => {
			const soname = line.trim().split(/\s+/)[0];
			return soname?.includes('.so') ? [soname] : [];
		}),
);

function loadDynamicLibraryCache(): string {
	try {
		return execSync('ldconfig -p', {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
	} catch {
		return '';
	}
}

function hasLinuxLibrary(libraryName: string): boolean {
	if (process.platform !== 'linux') return true;

	for (const soname of dynamicLibrarySonames) {
		if (soname === libraryName || soname.startsWith(`${libraryName}.`)) {
			return true;
		}
	}

	return false;
}

const canRunWebKit = process.platform !== 'linux'
	|| (
		hasLinuxLibrary('libicu.so')
		&& hasLinuxLibrary('libxml2.so')
		&& hasLinuxLibrary('libflite.so')
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
