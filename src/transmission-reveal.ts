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
 * How long the fully revealed message lingers after keying completes before the
 * original headline is restored (ms).
 */
const SETTLE_MS = 1100;

let savedHeadline: string | null = null;
let currentMessage = '';
let restoreTimerId: number | null = null;
let syncTimerIds: number[] = [];

function getHeadline(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-headline]');
}

function clearSyncTimers(): void {
	for (const id of syncTimerIds) window.clearTimeout(id);
	syncTimerIds = [];
}

function modeClasses(): string[] {
	return Object.values(MODE_CLASS);
}

/**
 * Begin revealing a decoded transmission message in the headline.
 *
 * Captures the live headline copy on the first call of a run so overlapping
 * transmissions always restore the real text. The visual treatment follows
 * {@link REVEAL_MODE}.
 *
 * @param message - Decoded plain-text message being keyed.
 * @param durationMs - Total keying duration, used to pace the `sync` reveal.
 */
export function startHeadlineReveal(message: string, durationMs: number): void {
	const headline = getHeadline();
	if (!headline) return;

	if (restoreTimerId !== null) {
		// Already mid-reveal: keep the captured headline and just retarget it.
		window.clearTimeout(restoreTimerId);
		restoreTimerId = null;
	} else {
		savedHeadline = headline.textContent;
	}
	clearSyncTimers();

	currentMessage = message;
	headline.classList.add(REVEAL_CLASS, MODE_CLASS[REVEAL_MODE]);

	if (REVEAL_MODE === 'sync') {
		const chars = Array.from(message);
		headline.textContent = '';
		chars.forEach((_, index) => {
			const at = (durationMs * (index + 1)) / chars.length;
			syncTimerIds.push(
				window.setTimeout(() => {
					headline.textContent = message.slice(0, index + 1);
				}, at),
			);
		});
	} else {
		headline.textContent = message;
	}
}

/**
 * End a headline reveal.
 *
 * On natural completion the full message is pinned for a short settle before the
 * original headline returns; an interrupted run restores immediately.
 *
 * @param immediate - Restore the original headline at once (transmission aborted).
 */
export function endHeadlineReveal(immediate: boolean): void {
	const headline = getHeadline();
	if (!headline) return;

	clearSyncTimers();
	if (restoreTimerId !== null) {
		window.clearTimeout(restoreTimerId);
		restoreTimerId = null;
	}

	const restore = (): void => {
		headline.textContent = savedHeadline;
		savedHeadline = null;
		headline.classList.remove(REVEAL_CLASS, ...modeClasses());
		restoreTimerId = null;
	};

	if (immediate) {
		restore();
		return;
	}

	// Pin the complete message (covers a sync run whose last tick was cancelled),
	// hold briefly, then restore the original copy.
	headline.textContent = currentMessage;
	restoreTimerId = window.setTimeout(restore, SETTLE_MS);
}
