/**
 * Capture an animated image of the 404 page.
 *
 * Uses Playwright's bundled Chromium to take sequential screenshots,
 * then stitches them into a GIF, WebP, or MP4 with ffmpeg.
 *
 * Local usage (Bun tooling):
 *   bun scripts/capture.ts [--url https://404.kjanat.com] [--out preview.webp]
 *                           [--width 1152] [--height 648] [--duration 6] [--fps 12]
 *                           [--quality 100] [--max-bytes 3145728] [--video-crf 28]
 *                           [--color-scheme light|dark]
 *
 * CI usage (generated Node artifact):
 *   node .capture-dist/capture.mjs [--url https://404.kjanat.com] [--out preview.webp]
 *                                  [--width 1152] [--height 648] [--duration 6] [--fps 12]
 *                                  [--quality 100] [--max-bytes 3145728] [--video-crf 28]
 *                                  [--color-scheme light|dark]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { cwd } from 'node:process';
import { parseArgs } from 'node:util';

import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

/* ---------- CLI args ---------- */

const SUPPORTED_EXTENSIONS = ['.gif', '.webp', '.mp4'] as const;
type OutputExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** Return true when the output extension is supported by the encoder pipeline. */
function isSupportedExtension(ext: string): ext is OutputExtension {
	return SUPPORTED_EXTENSIONS.some(e => e === ext);
}

const { values: args } = parseArgs({
	options: {
		help: { type: 'boolean', default: false },
		url: { type: 'string', default: 'https://404.kjanat.com' },
		hostname: { type: 'string', short: 'H', default: '' },
		out: { type: 'string', short: 'o', default: 'preview.webp' },
		width: { type: 'string', short: 'w', default: '1152' },
		height: { type: 'string', short: 'h', default: '648' },
		duration: { type: 'string', short: 'd', default: '6' },
		fps: { type: 'string', default: '12' },
		quality: { type: 'string', short: 'q', default: '100' },
		'max-bytes': { type: 'string' },
		'video-crf': { type: 'string', default: '28' },
		'color-scheme': { type: 'string', default: '' },
	},
});

if (args.help) {
	console.log(`Usage: bun ${relative(cwd(), import.meta.filename)} [options]

Capture an animated screenshot of the 404 page as GIF, WebP, or MP4.

Options:
      --url <url>            Target URL                     [default: https://404.kjanat.com]
  -H, --hostname <host>      Override hostname shown on page (appended as ?host=)
  -o, --out <path>           Output file (.gif/.webp/.mp4)  [default: preview.webp]
  -w, --width <px>           Viewport width                 [default: 1152]
  -h, --height <px>          Viewport height                [default: 648]
  -d, --duration <sec>       Recording length               [default: 6]
      --fps <n>              Frames per second              [default: 12]
  -q, --quality <0-100>      WebP quality (100 = lossless)  [default: 100]
      --max-bytes <n>        Auto-sweep to fit byte budget
      --video-crf <0-51>     MP4 H.264 CRF                  [default: 28]
      --color-scheme <mode>  Emulate "light" or "dark"
      --help                 Show this help message`);
	process.exit(0);
}

const HOSTNAME_OVERRIDE = args.hostname;
const TARGET_URL = HOSTNAME_OVERRIDE
	? `${args.url}${args.url.includes('?') ? '&' : '?'}host=${encodeURIComponent(HOSTNAME_OVERRIDE)}`
	: args.url;
const OUT = resolve(args.out);
const OUT_EXT = extname(OUT).toLowerCase();
const WIDTH = Number(args.width);
const HEIGHT = Number(args.height);
const DURATION = Number(args.duration); // seconds to record
const FPS = Number(args.fps);
const WEBP_QUALITY = Number(args.quality);
const MAX_BYTES = args['max-bytes'] === undefined ? null : Number(args['max-bytes']);
const VIDEO_CRF = Number(args['video-crf']);
const COLOR_SCHEME = args['color-scheme'] || '';
const TMP = resolve(dirname(OUT), `.capture-frames-${Date.now()}`);
const NAVIGATION_TIMEOUT_MS = 10_000;
const FIRST_PAINT_SETTLE_MS = 300;

