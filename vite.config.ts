import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import ts from 'typescript';
import type { Plugin, ViteDevServer } from 'vite';
import { defineConfig } from 'vite';
import svgToIco from 'vite-svg-to-ico';

interface BundleAssetLike {
	readonly type: string;
	readonly source?: unknown;
}

type BundleLike = Record<string, BundleAssetLike | undefined>;

function readPackageField(packageJson: string, field: string): string {
	const match = new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`).exec(packageJson);
	const value = match?.[1];
	if (value === undefined) {
		throw new Error(`Missing package field: ${field}`);
	}
	return value;
}

function createPublishedPackageJson(packageJson: string): string {
	return `${
		JSON.stringify(
			{
				name: readPackageField(packageJson, 'name'),
				version: readPackageField(packageJson, 'version'),
				description: readPackageField(packageJson, 'description'),
				homepage: readPackageField(packageJson, 'homepage'),
				repository: readPackageField(packageJson, 'repository'),
				license: readPackageField(packageJson, 'license'),
				author: readPackageField(packageJson, 'author'),
				type: 'module',
				publishConfig: {
					access: 'public',
					registry: 'https://registry.npmjs.org/',
				},
			},
			null,
			'\t',
		)
	}\n`;
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

function readBundleText(bundle: BundleLike, fileName: string): string | null {
	const item = bundle[fileName];
	if (item === undefined || item.type !== 'asset' || typeof item.source !== 'string') return null;
	return item.source;
}

function inlineAttributeText(attributes: string): string {
	return attributes.replace(/\s+crossorigin(?:="[^"]*")?/g, '').trim();
}

function svgDataUrl(source: string): string {
	return `data:image/svg+xml,${encodeURIComponent(source)}`;
}

function inlineBuildAssets(): Plugin {
	return {
		name: 'inline-build-assets',
		apply: 'build',
		enforce: 'post',
		generateBundle(_options, bundle) {
			const htmlAsset = bundle['index.html'];
			if (htmlAsset === undefined || htmlAsset.type !== 'asset' || typeof htmlAsset.source !== 'string') return;

			let html = htmlAsset.source;
			html = html.replace(
				/<script\b([^>]*?)\s+src="\/?([^"]+\.js)"([^>]*)><\/script>/g,
				(match: string, before: string, fileName: string, after: string) => {
					const source = readBundleText(bundle, fileName);
					if (source === null) return match;
					delete bundle[fileName];

					const attributes = inlineAttributeText(`${before}${after}`);
					return `<script${attributes === '' ? '' : ` ${attributes}`}>\n${source}\n</script>`;
				},
			);
			html = html.replace(
				/<link\b([^>]*?)\s+href="\/?([^"]+\.css)"([^>]*)>/g,
				(match: string, before: string, fileName: string, after: string) => {
					const attributes = `${before}${after}`;
					if (!/\brel="stylesheet"/.test(attributes)) return match;

					const source = readBundleText(bundle, fileName);
					if (source === null) return match;
					delete bundle[fileName];

					return `<style>\n${source}\n</style>`;
				},
			);
			html = html.replace(
				/<link\b([^>]*?)\s+href="\/?([^"]+\.svg)"([^>]*)>/g,
				(match: string, before: string, fileName: string, after: string) => {
					const attributes = `${before}${after}`;
					if (!/\brel="icon"/.test(attributes)) return match;

					const source = readBundleText(bundle, fileName);
					if (source === null) return match;
					delete bundle[fileName];

					return `<link${before} href="${svgDataUrl(source)}"${after}>`;
				},
			);

			for (const fileName of Object.keys(bundle)) {
				if (fileName !== 'index.html' && fileName !== 'robots.txt') delete bundle[fileName];
			}

			htmlAsset.source = html;
		},
	};
}

function stagePackageRoot(): Plugin {
	return {
		name: 'stage-package-root',
		apply: 'build',
		closeBundle() {
			const packageJson = readFileSync(resolve('package.json'), 'utf-8');
			writeFileSync(resolve('dist/package.json'), createPublishedPackageJson(packageJson));
			copyFileSync(resolve('README.md'), resolve('dist/README.md'));
			copyFileSync(resolve('LICENSE'), resolve('dist/LICENSE'));
		},
	};
}

export default defineConfig({
	base: '/',
	plugins: [
		tailwindcss(),
		svgToIco({
			input: 'src/icon.svg',
			emit: [
				{ format: 'ico', filename: 'favicon.ico', inject: false },
				{ format: 'svg', filename: 'favicon.svg', inject: true },
			],
		}),
		inlineScript(),
		inlineBuildAssets(),
		stagePackageRoot(),
		{
			name: 'cf-async-disable',
			transformIndexHtml(html) {
				return html.replace(/<script type="module"/g, '<script data-cfasync="false" type="module"');
			},
		},
	],
	build: {
		assetsInlineLimit: Number.POSITIVE_INFINITY,
		cssCodeSplit: false,
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
