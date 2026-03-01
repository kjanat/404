import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import ts from 'typescript';
import type { Plugin, ViteDevServer } from 'vite';
import { defineConfig } from 'vite';
import svgToIco from 'vite-svg-to-ico';

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
					const abs = resolve(src);

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
							module: ts.ModuleKind.None,
							removeComments: false,
						},
					});

					return `<script>${outputText}</script>`;
				},
			);
		},
	};
}

export default defineConfig({
	base: '/',
	plugins: [
		tailwindcss(),
		svgToIco({
			input: 'src/icon.svg',
			emit: { source: { name: 'favicon.svg' }, inject: true },
		}),
		inlineScript(),
		{
			name: 'cf-async-disable',
			transformIndexHtml(html) {
				return html.replace(/<script type="module"/g, '<script data-cfasync="false" type="module"');
			},
		},
	],
	build: { target: 'esnext', sourcemap: true },
	server: {
		open: true,
		host: true,
		allowedHosts: true,
		strictPort: true,
	},
});
