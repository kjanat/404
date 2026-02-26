declare module 'eslint-plugin-tailwindcss' {
	import type { Linter } from 'eslint';

	declare const plugin: {
		configs: {
			'flat/recommended': Linter.Config[];
		};
	};

	export default plugin;
}
