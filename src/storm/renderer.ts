import fragmentShaderSource from '#404/storm/shaders/storm.frag.glsl?raw';
import vertexShaderSource from '#404/storm/shaders/storm.vert.glsl?raw';
import type { BoltSegment } from '#404/storm/types';
import type { ThemeName } from '#404/theme/types';

const MAX_DEVICE_PIXEL_RATIO = 1.5;
const MAX_BOLT_SEGMENTS = 72;
const CANVAS_SELECTOR = '.storm-canvas';

interface RenderState {
	readonly time: number;
	readonly flash: number;
	readonly regionDim: number;
	readonly boltIntensity: number;
	readonly boltSegments: readonly BoltSegment[];
	readonly theme: ThemeName;
}

interface UniformLocations {
	readonly resolution: WebGLUniformLocation;
	readonly time: WebGLUniformLocation;
	readonly flash: WebGLUniformLocation;
	readonly regionDim: WebGLUniformLocation;
	readonly boltIntensity: WebGLUniformLocation;
	readonly theme: WebGLUniformLocation;
	readonly boltSegmentCount: WebGLUniformLocation;
	readonly boltSegments: WebGLUniformLocation;
	readonly boltData: WebGLUniformLocation;
}

/**
 * Resolve a required uniform location from the linked storm program.
 *
 * @param gl - WebGL2 context that owns the program.
 * @param program - Linked shader program to inspect.
 * @param name - Uniform name expected by the renderer.
 */
function getUniformLocation(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	name: string,
): WebGLUniformLocation {
	const location = gl.getUniformLocation(program, name);
	if (location === null) {
		throw new Error(`Missing WebGL uniform: ${name}`);
	}
	return location;
}

/**
 * Compile a storm shader and include the browser compile log in thrown errors.
 *
 * @param gl - WebGL2 context used for shader compilation.
 * @param type - Shader stage constant, such as `gl.VERTEX_SHADER`.
 * @param source - GLSL source imported from a raw shader file.
 */
function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (shader === null) {
		throw new Error('Unable to create WebGL shader');
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error';
		gl.deleteShader(shader);
		throw new Error(log);
	}

	return shader;
}

/**
 * Link the full-screen storm shader program.
 *
 * @param gl - WebGL2 context that will own the linked program.
 */
function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
	const program = gl.createProgram();

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) ?? 'Unknown program link error';
		gl.deleteProgram(program);
		throw new Error(log);
	}

	return program;
}

/**
 * Resolve the document theme into the compact renderer theme enum.
 *
 * @param root - Document root carrying the `data-theme` attribute.
 */
