import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import ts from 'typescript';
import type { Plugin, ViteDevServer } from 'vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import svgToIco from 'vite-svg-to-ico';

const SOURCE_ROOT = 'src';

/** Read the `version` string from the package manifest, parsed at the boundary. */
function readPackageVersion(): string {
	const parsed: unknown = JSON.parse(
		readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8'),
	);
	if (
		typeof parsed === 'object' && parsed !== null && 'version' in parsed
		&& typeof parsed.version === 'string'
	) {
		return parsed.version;
	}
	throw new Error('package.json is missing a string "version" field');
}

/** Build-time package version, read once from the package manifest. */
const PKG_VERSION = readPackageVersion();

/** Inject `<meta name="version">` into the head with the package.json version. */
function versionMeta(): Plugin {
	return {
		name: 'version-meta',
		transformIndexHtml() {
			return [
				{ tag: 'meta', attrs: { name: 'version', content: PKG_VERSION }, injectTo: 'head' },
			];
		},
	};
}

/**
 * Compile `<!-- @inline path/to/file.ts -->` markers into render-blocking
 * inline `<script>` blocks.  TypeScript is stripped via `ts.transpileModule`;
 * the result is **not** a module — it executes synchronously before first
 * paint.
 *
 * Uses an HTML comment so Vite's own `<script>` scanner never sees a bare
 * `src` attribute and doesn't emit a spurious "can't be bundled" warning.
 *
 * In dev mode the source file is watched and triggers a full page reload.
 */
function inlineScript(): Plugin {
	let server: ViteDevServer | undefined;
	const watched = new Set<string>();

	return {
		name: 'inline-script',
		enforce: 'pre',

		configureServer(s) {
			server = s;
		},

		transformIndexHtml(html) {
			return html.replace(
				/<!--\s*@inline\s+(\S+)\s*-->/g,
				(_, src: string) => {
					const abs = resolve(SOURCE_ROOT, src);

					if (server && !watched.has(abs)) {
						watched.add(abs);
						server.watcher.add(abs);
						server.watcher.on('change', (p) => {
							if (p === abs) server?.ws.send({ type: 'full-reload' });
						});
					}

					const source = readFileSync(abs, 'utf-8');
					const { outputText } = ts.transpileModule(source, {
						compilerOptions: {
							target: ts.ScriptTarget.ES2022,
							module: ts.ModuleKind.Preserve,
							removeComments: false,
						},
					});

					return `<script data-cfasync="false">\n${outputText}</script>`;
				},
			);
		},
	};
}

export default defineConfig({
	base: './',
	root: SOURCE_ROOT,
	plugins: [
		tailwindcss(),
		svgToIco({
			input: 'icon.svg',
			emit: [{ format: 'ico', filename: 'favicon.ico', inject: false }],
		}),
		inlineScript(),
		versionMeta(),
		{
			name: 'cf-async-disable',
			transformIndexHtml(html) {
				return html.replace(/<script type="module"/g, '<script data-cfasync="false" type="module"');
			},
		},
		viteSingleFile({ removeViteModuleLoader: true }),
	],
	build: {
		assetsInlineLimit: Number.POSITIVE_INFINITY,
		cssCodeSplit: false,
		emptyOutDir: false,
		outDir: '..',
		target: 'esnext',
		sourcemap: false,
	},
	server: {
		open: false,
		host: true,
		allowedHosts: true,
		strictPort: true,
	},
});
