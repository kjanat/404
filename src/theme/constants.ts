/**
 * localStorage key storing persisted theme preference.
 *
 * Use when persisting or reading preference via {@link ./preference.ts#writeThemePreference}
 * and {@link ./preference.ts#readThemePreference}.
 */
export const THEME_STORAGE_KEY = 'kjanat-theme-preference';

/**
 * Attribute storing resolved theme (`light` or `dark`).
 *
 * Use when syncing resolved theme state in {@link ./controls.ts#initializeThemeControls}.
 */
export const THEME_ATTR = 'data-theme';

/**
 * Attribute storing user preference (`system`/`light`/`dark`).
 *
 * Use when syncing selected preference state in {@link ./controls.ts#initializeThemeControls}.
 */
export const THEME_PREFERENCE_ATTR = 'data-theme-preference';

/**
 * Attribute set when URL explicitly locks theme selection.
 *
 * Use when URL override is detected in {@link ./controls.ts#initializeThemeControls}.
 */
export const THEME_LOCKED_ATTR = 'data-theme-locked';

/**
 * URL query parameter names accepted for theme override.
 *
 * Use when scanning URL parameters in {@link ./preference.ts#readThemeOverride}.
 */
export const THEME_PARAM_NAMES = ['theme', 'mode'] as const;
