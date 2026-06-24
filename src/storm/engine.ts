import { isWebKit, WEBKIT_FRAME_INTERVAL_MS } from '#404/quality';
import { generateBoltSegments, generateMorseBolt } from '#404/storm/bolt';
import {
	CONTINUING_CURRENT,
	DEFAULT_BOLT_COUNT,
	IC_GLOW,
	IC_GLOW_DURATION,
	IC_GLOW_INTENSITY,
	INTER_FLASH,
	INTERSTROKE_CENTER,
	INTERSTROKE_SPREAD,
	M_COMPONENT_CHANCE,
	M_COMPONENT_DURATION,
	M_COMPONENT_INTENSITY,
	MAX_BOLT_COUNT,
	MORSE_DASH_PEAK,
	MORSE_DOT_PEAK,
	PREFLASH_DURATION,
	REGION_DIM_BASELINE,
	STROKE_DECAY_TAU,
	STROKES,
	SUBSEQUENT_INTENSITY,
} from '#404/storm/constants';
import { buildTransmissionTimeline, TRANSMISSION_MESSAGE, transmissionDuration } from '#404/storm/morse';
import { StormRenderer } from '#404/storm/renderer';
import { rand, randInt, randLogNormal } from '#404/storm/rng';
import {
	type BoltSegment,
	FlashPhase,
	type FlashSequence,
	type MorseKind,
	type StrokeEvent,
	type TransmissionStep,
} from '#404/storm/types';

/**
 * Event dispatched on `document` when a morse transmission starts and ends.
 *
 * Use when listening for transmission lifecycle to drive UI feedback.
 */
export const TRANSMISSION_EVENT = 'storm:transmission';

/** Detail payload carried by {@link TRANSMISSION_EVENT}. */
export interface TransmissionEventDetail {
	/** Lifecycle phase of the transmission. */
	readonly phase: 'start' | 'end';
	/** Plain-text message being keyed. */
	readonly message: string;
	/** Total keying duration in ms, for time-synced reveals. */
	readonly durationMs: number;
}

type RuntimePhase =
	| FlashPhase.Quiet
	| FlashPhase.PreFlash
	| FlashPhase.StrokePeak
	| FlashPhase.StrokeDecay
	| FlashPhase.Interstroke
	| FlashPhase.ContinuingCurrent;

type PhaseStrategy = (now: number, elapsed: number) => void;

/**
 * Shape the brightness envelope of a single keyed morse element.
 *
 * Dots snap to a sharp peak then fall away; dashes ramp up, hold a flickering
 * plateau, then taper, so the longer element reads as a sustained bolt.
 *
 * @param kind - Element class being keyed.
 * @param progress - Normalized position within the element, in `[0, 1)`.
 * @param now - Current timestamp, used for the dash plateau flicker.
 */
function morseEnvelope(kind: MorseKind, progress: number, now: number): number {
	if (kind === 'dot') {
		const attack = 0.16;
		if (progress < attack) return progress / attack;
		return Math.exp(-(progress - attack) * 3.2);
	}

	const attack = 0.1;
	const release = 0.82;
	let base: number;
	if (progress < attack) {
		base = progress / attack;
	} else if (progress < release) {
		base = 1 - 0.12 * ((progress - attack) / (release - attack));
	} else {
		base = (1 - (progress - release) / (1 - release)) * 0.88;
	}

	const flicker = 0.05 * Math.sin(now * 0.05);
	return Math.max(0, base + flicker);
}

/**
 * Procedural lightning runtime.
 *
 * Runs the flash state machine and feeds compact uniforms into the WebGL storm
 * renderer. Calm mode still controls the runtime through start/stop.
 */
export class StormEngine {
	private readonly root: HTMLElement;
	private readonly boltCount: number;
	private readonly renderer: StormRenderer | null;
	private readonly frameInterval: number;
	private rafId = 0;
	private running = false;
	private lastFrameTime = 0;

	private flash = 0;
	private regionDim = REGION_DIM_BASELINE;
	private boltIntensity = 0;
	private activeBoltSegments: readonly BoltSegment[] = [];

	private phase: RuntimePhase = FlashPhase.Quiet;
	private phaseStart = 0;
	private currentFlash: FlashSequence | null = null;
	private strokeIndex = 0;
	private nextFlashTime = 0;
	private nextICGlowTime = 0;
	private icGlowEnd = 0;
	private icGlowPeak = 0;

	private transmissionSteps: readonly TransmissionStep[] | null = null;
	private transmissionStart = 0;
	private transmissionTotal = 0;
	private transmissionStepIndex = -1;
	private transmissionBolt: readonly BoltSegment[] = [];
	private transmissionMessage = '';

