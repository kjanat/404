#!/usr/bin/env node

/**
 * Capture an animated image of the 404 page.
 *
 * Uses Playwright's bundled Chromium to take sequential screenshots,
 * then stitches them into a GIF, WebP, or MP4 with ffmpeg.
 *
 * Usage:
 *   node scripts/capture.mjs [--url https://404.kjanat.com] [--out preview.webp]
 *                             [--width 800] [--height 500] [--duration 6] [--fps 12]
 *                             [--quality 100] [--max-bytes 3145728] [--video-crf 28]
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
		quality: { type: 'string', short: 'q', default: '100' },
		'max-bytes': { type: 'string' },
		'video-crf': { type: 'string', default: '28' },
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
const MAX_BYTES = args['max-bytes'] === undefined ? null : Number(args['max-bytes']);
const VIDEO_CRF = Number(args['video-crf']);
const FRAME_INTERVAL = 1000 / FPS;
const TOTAL_FRAMES = Math.ceil(DURATION * FPS);
const TMP = resolve(dirname(OUT), '.capture-frames');

if (OUT_EXT !== '.gif' && OUT_EXT !== '.webp' && OUT_EXT !== '.mp4') {
	console.error('Unsupported output format. Use .gif, .webp, or .mp4');
	process.exit(1);
}

if (OUT_EXT === '.webp' && (!Number.isFinite(WEBP_QUALITY) || WEBP_QUALITY < 0 || WEBP_QUALITY > 100)) {
	console.error('Invalid --quality value. Use a number between 0 and 100');
	process.exit(1);
}

if (MAX_BYTES !== null && (!Number.isFinite(MAX_BYTES) || MAX_BYTES <= 0)) {
	console.error('Invalid --max-bytes value. Use a number greater than 0');
	process.exit(1);
}

if (OUT_EXT === '.mp4' && (!Number.isFinite(VIDEO_CRF) || VIDEO_CRF < 0 || VIDEO_CRF > 51)) {
	console.error('Invalid --video-crf value. Use a number between 0 and 51');
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

/** @type {(parts: string[], quiet?: boolean) => void} */
const runFfmpeg = (parts, quiet = false) => {
	execSync(parts.join(' '), { stdio: quiet ? 'ignore' : 'inherit' });
};

/** @type {(outPath: string, quiet?: boolean) => void} */
const encodeGif = (outPath, quiet = false) => {
	runFfmpeg(
		[
			'ffmpeg -y',
			`-framerate ${FPS}`,
			`-i "${TMP}/frame-%05d.png"`,
			// High-quality palette-based GIF encoding
			`-vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg"`,
			`"${outPath}"`,
		],
		quiet,
	);
};

/** @type {(outPath: string, quality: number, quiet?: boolean) => void} */
const encodeWebpLossless = (outPath, quality, quiet = false) => {
	runFfmpeg(
		[
			'ffmpeg -y',
			`-framerate ${FPS}`,
			`-i "${TMP}/frame-%05d.png"`,
			`-vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,format=rgba"`,
			'-c:v libwebp_anim',
			'-lossless 1',
			`-q:v ${quality}`,
			'-compression_level 6',
			'-loop 0',
			`"${outPath}"`,
		],
		quiet,
	);
};

/** @type {(outPath: string, quality: number, quiet?: boolean) => void} */
const encodeWebpLossy = (outPath, quality, quiet = false) => {
	runFfmpeg(
		[
			'ffmpeg -y',
			`-framerate ${FPS}`,
			`-i "${TMP}/frame-%05d.png"`,
			`-vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,format=yuva420p"`,
			'-c:v libwebp_anim',
			'-lossless 0',
			`-q:v ${quality}`,
			'-compression_level 6',
			'-loop 0',
			`"${outPath}"`,
		],
		quiet,
	);
};

/** @type {(outPath: string, crf: number, quiet?: boolean) => void} */
const encodeMp4 = (outPath, crf, quiet = false) => {
	runFfmpeg(
		[
			'ffmpeg -y',
			`-framerate ${FPS}`,
			`-i "${TMP}/frame-%05d.png"`,
			`-vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,format=yuv420p"`,
			'-c:v libx264',
			'-preset veryfast',
			`-crf ${crf}`,
			'-movflags +faststart',
			'-an',
			`"${outPath}"`,
		],
		quiet,
	);
};