if (!isSupportedExtension(OUT_EXT)) {
	console.error('Unsupported output format. Use .gif, .webp, or .mp4');
	process.exit(1);
}

if (COLOR_SCHEME && COLOR_SCHEME !== 'light' && COLOR_SCHEME !== 'dark') {
	console.error('Invalid --color-scheme value. Use "light" or "dark".');
	process.exit(1);
}

const numericCaptureArgs: [flag: string, value: number][] = [
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

// Create this job's temp dir first (implicitly ensures outDir exists)
const outDir = dirname(OUT);
mkdirSync(TMP, { recursive: true });

// Clean up stale temp dirs from previous crashed runs, protecting any
// concurrently-active dir younger than 2 minutes.
const STALE_THRESHOLD_MS = 120_000;
const now = Date.now();
for (const entry of readdirSync(outDir)) {
	if (!entry.startsWith('.capture-frames-')) continue;
	const candidate = resolve(outDir, entry);
	if (candidate === TMP) continue;
	try {
		if (statSync(candidate).mtimeMs < now - STALE_THRESHOLD_MS) {
			rmSync(candidate, { recursive: true, force: true });
		}
	} catch {
		/* already removed by a parallel run */
	}
}

// Resolve the target URL — fall back to local 404.html when a remote URL is
// unreachable (e.g. in sandboxed CI environments without outbound networking).
/** Open the remote URL or fall back to local 404.html in the same viewport. */
const resolveTarget = async (browser: Browser): Promise<Page> => {
	const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

	if (/^https?:\/\//.test(TARGET_URL)) {
		try {
			await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
			console.log(`Loaded remote URL: ${TARGET_URL}`);
			return page;
		} catch {
			console.log(`Remote URL unreachable, falling back to local 404.html`);
			await page.close();
		}
	}

	const htmlPath = resolve('dist/index.html');
	if (!existsSync(htmlPath)) {
		console.error('dist/index.html not found — run `bun run build` first.');
		process.exit(1);
	}
	const fallback = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
	await fallback.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
	console.log(`Loaded local file: ${htmlPath}`);
	return fallback;
};

console.log(
	`Capturing ${TOTAL_FRAMES} frames (${DURATION}s @ ${FPS} fps) at ${WIDTH}x${HEIGHT}`,
);

try {
	const browser = await chromium.launch({
		args: ['--no-sandbox', '--disable-gpu', '--disable-blink-features=AutomationControlled'],
	});

	try {
		const page = await resolveTarget(browser);

		// Emulate color scheme if requested
		if (COLOR_SCHEME === 'light' || COLOR_SCHEME === 'dark') {
			await page.emulateMedia({ colorScheme: COLOR_SCHEME });
			console.log(`Emulating prefers-color-scheme: ${COLOR_SCHEME}`);
		}

		// Let the first paint settle
		await page.waitForTimeout(FIRST_PAINT_SETTLE_MS);

		for (let i = 0; i < TOTAL_FRAMES; i++) {
			const padded = String(i).padStart(5, '0');
			const captureStartedAt = Date.now();
			await page.screenshot({ path: `${TMP}/frame-${padded}.png` });
			if (i < TOTAL_FRAMES - 1) {
				const captureDurationMs = Date.now() - captureStartedAt;
				const remainingInterval = FRAME_INTERVAL - captureDurationMs;
				if (remainingInterval > 0) {
					await page.waitForTimeout(remainingInterval);
				}
			}
		}

		console.log(`Captured ${TOTAL_FRAMES} frames into ${TMP}`);
	} finally {
		await browser.close();
	}

	/* ---------- Assemble output with ffmpeg ---------- */

	/** Shared ffmpeg input arguments for the frame sequence. */
	const ffmpegPreamble = (): string[] => /* dprint-ignore */ [
	'-y',
	'-nostdin',
	'-loglevel', 'error',
	'-hwaccel', 'auto',
	'-framerate', String(FPS),
	'-i', `${TMP}/frame-%05d.png`,
];

	/** Execute ffmpeg with optional quiet output mode. */
	const runFfmpeg = (ffmpegArgs: string[], quiet = false): void => {
		execFileSync('ffmpeg', ffmpegArgs, { stdio: quiet ? 'ignore' : 'inherit' });
	};

	/** Encode the captured frames as an optimized animated GIF. */
	const encodeGif = (outPath: string, quiet = false): void => {
		runFfmpeg([
			...ffmpegPreamble(),
			// High-quality palette-based GIF encoding
			'-vf',
			`fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg`,
			outPath,
		], quiet);
	};

	/** Encode the captured frames as an animated WebP. */
	const encodeWebp = (
		outPath: string,
		quality: number,
		lossless: boolean,
		quiet = false,
		compressionLevel = 6,
	): void => {
		const scaleHeight = lossless ? -1 : -2;
		runFfmpeg([
			...ffmpegPreamble(),
			'-vf',
			`fps=${FPS},scale=${WIDTH}:${scaleHeight}:flags=lanczos,format=${lossless ? 'rgba' : 'yuva420p'}`,
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

	/** Encode the captured frames as an MP4 using H.264. */
	const encodeMp4 = (outPath: string, crf: number, quiet = false): void => {
		runFfmpeg([
			...ffmpegPreamble(),
			'-vf',
			`fps=${FPS},scale=${WIDTH}:-2:flags=lanczos,format=yuv420p`,
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

	/** Find the highest quality WebP that fits under the requested byte budget. */
	const sweepWebp = (maxBytes: number): void => {
		const tmpOut = `${OUT}.sweep.webp`;

		// Use compression_level=0 for probes — same quality ordering as level 6
		// but ~33× faster. The final encode re-runs at level 6 for best compression.
		/** Measure encoded size for a probe configuration. */
		const measure = (lossless: boolean, quality: number): number => {
			encodeWebp(tmpOut, quality, lossless, /* quiet */ true, /* compressionLevel */ 0);
			const size = statSync(tmpOut).size;
			rmSync(tmpOut);
			return size;
		};

		/** Binary search for the best probe quality under the byte limit. */
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
			encodeWebp(OUT, best.quality, false);
			const directFinalSize = statSync(OUT).size;
			if (directFinalSize <= maxBytes) {
				console.log(`Final lossy output quality ${best.quality} (${directFinalSize} bytes)`);
				return;
			}

			// Rare fallback: probe compression and final compression diverged enough
			// to exceed the target. Only then perform an additional binary search.
			console.log(
				`Final lossy encode (${directFinalSize} bytes) exceeds --max-bytes; running fallback search.`,
			);
			let low = 0;
			let high = Math.max(0, best.quality - 1);
			let finalBest: { quality: number; size: number } | null = null;

			while (low <= high) {
				const mid = Math.floor((low + high) / 2);
				encodeWebp(OUT, mid, false);
				const finalSize = statSync(OUT).size;
				if (finalSize <= maxBytes) {
					finalBest = { quality: mid, size: finalSize };
					low = mid + 1;
				} else {
					high = mid - 1;
				}
			}

			if (finalBest !== null) {
				encodeWebp(OUT, finalBest.quality, false);
				const finalSize = statSync(OUT).size;
				console.log(`Fallback lossy output quality ${finalBest.quality} (${finalSize} bytes)`);
				return;
			}

			encodeWebp(OUT, 0, false);
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

	/** Find the lowest CRF MP4 that fits under the requested byte budget. */
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

	const sizeKB = Math.round(statSync(OUT).size / 1024);
	console.log(`Done \u2192 ${OUT} (${sizeKB} KB)`);
} finally {
	/* ---------- Cleanup ---------- */
	rmSync(TMP, { recursive: true, force: true });
}