	private readonly phaseStrategies: Record<RuntimePhase, PhaseStrategy> = {
		[FlashPhase.Quiet]: (now) => {
			this.runQuietPhase(now);
		},
		[FlashPhase.PreFlash]: (now, elapsed) => {
			this.runPreFlashPhase(now, elapsed);
		},
		[FlashPhase.StrokePeak]: (now) => {
			this.runStrokePeakPhase(now);
		},
		[FlashPhase.StrokeDecay]: (now, elapsed) => {
			this.runStrokeDecayPhase(now, elapsed);
		},
		[FlashPhase.Interstroke]: (now, elapsed) => {
			this.runInterstrokePhase(now, elapsed);
		},
		[FlashPhase.ContinuingCurrent]: (now, elapsed) => {
			this.runContinuingCurrentPhase(now, elapsed);
		},
	};

	/**
	 * Create a storm engine instance.
	 *
	 * @param root - Root element used to read theme state.
	 * @param boltCount - Upper density hint for generated lightning channels.
	 */
	constructor(root: HTMLElement = document.documentElement, boltCount = DEFAULT_BOLT_COUNT) {
		this.root = root;
		const normalizedBoltCount = Number.isFinite(boltCount)
			? Math.floor(boltCount)
			: DEFAULT_BOLT_COUNT;
		this.boltCount = normalizedBoltCount >= 1 && normalizedBoltCount <= MAX_BOLT_COUNT
			? normalizedBoltCount
			: DEFAULT_BOLT_COUNT;
		// WebKit (Safari / WebKitGTK) struggles with the per-pixel shader cost,
		// so cap its frame rate; other engines run unthrottled.
		this.frameInterval = isWebKit() ? WEBKIT_FRAME_INTERVAL_MS : 0;
		this.renderer = StormRenderer.create(root);
	}

	/**
	 * Start animation loop and schedule first flash/glow events.
	 *
	 * Safe to call repeatedly; no-op when already running.
	 */
	start(): void {
		if (this.running) return;
		if (this.renderer === null) return;
		this.running = true;
		this.renderer.start();
		const t = performance.now();
		this.nextFlashTime = t + rand(800, 2200);
		this.nextICGlowTime = t + rand(400, 1200);
		this.icGlowEnd = this.nextICGlowTime + rand(IC_GLOW_DURATION);
		this.icGlowPeak = rand(IC_GLOW_INTENSITY);
		this.phase = FlashPhase.Quiet;
		this.phaseStart = t;
		this.lastFrameTime = 0;
		this.tick(t);
	}

	/**
	 * Stop animation loop and reset storm output.
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
		this.boltIntensity = 0;
		this.activeBoltSegments = [];
		this.currentFlash = null;
		const wasTransmitting = this.transmissionSteps !== null;
		this.transmissionSteps = null;
		this.transmissionStepIndex = -1;
		this.transmissionBolt = [];
		this.renderer?.stop();
		// A transmission interrupted by stop (tab hidden, reduced-motion) must
		// still tear down its UI feedback; the empty message skips the headline
		// reveal so an abort never leaks the decoded text.
		if (wasTransmitting) this.emitTransmission('end', '');
	}

	/** Whether a morse transmission is currently being keyed. */
	get transmitting(): boolean {
		return this.transmissionSteps !== null;
	}

	/**
	 * Begin keying a morse transmission through the lightning.
	 *
	 * Overrides the random flash scheduler with a deterministic dot/dash
	 * timeline until it completes, then resumes the normal storm. No-op when the
	 * engine is stopped (including calm mode) or a transmission is already
	 * running.
	 *
	 * @param message - Text to key; defaults to {@link TRANSMISSION_MESSAGE}.
	 * @returns `true` when a transmission started, otherwise `false`.
	 */
	beginTransmission(message: string = TRANSMISSION_MESSAGE): boolean {
		if (!this.running || this.transmissionSteps !== null) return false;

		const steps = buildTransmissionTimeline(message);
		if (steps.length === 0) return false;

		this.transmissionSteps = steps;
		this.transmissionTotal = transmissionDuration(steps);
		this.transmissionStart = performance.now();
		this.transmissionStepIndex = -1;
		this.transmissionBolt = [];
		this.transmissionMessage = message;
		this.currentFlash = null;
		this.phase = FlashPhase.Quiet;
		this.setTransmissionProgress(0);
		this.setTransmissionFlash(0);
		this.emitTransmission('start', message);
		return true;
	}

