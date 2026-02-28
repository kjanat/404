/**
 * Early theme detection — render-blocking, runs before first paint.
 *
 * Sets `data-theme` on `<html>` from URL param, localStorage, or system
 * preference so the correct CSS custom properties apply immediately.
 *
 * Compiled and inlined by the `inline-script` Vite plugin.
 */
(() => {
	try {
		const root = document.documentElement;
		const params = new URLSearchParams(window.location.search);
		const rawOverride = params.get('theme') ?? params.get('mode');
		const normalizedOverride = rawOverride?.trim().toLowerCase();

		const resolveSystem = (): 'light' | 'dark' =>
			window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

		const setTheme = (theme: string, preference: string): void => {
			root.setAttribute('data-theme', theme);
			root.setAttribute('data-theme-preference', preference);
		};

		if (rawOverride !== null) {
			root.setAttribute('data-theme-locked', 'true');

			if (normalizedOverride === 'light' || normalizedOverride === 'dark') {
				setTheme(normalizedOverride, normalizedOverride);
				return;
			}

			setTheme(resolveSystem(), 'system');
			return;
		}

		const saved = window.localStorage.getItem('kjanat-theme-preference');
		if (saved === 'light' || saved === 'dark') {
			setTheme(saved, saved);
		} else {
			setTheme(resolveSystem(), 'system');
		}
	} catch { /* swallow — dark fallback is safe */ }
})();
