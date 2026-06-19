/**
 * Render-quality heuristics for the WebGL storm/panel layers.
 *
 * The procedural storm shader is GPU-heavy. WebKit engines (Safari and
 * WebKitGTK, e.g. GNOME Web / Epiphany) handle it far worse than Blink or
 * Gecko, so the visually-degrading optimizations are gated behind
 * {@link isWebKit}. Non-WebKit browsers keep full quality.
 */

/** Internal render-resolution multiplier applied on top of the DPR cap on WebKit. */
export const WEBKIT_RENDER_SCALE = 0.66;

/** Minimum milliseconds between storm frames on WebKit (~30fps cap). */
export const WEBKIT_FRAME_INTERVAL_MS = 1000 / 30;

let cachedIsWebKit: boolean | null = null;

/**
 * Detect a real WebKit engine (Safari or WebKitGTK), excluding Blink.
 *
 * Blink-based browsers also report `AppleWebKit`, so they are filtered out by
 * their `Chrome`/`Chromium`/`Edg`/`OPR` tokens. Firefox carries no
 * `AppleWebKit` token. The result is cached for the page lifetime.
 */
export function isWebKit(): boolean {
	if (cachedIsWebKit !== null) return cachedIsWebKit;
	if (typeof navigator === 'undefined') {
		cachedIsWebKit = false;
		return cachedIsWebKit;
	}

	const ua = navigator.userAgent;
	cachedIsWebKit = /\bAppleWebKit\b/.test(ua) && !/\b(?:Chrome|Chromium|Edg|OPR)\b/.test(ua);
	return cachedIsWebKit;
}
