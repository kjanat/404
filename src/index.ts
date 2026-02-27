/**
 * 404 page entry point — calm-mode orchestration and page initialization.
 *
 * Detects accessibility preferences (`prefers-reduced-motion`, `prefers-contrast`,
 * `forced-colors`) and an explicit `?calm=` URL override to toggle calm mode.
 * When calm, the {@linkcode StormEngine} is stopped and the `calm-mode` CSS class
 * is applied; otherwise lightning animations run procedurally.
 *
 * @module
 */

import { generateCloudBackground, StormEngine } from './storm';

/** URL query parameter name for the explicit calm-mode override. */
const CALM_PARAM = 'calm';

/** CSS class toggled on `<html>` and `<body>` when calm mode is active. */
const CALM_CLASS = 'calm-mode';

/** Matches truthy override values: `1`, `true`, `yes`, `on`. */
const CALM_ON_RE = /^(1|true|yes|on)$/i;

/** Matches falsy override values: `0`, `false`, `no`, `off`. */
const CALM_OFF_RE = /^(0|false|no|off)$/i;

/**
 * Media query definitions whose activation triggers calm mode.
 *
 * Any single match is sufficient — we err on the side of reducing motion.
 */
const mediaQueryDefs = {
	reduceMotion: '(prefers-reduced-motion: reduce)',
	moreContrast: '(prefers-contrast: more)',
	forcedColors: '(forced-colors: active)',
} as const;

/** Discriminant key for each accessibility media query. */
type CalmSignal = keyof typeof mediaQueryDefs;

/** Live `MediaQueryList` handles for each {@linkcode CalmSignal}. */
const mediaQueries: Record<CalmSignal, MediaQueryList> = Object.fromEntries(
	Object.entries(mediaQueryDefs).map(([key, query]) => [key, window.matchMedia(query)]),
) as Record<CalmSignal, MediaQueryList>;

/**
 * Read the explicit `?calm=` URL parameter.
 *
 * @returns `true` if the user explicitly requested calm, `false` if they
 *   explicitly disabled it, or `null` if no override is present.
 */
function getCalmOverride(): boolean | null {
	const raw = new URLSearchParams(window.location.search).get(CALM_PARAM);
	if (raw === null) return null;
	if (CALM_ON_RE.test(raw)) return true;
	if (CALM_OFF_RE.test(raw)) return false;
	return null;
}

/**
 * Check whether any accessibility media query currently matches.
 *
 * @returns `true` if at least one of `prefers-reduced-motion`,
 *   `prefers-contrast: more`, or `forced-colors: active` is active.
 */
function getAccessibilityCalm(): boolean {
	return Object.values(mediaQueries).some((mq) => mq.matches);
}

/**
 * Resolve the current calm-mode state.
 *
 * The explicit URL override takes precedence; if absent, accessibility
 * media queries are consulted.
 *
 * @returns `true` if the page should be in calm mode.
 */
function shouldCalm(): boolean {
	return getCalmOverride() ?? getAccessibilityCalm();
}

/**
 * Apply or remove calm mode and start/stop the storm engine accordingly.
 *
 * Toggles the `calm-mode` class on both `<html>` and `<body>`, then
 * calls {@linkcode StormEngine.start | start()} or
 * {@linkcode StormEngine.stop | stop()} to match.
 *
 * @param storm - The storm engine instance to control.
 */
function applyCalmMode(storm: StormEngine): void {
	const calm = shouldCalm();
	document.documentElement.classList.toggle(CALM_CLASS, calm);
	document.body.classList.toggle(CALM_CLASS, calm);

	if (calm) {
		storm.stop();
	} else {
		storm.start();
	}
}

/**
 * Subscribe to runtime changes in accessibility media queries.
 *
 * Registers `change` listeners on each {@linkcode MediaQueryList} and
 * returns a teardown function that removes all listeners.
 *
 * @param onChange - Callback invoked when any calm-relevant media query changes.
 * @returns Cleanup function that unsubscribes all listeners.
 */
function subscribeCalmSignals(onChange: () => void): () => void {
	const cleanup: (() => void)[] = [];

	for (const mq of Object.values(mediaQueries)) {
		const handler = (): void => {
			onChange();
		};

		if (typeof mq.addEventListener === 'function') {
			mq.addEventListener('change', handler);
			cleanup.push((): void => {
				mq.removeEventListener('change', handler);
			});
		}
	}

	return (): void => {
		for (const fn of cleanup) fn();
	};
}

/**
 * Populate dynamic host-dependent content.
 *
 * Sets `textContent` of all `[data-host]` elements to the current hostname
 * and updates `document.title` to `404 | <hostname>`.
 */
function initializePage(): void {
	const host = window.location.hostname;
	if (!host) return;

	for (const target of document.querySelectorAll<HTMLElement>('[data-host]')) {
		target.textContent = host;
	}

	document.title = `404 | ${host}`;
}

((): void => {
	document.documentElement.style.setProperty('--cloud-bg', generateCloudBackground());
	const storm = new StormEngine();
	applyCalmMode(storm);
	subscribeCalmSignals(() => {
		applyCalmMode(storm);
	});
	initializePage();
})();
