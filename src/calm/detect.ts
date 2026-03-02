import {
	CALM_OFF_RE,
	CALM_ON_RE,
	CALM_PARAM,
	mediaQueryDefs,
	type CalmSignal,
} from './constants.ts';

const mediaQueries: Record<CalmSignal, MediaQueryList> = {
	reduceMotion: window.matchMedia(mediaQueryDefs.reduceMotion),
	moreContrast: window.matchMedia(mediaQueryDefs.moreContrast),
	forcedColors: window.matchMedia(mediaQueryDefs.forcedColors),
};

/**
 * Read explicit calm mode URL override from `?calm=`.
 *
 * @returns `true` for explicit calm-on, `false` for explicit calm-off,
 * or `null` when unset/invalid.
 */
export function getCalmOverride(): boolean | null {
	const raw = new URLSearchParams(window.location.search).get(CALM_PARAM);
	if (raw === null) return null;
	if (CALM_ON_RE.test(raw)) return true;
	if (CALM_OFF_RE.test(raw)) return false;
	return null;
}

/**
 * Check if any accessibility preference currently requests calmer visuals.
 *
 * @returns `true` when any calm media query matches.
 */
export function getAccessibilityCalm(): boolean {
	return Object.values(mediaQueries).some((mq) => mq.matches);
}

/**
 * Resolve effective calm mode state.
 *
 * URL override has precedence over accessibility-derived calm state.
 */
export function shouldCalm(): boolean {
	return getCalmOverride() ?? getAccessibilityCalm();
}

/**
 * Subscribe to changes in calm-relevant media queries.
 *
 * @param onChange - Callback fired when any calm signal changes.
 * @returns Cleanup function removing all registered listeners.
 */
export function subscribeCalmSignals(onChange: () => void): () => void {
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
