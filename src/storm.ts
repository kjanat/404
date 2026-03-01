/**
 * Procedural storm engine — drives lightning visuals via CSS custom properties.
 *
 * Physics basis (Rakov & Uman, NOAA/NSSL, peer-reviewed high-speed video studies):
 *
 *   −CG flash anatomy:
 *     1. Preliminary IC glow          ~50-100 ms before first stroke
 *     2. Stepped leader (invisible at animation scale, but we show the IC buildup)
 *     3. First return stroke           rise <1 frame, decay ~60-80 ms (exponential)
 *     4. Interstroke dark interval     geometric mean ~50 ms (range 30-100 ms)
 *     5. Subsequent return strokes     2-4 more, each dimmer (subsequent peak ≈ 10-15 kA vs 30 kA first)
 *     6. Continuing current / M-comp   ~100-300 ms slow fade with occasional re-brightening
 *
 *   Storm-scale timing:
 *     Active thunderstorm: ~1-3 flashes/minute → 3-8 s between flashes
 *     IC:CG ratio ~5-10:1 → most flashes are diffuse cloud illumination
 *
 * Outputs (set on `document.documentElement.style`):
 *
 * | Property       | Range | Purpose                                                        |
 * | -------------- | ----- | -------------------------------------------------------------- |
 * | `--flash`      | 0..1  | Overall flash intensity (body::before, panel shadow, h1 glow)  |
 * | `--bolt-a`     | 0..1  | Bolt A visibility                                              |
 * | `--bolt-b`     | 0..1  | Bolt B visibility                                              |
 * | `--bolt-c`     | 0..1  | Bolt C visibility                                              |
 * | `--region-dim` | 0..1  | Storm region darkening (inverted: low = bright flash moment)   |
 *
 * @module
 */

// ── RNG helpers ──────────────────────────────────────────────────────────────

/**
 * Uniform random float in `[min, max)`.
 *
 * @param min - Inclusive lower bound.
 * @param max - Exclusive upper bound.
 * @returns Pseudorandom float.
 */
