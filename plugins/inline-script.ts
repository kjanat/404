import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import type { Plugin, ViteDevServer } from 'vite';

const INLINE_REGEX = /<!--\s*@inline\s+(\S+)\s*-->/g;

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
function inlineScript(SOURCE: string): Plugin {
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
				INLINE_REGEX,
				(_, src: string) => {
					const abs = resolve(SOURCE, src);

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

export { inlineScript, inlineScript as default };
