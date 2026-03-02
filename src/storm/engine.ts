import { generateBoltPath } from './bolt.ts';
import {
	CONTINUING_CURRENT_MAX,
	CONTINUING_CURRENT_MIN,
	DEFAULT_BOLT_COUNT,
	IC_GLOW_DURATION_MAX,
	IC_GLOW_DURATION_MIN,
	IC_GLOW_INTENSITY_MAX,
	IC_GLOW_INTENSITY_MIN,
	IC_GLOW_MAX,
	IC_GLOW_MIN,
	INTER_FLASH_MAX,
	INTER_FLASH_MIN,
	INTERSTROKE_CENTER,
	INTERSTROKE_SPREAD,
	M_COMPONENT_CHANCE,
	M_COMPONENT_DURATION,
	M_COMPONENT_INTENSITY,
	PREFLASH_DURATION_MAX,
	PREFLASH_DURATION_MIN,
	REGION_DIM_BASELINE,
	STROKES_MAX,
	STROKES_MIN,
	STROKE_DECAY_TAU,
	SUBSEQUENT_INTENSITY_MAX,
	SUBSEQUENT_INTENSITY_MIN,
} from './constants.ts';
import { rand, randInt, randLogNormal } from './rng.ts';
import { FlashPhase, type FlashSequence, type StrokeEvent } from './types.ts';

/**
 * Procedural lightning runtime.
 *
 * Drives `--flash` and `--region-dim` CSS variables and controls dynamically
 * generated `.storm-streak` bolt elements.
 */
export class StormEngine {
	private readonly root: HTMLElement;
	private readonly boltCount: number;
	private rafId = 0;
	private running = false;

	private boltElements: HTMLSpanElement[] = [];
	private container: HTMLElement | null = null;

	private flash = 0;
	private regionDim = REGION_DIM_BASELINE;

	private phase: FlashPhase = FlashPhase.Quiet;
	private phaseStart = 0;
	private currentFlash: FlashSequence | null = null;
	private strokeIndex = 0;
	private nextFlashTime = 0;
	private nextICGlowTime = 0;
	private icGlowEnd = 0;
	private icGlowPeak = 0;

	/**
	 * Create a storm engine instance.
	 *
	 * @param root - Root element receiving CSS output vars.
	 * @param boltCount - Number of bolt elements to create.
	 */
	constructor(root: HTMLElement = document.documentElement, boltCount = DEFAULT_BOLT_COUNT) {
		this.root = root;
		this.boltCount = boltCount;
	}

	private createBolts(): void {
		this.container = document.querySelector('.storm-streaks');
		if (!this.container) return;

		this.destroyBolts();

		for (let i = 0; i < this.boltCount; i++) {
			const el = document.createElement('span');
			el.className = 'storm-streak';

			el.style.left = `${rand(5, 85).toFixed(0)}%`;
			el.style.top = `${rand(-16, -4).toFixed(0)}%`;
			const rotation = rand(-15, 15).toFixed(1);
			const scale = rand(0.6, 1.1).toFixed(2);
			el.style.transform = `rotate(${rotation}deg) scale(${scale})`;
			el.style.setProperty('--bolt-clip', generateBoltPath());

			this.container.appendChild(el);
			this.boltElements.push(el);
		}
	}

	private destroyBolts(): void {
		for (const el of this.boltElements) {
			el.remove();
		}
		this.boltElements = [];
	}

	private refreshBoltShapes(): void {
		for (const el of this.boltElements) {
			el.style.setProperty('--bolt-clip', generateBoltPath());
		}
	}

	/**
	 * Start animation loop and schedule first flash/glow events.
	 *
	 * Safe to call repeatedly; no-op when already running.
	 */
	start(): void {
		if (this.running) return;
		this.running = true;
		this.createBolts();
		const t = performance.now();
		this.nextFlashTime = t + rand(800, 2200);
		this.nextICGlowTime = t + rand(400, 1200);
		this.icGlowEnd = this.nextICGlowTime + rand(IC_GLOW_DURATION_MIN, IC_GLOW_DURATION_MAX);
		this.icGlowPeak = rand(IC_GLOW_INTENSITY_MIN, IC_GLOW_INTENSITY_MAX);
		this.phase = FlashPhase.Quiet;
		this.tick(performance.now());
	}

