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

const BUILD_HTML = resolve('index.html');
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

if (!existsSync(BUILD_HTML)) {
	throw new Error('Build failed: index.html not found');
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
		await page.waitForFunction(() => {
			const canvas = document.querySelector<HTMLCanvasElement>('.storm-canvas');
			return canvas?.dataset.stormRenderer === 'webgl2'
				&& canvas.dataset.stormActive === 'true'
				&& canvas.width > 0
				&& canvas.height > 0;
		});

		const state = await page.evaluate(() => {
			const hostText = document.querySelector<HTMLElement>('[data-blurb] .font-bold')?.textContent ?? '';
			const canvas = document.querySelector<HTMLCanvasElement>('.storm-canvas');

			return {
				title: document.title,
				ready: document.body.classList.contains('page-ready'),
				hostText,
				hasThemeControls: document.querySelector('[data-theme-dock-toggle]') !== null,
				renderer: canvas?.dataset.stormRenderer ?? '',
				rendererActive: canvas?.dataset.stormActive ?? '',
				canvasWidth: canvas?.width ?? 0,
				canvasHeight: canvas?.height ?? 0,
			};
		});

		assert(state.ready, 'Page never reached ready state');
		assert(state.title === `404 | ${TEST_HOST}`, `Unexpected title: ${state.title}`);
		assert(state.hostText === TEST_HOST, `Host text mismatch: ${state.hostText}`);
		assert(state.hasThemeControls, 'Theme controls missing');
		assert(state.renderer === 'webgl2', `Storm renderer did not initialize: ${state.renderer}`);
		assert(state.rendererActive === 'true', 'Storm renderer is not active');
		assert(state.canvasWidth > 0 && state.canvasHeight > 0, 'Storm canvas has no drawable size');

		assert(pageErrors.length === 0, `Runtime errors detected:\n${pageErrors.join('\n')}`);
		assert(consoleErrors.length === 0, `Console errors detected:\n${consoleErrors.join('\n')}`);

		console.log('Smoke test passed.');
	} finally {
		await browser.close();
	}
} finally {
	await previewServer.close();
}
