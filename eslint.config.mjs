import js from '@eslint/js';
// @ts-ignore
import html from 'eslint-plugin-html';
import globals from 'globals';

export default [
	{
		files: ['**/*.html'],
		plugins: { html },
		rules: js.configs.recommended.rules,
		languageOptions: {
			globals: globals.browser,
		},
	},
];
