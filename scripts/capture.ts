#!/usr/bin/env bun

/**
 * Capture an animated image of the 404 page.
 *
 * Uses Playwright's bundled Chromium to take sequential screenshots,
 * then stitches them into a GIF, WebP, or MP4 with ffmpeg.
 *
 * Usage:
 *   bun scripts/capture.ts [--url https://404.kjanat.com] [--out preview.webp]
 *                           [--width 800] [--height 500] [--duration 6] [--fps 12]
 *                           [--quality 100] [--max-bytes 3145728] [--video-crf 28]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

/* ---------- CLI args ---------- */

const SUPPORTED_EXTENSIONS = ['.gif', '.webp', '.mp4'] as const;
type OutputExtension = (typeof SUPPORTED_EXTENSIONS)[number];

function isSupportedExtension(ext: string): ext is OutputExtension {
	return SUPPORTED_EXTENSIONS.some(e => e === ext);
}

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

const TARGET_URL = args.url ?? 'https://404.kjanat.com';
const OUT = resolve(args.out ?? 'preview.webp');
const OUT_EXT = extname(OUT).toLowerCase();
const WIDTH = Number(args.width);
const HEIGHT = Number(args.height);
const DURATION = Number(args.duration); // seconds to record
const FPS = Number(args.fps);
const WEBP_QUALITY = Number(args.quality);
const MAX_BYTES = args['max-bytes'] === undefined ? null : Number(args['max-bytes']);
const VIDEO_CRF = Number(args['video-crf']);
const TMP = resolve(dirname(OUT), '.capture-frames');

if (!isSupportedExtension(OUT_EXT)) {
	console.error('Unsupported output format. Use .gif, .webp, or .mp4');
	process.exit(1);
}

const numericCaptureArgs: Array<[flag: string, value: number]> = [
	['--width', WIDTH],
	['--height', HEIGHT],
	['--duration', DURATION],
	['--fps', FPS],
];
for (const [flag, value] of numericCaptureArgs) {
	if (!Number.isFinite(value) || value <= 0) {
		console.error(`Invalid ${flag} value. Use a number greater than 0.`);
		process.exit(1);
	}
}

const FRAME_INTERVAL = 1000 / FPS;
const TOTAL_FRAMES = Math.ceil(DURATION * FPS);

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

try {
	execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
	console.error('ffmpeg not found in PATH. Install ffmpeg first.');
	process.exit(1);
}

/* ---------- Capture frames ---------- */

if (existsSync(TMP)) rmSync(TMP, { recursive: true });
mkdirSync(TMP, { recursive: true });

