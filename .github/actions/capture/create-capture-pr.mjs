// @ts-check
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

const SCHEMES = /** @type {const} */ (['dark', 'light']);
const ALLOWED_EXTS = new Set(['gif', 'webp', 'mp4']);

/**
 * Create a PR that updates the preview media files and README reference.
 *
 * @param {import('@actions/github-script').AsyncFunctionArguments} args
 */
export default async function run({ github, context, core, exec }) {
	/** @type {Record<string, string | undefined>} */
	// Workflow dispatch inputs are untyped in the webhook payload — no escape from any here.
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const inputs = context.payload.inputs ?? {};
	const {
		url = '',
		width = '',
		height = '',
		duration = '',
		fps = '',
		quality = '',
		max_mb: maxMb = '',
		video_crf: videoCrf = '',
		ext = 'webp',
		color_scheme: colorScheme = 'both',
	} = inputs;
	const normalizedExt = ext.trim().toLowerCase();
	if (!ALLOWED_EXTS.has(normalizedExt)) {
		core.setFailed(`Unsupported extension "${ext}". Allowed: ${Array.from(ALLOWED_EXTS).join(', ')}`);
		return;
	}

	// Discover which preview files were actually downloaded
	const downloadedFiles = SCHEMES
		.map(s => /** @type {const} */ ([s, `preview-${s}.${normalizedExt}`]))
		.filter(([, f]) => existsSync(f));

	if (downloadedFiles.length === 0) {
		core.setFailed(
			`No preview files found. Expected preview-dark.${normalizedExt} and/or preview-light.${normalizedExt}`,
		);
		return;
	}

	/** Format a numeric timestamp segment with a 2-digit width. @param {number} n */
	const pad = n => String(n).padStart(2, '0');
	/** Escape table cell content so Markdown/HTML stays well-formed. @param {unknown} value */
	const escapeTableCell = value =>
		String(value)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('|', '&#124;');
	const now = new Date();
	const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${
		pad(now.getMinutes())
	}${pad(now.getSeconds())}`;
	const branch = `capture/preview-${normalizedExt}-${ts}`;

	await Promise.all([
		exec.exec('git', ['config', 'user.name', 'github-actions[bot]'])
			.then(() => exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])),
		exec.exec('git', ['checkout', '-b', branch]),
	]);

	// Remove ALL old preview files (legacy non-prefixed + scheme-prefixed of every extension)
	const oldFiles = [...ALLOWED_EXTS].flatMap(e => [
		`preview.${e}`,
		...SCHEMES.map(s => `preview-${s}.${e}`),
	]);
	await exec.exec('git', ['rm', '--cached', '-f', '--ignore-unmatch', ...oldFiles]);

	// Re-add any same-extension scheme files that still exist in the repo
	// (e.g. preview-light.webp when only dark was recaptured)
	for (const s of SCHEMES) {
		const f = `preview-${s}.${normalizedExt}`;
		if (existsSync(f)) await exec.exec('git', ['add', f]);
	}

	// Update README with <picture> element
	const readmeContent = await readFile('README.md', 'utf8');
	await writeFile('README.md', updateReadme(readmeContent, normalizedExt, downloadedFiles.map(([s]) => s)));

	const filesToAdd = downloadedFiles.map(([, f]) => f);
	await exec.exec('git', ['add', ...filesToAdd, 'README.md'])
		.then(() => exec.exec('git', ['commit', '-m', `chore: update preview captures (${normalizedExt})`]))
		.then(() => exec.exec('git', ['push', 'origin', branch]));

	const { stdout: commitShaStdout } = await exec.getExecOutput('git', ['rev-parse', 'HEAD']);
	const commitSha = commitShaStdout.trim();

	const { owner, repo } = context.repo;
	const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}`;
	const artifactUrl = `https://github.com/${owner}/${repo}/actions/runs/${context.runId}/artifacts`;

	const previewImages = downloadedFiles.map(([scheme, file]) =>
		`### ${scheme[0].toUpperCase()}${scheme.slice(1)}\n![${scheme} preview](${rawBase}/${commitSha}/${file})`
	);

	const body = [
		'Captured with the following settings:',
		'',
		'| Parameter    | Value |',
		'| ------------ | ----- |',
		`| URL          | <code>${escapeTableCell(url)}</code> |`,
		`| Dimensions   | ${escapeTableCell(`${width}x${height}`)} |`,
		`| Duration     | ${escapeTableCell(`${duration}s @ ${fps} fps`)} |`,
		`| Quality      | ${escapeTableCell(quality)} |`,
		`| Max size     | ${escapeTableCell(`${maxMb} MB`)} |`,
		`| Video CRF    | ${escapeTableCell(videoCrf)} |`,
		`| Filetype     | <code>${escapeTableCell(normalizedExt)}</code> |`,
		`| Color scheme | <code>${escapeTableCell(colorScheme)}</code> |`,
		'',
		...previewImages,
		'',
		`[Download artifact](${artifactUrl})`,
	].join('\n');

	const defaultBranch = String(
		context.payload.repository?.default_branch
			?? context.payload.repository?.defaultBranch
			?? 'master',
	);
	const pr = await github.rest.pulls.create({
		owner,
		repo,
		title: `Update preview captures (${normalizedExt})`,
		body,
		base: defaultBranch,
		head: branch,
	});

	await core.summary
		.addHeading('Preview PR created', 2)
		.addList([
			`PR: <a href="${pr.data.html_url}">${pr.data.html_url}</a>`,
			`Branch: <code>${branch}</code>`,
			`Commit: ${commitSha}`,
			...downloadedFiles.map(([, f]) => `Preview: <a href="${rawBase}/${commitSha}/${f}">${f}</a>`),
			`Artifact: <a href="${artifactUrl}">Download artifact</a>`,
		])
		.write();

	core.info(`PR created: ${pr.data.html_url}`);
	core.setOutput('pr-url', pr.data.html_url);
}

