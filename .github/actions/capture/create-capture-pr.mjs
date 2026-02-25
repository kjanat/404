// @ts-check
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

/**
 * Create a PR that updates the preview media file and README reference.
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
	} = inputs;
	const normalizedExt = ext.trim().toLowerCase();
	const allowedExts = new Set(['gif', 'webp', 'mp4']);
	if (!allowedExts.has(normalizedExt)) {
		core.setFailed(`Unsupported extension "${ext}". Allowed: ${Array.from(allowedExts).join(', ')}`);
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
	const previewFile = `preview.${normalizedExt}`;

	if (!existsSync(previewFile)) {
		core.setFailed(`Missing downloaded artifact file: ${previewFile}`);
		return;
	}

	await Promise.all([
		// config.lock: chain user.name → user.email
		exec.exec('git', ['config', 'user.name', 'github-actions[bot]'])
			.then(() => exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])),
		exec.exec('git', ['checkout', '-b', branch]),
	]);
	await exec.exec('git', ['rm', '--cached', '-f', '--ignore-unmatch', 'preview.gif', 'preview.webp', 'preview.mp4']);

	const readmeContent = await readFile('README.md', 'utf8');
	await writeFile(
		'README.md',
		readmeContent.replace(/preview\.(?:gif|webp|mp4)\b/g, `preview.${normalizedExt}`),
	);

	await exec.exec('git', ['add', previewFile, 'README.md'])
		.then(() => exec.exec('git', ['commit', '-m', `chore: update preview screenshot to preview.${normalizedExt}`]))
		.then(() => exec.exec('git', ['push', 'origin', branch]));

	const { stdout: commitShaStdout } = await exec.getExecOutput('git', ['rev-parse', 'HEAD']);
	const commitSha = commitShaStdout.trim();

	const { owner, repo } = context.repo;
	const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}`;
	const artifactUrl = `https://github.com/${owner}/${repo}/actions/runs/${context.runId}/artifacts`;

	const body = [
		'Captured with the following settings:',
		'',
		'| Parameter  | Value |',
		'| ---------- | ----- |',
		`| URL        | <code>${escapeTableCell(url)}</code> |`,
		`| Dimensions | ${escapeTableCell(`${width}x${height}`)} |`,
		`| Duration   | ${escapeTableCell(`${duration}s @ ${fps} fps`)} |`,
		`| Quality    | ${escapeTableCell(quality)} |`,
		`| Max size   | ${escapeTableCell(`${maxMb} MB`)} |`,
		`| Video CRF  | ${escapeTableCell(videoCrf)} |`,
		`| Filetype   | <code>${escapeTableCell(normalizedExt)}</code> |`,
		'',
		`![Preview](${rawBase}/${commitSha}/preview.${normalizedExt})`,
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
		title: `Update preview screenshot (preview.${normalizedExt})`,
		body,
		base: defaultBranch,
		head: branch,
	});

	await core.summary
		.addHeading('Preview PR created', 2)
		.addList([
			`PR: <a href="${pr.data.html_url}">${pr.data.html_url}</a>`,
			`Branch: <code>${branch}</code>`,
			`Commit: <code>${commitSha}</code>`,
			`Preview: <a href="${rawBase}/${commitSha}/preview.${normalizedExt}">preview.${normalizedExt}</a>`,
			`Artifact: <a href="${artifactUrl}">Download artifact</a>`,
		])
		.write();

	core.info(`PR created: ${pr.data.html_url}`);
	core.setOutput('pr-url', pr.data.html_url);
}
