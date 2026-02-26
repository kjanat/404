const CALM_PARAM = 'calm';
const CALM_CLASS = 'calm-mode';

const CALM_ON_RE = /^(1|true|yes|on)$/i;
const CALM_OFF_RE = /^(0|false|no|off)$/i;

const mediaQueryDefs = {
	reduceMotion: '(prefers-reduced-motion: reduce)',
	moreContrast: '(prefers-contrast: more)',
	forcedColors: '(forced-colors: active)',
} as const;

type CalmSignal = keyof typeof mediaQueryDefs;

const mediaQueries: Record<CalmSignal, MediaQueryList> = Object.fromEntries(
	Object.entries(mediaQueryDefs).map(([key, query]) => [key, window.matchMedia(query)]),
) as Record<CalmSignal, MediaQueryList>;

function getCalmOverride(): boolean | null {
	const raw = new URLSearchParams(window.location.search).get(CALM_PARAM);
	if (raw === null) return null;
	if (CALM_ON_RE.test(raw)) return true;
	if (CALM_OFF_RE.test(raw)) return false;
	return null;
}

function getAccessibilityCalm(): boolean {
	return Object.values(mediaQueries).some((mq) => mq.matches);
}

function applyCalmMode(): void {
	const shouldCalm = getCalmOverride() ?? getAccessibilityCalm();
	document.documentElement.classList.toggle(CALM_CLASS, shouldCalm);
	document.body.classList.toggle(CALM_CLASS, shouldCalm);
}

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

function initializePage(): void {
	const host = window.location.hostname;
	if (!host) return;

	for (const target of document.querySelectorAll<HTMLElement>('[data-host]')) {
		target.textContent = host;
	}

	document.title = `404 | ${host}`;
}

((): void => {
	applyCalmMode();
	subscribeCalmSignals(applyCalmMode);
	initializePage();
})();
