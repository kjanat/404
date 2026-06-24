/**
 * Headline reveal modes for a morse transmission.
 *
 * - `intensify`: the whole decoded message fades into the headline and grows
 *   brighter/larger as the keying progresses (driven by `--transmission-progress`).
 * - `sync`: the message is typed out letter-by-letter, paced across the keying
 *   duration so the text assembles roughly in step with the lightning.
 */
export type RevealMode = 'intensify' | 'sync';

/**
 * Active reveal style. Swap this single constant to change how the decoded
 * message surfaces in the headline during a transmission.
 */
const REVEAL_MODE: RevealMode = 'intensify';

/** Base class marking the headline as showing a decoded transmission. */
const REVEAL_CLASS = 'headline-transmission';

/** Mode-specific class applied alongside {@link REVEAL_CLASS}. */
const MODE_CLASS: Readonly<Record<RevealMode, string>> = {
	intensify: 'is-intensify',
	sync: 'is-sync',
};

/**
 * Cross-fade duration for swapping copy in and out of the headline (ms).
 *
 * Keep in sync with the `opacity` transition on `.headline-transmission`.
 */
const FADE_MS = 240;

/**
 * How long the fully revealed message lingers after keying completes before the
 * original headline fades back in (ms).
 */
const SETTLE_MS = 1100;

let savedHeadline: string | null = null;
let currentMessage = '';
let timerIds: number[] = [];

function getHeadline(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-headline]');
}

function getPanel(): HTMLElement | null {
	return document.querySelector<HTMLElement>('.panel');
}

/** Pin the panel's current height so the swapped copy can't resize the box. */
function freezePanelHeight(): void {
	const panel = getPanel();
	if (panel) panel.style.minHeight = `${panel.offsetHeight}px`;
}

/** Release the pinned panel height. */
function releasePanelHeight(): void {
	getPanel()?.style.removeProperty('min-height');
}

function clearTimers(): void {
	for (const id of timerIds) window.clearTimeout(id);
	timerIds = [];
}

function after(ms: number, run: () => void): void {
	timerIds.push(window.setTimeout(run, ms));
}

function modeClasses(): string[] {
	return Object.values(MODE_CLASS);
}

/**
 * Begin revealing a decoded transmission message in the headline.
 *
 * The current headline fades out, the copy is swapped at the trough of the fade,
 * then the active {@link REVEAL_MODE} fades the decoded message in. The live
 * headline text is captured once per run so overlapping transmissions always
 * restore the real copy.
 *
 * @param message - Decoded plain-text message being keyed.
 * @param durationMs - Total keying duration, used to pace the `sync` reveal.
 */
export function startHeadlineReveal(message: string, durationMs: number): void {
	const headline = getHeadline();
	if (!headline) return;

	if (savedHeadline === null) {
		savedHeadline = headline.textContent;
		// Lock the box at its pre-reveal size before any copy swap reflows it.
		freezePanelHeight();
	}
	clearTimers();
	currentMessage = message;

	// Fade the current headline out (copy + colour untouched) so the swap lands
	// while it is invisible.
	headline.classList.add(REVEAL_CLASS);
	headline.style.opacity = '0';

	after(FADE_MS, () => {
		headline.classList.add(MODE_CLASS[REVEAL_MODE]);

		if (REVEAL_MODE === 'sync') {
			const chars = Array.from(message);
			headline.textContent = '';
			chars.forEach((_, index) => {
				const at = Math.max(0, (durationMs * (index + 1)) / chars.length - FADE_MS);
				after(at, () => {
					headline.textContent = message.slice(0, index + 1);
				});
			});
		} else {
			headline.textContent = message;
		}

		// Hand opacity back to the mode rule, which fades the message in.
		headline.style.removeProperty('opacity');
	});
}

/**
 * End a headline reveal.
 *
 * On natural completion the full message is pinned, held briefly, then
 * cross-faded back to the original headline. An interrupted run restores at once.
 *
 * @param immediate - Restore the original headline without a fade (transmission aborted).
 */
export function endHeadlineReveal(immediate: boolean): void {
	const headline = getHeadline();
	if (!headline) return;

	clearTimers();

	if (immediate) {
		headline.textContent = savedHeadline;
		headline.classList.remove(REVEAL_CLASS, ...modeClasses());
		headline.style.removeProperty('opacity');
		releasePanelHeight();
		savedHeadline = null;
		return;
	}

	// Pin the complete message (covers a sync run whose last tick was cancelled).
	headline.classList.add(REVEAL_CLASS, MODE_CLASS[REVEAL_MODE]);
	headline.textContent = currentMessage;
	headline.style.removeProperty('opacity');

	after(SETTLE_MS, () => {
		headline.style.opacity = '0'; // fade the message out
		after(FADE_MS, () => {
			headline.textContent = savedHeadline;
			headline.classList.remove(...modeClasses());
			void headline.offsetWidth; // commit the swap at opacity 0 before fading in
			headline.style.opacity = '1'; // fade the original headline back in
			after(FADE_MS, () => {
				headline.classList.remove(REVEAL_CLASS);
				headline.style.removeProperty('opacity');
				releasePanelHeight();
				savedHeadline = null;
			});
		});
	});
}
