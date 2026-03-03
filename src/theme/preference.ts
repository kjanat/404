import { THEME_PARAM_NAMES, THEME_STORAGE_KEY } from './constants.ts';
import type { ThemeName, ThemePreference } from './types.ts';

/** `prefers-color-scheme` query used to resolve `system` preference. */
export const systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');

/** Parsed URL theme override, with explicit param presence signal. */
export interface ThemeOverride {
	/** True when URL contains `?theme=` or `?mode=` regardless of validity. */
	hasParam: boolean;
	/** Parsed preference value, or `null` if override value is invalid. */
	preference: ThemePreference | null;
}

function parseThemePreference(raw: string | null): ThemePreference {
	if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
	return 'system';
}

/**
 * Read persisted theme preference from localStorage.
 *
 * Falls back to `system` when storage is unavailable or value is invalid.
 */
export function readThemePreference(): ThemePreference {
	try {
		return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
	} catch {
		return 'system';
	}
}

/**
 * Persist theme preference to localStorage.
 *
 * Storage failures are ignored to keep rendering resilient in restricted envs.
 *
 * @param value - Preference to persist.
 */
export function writeThemePreference(value: ThemePreference): void {
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, value);
	} catch {
		return;
	}
}

/**
 * Resolve a user preference to an actual theme token.
 *
 * @param preference - User-selected preference.
 * @returns `light` or `dark` based on preference and system setting.
 */
export function resolveTheme(preference: ThemePreference): ThemeName {
	if (preference === 'system') {
		return systemThemeQuery.matches ? 'light' : 'dark';
	}

	return preference;
}

/**
 * Parse a `data-theme-option` value from the theme switch DOM.
 *
 * @param raw - Raw dataset value.
 * @returns Parsed preference or `null` for unknown values.
 */
export function parseThemeOption(raw: string | undefined): ThemePreference | null {
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

/**
 * Read URL theme override from `?theme=` or `?mode=`.
 *
 * `auto` is normalized to `system`. Invalid values keep `hasParam: true` and
 * return `preference: null` so caller can lock UI while preserving safe fallback.
 */
export function readThemeOverride(): ThemeOverride {
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
