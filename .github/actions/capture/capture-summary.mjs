// @ts-check
/**
 * Publish a capture summary table to the GitHub Actions job summary.
 *
 * @param {import('@actions/github-script').AsyncFunctionArguments} args
 */
export default async function run({ context, core }) {
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
	const artifactUrl = process.env.ARTIFACT_URL ?? '';

	/** Escape HTML special characters for safe inclusion in table cells. @param {string} value */
	const esc = value =>
		String(value)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;');

	await core.summary
		.addHeading('Capture complete', 3)
		.addTable([
			[{ data: 'Parameter', header: true }, { data: 'Value', header: true }],
			['URL', `<code>${esc(url)}</code>`],
			['Dimensions', esc(`${width}×${height}`)],
			['Duration', esc(`${duration}s @ ${fps} fps`)],
			['Quality', esc(quality)],
			['Max size', esc(`${maxMb} MB`)],
			['Video CRF', esc(videoCrf)],
			['Filetype', `<code>${esc(ext)}</code>`],
		])
		.addEOL()
		.addLink('Download artifact', artifactUrl)
		.write();
}
