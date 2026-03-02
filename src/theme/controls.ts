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

interface LegacyMediaQueryList {
	readonly addListener?: (handler: () => void) => void;
	readonly removeListener?: (handler: () => void) => void;
}

let themeControlsInitialized = false;
let disposeThemeControls: (() => void) | null = null;

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
	if (themeControlsInitialized && disposeThemeControls !== null) {
		disposeThemeControls();
		disposeThemeControls = null;
		themeControlsInitialized = false;
	}

	const cleanup: (() => void)[] = [];
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
	} else {
		document.documentElement.removeAttribute(THEME_LOCKED_ATTR);
		document.body.removeAttribute(THEME_LOCKED_ATTR);
	}

	let preference = themeOverride.preference ?? (themeOverride.hasParam ? 'system' : readThemePreference());

	const syncTheme = (animate: boolean): void => {
		const resolvedTheme = resolveTheme(preference);
		applyTheme(resolvedTheme, preference, options, animate);
	};

	if (!themeOverride.hasParam) {
		setThemeDrawerOpen(false);

		if (themeDockToggle && themeDrawer) {
			const onThemeDockToggleClick = (): void => {
				setThemeDrawerOpen(themeDrawer.hasAttribute('hidden'));
			};
			themeDockToggle.addEventListener('click', onThemeDockToggleClick);
			cleanup.push((): void => {
				themeDockToggle.removeEventListener('click', onThemeDockToggleClick);
			});
		}

		const onDocumentKeydown = (event: KeyboardEvent): void => {
			if (
				event.repeat
				|| (event.target instanceof HTMLElement && event.target.isContentEditable)
				|| event.target instanceof HTMLInputElement
				|| event.target instanceof HTMLTextAreaElement
				|| event.target instanceof HTMLSelectElement
				|| event.metaKey
				|| event.ctrlKey
				|| event.altKey
			) {
				return;
			}

			if (event.key.toLowerCase() === 't') {
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
		};
		document.addEventListener('keydown', onDocumentKeydown);
		cleanup.push((): void => {
			document.removeEventListener('keydown', onDocumentKeydown);
		});

		const onDocumentClick = (event: MouseEvent): void => {
			if (
				themeDrawer
				&& !themeDrawer.hasAttribute('hidden')
				&& event.target instanceof Node
				&& !themeDrawer.contains(event.target)
				&& !(themeDockToggle?.contains(event.target) ?? false)
			) {
				setThemeDrawerOpen(false);
			}
		};
		document.addEventListener('click', onDocumentClick);
		cleanup.push((): void => {
			document.removeEventListener('click', onDocumentClick);
		});

		for (const optionButton of options) {
			const option = parseThemeOption(optionButton.dataset.themeOption);
			if (option === null) continue;

			const onOptionClick = (): void => {
				preference = option;
				writeThemePreference(preference);
				syncTheme(true);
			};
			optionButton.addEventListener('click', onOptionClick);
			cleanup.push((): void => {
				optionButton.removeEventListener('click', onOptionClick);
			});
		}
	}

	if (!themeOverride.hasParam && switchRoot && options.length > 0) {
		const onSwitchRootKeydown = (event: KeyboardEvent): void => {
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
		};
		switchRoot.addEventListener('keydown', onSwitchRootKeydown);
		cleanup.push((): void => {
			switchRoot.removeEventListener('keydown', onSwitchRootKeydown);
		});
	}

	const handleSystemThemeChange = (): void => {
		if (preference === 'system') {
			syncTheme(false);
		}
	};

	if (typeof systemThemeQuery.addEventListener === 'function') {
		systemThemeQuery.addEventListener('change', handleSystemThemeChange);
		cleanup.push((): void => {
			systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
		});
	} else {
		const legacySystemThemeQuery: LegacyMediaQueryList = systemThemeQuery;
		const addLegacyListener = legacySystemThemeQuery.addListener;
		const removeLegacyListener = legacySystemThemeQuery.removeListener;
		if (typeof addLegacyListener === 'function' && typeof removeLegacyListener === 'function') {
			addLegacyListener.call(systemThemeQuery, handleSystemThemeChange);
			cleanup.push((): void => {
				removeLegacyListener.call(systemThemeQuery, handleSystemThemeChange);
			});
		}
	}

	syncTheme(false);
	disposeThemeControls = (): void => {
		for (const fn of cleanup) fn();
	};
	themeControlsInitialized = true;
}
