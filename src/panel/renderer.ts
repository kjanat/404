import fragmentShaderSource from '#404/panel/shaders/panel-light.frag.glsl?raw';
import vertexShaderSource from '#404/panel/shaders/panel-light.vert.glsl?raw';

const MAX_DEVICE_PIXEL_RATIO = 1.5;
const PANEL_LIGHT_SELECTOR = '.panel-light-canvas';

interface UniformLocations {
	readonly resolution: WebGLUniformLocation;
	readonly glint: WebGLUniformLocation;
	readonly theme: WebGLUniformLocation;
}

function getUniformLocation(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	name: string,
): WebGLUniformLocation {
	const location = gl.getUniformLocation(program, name);
	if (location === null) {
		throw new Error(`Missing panel light uniform: ${name}`);
	}
	return location;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (shader === null) {
		throw new Error('Unable to create panel light shader');
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) ?? 'Unknown panel light shader compile error';
		gl.deleteShader(shader);
		throw new Error(log);
	}

	return shader;
}

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
		const log = gl.getProgramInfoLog(program) ?? 'Unknown panel light program link error';
		gl.deleteProgram(program);
		throw new Error(log);
	}

	return program;
}

function resolveThemeValue(): number {
	return document.documentElement.dataset.theme === 'light' ? 1 : 0;
}

/**
 * WebGL renderer for the panel-local light sheen.
 *
 * Keeps decorative panel light in shaders while the panel DOM remains ordinary
 * accessible content.
 */
export class PanelLightRenderer {
	private readonly canvas: HTMLCanvasElement;
	private readonly resizeObserver: ResizeObserver;
	private readonly themeObserver: MutationObserver;
	private gl: WebGL2RenderingContext | null = null;
	private program: WebGLProgram | null = null;
	private uniforms: UniformLocations | null = null;
	private glintX = 0.2;
	private glintY = 0;
	private width = 0;
	private height = 0;
	private dpr = 1;

	private constructor(panel: HTMLElement, canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.resizeObserver = new ResizeObserver(() => {
			this.render();
		});
		this.themeObserver = new MutationObserver(() => {
			this.render();
		});

		this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
		this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
		this.initialize();
		this.resizeObserver.observe(panel);
		this.themeObserver.observe(document.documentElement, {
			attributeFilter: ['data-theme'],
			attributes: true,
		});
		this.render();
	}

	/** Create the renderer for the panel canvas, if WebGL2 is available. */
	static create(panel: HTMLElement): PanelLightRenderer | null {
		const canvas = panel.querySelector<HTMLCanvasElement>(PANEL_LIGHT_SELECTOR);
		if (canvas === null) return null;

		try {
			return new PanelLightRenderer(panel, canvas);
		} catch (error) {
			canvas.dataset.panelLightRenderer = 'fallback';
			if (import.meta.env.DEV) {
				console.warn('[PanelLightRenderer] WebGL2 initialization failed', error);
			}
			return null;
		}
	}

	/** Move the shader glint focus in normalized panel coordinates. */
	setGlint(x: number, y: number): void {
		this.glintX = Math.min(1, Math.max(0, x));
		this.glintY = Math.min(1, Math.max(0, y));
		this.render();
	}

	private initialize(): void {
		const gl = this.canvas.getContext('webgl2', {
			alpha: true,
			antialias: false,
			depth: false,
			failIfMajorPerformanceCaveat: false,
			premultipliedAlpha: false,
			stencil: false,
		});

		if (gl === null) {
			throw new Error('WebGL2 is unavailable for panel light');
		}

		const program = createProgram(gl);
		this.gl = gl;
		this.program = program;
		this.uniforms = {
			resolution: getUniformLocation(gl, program, 'uResolution'),
			glint: getUniformLocation(gl, program, 'uGlint'),
			theme: getUniformLocation(gl, program, 'uTheme'),
		};

		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.disable(gl.BLEND);

		this.canvas.dataset.panelLightRenderer = 'webgl2';
		this.resize();
	}

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

	private render(): void {
		const gl = this.gl;
		const program = this.program;
		const uniforms = this.uniforms;
		if (gl === null || program === null || uniforms === null) return;

		this.resize();
		gl.viewport(0, 0, this.width, this.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(program);
		gl.uniform2f(uniforms.resolution, this.width, this.height);
		gl.uniform2f(uniforms.glint, this.glintX, this.glintY);
		gl.uniform1i(uniforms.theme, resolveThemeValue());
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	private readonly handleContextLost = (event: Event): void => {
		event.preventDefault();
		this.gl = null;
		this.program = null;
		this.uniforms = null;
		this.canvas.dataset.panelLightRenderer = 'lost';
	};

	private readonly handleContextRestored = (): void => {
		try {
			this.initialize();
			this.render();
		} catch (error) {
			this.canvas.dataset.panelLightRenderer = 'fallback';
			if (import.meta.env.DEV) {
				console.warn('[PanelLightRenderer] WebGL2 context restore failed', error);
			}
		}
	};
}
