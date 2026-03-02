const PANEL_PRESS_SPAM_WINDOW_MS = 1300;
const PANEL_PRESS_SPAM_LIMIT = 4;
const PANEL_PRESS_COOLDOWN_MS = 2400;
const PANEL_PRESS_LOCK_CLASS = 'panel-press-locked';

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Initialize pointer-driven panel tilt, glint, and press feedback.
 *
 * Includes spam-press cooldown guard and automatic reset for reduced-motion.
 */
export function initializePanelInteractivity(): void {
	const panel = document.querySelector<HTMLElement>('.panel');
	if (!panel) return;
	let pressLockUntilMs = 0;
	let pressSamples: number[] = [];
	let pressLockTimerId: number | null = null;

	const clearPressLockTimer = (): void => {
		if (pressLockTimerId === null) return;
		window.clearTimeout(pressLockTimerId);
		pressLockTimerId = null;
	};

	const unlockPanelPress = (): void => {
		pressLockUntilMs = 0;
		panel.classList.remove(PANEL_PRESS_LOCK_CLASS);
		clearPressLockTimer();
	};

	const lockPanelPress = (nowMs: number): void => {
		pressLockUntilMs = nowMs + PANEL_PRESS_COOLDOWN_MS;
		panel.classList.add(PANEL_PRESS_LOCK_CLASS);
		clearPressLockTimer();
		pressLockTimerId = window.setTimeout(() => {
			unlockPanelPress();
		}, PANEL_PRESS_COOLDOWN_MS);
	};

	const clearPressDepth = (): void => {
		panel.style.setProperty('--panel-press-depth', '0');
	};

	const registerPanelPress = (nowMs: number): void => {
		pressSamples = pressSamples.filter((sample) => nowMs - sample <= PANEL_PRESS_SPAM_WINDOW_MS);
		pressSamples.push(nowMs);

		if (pressSamples.length >= PANEL_PRESS_SPAM_LIMIT) {
			pressSamples = [];
			clearPressDepth();
			lockPanelPress(nowMs);
		}
	};

	const resetPanelStyle = (): void => {
		panel.style.setProperty('--panel-tilt-x', '0');
		panel.style.setProperty('--panel-tilt-y', '0');
		panel.style.setProperty('--panel-glint-x', '20%');
		panel.style.setProperty('--panel-glint-y', '0%');
		clearPressDepth();
	};

	resetPanelStyle();

	panel.addEventListener('pointermove', (event) => {
		if (reduceMotionQuery.matches) return;

		const rect = panel.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;

		const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

		const tiltX = (x - 0.5) * 4.8;
		const tiltY = (0.5 - y) * 4.2;

		panel.style.setProperty('--panel-tilt-x', tiltX.toFixed(2));
		panel.style.setProperty('--panel-tilt-y', tiltY.toFixed(2));
		panel.style.setProperty('--panel-glint-x', `${(x * 100).toFixed(1)}%`);
		panel.style.setProperty('--panel-glint-y', `${(y * 100).toFixed(1)}%`);
	});

	panel.addEventListener('pointerleave', resetPanelStyle);

	panel.addEventListener('pointerdown', () => {
		if (reduceMotionQuery.matches) return;

		const nowMs = window.performance.now();
		if (pressLockUntilMs > 0 && nowMs >= pressLockUntilMs) {
			unlockPanelPress();
		}

		if (nowMs < pressLockUntilMs) {
			clearPressDepth();
			return;
		}

		registerPanelPress(nowMs);
		if (nowMs < pressLockUntilMs) return;

		panel.style.setProperty('--panel-press-depth', '1');
	});

	panel.addEventListener('pointerup', clearPressDepth);
	panel.addEventListener('pointercancel', clearPressDepth);

	if (typeof reduceMotionQuery.addEventListener === 'function') {
		reduceMotionQuery.addEventListener('change', () => {
			if (reduceMotionQuery.matches) {
				unlockPanelPress();
				pressSamples = [];
				resetPanelStyle();
			}
		});
	}
}
