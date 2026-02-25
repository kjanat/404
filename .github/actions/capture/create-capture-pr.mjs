// @ts-check
import { DefaultArtifactClient } from '@actions/artifact';
import { readFile, writeFile } from 'node:fs/promises';

/** @param {import('@actions/github-script').AsyncFunctionArguments} args */
export default async function run({ github, context, core, exec }) {
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
	} = context.payload.inputs ?? {};

	/** @param {number} n */
	const pad = n => String(n).padStart(2, '0');
	const now = new Date();
	const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${
		pad(now.getMinutes())
	}${pad(now.getSeconds())}`;
	const branch = `capture/preview-${ext}-${ts}`;

	const artifactClient = new DefaultArtifactClient();
	const { artifact } = await artifactClient.getArtifact(`preview.${ext}`);
	await artifactClient.downloadArtifact(artifact.id);

	await Promise.all([
		// config.lock: chain user.name → user.email
		exec.exec('git', ['config', 'user.name', 'github-actions[bot]'])
			.then(() => exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])),
		// index.lock: chain checkout → rm (rm needs the new branch)
		exec.exec('git', ['checkout', '-b', branch])
			.then(() =>
				exec.exec('git', ['rm', '--cached', '-f', '--ignore-unmatch', 'preview.gif', 'preview.webp', 'preview.mp4'])
			),
		// pure FS: fully independent
		readFile('README.md', 'utf8').then(content =>
			writeFile('README.md', content.replace(/preview\.[a-zA-Z0-9]*/g, `preview.${ext}`))
		),
	]);

	await exec.exec('git', ['add', `preview.${ext}`, 'README.md'])
		.then(() => exec.exec('git', ['commit', '-m', `chore: update preview screenshot to preview.${ext}`]))
		.then(() => exec.exec('git', ['push', 'origin', branch]));

	const { stdout: commitShaStdout } = await exec.getExecOutput('git', ['rev-parse', 'HEAD']);
	const commitSha = commitShaStdout.trim();

	const { owner, repo } = context.repo;
	const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}`;
	const artifactUrl = `https://github.com/${owner}/${repo}/actions/runs/${context.runId}/artifacts/${artifact.id}`;

	const body = [
		'Captured with the following settings:',
		'',
		'| Parameter  | Value |',
		'| ---------- | ----- |',
		`| URL        | <code>${url}</code> |`,
		`| Dimensions | ${width}x${height} |`,
		`| Duration   | ${duration}s @ ${fps} fps |`,
		`| Quality    | ${quality} |`,
		`| Max size   | ${maxMb} MB |`,
		`| Video CRF  | ${videoCrf} |`,
		`| Filetype   | <code>${ext}</code> |`,
		'',
		`![Preview](${rawBase}/${commitSha}/preview.${ext})`,
		'',
		`[Download artifact](${artifactUrl})`,
	].join('\n');

	const pr = await github.rest.pulls.create({
		owner,
		repo,
		title: `Update preview screenshot (preview.${ext})`,
		body,
		base: 'master',
		head: branch,
	});

	await core.summary
		.addHeading('Preview PR created', 2)
		.addRaw(`- PR: [${pr.data.html_url}](${pr.data.html_url})`, true)
		.addRaw(`- Branch: <code>${branch}</code>`, true)
		.addRaw(`- Commit: <code>${commitSha}</code>`, true)
		.addRaw(`- Preview: [preview.${ext}](${rawBase}/${commitSha}/preview.${ext})`, true)
		.addRaw(`- Artifact: [Download artifact](${artifactUrl})`, true)
		.write();

	core.info(`PR created: ${pr.data.html_url}`);
	core.setOutput('pr-url', pr.data.html_url);
}