function resolveThemeName(root: HTMLElement): ThemeName {
	return root.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Return whether test builds should keep canvas pixels readable. */
function shouldPreserveDrawingBuffer(): boolean {
	return import.meta.env.DEV && new URLSearchParams(window.location.search).has('storm-test');
}

/**
 * Raw WebGL2 renderer for the atmospheric storm layer.
 *
 * Owns all GPU resources and exposes a narrow render-state API to StormEngine.
 */
export class StormRenderer {
	private readonly canvas: HTMLCanvasElement;
	private readonly root: HTMLElement;
	private readonly segmentUniformData = new Float32Array(MAX_BOLT_SEGMENTS * 4);
	private readonly segmentParamData = new Float32Array(MAX_BOLT_SEGMENTS * 2);

	private gl: WebGL2RenderingContext | null = null;
	private program: WebGLProgram | null = null;
	private uniforms: UniformLocations | null = null;
	private initialized = false;
	private active = false;
	private width = 0;
	private height = 0;
	private dpr = 1;

	/**
	 * Create the renderer and initialize WebGL state for the storm canvas.
	 *
	 * @param root - Document root used to read theme state.
	 * @param canvas - Full-screen storm canvas element.
	 */
	private constructor(root: HTMLElement, canvas: HTMLCanvasElement) {
		this.root = root;
		this.canvas = canvas;
		this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
		this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
		this.initialize();
	}

	/**
	 * Create the renderer for the page's storm canvas.
	 *
	 * @param root - Document root used for theme state.
	 */
	static create(root: HTMLElement): StormRenderer | null {
		const canvas = document.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR);
		if (canvas === null) return null;

		try {
			return new StormRenderer(root, canvas);
		} catch (error) {
			canvas.dataset.stormRenderer = 'fallback';
			canvas.dataset.stormActive = 'false';
			if (import.meta.env.DEV) {
				console.warn('[StormRenderer] WebGL2 initialization failed', error);
			}
			return null;
		}
	}

	/** Mark the renderer active and draw the first neutral frame. */
	start(): void {
		this.active = this.initialized;
		this.canvas.dataset.stormActive = this.active ? 'true' : 'false';
		this.canvas.dataset.stormTheme = resolveThemeName(this.root);
	}

	/** Stop drawing active lightning and clear the canvas to fallback visuals. */
	stop(): void {
		this.active = false;
		this.canvas.dataset.stormActive = 'false';
		const gl = this.gl;
		if (gl === null) return;
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
	}

	/**
	 * Draw one storm frame from the current state machine output.
	 *
	 * @param state - Current atmospheric and lightning state.
	 */
	render(state: RenderState): void {
		if (!this.active || !this.initialized) return;

		const gl = this.gl;
		const program = this.program;
		const uniforms = this.uniforms;
		if (gl === null || program === null || uniforms === null) return;

		this.resize();
		const segmentCount = this.writeBoltUniforms(state.boltSegments);
		const themeValue = state.theme === 'light' ? 1 : 0;

		gl.viewport(0, 0, this.width, this.height);
		gl.useProgram(program);
		gl.uniform2f(uniforms.resolution, this.width, this.height);
		gl.uniform1f(uniforms.time, state.time);
		gl.uniform1f(uniforms.flash, state.flash);
		gl.uniform1f(uniforms.regionDim, state.regionDim);
		gl.uniform1f(uniforms.boltIntensity, state.boltIntensity);
		gl.uniform1i(uniforms.theme, themeValue);
		gl.uniform1i(uniforms.boltSegmentCount, segmentCount);
		gl.uniform4fv(uniforms.boltSegments, this.segmentUniformData);
		gl.uniform2fv(uniforms.boltData, this.segmentParamData);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		this.canvas.dataset.stormTheme = state.theme;
	}

	/** Initialize WebGL resources and cache all required storm uniforms. */
	private initialize(): void {
		const gl = this.canvas.getContext('webgl2', {
			alpha: true,
			antialias: false,
			depth: false,
			failIfMajorPerformanceCaveat: false,
			preserveDrawingBuffer: shouldPreserveDrawingBuffer(),
			premultipliedAlpha: false,
			stencil: false,
		});

		if (gl === null) {
			throw new Error('WebGL2 is unavailable');
		}

		const program = createProgram(gl);
		this.gl = gl;
		this.program = program;
		this.uniforms = {
			resolution: getUniformLocation(gl, program, 'uResolution'),
			time: getUniformLocation(gl, program, 'uTime'),
			flash: getUniformLocation(gl, program, 'uFlash'),
			regionDim: getUniformLocation(gl, program, 'uRegionDim'),
			boltIntensity: getUniformLocation(gl, program, 'uBoltIntensity'),
			theme: getUniformLocation(gl, program, 'uTheme'),
			boltSegmentCount: getUniformLocation(gl, program, 'uBoltSegmentCount'),
			boltSegments: getUniformLocation(gl, program, 'uBoltSegments[0]'),
			boltData: getUniformLocation(gl, program, 'uBoltData[0]'),
		};

		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		this.initialized = true;
		this.canvas.dataset.stormRenderer = 'webgl2';
		this.canvas.dataset.stormActive = 'false';
		this.resize();
	}

	/** Match the backing store to the canvas display size and DPR cap. */
	private resize(): void {
		const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
		const nextWidth = Math.max(1, Math.floor(this.canvas.clientWidth * nextDpr));
		const nextHeight = Math.max(1, Math.floor(this.canvas.clientHeight * nextDpr));

		if (nextWidth === this.width && nextHeight === this.height && nextDpr === this.dpr) {
			return;
		}

		this.width = nextWidth;
		this.height = nextHeight;
		this.dpr = nextDpr;
		this.canvas.width = nextWidth;
		this.canvas.height = nextHeight;
	}

	/**
	 * Upload active lightning segments into reusable uniform buffers.
	 *
	 * @param segments - Generated bolt segments for the current flash.
	 */
	private writeBoltUniforms(segments: readonly BoltSegment[]): number {
		this.segmentUniformData.fill(0);
		this.segmentParamData.fill(0);

		const segmentCount = Math.min(segments.length, MAX_BOLT_SEGMENTS);
		for (let i = 0; i < segmentCount; i++) {
			const segment = segments[i];
			if (segment === undefined) continue;
			const segmentOffset = i * 4;
			const dataOffset = i * 2;
			this.segmentUniformData[segmentOffset] = segment.ax;
			this.segmentUniformData[segmentOffset + 1] = segment.ay;
			this.segmentUniformData[segmentOffset + 2] = segment.bx;
			this.segmentUniformData[segmentOffset + 3] = segment.by;
			this.segmentParamData[dataOffset] = segment.width;
			this.segmentParamData[dataOffset + 1] = segment.strength;
		}

		return segmentCount;
	}

	/** Mark the renderer inactive after WebGL context loss. */
	private readonly handleContextLost = (event: Event): void => {
		event.preventDefault();
		this.initialized = false;
		this.active = false;
		this.program = null;
		this.uniforms = null;
		this.canvas.dataset.stormRenderer = 'lost';
		this.canvas.dataset.stormActive = 'false';
	};

	/** Recreate GPU resources after the browser restores the storm context. */
	private readonly handleContextRestored = (): void => {
		try {
			this.initialize();
			this.start();
		} catch (error) {
			this.canvas.dataset.stormRenderer = 'fallback';
			this.canvas.dataset.stormActive = 'false';
			if (import.meta.env.DEV) {
				console.warn('[StormRenderer] WebGL2 context restore failed', error);
			}
		}
	};
}
