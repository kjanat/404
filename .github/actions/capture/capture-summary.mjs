// @ts-check
/**
 * Publish a capture summary table to the GitHub Actions job summary.
 *
 * @param {import('@actions/github-script').AsyncFunctionArguments} args
 */
export default async function run({ core }) {
	const rawInputs = process.env.CAPTURE_INPUTS ?? '{}';

	/** @param {unknown} value @returns {value is Record<string, unknown>} */
	const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

	/** @type {Record<string, unknown>} */
	let inputs = {};
	try {
		const parsed = /** @type {unknown} */ (JSON.parse(rawInputs));
		if (isRecord(parsed)) {
			inputs = parsed;
		}
	} catch {
		core.warning('capture summary: failed to parse CAPTURE_INPUTS JSON');
	}

	/** @param {unknown} value */
	const asString = (value) => {
		if (typeof value === 'string') return value;
		if (typeof value === 'number') return String(value);
		if (typeof value === 'boolean') return String(value);
		if (typeof value === 'bigint') return String(value);
		if (value === null || value === undefined) return '';
		return '';
	};

	const url = asString(inputs.url);
	const width = asString(inputs.width);
	const height = asString(inputs.height);
	const duration = asString(inputs.duration);
	const fps = asString(inputs.fps);
	const quality = asString(inputs.quality);
	const maxMb = asString(inputs.max_mb);
	const videoCrf = asString(inputs.video_crf);
	const ext = asString(inputs.ext) || 'webp';
	const artifactUrl = process.env.ARTIFACT_URL ?? '';
	const colorScheme = process.env.COLOR_SCHEME ?? '';

	const dimensions = width && height ? `${width}x${height}` : 'n/a';
	const durationValue = duration && fps ? `${duration}s @ ${fps} fps` : 'n/a';
	const qualityValue = quality || 'n/a';
	const maxSizeValue = maxMb ? `${maxMb} MB` : 'n/a';
	const videoCrfValue = videoCrf || 'n/a';
	const urlValue = url || 'n/a';

	/** Escape HTML special characters for safe inclusion in table cells. @param {unknown} value */
	const esc = value =>
		String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

	await core.summary
		.addHeading('Capture complete', 3)
		.addTable([
			[{ data: 'Parameter', header: true }, { data: 'Value', header: true }],
			['URL', `<code>${esc(urlValue)}</code>`],
			['Dimensions', esc(dimensions)],
			['Duration', esc(durationValue)],
			['Quality', esc(qualityValue)],
			['Max size', esc(maxSizeValue)],
			['Video CRF', esc(videoCrfValue)],
			['Filetype', `<code>${esc(ext)}</code>`],
			['Color scheme', `<code>${esc(colorScheme)}</code>`],
		])
		.addEOL()
		.addLink('Download artifact', artifactUrl)
		.write();
}
