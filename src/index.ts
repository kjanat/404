/**
 * 404 page entry point — calm-mode orchestration and page initialization.
 *
 * Detects accessibility preferences (`prefers-reduced-motion`, `prefers-contrast`,
 * `forced-colors`) and an explicit `?calm=` URL override to toggle calm mode.
 * Also supports URL theme override params (`?theme=`/`?mode=`) for locked
 * light/dark/system rendering. When calm, the {@linkcode StormEngine} is
 * stopped and the `calm-mode` CSS class is applied; otherwise lightning
 * animations run procedurally.
 *
 * @module
 */

import { generateCloudBackground, StormEngine } from './storm.ts';

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
const THEME_LOCKED_ATTR = 'data-theme-locked';
const THEME_PARAM_NAMES = ['theme', 'mode'] as const;
const PAGE_READY_CLASS = 'page-ready';
const PANEL_PRESS_SPAM_WINDOW_MS = 1300;
const PANEL_PRESS_SPAM_LIMIT = 4;
const PANEL_PRESS_COOLDOWN_MS = 2400;
const PANEL_PRESS_LOCK_CLASS = 'panel-press-locked';

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

function parseThemeOverride(raw: string | null): ThemePreference | null {
	if (raw === null) return null;

	const normalized = raw.trim().toLowerCase();
	if (normalized === 'light' || normalized === 'dark' || normalized === 'system') {
		return normalized;
	}

	if (normalized === 'auto') {
		return 'system';
	}

	return null;
}