	private emitTransmission(phase: 'start' | 'end', message: string): void {
		this.root.dataset.transmission = phase === 'start' ? 'active' : 'idle';
		const detail: TransmissionEventDetail = { phase, message, durationMs: this.transmissionTotal };
		document.dispatchEvent(new CustomEvent<TransmissionEventDetail>(TRANSMISSION_EVENT, { detail }));
	}

	/**
	 * Publish keying progress (`0`–`1`) for the panel border indicator.
	 *
	 * Written to the document root (not the engine root) because the panel and
	 * headline that consume it are page-level, independent of the engine root.
	 */
	private setTransmissionProgress(value: number): void {
		document.documentElement.style.setProperty('--transmission-progress', value.toFixed(4));
	}

	/** Publish the live keyed brightness (`0`–`1`) so UI glow pulses with each bolt. */
	private setTransmissionFlash(value: number): void {
		document.documentElement.style.setProperty('--transmission-flash', value.toFixed(3));
	}

	private generateFlash(): FlashSequence {
		const strokeCount = randInt(STROKES);
		const strokes: StrokeEvent[] = [];

		const firstPeak = rand(0.85, 1.0);
		strokes.push({
			peakIntensity: firstPeak,
			decayTau: STROKE_DECAY_TAU * rand(0.8, 1.3),
		});

		for (let i = 1; i < strokeCount; i++) {
			const relativeIntensity = rand(SUBSEQUENT_INTENSITY);
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

		return {
			strokes,
			boltSegments: generateBoltSegments(activeBoltCount),
			preflashDuration: rand(PREFLASH_DURATION),
			continuingCurrentDuration: rand(CONTINUING_CURRENT),
			hasMComponent: Math.random() < M_COMPONENT_CHANCE,
			interstrokeIntervals: intervals,
		};
	}

	private tick = (now: number): void => {
		if (!this.running) return;

		this.rafId = requestAnimationFrame(this.tick);

		if (now - this.lastFrameTime < this.frameInterval) return;
		this.lastFrameTime = now;

		this.update(now);
		this.commit(now);
	};

	private update(now: number): void {
		if (this.transmissionSteps !== null) {
			this.runTransmission(now);
			return;
		}

		const elapsed = now - this.phaseStart;
		const strategy = this.phaseStrategies[this.phase];
		strategy(now, elapsed);
	}

	private runTransmission(now: number): void {
		const steps = this.transmissionSteps;
		if (steps === null) return;

		const elapsed = now - this.transmissionStart;
		if (elapsed >= this.transmissionTotal) {
			this.finishTransmission(now);
			return;
		}

		this.setTransmissionProgress(elapsed / this.transmissionTotal);

		let stepStart = 0;
		let index = 0;
		for (; index < steps.length; index++) {
			const step = steps[index];
			if (step === undefined) break;
			if (elapsed < stepStart + step.durationMs) break;
			stepStart += step.durationMs;
		}

		const step = steps[index];
		if (step === undefined) {
			this.finishTransmission(now);
			return;
		}

		if (index !== this.transmissionStepIndex) {
			this.transmissionStepIndex = index;
			this.transmissionBolt = step.on && step.kind !== null ? generateMorseBolt(step.kind) : [];
		}

		if (step.on && step.kind !== null) {
			const progress = (elapsed - stepStart) / step.durationMs;
			const peak = step.kind === 'dash' ? MORSE_DASH_PEAK : MORSE_DOT_PEAK;
			this.flash = peak * morseEnvelope(step.kind, progress, now);
			this.boltIntensity = this.flash;
			this.activeBoltSegments = this.transmissionBolt;
			this.regionDim = Math.max(0.05, REGION_DIM_BASELINE - this.flash * 0.6);
		} else {
			this.flash = 0;
			this.boltIntensity = 0;
			this.activeBoltSegments = [];
			this.regionDim = REGION_DIM_BASELINE;
		}

		this.setTransmissionFlash(this.flash);
	}

	private finishTransmission(now: number): void {
		const message = this.transmissionMessage;
		// Settle the indicator at a full ring; the fade-out is driven by the
		// removal of the storm-transmitting class, and the next run resets to 0.
		this.setTransmissionProgress(1);
		this.setTransmissionFlash(0);
		this.transmissionSteps = null;
		this.transmissionStepIndex = -1;
		this.transmissionBolt = [];
		this.flash = 0;
		this.boltIntensity = 0;
		this.activeBoltSegments = [];
		this.regionDim = REGION_DIM_BASELINE;
		this.phase = FlashPhase.Quiet;
		this.phaseStart = now;
		this.nextFlashTime = now + rand(900, 2000);
		this.nextICGlowTime = now + rand(400, 1200);
		this.icGlowEnd = this.nextICGlowTime + rand(IC_GLOW_DURATION);
		this.icGlowPeak = rand(IC_GLOW_INTENSITY);
		this.emitTransmission('end', message);
	}

	private runQuietPhase(now: number): void {
		this.flash = 0;
		this.boltIntensity = 0;
		this.activeBoltSegments = [];
		this.regionDim = REGION_DIM_BASELINE;

		if (now >= this.nextICGlowTime && now < this.icGlowEnd) {
			const icElapsed = now - this.nextICGlowTime;
			const icDuration = this.icGlowEnd - this.nextICGlowTime;
			const t = icElapsed / icDuration;
			const envelope = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
			this.flash = this.icGlowPeak * Math.max(0, envelope);
			this.regionDim = REGION_DIM_BASELINE - this.flash * 0.15;
		} else if (now >= this.icGlowEnd && this.icGlowEnd > 0) {
			this.nextICGlowTime = now + rand(IC_GLOW);
			const duration = rand(IC_GLOW_DURATION);
			this.icGlowEnd = this.nextICGlowTime + duration;
			this.icGlowPeak = rand(IC_GLOW_INTENSITY);
		}

		if (now >= this.nextFlashTime) {
			this.currentFlash = this.generateFlash();
			this.strokeIndex = 0;
			this.phase = FlashPhase.PreFlash;
			this.phaseStart = now;
		}
	}

	private runPreFlashPhase(now: number, elapsed: number): void {
		const flash = this.currentFlash;
		if (!flash) return;

		const progress = elapsed / flash.preflashDuration;
		if (progress >= 1) {
			this.phase = FlashPhase.StrokePeak;
			this.phaseStart = now;
			return;
		}

		this.flash = 0.08 * progress * progress;
		this.boltIntensity = 0;
		this.regionDim = REGION_DIM_BASELINE - this.flash * 0.2;
	}

	private runStrokePeakPhase(now: number): void {
		const flash = this.currentFlash;
		if (!flash) return;

		const stroke = flash.strokes[this.strokeIndex];
		if (!stroke) return;

		this.flash = stroke.peakIntensity;
		this.regionDim = Math.max(0.05, REGION_DIM_BASELINE - stroke.peakIntensity * 0.7);
		this.activeBoltSegments = flash.boltSegments;
		this.boltIntensity = stroke.peakIntensity;
		this.phase = FlashPhase.StrokeDecay;
		this.phaseStart = now;
	}

	private runStrokeDecayPhase(now: number, elapsed: number): void {
		const flash = this.currentFlash;
		if (!flash) return;

		const stroke = flash.strokes[this.strokeIndex];
		if (!stroke) return;

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
				this.boltIntensity = 0;
			}
			return;
		}