	/**
	 * Stop animation loop, reset outputs, and remove generated bolt elements.
	 *
	 * Safe to call repeatedly.
	 */
	stop(): void {
		this.running = false;
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = 0;
		}
		this.flash = 0;
		this.regionDim = REGION_DIM_BASELINE;
		this.setAllBoltsOpacity(0);
		this.commit();
		this.destroyBolts();
	}

	private generateFlash(): FlashSequence {
		const strokeCount = randInt(STROKES_MIN, STROKES_MAX);
		const strokes: StrokeEvent[] = [];

		const firstPeak = rand(0.85, 1.0);
		strokes.push({
			peakIntensity: firstPeak,
			decayTau: STROKE_DECAY_TAU * rand(0.8, 1.3),
		});

		for (let i = 1; i < strokeCount; i++) {
			const relativeIntensity = rand(SUBSEQUENT_INTENSITY_MIN, SUBSEQUENT_INTENSITY_MAX);
			const decay = 1 - (i / strokeCount) * 0.3;
			strokes.push({
				peakIntensity: firstPeak * relativeIntensity * decay,
				decayTau: STROKE_DECAY_TAU * rand(0.7, 1.1),
			});
		}

		const intervals: number[] = [];
		for (let i = 0; i < strokeCount - 1; i++) {
			const interval = randLogNormal(INTERSTROKE_CENTER, INTERSTROKE_SPREAD);
			intervals.push(Math.max(20, Math.min(200, interval)));
		}

		const activeBoltCount = randInt(1, Math.min(3, this.boltCount));
		const indices: number[] = [];
		const available = Array.from({ length: this.boltCount }, (_, i) => i);
		for (let i = available.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const a = available[i];
			const b = available[j];
			if (a !== undefined && b !== undefined) {
				available[i] = b;
				available[j] = a;
			}
		}
		for (let i = 0; i < activeBoltCount; i++) {
			const idx = available[i];
			if (idx !== undefined) indices.push(idx);
		}

		this.refreshBoltShapes();

		return {
			strokes,
			boltIndices: indices,
			preflashDuration: rand(PREFLASH_DURATION_MIN, PREFLASH_DURATION_MAX),
			continuingCurrentDuration: rand(CONTINUING_CURRENT_MIN, CONTINUING_CURRENT_MAX),
			hasMComponent: Math.random() < M_COMPONENT_CHANCE,
			interstrokeIntervals: intervals,
		};
	}

	private tick = (now: number): void => {
		if (!this.running) return;

		this.update(now);
		this.commit();

		this.rafId = requestAnimationFrame(this.tick);
	};

	private update(now: number): void {
		const elapsed = now - this.phaseStart;

		switch (this.phase) {
			case FlashPhase.Quiet:
				this.flash = 0;
				this.setAllBoltsOpacity(0);
				this.regionDim = REGION_DIM_BASELINE;

				if (now >= this.nextICGlowTime && now < this.icGlowEnd) {
					const icElapsed = now - this.nextICGlowTime;
					const icDuration = this.icGlowEnd - this.nextICGlowTime;
					const t = icElapsed / icDuration;
					const envelope = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
					this.flash = this.icGlowPeak * Math.max(0, envelope);
					this.regionDim = REGION_DIM_BASELINE - this.flash * 0.15;
				} else if (now >= this.icGlowEnd && this.icGlowEnd > 0) {
					this.nextICGlowTime = now + rand(IC_GLOW_MIN, IC_GLOW_MAX);
					const duration = rand(IC_GLOW_DURATION_MIN, IC_GLOW_DURATION_MAX);
					this.icGlowEnd = this.nextICGlowTime + duration;
					this.icGlowPeak = rand(IC_GLOW_INTENSITY_MIN, IC_GLOW_INTENSITY_MAX);
				}

				if (now >= this.nextFlashTime) {
					this.currentFlash = this.generateFlash();
					this.strokeIndex = 0;
					this.phase = FlashPhase.PreFlash;
					this.phaseStart = now;
				}
				break;

			case FlashPhase.PreFlash: {
				const flash = this.currentFlash;
				if (!flash) break;
				const progress = elapsed / flash.preflashDuration;
				if (progress >= 1) {
					this.phase = FlashPhase.StrokePeak;
					this.phaseStart = now;
				} else {
					this.flash = 0.08 * progress * progress;
					this.regionDim = REGION_DIM_BASELINE - this.flash * 0.2;
				}
				break;
			}

			case FlashPhase.StrokePeak: {
				const flash = this.currentFlash;
				if (!flash) break;
				const stroke = flash.strokes[this.strokeIndex];
				if (!stroke) break;
				this.flash = stroke.peakIntensity;
				this.regionDim = Math.max(0.05, REGION_DIM_BASELINE - stroke.peakIntensity * 0.7);
				this.setBolts(flash.boltIndices, stroke.peakIntensity);
				this.phase = FlashPhase.StrokeDecay;
				this.phaseStart = now;
				break;
			}

			case FlashPhase.StrokeDecay: {
				const flash = this.currentFlash;
				if (!flash) break;
				const stroke = flash.strokes[this.strokeIndex];
				if (!stroke) break;

				const decayed = stroke.peakIntensity * Math.exp(-elapsed / stroke.decayTau);
				const isLastStroke = this.strokeIndex >= flash.strokes.length - 1;
				const floorIntensity = isLastStroke ? 0.02 : 0.03;

				if (decayed <= floorIntensity) {
					if (isLastStroke) {
						this.phase = FlashPhase.ContinuingCurrent;
						this.phaseStart = now;
						this.flash = floorIntensity;
					} else {
						this.phase = FlashPhase.Interstroke;
						this.phaseStart = now;
						this.flash = 0;
						this.setAllBoltsOpacity(0);
					}
				} else {
					this.flash = decayed;
					this.regionDim = Math.max(0.1, REGION_DIM_BASELINE - decayed * 0.5);
					this.setBolts(flash.boltIndices, decayed);
				}
				break;
			}

			case FlashPhase.Interstroke: {
				const flash = this.currentFlash;
				if (!flash) break;

				const interval = flash.interstrokeIntervals[this.strokeIndex] ?? INTERSTROKE_CENTER;
				this.flash = 0;
				this.setAllBoltsOpacity(0);
				this.regionDim = REGION_DIM_BASELINE;

				if (elapsed >= interval) {
					this.strokeIndex++;
					this.phase = FlashPhase.StrokePeak;
					this.phaseStart = now;
				}
				break;
			}

			case FlashPhase.ContinuingCurrent: {
				const flash = this.currentFlash;
				if (!flash) break;

				const ccProgress = elapsed / flash.continuingCurrentDuration;
				if (ccProgress >= 1) {
					this.flash = 0;
					this.setAllBoltsOpacity(0);
					this.regionDim = REGION_DIM_BASELINE;
					this.currentFlash = null;
					this.phase = FlashPhase.Quiet;
					this.phaseStart = now;
					this.nextFlashTime = now + rand(INTER_FLASH_MIN, INTER_FLASH_MAX);
				} else {
					const baseFade = 0.04 * Math.exp(-ccProgress * 3);

					let mPulse = 0;
					if (flash.hasMComponent) {
						const mCenter = 0.45;
						const mWidth = M_COMPONENT_DURATION / flash.continuingCurrentDuration;
						const mDist = Math.abs(ccProgress - mCenter);
						if (mDist < mWidth) {
							const mEnvelope = 1 - mDist / mWidth;
							mPulse = M_COMPONENT_INTENSITY * mEnvelope * mEnvelope;
						}
					}

					this.flash = baseFade + mPulse;
					this.regionDim = REGION_DIM_BASELINE - this.flash * 0.15;
					this.setBolts(flash.boltIndices, baseFade * 0.5);
				}
				break;
			}

			default:
				break;
		}
	}

	private setBolts(activeIndices: readonly number[], intensity: number): void {
		const value = intensity.toFixed(4);
		for (let i = 0; i < this.boltElements.length; i++) {
			const el = this.boltElements[i];
			if (el) {
				el.style.opacity = activeIndices.includes(i) ? value : '0';
			}
		}
	}

	private setAllBoltsOpacity(opacity: number): void {
		const value = opacity.toFixed(4);
		for (const el of this.boltElements) {
			el.style.opacity = value;
		}
	}

	private commit(): void {
		const style = this.root.style;
		style.setProperty('--flash', this.flash.toFixed(4));
		style.setProperty('--region-dim', this.regionDim.toFixed(4));
	}
}
