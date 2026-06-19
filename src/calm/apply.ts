import { CALM_CLASS } from '#404/calm/constants';
import { shouldCalm } from '#404/calm/detect';
import type { StormEngine } from '#404/storm/engine';

/**
 * Apply calm mode class toggles and start/stop the storm engine.
 *
 * @param storm - Storm engine instance controlled by calm-mode state.
 */
export function applyCalmMode(storm: StormEngine): void {
	const calm = shouldCalm();
	document.documentElement.classList.toggle(CALM_CLASS, calm);
	document.body.classList.toggle(CALM_CLASS, calm);

	if (calm) {
		storm.stop();
	} else {
		storm.start();
	}
}
