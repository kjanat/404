import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import svgToIco from 'vite-svg-to-ico';
import { inlineScript } from './plugins/inline-script';
import { versionMeta } from './plugins/version-meta';

import { version } from './package.json' with { type: 'json' };

export default defineConfig({
	base: './',
	root: 'src',
	plugins: [
		versionMeta(version),
		tailwindcss(),
		svgToIco({
			input: 'icon.svg',
			emit: [{ format: 'ico', filename: 'favicon.ico', inject: false }],
		}),
		inlineScript('src'), // dprint-ignore
		{ name: 'cf-async-disable', transformIndexHtml(html) { return html.replace(/<script type="module"/g, '<script data-cfasync="false" type="module"') } },
		viteSingleFile({ removeViteModuleLoader: true }),
	],
	build: {
		assetsInlineLimit: 0,
		cssCodeSplit: false,
		emptyOutDir: false,
		outDir: import.meta.dirname,
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
