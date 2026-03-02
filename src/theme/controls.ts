import { THEME_ATTR, THEME_LOCKED_ATTR, THEME_PREFERENCE_ATTR } from './constants.ts';
import {
	parseThemeOption,
	readThemeOverride,
	readThemePreference,
	resolveTheme,
	systemThemeQuery,
	writeThemePreference,
} from './preference.ts';
import type { ThemeName, ThemePreference } from './types.ts';
import { hasViewTransitionApi } from './view-transition.ts';

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

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

/**
 * Initialize interactive theme controls and keep DOM theme attrs in sync.
 *
 * Handles URL-locked mode, localStorage persistence, keyboard navigation,
 * drawer open/close behavior, and system theme change reactions.
 */
export function initializeThemeControls(): void {
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