function readThemeOverride(): { hasParam: boolean; preference: ThemePreference | null } {
	const params = new URLSearchParams(window.location.search);

	for (const paramName of THEME_PARAM_NAMES) {
		const raw = params.get(paramName);
		if (raw === null) continue;

		return {
			hasParam: true,
			preference: parseThemeOverride(raw),
		};
	}

	return {
		hasParam: false,
		preference: null,
	};
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
	const themeDockToggle = document.querySelector<HTMLButtonElement>('[data-theme-dock-toggle]');
	const themeDrawer = document.querySelector<HTMLElement>('[data-theme-drawer]');
	const themeOverride = readThemeOverride();

	const setThemeDrawerOpen = (open: boolean): void => {
		if (themeDrawer) {
			themeDrawer.hidden = !open;
		}

		if (themeDockToggle) {
			themeDockToggle.setAttribute('aria-expanded', String(open));
		}
	};

	if (themeOverride.hasParam) {
		document.documentElement.setAttribute(THEME_LOCKED_ATTR, 'true');
		document.body.setAttribute(THEME_LOCKED_ATTR, 'true');
		setThemeDrawerOpen(false);
	}

	let preference = themeOverride.preference ?? (themeOverride.hasParam ? 'system' : readThemePreference());

	const syncTheme = (animate: boolean): void => {
		const resolvedTheme = resolveTheme(preference);
		applyTheme(resolvedTheme, preference, options, animate);
	};

	if (!themeOverride.hasParam) {
		setThemeDrawerOpen(false);

		if (themeDockToggle && themeDrawer) {
			themeDockToggle.addEventListener('click', () => {
				setThemeDrawerOpen(themeDrawer.hasAttribute('hidden'));
			});
		}

		// Keyboard shortcut: press T to toggle scene settings
		document.addEventListener('keydown', (event) => {
			if (
				event.target instanceof HTMLInputElement
				|| event.target instanceof HTMLTextAreaElement
				|| event.target instanceof HTMLSelectElement
				|| event.metaKey
				|| event.ctrlKey
				|| event.altKey
			) {
				return;
			}

			if (event.key === 't' || event.key === 'T') {
				event.preventDefault();
				const isOpen = themeDrawer ? !themeDrawer.hasAttribute('hidden') : false;
				setThemeDrawerOpen(!isOpen);

				if (!isOpen && themeDrawer) {
					const checked = themeDrawer.querySelector<HTMLButtonElement>('[aria-checked="true"]');
					if (checked) checked.focus();
				} else if (themeDockToggle) {
					themeDockToggle.focus();
				}
			}
		});

		// Click outside to close drawer
		document.addEventListener('click', (event) => {
			if (
				themeDrawer
				&& !themeDrawer.hasAttribute('hidden')
				&& event.target instanceof Node
				&& !themeDrawer.contains(event.target)
				&& !(themeDockToggle?.contains(event.target) ?? false)
			) {
				setThemeDrawerOpen(false);
			}
		});

		for (const optionButton of options) {
			const option = parseThemeOption(optionButton.dataset.themeOption);
			if (option === null) continue;

			optionButton.addEventListener('click', () => {
				preference = option;
				writeThemePreference(preference);
				syncTheme(true);
			});
		}
	}

	if (!themeOverride.hasParam && switchRoot && options.length > 0) {
		switchRoot.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				setThemeDrawerOpen(false);
				if (themeDockToggle) {
					themeDockToggle.focus();
				}
				return;
			}

			if (
				event.key !== 'ArrowRight'
				&& event.key !== 'ArrowLeft'
				&& event.key !== 'Home'
				&& event.key !== 'End'
			) {
				return;
			}

			event.preventDefault();

			let currentIndex = document.activeElement instanceof HTMLButtonElement
				? options.indexOf(document.activeElement)
				: -1;
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
	let pressLockUntilMs = 0;
	let pressSamples: number[] = [];
	let pressLockTimerId: number | null = null;

	const clearPressLockTimer = (): void => {
		if (pressLockTimerId === null) return;
		window.clearTimeout(pressLockTimerId);
		pressLockTimerId = null;
	};

	const unlockPanelPress = (): void => {
		pressLockUntilMs = 0;
		panel.classList.remove(PANEL_PRESS_LOCK_CLASS);
		clearPressLockTimer();
	};

	const lockPanelPress = (nowMs: number): void => {
		pressLockUntilMs = nowMs + PANEL_PRESS_COOLDOWN_MS;
		panel.classList.add(PANEL_PRESS_LOCK_CLASS);
		clearPressLockTimer();
		pressLockTimerId = window.setTimeout(() => {
			unlockPanelPress();
		}, PANEL_PRESS_COOLDOWN_MS);
	};

	const clearPressDepth = (): void => {
		panel.style.setProperty('--panel-press-depth', '0');
	};

	const registerPanelPress = (nowMs: number): void => {
		pressSamples = pressSamples.filter((sample) => nowMs - sample <= PANEL_PRESS_SPAM_WINDOW_MS);
		pressSamples.push(nowMs);

		if (pressSamples.length >= PANEL_PRESS_SPAM_LIMIT) {
			pressSamples = [];
			clearPressDepth();
			lockPanelPress(nowMs);
		}
	};

	const resetPanelStyle = (): void => {
		panel.style.setProperty('--panel-tilt-x', '0');
		panel.style.setProperty('--panel-tilt-y', '0');
		panel.style.setProperty('--panel-glint-x', '20%');
		panel.style.setProperty('--panel-glint-y', '0%');
		clearPressDepth();
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

		const nowMs = window.performance.now();
		if (pressLockUntilMs > 0 && nowMs >= pressLockUntilMs) {
			unlockPanelPress();
		}

		if (nowMs < pressLockUntilMs) {
			clearPressDepth();
			return;
		}

		registerPanelPress(nowMs);
		if (nowMs < pressLockUntilMs) return;

		panel.style.setProperty('--panel-press-depth', '1');
	});

	panel.addEventListener('pointerup', clearPressDepth);
	panel.addEventListener('pointercancel', clearPressDepth);

	if (typeof reduceMotionQuery.addEventListener === 'function') {
		reduceMotionQuery.addEventListener('change', () => {
			if (reduceMotionQuery.matches) {
				unlockPanelPress();
				pressSamples = [];
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

/** Randomly selected heading for the 404 page. */
const HEADLINES: readonly [string, ...string[]] = [
	// confused
	'404 \u2014 Huh?',
	'404 \u2014 Who are you?',
	'404 \u2014 What are you doing here?',
	'404 \u2014 Do I know you?',
	'404 \u2014 Wait, what?',
	'404 \u2014 Come again?',
	'404 \u2014 Sorry, who?',
	// blunt
	'404 \u2014 Nope.',
	'404 \u2014 Go home.',
	'404 \u2014 No.',
	'404 \u2014 Absolutely not.',
	'404 \u2014 Not today.',
	'404 \u2014 Try again. Or don\u2019t.',
	'404 \u2014 Nothing to see here.',
	// sassy
	'404 \u2014 Nice try though.',
	'404 \u2014 Not even close.',
	'404 \u2014 You sure about that URL?',
	'404 \u2014 Cute URL. Doesn\u2019t exist.',
	'404 \u2014 Bold of you to assume.',
	'404 \u2014 Bless your heart.',
	// awkward
	'404 \u2014 This is awkward.',
	'404 \u2014 Well, this is embarrassing.',
	'404 \u2014 You seem lost.',
	'404 \u2014 Wrong turn, buddy.',
	'404 \u2014 Somebody lied to you.',
	// dry
	'404 \u2014 This host is not configured.',
	'404 \u2014 There\u2019s nothing here.',
	'404 \u2014 Nobody lives here.',
	'404 \u2014 Plot twist: there is no website.',
	'404 \u2014 The void says hi.',
];

/** A `{host}` placeholder in each template is replaced with the actual hostname. */
const BLURBS: readonly [string, ...string[]] = [
	// existential
	'{host} gazed into the void, and the void gazed back. There\u2019s nothing here \u2014 no site, no config, not even a humble \u2018Hello World.\u2019 If you expected something, someone owes you an apology.',
	'Legend has it that {host} once hosted a website. That legend is wrong. There\u2019s nothing here. There never was.',
	'{host} is the digital equivalent of showing up to a party at the wrong address. Awkward silence. Empty rooms. Check the address.',
	'If {host} were a book, every page would be blank. Avant-garde? Maybe. Useful? Absolutely not.',
	'Somewhere in a parallel universe, {host} is a thriving website. This is not that universe.',
	// deadpan
	'{host} is serving absolutely nothing. Whoever pointed you here probably fat-fingered a DNS record. We\u2019re not pointing fingers, but someone should double-check their work.',
	'You\u2019ve reached {host}. Nobody\u2019s home. We checked. Twice. If you expected a website, the DNS might be lying to you.',
	'{host} has the same energy as a \u2018Coming Soon\u2019 sign that\u2019s been up since 2019. Nothing\u2019s coming. Nothing was ever coming.',
	'The server responded. {host} did not. One of them is doing their job.',
	'Fun fact: {host} has been visited more times than it\u2019s been configured. You\u2019re part of the statistic now. Congratulations.',
	// personified
	'We asked {host} what it wanted to be when it grew up. It hasn\u2019t decided yet. Check back later, or check the address \u2014 one of you is lost.',
	'{host} was supposed to be here, but it ghosted us. Left us on read. Not cool, {host}. Not cool.',
	'{host} called in sick today. No substitute was provided. Please try again when it feels better, or check if you have the right address.',
	'{host} is giving main character energy with zero plot development. Completely empty arc.',
	'Dear {host}, we\u2019ve been trying to reach you about your extended website warranty. Please exist at your earliest convenience.',
	// real estate
	'{host} is a pristine, untouched plot of internet. No tenants, no content, just digital tumbleweeds. If you expected a website here, the address might be wrong \u2014 or the landlord forgot to build.',
	'Welcome to {host}, a beautiful vacant lot on the information superhighway. Zoning permits pending. Utilities not connected. Content: none.',
	'{host}: zero bedrooms, zero bathrooms, zero content. Great bones though. Someone should really develop this property.',
	// poetry & wordplay
	'Roses are red, violets are blue, {host} has no website, and now you\u2019re sad too.',
	'Knock knock. Who\u2019s there? Not {host}, that\u2019s for sure. This domain is emptier than a promises.txt from your last standup.',
	'404: the number of seconds you\u2019ll spend wondering why {host} has nothing on it. Spoiler: nobody configured it.',
	'{host} exists the way your weekend plans do \u2014 technically real, but with absolutely nothing behind it. Check the address, maybe.',
	// tech humor
	'Turns out {host} is a domain, not a website. Common misconception. Like thinking the cloud is actually a cloud.',
	'{host}\u2019s deployment pipeline is flawless: nothing goes in, nothing comes out. Zero bugs. Technically perfect.',
	'SELECT * FROM {host} WHERE content IS NOT NULL returned zero rows. The database is not the problem. There is no database.',
	'{host} runs on 100% renewable energy because it does absolutely nothing. Carbon-neutral by default.',
	'git log for {host} is empty. No commits, no history, no regrets. A clean slate in every sense.',
	// absurdist
	'This page is the only proof that {host} exists. Think of it as a birth certificate for an empty domain. Frame it if you want.',
	'A wise person once said, \u2018If you visit {host} and nothing loads, does the website even exist?\u2019 The answer is no. It does not.',
	'{host} has all the charisma of a 404 page. Oh wait \u2014 that\u2019s exactly what this is.',
];

/** Pick a random element from a non-empty readonly tuple. */
function pickRandom<T>(arr: readonly [T, ...T[]]): T {
	const [fallback] = arr;
	return arr[Math.floor(Math.random() * arr.length)] ?? fallback;
}

/**
 * Populate dynamic host-dependent content.
 *
 * Picks a random headline for `[data-headline]`, a random blurb for
 * `[data-blurb]`, injects the hostname as an accented `<span>`, and
 * updates `document.title` to `404 | <hostname>`.
 */
function initializePage(): void {
	const host = new URLSearchParams(window.location.search).get('host') ?? window.location.hostname;
	if (!host) return;

	const headlineTarget = document.querySelector<HTMLElement>('[data-headline]');
	if (headlineTarget) {
		headlineTarget.textContent = pickRandom(HEADLINES);
	}

	const blurbTarget = document.querySelector<HTMLElement>('[data-blurb]');
	if (blurbTarget) {
		const template = pickRandom(BLURBS);
		const hostSpan = document.createElement('span');
		hostSpan.className = 'font-bold break-all text-accent-2';
		hostSpan.textContent = host;

		const parts = template.split('{host}');
		blurbTarget.textContent = '';
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (i > 0) blurbTarget.appendChild(hostSpan.cloneNode(true));
			if (part) blurbTarget.appendChild(document.createTextNode(part));
		}
	}

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
