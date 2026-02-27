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

const THEME_STORAGE_KEY = 'kjanat-theme-preference';
const THEME_ATTR = 'data-theme';
const THEME_PREFERENCE_ATTR = 'data-theme-preference';
const PAGE_READY_CLASS = 'page-ready';

const systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

type ThemePreference = 'system' | 'light' | 'dark';
type ThemeName = 'light' | 'dark';

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
const mediaQueries: Record<CalmSignal, MediaQueryList> = {
	reduceMotion: window.matchMedia(mediaQueryDefs.reduceMotion),
	moreContrast: window.matchMedia(mediaQueryDefs.moreContrast),
	forcedColors: window.matchMedia(mediaQueryDefs.forcedColors),
};

type StartViewTransition = Exclude<Document['startViewTransition'], undefined>;

function hasViewTransitionApi(
	doc: Document,
): doc is Document & { startViewTransition: StartViewTransition } {
	return typeof doc.startViewTransition === 'function';
}

function parseThemePreference(raw: string | null): ThemePreference {
	if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
	return 'system';
}

function readThemePreference(): ThemePreference {
	try {
		return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
	} catch {
		return 'system';
	}
}

function writeThemePreference(value: ThemePreference): void {
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, value);
	} catch {
		return;
	}
}

function resolveTheme(preference: ThemePreference): ThemeName {
	if (preference === 'system') {
		return systemThemeQuery.matches ? 'light' : 'dark';
	}

	return preference;
}

function parseThemeOption(raw: string | undefined): ThemePreference | null {
	if (raw === 'system' || raw === 'light' || raw === 'dark') return raw;
	return null;
}

function updateThemeSwitch(
	options: readonly HTMLButtonElement[],
	preference: ThemePreference,
	resolvedTheme: ThemeName,
): void {
	for (const optionButton of options) {
		const option = parseThemeOption(optionButton.dataset.themeOption);
		if (option === null) continue;

		const isSelected = option === preference;
		optionButton.setAttribute('aria-checked', String(isSelected));
		optionButton.tabIndex = isSelected ? 0 : -1;

		if (option === 'system') {
			const autoLabel = `Auto (${resolvedTheme})`;
			optionButton.setAttribute('aria-label', autoLabel);
			optionButton.setAttribute('title', autoLabel);
			continue;
		}

		const themeLabel = `${option} theme`;
		optionButton.setAttribute('aria-label', themeLabel);
		optionButton.setAttribute('title', themeLabel);
	}
}

function applyTheme(
	theme: ThemeName,
	preference: ThemePreference,
	options: readonly HTMLButtonElement[],
	animate: boolean,
): void {
	const commit = (): void => {
		document.documentElement.setAttribute(THEME_ATTR, theme);
		document.documentElement.setAttribute(THEME_PREFERENCE_ATTR, preference);
		document.body.setAttribute(THEME_ATTR, theme);
		document.body.setAttribute(THEME_PREFERENCE_ATTR, preference);
		updateThemeSwitch(options, preference, theme);
	};

	if (animate && !reduceMotionQuery.matches && hasViewTransitionApi(document)) {
		document.startViewTransition(() => {
			commit();
		});
		return;
	}

	commit();
}

function initializeThemeControls(): void {
	const options = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-theme-option]'));
	const switchRoot = document.querySelector<HTMLElement>('[data-theme-switch]');
	let preference = readThemePreference();

	const syncTheme = (animate: boolean): void => {
		applyTheme(resolveTheme(preference), preference, options, animate);
	};

	for (const optionButton of options) {
		const option = parseThemeOption(optionButton.dataset.themeOption);
		if (option === null) continue;

		optionButton.addEventListener('click', () => {
			preference = option;
			writeThemePreference(preference);
			syncTheme(true);
		});
	}

	if (switchRoot && options.length > 0) {
		switchRoot.addEventListener('keydown', (event) => {
			if (
				event.key !== 'ArrowRight'
				&& event.key !== 'ArrowLeft'
				&& event.key !== 'Home'
				&& event.key !== 'End'
			) {
				return;
			}

			event.preventDefault();

			let currentIndex = options.findIndex((optionButton) => optionButton === document.activeElement);
			if (currentIndex < 0) {
				currentIndex = options.findIndex((optionButton) => optionButton.getAttribute('aria-checked') === 'true');
			}
			if (currentIndex < 0) {
				currentIndex = 0;
			}

			let nextIndex = currentIndex;

			if (event.key === 'ArrowRight') {
				nextIndex = (currentIndex + 1) % options.length;
			}

			if (event.key === 'ArrowLeft') {
				nextIndex = (currentIndex + options.length - 1) % options.length;
			}

			if (event.key === 'Home') {
				nextIndex = 0;
			}

			if (event.key === 'End') {
				nextIndex = options.length - 1;
			}

			const nextOption = options[nextIndex];
			if (!nextOption) return;

			nextOption.focus();
			nextOption.click();
		});
	}

	if (typeof systemThemeQuery.addEventListener === 'function') {
		systemThemeQuery.addEventListener('change', () => {
			if (preference === 'system') {
				syncTheme(false);
			}
		});
	}

	syncTheme(false);
}

function initializePanelInteractivity(): void {
	const panel = document.querySelector<HTMLElement>('.panel');
	if (!panel) return;

	const resetPanelStyle = (): void => {
		panel.style.setProperty('--panel-tilt-x', '0');
		panel.style.setProperty('--panel-tilt-y', '0');
		panel.style.setProperty('--panel-glint-x', '20%');
		panel.style.setProperty('--panel-glint-y', '0%');
		panel.style.setProperty('--panel-press-depth', '0');
	};

	resetPanelStyle();

	panel.addEventListener('pointermove', (event) => {
		if (reduceMotionQuery.matches) return;

		const rect = panel.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;

		const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

		const tiltX = (x - 0.5) * 4.8;
		const tiltY = (0.5 - y) * 4.2;

		panel.style.setProperty('--panel-tilt-x', tiltX.toFixed(2));
		panel.style.setProperty('--panel-tilt-y', tiltY.toFixed(2));
		panel.style.setProperty('--panel-glint-x', `${(x * 100).toFixed(1)}%`);
		panel.style.setProperty('--panel-glint-y', `${(y * 100).toFixed(1)}%`);
	});

	panel.addEventListener('pointerleave', resetPanelStyle);

	panel.addEventListener('pointerdown', () => {
		if (reduceMotionQuery.matches) return;
		panel.style.setProperty('--panel-press-depth', '1');
	});

	const clearPressDepth = (): void => {
		panel.style.setProperty('--panel-press-depth', '0');
	};

	panel.addEventListener('pointerup', clearPressDepth);
	panel.addEventListener('pointercancel', clearPressDepth);

	if (typeof reduceMotionQuery.addEventListener === 'function') {
		reduceMotionQuery.addEventListener('change', () => {
			if (reduceMotionQuery.matches) {
				resetPanelStyle();
			}
		});
	}
}

function markPageReady(): void {
	requestAnimationFrame(() => {
		document.body.classList.add(PAGE_READY_CLASS);
	});
}

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
	initializeThemeControls();
	initializePanelInteractivity();
	markPageReady();

	const storm = new StormEngine();
	applyCalmMode(storm);
	subscribeCalmSignals(() => {
		applyCalmMode(storm);
	});

	initializePage();
})();
