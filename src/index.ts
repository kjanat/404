import { applyCalmMode } from '#404/calm/apply';
import { subscribeCalmSignals } from '#404/calm/detect';
import { initializePage } from '#404/page-content';
import { initializePanelInteractivity } from '#404/panel';
import { StormEngine, TRANSMISSION_EVENT, type TransmissionEventDetail } from '#404/storm/engine';
import { initializeThemeControls } from '#404/theme/controls';
import { endHeadlineReveal, startHeadlineReveal } from '#404/transmission-reveal';

/**
 * Body class toggled while a morse transmission is keying.
 *
 * Use when reflecting transmission state for CSS feedback.
 */
const TRANSMITTING_CLASS = 'storm-transmitting';

/**
 * Body class toggled once initial layout and controls are wired.
 *
 * Use when marking ready state in {@link markPageReady}.
 */
const PAGE_READY_CLASS = 'page-ready';

function markPageReady(): void {
	requestAnimationFrame(() => {
		document.body.classList.add(PAGE_READY_CLASS);
	});
}

((): void => {
	initializeThemeControls();

	const storm = new StormEngine();
	initializePanelInteractivity(() => {
		storm.beginTransmission();
	});
	markPageReady();

	document.addEventListener(TRANSMISSION_EVENT, (event) => {
		const { phase, message, durationMs } = (event as CustomEvent<TransmissionEventDetail>).detail;
		document.body.classList.toggle(TRANSMITTING_CLASS, phase === 'start');
		if (phase === 'start') {
			// Reveal rides along with the keying, intensifying as the bolts spell it.
			startHeadlineReveal(message, durationMs);
		} else {
			// An interrupted transmission ends with an empty message; restore at once.
			endHeadlineReveal(message.length === 0);
		}
	});

	applyCalmMode(storm);
	subscribeCalmSignals(() => {
		applyCalmMode(storm);
	});

	// Pause the render loop while the tab is hidden to save CPU/GPU and battery;
	// resume through calm mode so it stays stopped when calm is active.
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			storm.stop();
		} else {
			applyCalmMode(storm);
		}
	});

	initializePage();
})();