function rand(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

/**
 * Random integer in `[min, max]` (inclusive on both ends).
 *
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound.
 * @returns Pseudorandom integer.
 */
function randInt(min: number, max: number): number {
	return Math.floor(rand(min, max + 1));
}

/**
 * Sample from a log-normal distribution centered near {@linkcode center}.
 *
 * Uses Box-Muller transform to generate a normal deviate, then exponentiates.
 * Models naturally skewed physical distributions (e.g. interstroke intervals).
 *
 * @param center - Geometric mean of the distribution.
 * @param spread - Standard deviation of the underlying normal (higher = wider tail).
 * @returns Positive pseudorandom sample.
 */
function randLogNormal(center: number, spread: number): number {
	const u1 = Math.random();
	const u2 = Math.random();
	const normal = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
	return center * Math.exp(spread * normal);
}

// ── Procedural cloud generation ──────────────────────────────────────────────

/** Minimum cloud masses to scatter across the sky. */
const CLOUD_MASS_MIN = 5;

/** Maximum cloud masses. */
const CLOUD_MASS_MAX = 8;

/** Minimum puffs per cloud mass. */
const PUFFS_PER_MASS_MIN = 3;

/** Maximum puffs per cloud mass. */
const PUFFS_PER_MASS_MAX = 6;

/**
 * Generate a procedural CSS gradient background for the cloud layer.
 *
 * Creates {@linkcode CLOUD_MASS_MIN}–{@linkcode CLOUD_MASS_MAX} cloud masses,
 * each composed of {@linkcode PUFFS_PER_MASS_MIN}–{@linkcode PUFFS_PER_MASS_MAX}
 * overlapping elliptical radial gradients with randomized position, size, and
 * density. The result is a `background` value that, when combined with the
 * `#cloud-tex` SVG turbulence filter, produces realistic cloud shapes.
 *
 * Uses `rgb(0 0 0 / alpha)` with `mix-blend-mode: multiply` — works
 * identically on both dark and light backgrounds.
 *
 * @returns CSS `background` value (comma-separated radial-gradient list).
 */
export function generateCloudBackground(): string {
	const massCount = randInt(CLOUD_MASS_MIN, CLOUD_MASS_MAX);
	const gradients: string[] = [];

	for (let m = 0; m < massCount; m++) {
		const cx = rand(8, 92);
		const cy = rand(8, 92);
		const puffCount = randInt(PUFFS_PER_MASS_MIN, PUFFS_PER_MASS_MAX);

		for (let p = 0; p < puffCount; p++) {
			const x = (cx + (Math.random() - 0.5) * 26).toFixed(0);
			const y = (cy + (Math.random() - 0.5) * 20).toFixed(0);
			const rx = rand(14, 38).toFixed(0);
			const ry = rand(10, 28).toFixed(0);
			const a = rand(0.35, 0.8).toFixed(2);
			const fade = rand(48, 64).toFixed(0);
			gradients.push(
				`radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%,rgb(0 0 0/${a}),transparent ${fade}%)`,
			);
		}
	}

	return gradients.join(',');
}

// ── Physical constants (animation-scaled) ────────────────────────────────────

/** Minimum inter-flash interval in ms (storm-scale: ~3 s between CG flashes). */
const INTER_FLASH_MIN = 2800;

/** Maximum inter-flash interval in ms (storm-scale: ~8 s between CG flashes). */
const INTER_FLASH_MAX = 8500;

/** Minimum IC background glow interval in ms (more frequent than CG). */
const IC_GLOW_MIN = 1200;

/** Maximum IC background glow interval in ms. */
const IC_GLOW_MAX = 4000;

/** Minimum return strokes per −CG flash (Rakov: mean 3-5, max ~20). */
const STROKES_MIN = 3;

/** Maximum return strokes per −CG flash. */
const STROKES_MAX = 6;

/** Geometric mean of interstroke interval in ms (~48-60 ms observed). */
const INTERSTROKE_CENTER = 52;

/** Log-normal spread parameter for interstroke intervals. */
const INTERSTROKE_SPREAD = 0.45;

/** Minimum pre-flash IC glow buildup duration in ms. */
const PREFLASH_DURATION_MIN = 40;

/** Maximum pre-flash IC glow buildup duration in ms. */
const PREFLASH_DURATION_MAX = 90;

/**
 * Return stroke exponential decay time constant in ms.
 *
 * At 2.5τ (~70 ms) the stroke reaches ~8% of peak luminosity.
 */
const STROKE_DECAY_TAU = 28;

/**
 * Minimum subsequent-stroke relative intensity.
 *
 * Subsequent strokes carry ~10-15 kA vs ~30 kA first stroke (≈ 0.33-0.50).
 */
const SUBSEQUENT_INTENSITY_MIN = 0.35;

/** Maximum subsequent-stroke relative intensity. */
const SUBSEQUENT_INTENSITY_MAX = 0.65;

/** Minimum continuing current duration in ms. */
const CONTINUING_CURRENT_MIN = 120;

/** Maximum continuing current duration in ms. */
const CONTINUING_CURRENT_MAX = 350;

/** Probability that a flash includes an M-component re-brightening pulse. */
const M_COMPONENT_CHANCE = 0.4;

/** Peak intensity of an M-component pulse (relative to full flash). */
const M_COMPONENT_INTENSITY = 0.12;

/** Duration of the M-component pulse envelope in ms. */
const M_COMPONENT_DURATION = 35;

/** Minimum IC (intra-cloud) glow peak intensity. */
const IC_GLOW_INTENSITY_MIN = 0.04;

/** Maximum IC (intra-cloud) glow peak intensity. */
const IC_GLOW_INTENSITY_MAX = 0.12;

/** Minimum IC glow duration in ms. */
const IC_GLOW_DURATION_MIN = 80;

/** Maximum IC glow duration in ms. */
const IC_GLOW_DURATION_MAX = 250;

/** Ambient cloud darkness opacity (baseline when no flash is active). */
const REGION_DIM_BASELINE = 0.42;

// ── Flash event types ────────────────────────────────────────────────────────

/**
 * State machine phases for a single −CG flash lifecycle.
 *
 * Transitions follow the physical sequence:
 * `Quiet → PreFlash → StrokePeak → StrokeDecay → (Interstroke → StrokePeak → ...) → ContinuingCurrent → Quiet`
 *
 * IC glow events occur independently during {@linkcode Quiet} phases.
 */
enum FlashPhase {
	/** Quiet period between flashes. */
	Quiet,
	/** Pre-flash intra-cloud glow buildup (~40-90 ms). */
	PreFlash,
	/** Return stroke peak — held for one frame then transitions to decay. */
	StrokePeak,
	/** Return stroke exponential decay (τ ≈ 28 ms). */
	StrokeDecay,
	/** Dark interval between successive return strokes (~50 ms geometric mean). */
	Interstroke,
	/** Continuing current slow fade after last stroke (~120-350 ms). */
	ContinuingCurrent,
	/** M-component re-brightening pulse during continuing current. */
	MComponent,
	/** Diffuse IC background glow (independent of CG flashes). */
	ICGlow,
}

/**
 * A single return stroke within a −CG flash.
 *
 * First strokes are brightest (~30 kA); subsequent strokes are 33-65% of first.
 */
interface StrokeEvent {
	/** Peak luminosity on the 0..1 scale. */
	readonly peakIntensity: number;
	/** Exponential decay time constant in ms (varies ±20-30% per stroke). */
	readonly decayTau: number;
}

/**
 * A procedurally generated −CG flash sequence.
 *
 * Contains all timing and intensity data needed to replay the flash
 * through the {@linkcode FlashPhase} state machine.
 */
interface FlashSequence {
	/** Ordered return strokes (first is brightest). */
	readonly strokes: readonly StrokeEvent[];
	/** Which bolt SVG path(s) illuminate during this flash. */
	readonly bolts: readonly ('a' | 'b' | 'c')[];
	/** Duration of the pre-flash IC glow buildup in ms. */
	readonly preflashDuration: number;
	/** Duration of the continuing current tail in ms. */
	readonly continuingCurrentDuration: number;
	/** Whether this flash includes an M-component re-brightening pulse. */
	readonly hasMComponent: boolean;
	/** Dark intervals between successive strokes in ms (length = strokes.length - 1). */
	readonly interstrokeIntervals: readonly number[];
}

// ── Core engine ──────────────────────────────────────────────────────────────

/**
 * Procedural lightning animation engine.
 *
 * Drives CSS custom properties on a root element via `requestAnimationFrame`,
 * producing stochastic −CG flash sequences and IC background glow events
 * grounded in observed lightning physics.
 *
 * No two animation cycles are identical — stroke counts, intensities, intervals,
 * bolt selection, and M-component presence are all randomized per flash.
 *
 * @example
 * ```ts
 * const storm = new StormEngine();
 * storm.start();
 *
 * // Later, to freeze all lightning (e.g. calm mode):
 * storm.stop();
 * ```
 */
export class StormEngine {
	/** Element whose inline style receives `--flash`, `--bolt-*`, `--region-dim`. */
	private readonly root: HTMLElement;
	/** Active `requestAnimationFrame` handle, or 0 if idle. */
	private rafId = 0;
	/** Whether the rAF loop is currently running. */
	private running = false;

	// Current output values
	private flash = 0;
	private boltA = 0;
	private boltB = 0;
	private boltC = 0;
	private regionDim = REGION_DIM_BASELINE;

	// Timeline state
	private phase: FlashPhase = FlashPhase.Quiet;
	private phaseStart = 0;
	private currentFlash: FlashSequence | null = null;
	private strokeIndex = 0;
	private nextFlashTime = 0;
	private nextICGlowTime = 0;
	private icGlowEnd = 0;
	private icGlowPeak = 0;

	/**
	 * Create a new storm engine.
	 *
	 * @param root - Element to set CSS custom properties on.
	 *   Defaults to `document.documentElement`.
	 */
	constructor(root: HTMLElement = document.documentElement) {
		this.root = root;
	}

	/**
	 * Begin the animation loop.
	 *
	 * Schedules the first CG flash within 0.8-2.2 s and the first IC glow
	 * within 0.4-1.2 s, then enters the rAF loop. Safe to call multiple
	 * times — subsequent calls are no-ops while already running.
	 */
	start(): void {
		if (this.running) return;
		this.running = true;
		const t = performance.now();
		this.nextFlashTime = t + rand(800, 2200);
		this.nextICGlowTime = t + rand(400, 1200);
		this.icGlowEnd = this.nextICGlowTime + rand(IC_GLOW_DURATION_MIN, IC_GLOW_DURATION_MAX);
		this.icGlowPeak = rand(IC_GLOW_INTENSITY_MIN, IC_GLOW_INTENSITY_MAX);
		this.phase = FlashPhase.Quiet;
		this.tick(performance.now());
	}

	/**
	 * Stop the animation loop and reset all CSS custom properties to neutral.
	 *
	 * Cancels the pending rAF, zeroes flash/bolt values, and restores
	 * `--region-dim` to its ambient baseline. Safe to call when already stopped.
	 */
	stop(): void {
		this.running = false;
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = 0;
		}
		this.flash = 0;
		this.boltA = 0;
		this.boltB = 0;
		this.boltC = 0;
		this.regionDim = REGION_DIM_BASELINE;
		this.commit();
	}

	// ── Flash generation ─────────────────────────────────────────────────────

	/**
	 * Procedurally generate a complete −CG flash sequence.
	 *
	 * Randomizes stroke count, per-stroke intensity/decay, interstroke intervals
	 * (log-normal), bolt selection (1-2 of 3 paths), continuing current duration,
	 * and M-component presence.
	 *
	 * @returns Immutable flash descriptor ready for playback.
	 */
	private generateFlash(): FlashSequence {
		const strokeCount = randInt(STROKES_MIN, STROKES_MAX);
		const strokes: StrokeEvent[] = [];

		// First stroke: full intensity
		const firstPeak = rand(0.85, 1.0);
		strokes.push({
			peakIntensity: firstPeak,
			decayTau: STROKE_DECAY_TAU * rand(0.8, 1.3),
		});

		// Subsequent strokes: diminishing intensity with variation
		for (let i = 1; i < strokeCount; i++) {
			const relativeIntensity = rand(SUBSEQUENT_INTENSITY_MIN, SUBSEQUENT_INTENSITY_MAX);
			// Later strokes trend dimmer but with randomness
			const decay = 1 - (i / strokeCount) * 0.3;
			strokes.push({
				peakIntensity: firstPeak * relativeIntensity * decay,
				decayTau: STROKE_DECAY_TAU * rand(0.7, 1.1),
			});
		}

		// Interstroke intervals (log-normal distributed, geometric mean ~50ms)
		const intervals: number[] = [];
		for (let i = 0; i < strokeCount - 1; i++) {
			const interval = randLogNormal(INTERSTROKE_CENTER, INTERSTROKE_SPREAD);
			intervals.push(Math.max(20, Math.min(200, interval))); // clamp to observed range
		}

		// Choose which bolt(s) appear (1-2 bolts per flash)
		const allBolts: ('a' | 'b' | 'c')[] = ['a', 'b', 'c'];
		const boltCount = Math.random() < 0.35 ? 2 : 1;
		// Fisher-Yates in-place shuffle (unbiased)
		for (let i = allBolts.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[allBolts[i], allBolts[j]] = [allBolts[j]!, allBolts[i]!];
		}
		const bolts = allBolts.slice(0, boltCount);

		return {
			strokes,
			bolts,
			preflashDuration: rand(PREFLASH_DURATION_MIN, PREFLASH_DURATION_MAX),
			continuingCurrentDuration: rand(CONTINUING_CURRENT_MIN, CONTINUING_CURRENT_MAX),
			hasMComponent: Math.random() < M_COMPONENT_CHANCE,
			interstrokeIntervals: intervals,
		};
	}

	// ── Main loop ────────────────────────────────────────────────────────────

	/**
	 * rAF callback — runs {@linkcode update} then {@linkcode commit} each frame.
	 *
	 * @param now - High-resolution timestamp from `requestAnimationFrame`.
	 */
	private tick = (now: number): void => {
		if (!this.running) return;

		this.update(now);
		this.commit();

		this.rafId = requestAnimationFrame(this.tick);
	};

	/**
	 * Advance the {@linkcode FlashPhase} state machine by one frame.
	 *
	 * Computes output values (`flash`, `boltA`..`boltC`, `regionDim`) based on
	 * elapsed time within the current phase, and transitions between phases
	 * when timing thresholds are met.
	 *
	 * @param now - High-resolution timestamp from `requestAnimationFrame`.
	 */
	private update(now: number): void {
		const elapsed = now - this.phaseStart;

		switch (this.phase) {
			case FlashPhase.Quiet:
				this.flash = 0;
				this.boltA = 0;
				this.boltB = 0;
				this.boltC = 0;
				this.regionDim = REGION_DIM_BASELINE;

				// Check for IC background glow
				if (now >= this.nextICGlowTime && now < this.icGlowEnd) {
					const icElapsed = now - this.nextICGlowTime;
					const icDuration = this.icGlowEnd - this.nextICGlowTime;
					// Triangle envelope
					const t = icElapsed / icDuration;
					const envelope = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
					this.flash = this.icGlowPeak * Math.max(0, envelope);
					this.regionDim = REGION_DIM_BASELINE - this.flash * 0.15;
				} else if (now >= this.icGlowEnd && this.icGlowEnd > 0) {
					// Schedule next IC glow
					this.nextICGlowTime = now + rand(IC_GLOW_MIN, IC_GLOW_MAX);
					const duration = rand(IC_GLOW_DURATION_MIN, IC_GLOW_DURATION_MAX);
					this.icGlowEnd = this.nextICGlowTime + duration;
					this.icGlowPeak = rand(IC_GLOW_INTENSITY_MIN, IC_GLOW_INTENSITY_MAX);
				}

				// Time for a CG flash?
				if (now >= this.nextFlashTime) {
					this.currentFlash = this.generateFlash();
					this.strokeIndex = 0;
					this.phase = FlashPhase.PreFlash;
					this.phaseStart = now;
				}
				break;

			case FlashPhase.PreFlash: {
				// Gradual IC glow buildup before first stroke
				const pf = this.currentFlash;
				if (!pf) break;
				const progress = elapsed / pf.preflashDuration;
				if (progress >= 1) {
					// Transition to first stroke peak
					this.phase = FlashPhase.StrokePeak;
					this.phaseStart = now;
				} else {
					// Ease-in quadratic buildup
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
				// Instantaneous peak — held for one frame then into decay
				this.flash = stroke.peakIntensity;
				this.regionDim = Math.max(0.05, REGION_DIM_BASELINE - stroke.peakIntensity * 0.7);
				this.setBolts(flash.bolts, stroke.peakIntensity);
				this.phase = FlashPhase.StrokeDecay;
				this.phaseStart = now;
				break;
			}

			case FlashPhase.StrokeDecay: {
				const flash = this.currentFlash;
				if (!flash) break;
				const stroke = flash.strokes[this.strokeIndex];
				if (!stroke) break;

				// Exponential decay: I(t) = peak * e^(-t/tau)
				const decayed = stroke.peakIntensity * Math.exp(-elapsed / stroke.decayTau);

				// Determine target floor (what we decay toward)
				const isLastStroke = this.strokeIndex >= flash.strokes.length - 1;
				const floorIntensity = isLastStroke ? 0.02 : 0.03;

				if (decayed <= floorIntensity) {
					if (isLastStroke) {
						// All strokes done → continuing current
						this.phase = FlashPhase.ContinuingCurrent;
						this.phaseStart = now;
						this.flash = floorIntensity;
					} else {
						// More strokes coming → interstroke dark
						this.phase = FlashPhase.Interstroke;
						this.phaseStart = now;
						this.flash = 0;
						this.boltA = 0;
						this.boltB = 0;
						this.boltC = 0;
					}
				} else {
					this.flash = decayed;
					this.regionDim = Math.max(0.1, REGION_DIM_BASELINE - decayed * 0.5);
					this.setBolts(flash.bolts, decayed);
				}
				break;
			}

			case FlashPhase.Interstroke: {
				const flash = this.currentFlash;
				if (!flash) break;

				const interval = flash.interstrokeIntervals[this.strokeIndex] ?? INTERSTROKE_CENTER;
				this.flash = 0;
				this.boltA = 0;
				this.boltB = 0;
				this.boltC = 0;
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
					// Flash fully complete
					this.flash = 0;
					this.boltA = 0;
					this.boltB = 0;
					this.boltC = 0;
					this.regionDim = REGION_DIM_BASELINE;
					this.currentFlash = null;
					this.phase = FlashPhase.Quiet;
					this.phaseStart = now;
					this.nextFlashTime = now + rand(INTER_FLASH_MIN, INTER_FLASH_MAX);
				} else {
					// Slow exponential fade with optional M-component
					const baseFade = 0.04 * Math.exp(-ccProgress * 3);

					// M-component: localized re-brightening pulse
					let mPulse = 0;
					if (flash.hasMComponent) {
						// M-component fires around 30-60% into continuing current
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
					// Bolts fade during continuing current
					this.setBolts(flash.bolts, baseFade * 0.5);
				}
				break;
			}

			default:
				break;
		}
	}

	/**
	 * Set bolt output values based on which bolts are active in this flash.
	 *
	 * @param activeBolts - Bolt identifiers selected for the current flash.
	 * @param intensity - Luminosity to apply to active bolts (0..1).
	 */
	private setBolts(activeBolts: readonly ('a' | 'b' | 'c')[], intensity: number): void {
		this.boltA = activeBolts.includes('a') ? intensity : 0;
		this.boltB = activeBolts.includes('b') ? intensity : 0;
		this.boltC = activeBolts.includes('c') ? intensity : 0;
	}

	// ── DOM output ───────────────────────────────────────────────────────────

	/**
	 * Write current output values to the root element's inline style.
	 *
	 * Called once per frame after {@linkcode update}. Values are serialized
	 * to 4 decimal places to avoid sub-pixel precision noise.
	 */
	private commit(): void {
		const s = this.root.style;
		s.setProperty('--flash', this.flash.toFixed(4));
		s.setProperty('--bolt-a', this.boltA.toFixed(4));
		s.setProperty('--bolt-b', this.boltB.toFixed(4));
		s.setProperty('--bolt-c', this.boltC.toFixed(4));
		s.setProperty('--region-dim', this.regionDim.toFixed(4));
	}
}
