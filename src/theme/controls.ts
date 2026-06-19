import { THEME_ATTR, THEME_LOCKED_ATTR, THEME_PREFERENCE_ATTR } from '#404/theme/constants';
import {
	parseThemeOption,
	readThemeOverride,
	readThemePreference,
	resolveTheme,
	systemThemeQuery,
	writeThemePreference,
} from '#404/theme/preference';
import type { ThemeName, ThemePreference } from '#404/theme/types';
import { hasViewTransitionApi } from '#404/theme/view-transition';

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

interface LegacyMediaQueryList {
	readonly addListener?: (handler: () => void) => void;
	readonly removeListener?: (handler: () => void) => void;
}

let themeControlsInitialized = false;
let disposeThemeControls: (() => void) | null = null;

function updateThemeSwitch(
	options: readonly HTMLInputElement[],
	preference: ThemePreference,
	resolvedTheme: ThemeName,
): void {
	for (const optionInput of options) {
		const option = parseThemeOption(optionInput.dataset.themeOption);
		if (option === null) continue;

		const isSelected = option === preference;
		optionInput.checked = isSelected;
		optionInput.tabIndex = isSelected ? 0 : -1;

		if (option === 'system') {
			const autoLabel = `Auto (${resolvedTheme})`;
			optionInput.setAttribute('aria-label', autoLabel);
			optionInput.setAttribute('title', autoLabel);
			continue;
		}

		const themeLabel = `${option} theme`;
		optionInput.setAttribute('aria-label', themeLabel);
		optionInput.setAttribute('title', themeLabel);
	}
}

function applyTheme(
	theme: ThemeName,
	preference: ThemePreference,
	options: readonly HTMLInputElement[],
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
	const validOptions = Array.from(document.querySelectorAll<HTMLInputElement>('[data-theme-option]')).flatMap(
		(optionInput) => {
			const option = parseThemeOption(optionInput.dataset.themeOption);
			return option === null ? [] : [{ optionInput, option }];
		},
	);
	const optionInputs = validOptions.map(({ optionInput }) => optionInput);
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
		setThemeDrawerOpen(false);
	} else {
		document.documentElement.removeAttribute(THEME_LOCKED_ATTR);
	}

	let preference = themeOverride.preference ?? (themeOverride.hasParam ? 'system' : readThemePreference());

	const syncTheme = (animate: boolean): void => {
		const resolvedTheme = resolveTheme(preference);
		applyTheme(resolvedTheme, preference, optionInputs, animate);
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
					const checked = themeDrawer.querySelector<HTMLInputElement>('[data-theme-option]:checked');
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

		for (const { optionInput, option } of validOptions) {
			const onOptionChange = (): void => {
				preference = option;
				writeThemePreference(preference);
				syncTheme(true);
			};
			optionInput.addEventListener('change', onOptionChange);
			cleanup.push((): void => {
				optionInput.removeEventListener('change', onOptionChange);
			});
		}
	}

	if (!themeOverride.hasParam && switchRoot && optionInputs.length > 0) {
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

			let currentIndex = document.activeElement instanceof HTMLInputElement
				? optionInputs.indexOf(document.activeElement)
				: -1;
			if (currentIndex < 0) {
				currentIndex = optionInputs.findIndex((optionInput) => optionInput.checked);
			}
			if (currentIndex < 0) {
				currentIndex = 0;
			}

			let nextIndex = currentIndex;

			if (event.key === 'ArrowRight') {
				nextIndex = (currentIndex + 1) % optionInputs.length;
			}

			if (event.key === 'ArrowLeft') {
				nextIndex = (currentIndex + optionInputs.length - 1) % optionInputs.length;
			}

			if (event.key === 'Home') {
				nextIndex = 0;
			}

			if (event.key === 'End') {
				nextIndex = optionInputs.length - 1;
			}

			const nextOption = optionInputs[nextIndex];
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