/** @type {(maxBytes: number, encoder: (outPath: string, quality: number, quiet?: boolean) => void) => { quality: number, size: number } | null} */
const sweepWebpWithEncoder = (maxBytes, encoder) => {
	const tmpOut = `${OUT}.sweep.webp`;
	let low = 0;
	let high = 100;
	let best = null;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		encoder(tmpOut, mid, true);
		const size = statSync(tmpOut).size;
		if (size <= maxBytes) {
			best = { quality: mid, size };
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	if (existsSync(tmpOut)) rmSync(tmpOut);
	return best;
};

/** @type {(encoder: (outPath: string, quality: number, quiet?: boolean) => void, quality: number) => number} */
const measureWebpSize = (encoder, quality) => {
	const tmpOut = `${OUT}.sweep.webp`;
	encoder(tmpOut, quality, true);
	const size = statSync(tmpOut).size;
	if (existsSync(tmpOut)) rmSync(tmpOut);
	return size;
};

/** @type {(maxBytes: number) => void} */
const sweepWebp = (maxBytes) => {
	const minLosslessSize = measureWebpSize(encodeWebpLossless, 0);
	if (minLosslessSize <= maxBytes) {
		const bestLossless = sweepWebpWithEncoder(maxBytes, encodeWebpLossless);
		if (bestLossless !== null) {
			console.log(
				`Selected lossless WebP quality ${bestLossless.quality} (${bestLossless.size} bytes)`,
			);
			encodeWebpLossless(OUT, bestLossless.quality);
			return;
		}
	} else {
		console.log(
			`Lossless WebP minimum (${minLosslessSize} bytes) exceeds --max-bytes; switching to lossy sweep.`,
		);
	}

	const bestLossy = sweepWebpWithEncoder(maxBytes, encodeWebpLossy);
	if (bestLossy !== null) {
		console.log(`Selected lossy WebP quality ${bestLossy.quality} (${bestLossy.size} bytes)`);
		encodeWebpLossy(OUT, bestLossy.quality);
		return;
	}

	console.log('No WebP quality met --max-bytes; using lossy quality 0.');
	encodeWebpLossy(OUT, 0);

	if (statSync(OUT).size > maxBytes) {
		console.log('Output still exceeds --max-bytes; lower width/height, fps, or duration.');
	} else {
		console.log(`Selected lossy WebP quality 0 (${statSync(OUT).size} bytes)`);
	}
};

/** @type {(maxBytes: number) => void} */
const sweepMp4 = (maxBytes) => {
	const tmpOut = `${OUT}.sweep.mp4`;
	let low = 0;
	let high = 51;
	let best = null;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		encodeMp4(tmpOut, mid, true);
		const size = statSync(tmpOut).size;
		if (size <= maxBytes) {
			best = { crf: mid, size };
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}

	if (best === null) {
		console.log('No MP4 CRF met --max-bytes; using CRF 51.');
		encodeMp4(OUT, 51);
	} else {
		console.log(`Selected MP4 CRF ${best.crf} (${best.size} bytes)`);
		encodeMp4(OUT, best.crf);
	}

	if (existsSync(tmpOut)) rmSync(tmpOut);
};

if (OUT_EXT === '.webp') {
	console.log('Assembling animated WebP with ffmpeg…');
	if (MAX_BYTES === null) {
		encodeWebpLossless(OUT, WEBP_QUALITY);
	} else {
		sweepWebp(MAX_BYTES);
	}
} else if (OUT_EXT === '.mp4') {
	console.log('Assembling MP4 with ffmpeg…');
	if (MAX_BYTES === null) {
		encodeMp4(OUT, VIDEO_CRF);
	} else {
		sweepMp4(MAX_BYTES);
	}
} else {
	console.log('Assembling GIF with ffmpeg…');
	encodeGif(OUT);
}

/* ---------- Cleanup ---------- */

rmSync(TMP, { recursive: true });

const sizeKB = Math.round(statSync(OUT).size / 1024);
console.log(`Done → ${OUT} (${sizeKB} KB)`);