/**
 * Replace the README image section with a `<picture>` element that switches
 * between dark and light preview images based on the user's color scheme.
 *
 * Only emits `<source>` elements for schemes that actually exist, and falls
 * back to `preview-dark` when both are present.
 *
 * @param {string} content - Current README content.
 * @param {string} ext - Normalized file extension (e.g. "webp").
 * @param {ReadonlyArray<typeof SCHEMES[number]>} schemes - Which schemes have preview files.
 * @returns {string} Updated README content.
 */
function updateReadme(content, ext, schemes) {
	const fallback = schemes.includes('dark') ? 'dark' : schemes[0];
	const sources = schemes
		.map(s => `  <source media="(prefers-color-scheme: ${s})" srcset="preview-${s}.${ext}">`)
		.join('\n');
	const pictureBlock = [
		'<a href="https://404.kjanat.com" title="Visit the 404 page">',
		'<picture>',
		sources,
		`  <img alt="Preview of the 404 page" src="preview-${fallback}.${ext}">`,
		'</picture>',
		'</a>',
	].join('\n');

	let result = content;

	// Replace legacy markdown image + link definitions
	result = result.replace(/\[!\[.*?\]\[preview\]\]\[404\]\n*/g, '');
	result = result.replace(/^\[preview\]:.*\n?/gm, '');
	result = result.replace(/^\[404\]:.*\n?/gm, '');

	// Replace existing <picture> block (from a previous run)
	const pictureRegex = /<a href="https:\/\/404\.kjanat\.com"[^>]*>\s*<picture>[\s\S]*?<\/picture>\s*<\/a>\n*/;
	if (pictureRegex.test(result)) {
		result = result.replace(pictureRegex, `${pictureBlock}\n\n`);
	} else {
		// Insert after the first paragraph
		result = result.replace(
			/(Custom 404 error page[^\n]*\n)\n*/,
			`$1\n${pictureBlock}\n\n`,
		);
	}

	if (!result.includes('<picture>')) {
		console.warn('updateReadme: failed to insert <picture> block — README structure may have changed');
	}

	// Collapse excessive blank lines, ensure trailing newline
	result = result.replace(/\n{3,}/g, '\n\n');
	if (!result.endsWith('\n')) result += '\n';

	return result;
}
