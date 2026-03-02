/**
 * Smoke-test the production build in a local preview server.
 *
 * Run: bun scripts/smoke.ts
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';

const DIST_HTML = resolve('dist/index.html');
const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_PORT = 4173;
const TEST_HOST = 'smoke.example';

const previewBaseUrl = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const smokeUrl = `${previewBaseUrl}/?host=${encodeURIComponent(TEST_HOST)}&calm=off&theme=dark`;

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(message);
	}
}

console.log('Building project...');
execSync('bun run build', { stdio: 'inherit' });

if (!existsSync(DIST_HTML)) {
	throw new Error('Build failed: dist/index.html not found');
}

console.log('Starting preview server...');
const previewServer = await preview({
	logLevel: 'error',
	preview: {
		host: PREVIEW_HOST,
		port: PREVIEW_PORT,
		strictPort: true,
	},
});

try {
	const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
	try {
		const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
		const consoleErrors: string[] = [];
		const pageErrors: string[] = [];

		page.on('console', (message) => {
			if (message.type() === 'error') {
				consoleErrors.push(message.text());
			}
		});
		page.on('pageerror', (error) => {
			pageErrors.push(error.message);
		});

		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
		await page.goto(smokeUrl, { waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => document.body.classList.contains('page-ready'));
		await page.waitForTimeout(150);

		const state = await page.evaluate(() => {
			const styles = getComputedStyle(document.documentElement);
			const hostText = document.querySelector<HTMLElement>('[data-blurb] .font-bold')?.textContent ?? '';

			return {
				title: document.title,
				ready: document.body.classList.contains('page-ready'),
				hostText,
				hasThemeControls: document.querySelector('[data-theme-dock-toggle]') !== null,
				boltCount: document.querySelectorAll('.storm-streak').length,
				cloudBackground: styles.getPropertyValue('--cloud-bg').trim(),
				flash: styles.getPropertyValue('--flash').trim(),
			};
		});

		assert(state.ready, 'Page never reached ready state');
		assert(state.title === `404 | ${TEST_HOST}`, `Unexpected title: ${state.title}`);
		assert(state.hostText === TEST_HOST, `Host text mismatch: ${state.hostText}`);
		assert(state.hasThemeControls, 'Theme controls missing');
		assert(state.boltCount > 0, 'Storm bolts not created');
		assert(state.cloudBackground.length > 0, 'Cloud background CSS variable missing');

		const flashValue = Number(state.flash);
		assert(Number.isFinite(flashValue), `Flash CSS variable is not numeric: ${state.flash}`);

		assert(pageErrors.length === 0, `Runtime errors detected:\n${pageErrors.join('\n')}`);
		assert(consoleErrors.length === 0, `Console errors detected:\n${consoleErrors.join('\n')}`);

		console.log('Smoke test passed.');
	} finally {
		await browser.close();
	}
} finally {
	await previewServer.close();
}
