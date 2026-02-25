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

	await core.summary
		.addHeading('Capture complete', 3)
		.addTable([
			[{ data: 'Parameter', header: true }, { data: 'Value', header: true }],
			['URL', `\`${url}\``],
			['Dimensions', `${width}x${height}`],
			['Duration', `${duration}s @ ${fps} fps`],
			['Quality', quality],
			['Max size', `${maxMb} MB`],
			['Video CRF', videoCrf],
			['Filetype', `\`${ext}\``],
		])
		.addEOL()
		.addLink('Download artifact', artifactUrl)
		.write();
}
