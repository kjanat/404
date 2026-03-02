/** localStorage key storing persisted theme preference. */
export const THEME_STORAGE_KEY = 'kjanat-theme-preference';

/** Attribute storing resolved theme (`light` or `dark`). */
export const THEME_ATTR = 'data-theme';

/** Attribute storing user preference (`system`/`light`/`dark`). */
export const THEME_PREFERENCE_ATTR = 'data-theme-preference';

/** Attribute set when URL explicitly locks theme selection. */
export const THEME_LOCKED_ATTR = 'data-theme-locked';

/** URL query parameter names accepted for theme override. */
export const THEME_PARAM_NAMES = ['theme', 'mode'] as const;
