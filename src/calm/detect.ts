import { CALM_OFF_RE, CALM_ON_RE, CALM_PARAM, type CalmSignal, mediaQueryDefs } from './constants.ts';

let mediaQueries: Record<CalmSignal, MediaQueryList> | null = null;
const noopCleanup = (): void => undefined;

interface LegacyMediaQueryList {
	readonly addListener?: (handler: () => void) => void;
	readonly removeListener?: (handler: () => void) => void;
}

function getMediaQueries(): Record<CalmSignal, MediaQueryList> | null {
	if (mediaQueries !== null) {
		return mediaQueries;
	}

	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return null;
	}

	mediaQueries = {
		reduceMotion: window.matchMedia(mediaQueryDefs.reduceMotion),
		moreContrast: window.matchMedia(mediaQueryDefs.moreContrast),
		forcedColors: window.matchMedia(mediaQueryDefs.forcedColors),
	};

	return mediaQueries;
}

/**
 * Read explicit calm mode URL override from `?calm=`.
 *
 * @returns `true` for explicit calm-on, `false` for explicit calm-off,
 * or `null` when unset/invalid.
 */
export function getCalmOverride(): boolean | null {
	if (typeof window === 'undefined') return null;

	const raw = new URLSearchParams(window.location.search).get(CALM_PARAM);
	if (raw === null) return null;
	const value = raw.trim();
	if (CALM_ON_RE.test(value)) return true;
	if (CALM_OFF_RE.test(value)) return false;
	return null;
}

/**
 * Check if any accessibility preference currently requests calmer visuals.
 *
 * @returns `true` when any calm media query matches.
 */
export function getAccessibilityCalm(): boolean {
	const queries = getMediaQueries();
	if (queries === null) return false;

	return Object.values(queries).some((mq) => mq.matches);
}

/**
 * Detect if the browser is WebKit (but not Chromium/Blink).
 *
 * WebKit has poor performance with high-frequency CSS custom property updates,
 * causing excessive CPU usage with the storm animations. Chromium-based browsers
 * (Chrome, Edge, Brave) handle this efficiently and should not be affected.
 *
 * @returns `true` for Safari, Epiphany, GNOME Web, and other pure WebKit browsers.
 */
export function isNonChromiumWebKit(): boolean {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		return false;
	}

	const ua = navigator.userAgent;

	// WebKit browsers include "AppleWebKit" in their UA
	const hasAppleWebKit = /AppleWebKit/i.test(ua);
	if (!hasAppleWebKit) return false;

	// Chromium-based browsers include "Chrome" or "Chromium" in their UA
	// Exclude them since they handle the animations efficiently
	const isChromiumBased = /Chrome|Chromium|Edg/i.test(ua);
	if (isChromiumBased) return false;

	// Pure WebKit: Safari, Epiphany, GNOME Web, etc.
	return true;
}

/**
 * Resolve effective calm mode state.
 *
 * URL override has precedence over accessibility-derived calm state.
 * WebKit browsers (except Chromium-based) automatically enable calm mode
 * due to poor performance with high-frequency CSS custom property updates.
 */
export function shouldCalm(): boolean {
	const override = getCalmOverride();
	if (override !== null) return override;

	// Auto-enable calm mode on WebKit to avoid performance issues
	if (isNonChromiumWebKit()) return true;

	return getAccessibilityCalm();
}

/**
 * Subscribe to changes in calm-relevant media queries.
 *
 * @param onChange - Callback fired when any calm signal changes.
 * @returns Cleanup function removing all registered listeners.
 */
export function subscribeCalmSignals(onChange: () => void): () => void {
	const cleanup: (() => void)[] = [];
	const queries = getMediaQueries();
	if (queries === null) return noopCleanup;

	for (const mq of Object.values(queries)) {
		const handler = (): void => {
			onChange();
		};

		if (typeof mq.addEventListener === 'function') {
			mq.addEventListener('change', handler);
			cleanup.push((): void => {
				mq.removeEventListener('change', handler);
			});
		} else {
			const legacyMq: LegacyMediaQueryList = mq;
			const addLegacyListener = legacyMq.addListener;
			const removeLegacyListener = legacyMq.removeListener;

			if (typeof addLegacyListener !== 'function' || typeof removeLegacyListener !== 'function') {
				continue;
			}

			addLegacyListener.call(mq, handler);
			cleanup.push((): void => {
				removeLegacyListener.call(mq, handler);
			});
		}
	}

	return (): void => {
		for (const fn of cleanup) fn();
	};
}
