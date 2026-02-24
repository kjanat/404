#!/usr/bin/env node

/**
 * Capture an animated image of the 404 page.
 *
 * Uses Playwright's bundled Chromium to take sequential screenshots,
 * then stitches them into a GIF or WebP with ffmpeg.
 *
 * Usage:
 *   node scripts/capture.mjs [--url https://404.kjanat.com] [--out preview.webp]
 *                             [--width 800] [--height 500] [--duration 6] [--fps 12]
 *                             [--quality 82]
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);

/* ---------- CLI args ---------- */

const { values: args } = parseArgs({
	options: {
		url: { type: 'string', default: 'https://404.kjanat.com' },
		out: { type: 'string', short: 'o', default: 'preview.webp' },
		width: { type: 'string', short: 'w', default: '800' },
		height: { type: 'string', short: 'h', default: '500' },
		duration: { type: 'string', short: 'd', default: '6' },
		fps: { type: 'string', default: '12' },
		quality: { type: 'string', short: 'q', default: '82' },
	},
});

const URL = args.url;
const OUT = resolve(args.out);
const OUT_EXT = extname(OUT).toLowerCase();
const WIDTH = Number(args.width);
const HEIGHT = Number(args.height);
const DURATION = Number(args.duration); // seconds to record
const FPS = Number(args.fps);
const WEBP_QUALITY = Number(args.quality);
const FRAME_INTERVAL = 1000 / FPS;
const TOTAL_FRAMES = Math.ceil(DURATION * FPS);
const TMP = resolve(dirname(OUT), '.capture-frames');

if (OUT_EXT !== '.gif' && OUT_EXT !== '.webp') {
	console.error('Unsupported output format. Use .gif or .webp');
	process.exit(1);
}

if (!Number.isFinite(WEBP_QUALITY) || WEBP_QUALITY < 0 || WEBP_QUALITY > 100) {
	console.error('Invalid --quality value. Use a number between 0 and 100');
	process.exit(1);
}

/* ---------- Locate Playwright ---------- */

function loadPlaywright() {
	const tryPaths = [
		// Global install (common in CI / sandboxed environments)
		'/opt/node22/lib/node_modules/playwright',
		// Local node_modules
		resolve('node_modules/playwright'),
	];
	for (const p of tryPaths) {
		if (existsSync(p)) return require(p);
	}
	throw new Error(
		'Playwright not found. Install it with: npm install -g playwright',
	);
}

const pw = loadPlaywright();

/* ---------- Capture frames ---------- */

if (existsSync(TMP)) rmSync(TMP, { recursive: true });
mkdirSync(TMP, { recursive: true });

// Resolve the target URL — fall back to local 404.html when a remote URL is
// unreachable (e.g. in sandboxed CI environments without outbound networking).
/** @type {(browser: import('playwright').Browser) => Promise<import('playwright').Page>} */
const resolveTarget = async (browser) => {
	const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

	if (/^https?:\/\//.test(URL)) {
		try {
			await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 10_000 });
			console.log(`Loaded remote URL: ${URL}`);
			return page;
		} catch {
			console.log(`Remote URL unreachable, falling back to local 404.html`);
			await page.close();
		}
	}

	const htmlPath = resolve('404.html');
	if (!existsSync(htmlPath)) {
		console.error('404.html not found in the current directory.');
		process.exit(1);
	}
	const fallback = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
	await fallback.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
	console.log(`Loaded local file: ${htmlPath}`);
	return fallback;
};

console.log(
	`Capturing ${TOTAL_FRAMES} frames (${DURATION}s @ ${FPS} fps) at ${WIDTH}x${HEIGHT}`,
);

const browser = await pw.chromium.launch({
	args: ['--no-sandbox', '--disable-gpu'],
});

const page = await resolveTarget(browser);

// Let the first paint settle
await page.waitForTimeout(300);

for (let i = 0; i < TOTAL_FRAMES; i++) {
	const padded = String(i).padStart(5, '0');
	await page.screenshot({ path: `${TMP}/frame-${padded}.png` });
	if (i < TOTAL_FRAMES - 1) {
		await page.waitForTimeout(FRAME_INTERVAL);
	}
}

await browser.close();
console.log(`Captured ${TOTAL_FRAMES} frames into ${TMP}`);

/* ---------- Assemble output with ffmpeg ---------- */

if (OUT_EXT === '.webp') {
	console.log('Assembling animated WebP with ffmpeg…');
	execSync(
		[
			'ffmpeg -y',
			`-framerate ${FPS}`,
			`-i "${TMP}/frame-%05d.png"`,
			`-vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,format=yuva420p"`,
			'-c:v libwebp_anim',
			'-lossless 0',
			`-q:v ${WEBP_QUALITY}`,
			'-compression_level 6',
			'-loop 0',
			`"${OUT}"`,
		].join(' '),
		{ stdio: 'inherit' },
	);
} else {
	console.log('Assembling GIF with ffmpeg…');
	execSync(
		[
			'ffmpeg -y',
			`-framerate ${FPS}`,
			`-i "${TMP}/frame-%05d.png"`,
			// High-quality palette-based GIF encoding
			`-vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg"`,
			`"${OUT}"`,
		].join(' '),
		{ stdio: 'inherit' },
	);
}

/* ---------- Cleanup ---------- */

rmSync(TMP, { recursive: true });

const sizeKB = Math.round(statSync(OUT).size / 1024);
console.log(`Done → ${OUT} (${sizeKB} KB)`);