		this.flash = decayed;
		this.regionDim = Math.max(0.1, REGION_DIM_BASELINE - decayed * 0.5);
		this.activeBoltSegments = flash.boltSegments;
		this.boltIntensity = decayed;
	}

	private runInterstrokePhase(now: number, elapsed: number): void {
		const flash = this.currentFlash;
		if (!flash) return;

		const interval = flash.interstrokeIntervals[this.strokeIndex] ?? INTERSTROKE_CENTER;
		this.flash = 0;
		this.boltIntensity = 0;
		this.regionDim = REGION_DIM_BASELINE;

		if (elapsed >= interval) {
			this.strokeIndex++;
			this.phase = FlashPhase.StrokePeak;
			this.phaseStart = now;
		}
	}

	private runContinuingCurrentPhase(now: number, elapsed: number): void {
		const flash = this.currentFlash;
		if (!flash) return;

		const ccProgress = elapsed / flash.continuingCurrentDuration;
		if (ccProgress >= 1) {
			this.flash = 0;
			this.boltIntensity = 0;
			this.activeBoltSegments = [];
			this.regionDim = REGION_DIM_BASELINE;
			this.currentFlash = null;
			this.phase = FlashPhase.Quiet;
			this.phaseStart = now;
			this.nextFlashTime = now + rand(INTER_FLASH);
			return;
		}

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
		this.activeBoltSegments = flash.boltSegments;
		this.boltIntensity = baseFade * 0.5;
	}

	private commit(now: number): void {
		const theme = this.root.dataset.theme === 'light' ? 'light' : 'dark';
		this.renderer?.render({
			time: now,
			flash: this.flash,
			regionDim: this.regionDim,
			boltIntensity: this.boltIntensity,
			boltSegments: this.activeBoltSegments,
			theme,
		});
	}
}