// Resolve the target URL — fall back to local 404.html when a remote URL is
// unreachable (e.g. in sandboxed CI environments without outbound networking).
const resolveTarget = async (browser: Browser): Promise<Page> => {
	const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

	if (/^https?:\/\//.test(TARGET_URL)) {
		try {
			await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 });
			console.log(`Loaded remote URL: ${TARGET_URL}`);
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

const browser = await chromium.launch({
	args: ['--no-sandbox', '--disable-gpu', '--disable-blink-features=AutomationControlled'],
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

const ffmpegPreamble = (): string[] => [
	'-y',
	'-framerate',
	String(FPS),
	'-i',
	`${TMP}/frame-%05d.png`,
];

const runFfmpeg = (ffmpegArgs: string[], quiet = false): void => {
	execFileSync('ffmpeg', ffmpegArgs, { stdio: quiet ? 'ignore' : 'inherit' });
};

const encodeGif = (outPath: string, quiet = false): void => {
	runFfmpeg([
		...ffmpegPreamble(),
		// High-quality palette-based GIF encoding
		'-vf',
		`fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg`,
		outPath,
	], quiet);
};

const encodeWebp = (
	outPath: string,
	quality: number,
	lossless: boolean,
	quiet = false,
	compressionLevel = 6,
): void => {
	runFfmpeg([
		...ffmpegPreamble(),
		'-vf',
		`fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,format=${lossless ? 'rgba' : 'yuva420p'}`,
		'-c:v',
		'libwebp_anim',
		'-lossless',
		lossless ? '1' : '0',
		'-q:v',
		String(quality),
		'-compression_level',
		String(compressionLevel),
		'-loop',
		'0',
		outPath,
	], quiet);
};

const encodeMp4 = (outPath: string, crf: number, quiet = false): void => {
	runFfmpeg([
		...ffmpegPreamble(),
		'-vf',
		`fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,format=yuv420p`,
		'-c:v',
		'libx264',
		'-preset',
		'veryfast',
		'-crf',
		String(crf),
		'-movflags',
		'+faststart',
		'-an',
		outPath,
	], quiet);
};

const sweepWebp = (maxBytes: number): void => {
	const tmpOut = `${OUT}.sweep.webp`;

	// Use compression_level=0 for probes — same quality ordering as level 6
	// but ~33× faster. The final encode re-runs at level 6 for best compression.
	const measure = (lossless: boolean, quality: number): number => {
		encodeWebp(tmpOut, quality, lossless, /* quiet */ true, /* compressionLevel */ 0);
		const size = statSync(tmpOut).size;
		rmSync(tmpOut);
		return size;
	};

	const sweep = (lossless: boolean): { quality: number; size: number } | null => {
		let low = 0, high = 100;
		let best: { quality: number; size: number } | null = null;
		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			const size = measure(lossless, mid);
			if (size <= maxBytes) {
				best = { quality: mid, size };
				low = mid + 1;
			} else high = mid - 1;
		}
		return best;
	};

	const minLosslessSize = measure(true, 0);
	if (minLosslessSize <= maxBytes) {
		const best = sweep(true);
		if (best !== null) {
			console.log(`Selected lossless WebP quality ${best.quality} (${best.size} bytes)`);
			encodeWebp(OUT, best.quality, true);
			const finalSize = statSync(OUT).size;
			if (finalSize <= maxBytes) {
				console.log(`Final lossless output size: ${finalSize} bytes`);
				return;
			}
			console.log(`Final lossless encode (${finalSize} bytes) exceeds --max-bytes; falling back to lossy sweep.`);
			rmSync(OUT);
		}
	} else {
		console.log(`Lossless WebP minimum (${minLosslessSize} bytes) exceeds --max-bytes; switching to lossy sweep.`);
	}

	const best = sweep(false);
	if (best !== null) {
		console.log(`Selected lossy WebP quality ${best.quality} (${best.size} bytes)`);
		for (let quality = best.quality; quality >= 0; quality--) {
			encodeWebp(OUT, quality, false);
			const finalSize = statSync(OUT).size;
			if (finalSize <= maxBytes) {
				console.log(`Final lossy output quality ${quality} (${finalSize} bytes)`);
				return;
			}
		}
		const minFinalLossySize = statSync(OUT).size;
		console.log(`Lossy quality 0 still exceeds --max-bytes (${minFinalLossySize} bytes).`);
		return;
	}

	console.log('No WebP quality met --max-bytes; using lossy quality 0.');
	encodeWebp(OUT, 0, false);
	const finalSize = statSync(OUT).size;
	if (finalSize > maxBytes) {
		console.log('Output still exceeds --max-bytes; lower width/height, fps, or duration.');
	} else {
		console.log(`Selected lossy WebP quality 0 (${finalSize} bytes)`);
	}
};

const sweepMp4 = (maxBytes: number): void => {
	const tmpOut = `${OUT}.sweep.mp4`;
	let low = 0, high = 51;
	let best: { crf: number; size: number } | null = null;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		encodeMp4(tmpOut, mid, true);
		const size = statSync(tmpOut).size;
		if (size <= maxBytes) {
			best = { crf: mid, size };
			high = mid - 1;
		} else low = mid + 1;
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
	console.log('Assembling animated WebP with ffmpeg\u2026');
	if (MAX_BYTES === null) {
		encodeWebp(OUT, WEBP_QUALITY, true);
	} else {
		sweepWebp(MAX_BYTES);
	}
} else if (OUT_EXT === '.mp4') {
	console.log('Assembling MP4 with ffmpeg\u2026');
	if (MAX_BYTES === null) {
		encodeMp4(OUT, VIDEO_CRF);
	} else {
		sweepMp4(MAX_BYTES);
	}
} else {
	if (MAX_BYTES !== null) {
		console.log('Warning: --max-bytes is not supported for GIF output; ignoring.');
	}
	console.log('Assembling GIF with ffmpeg\u2026');
	encodeGif(OUT);
}

/* ---------- Cleanup ---------- */

rmSync(TMP, { recursive: true });

const sizeKB = Math.round(statSync(OUT).size / 1024);
console.log(`Done \u2192 ${OUT} (${sizeKB} KB)`);
