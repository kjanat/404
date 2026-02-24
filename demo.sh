#!/usr/bin/env bash
# This script demonstrates how to use the new capture CLI
# with auto-sweep for WebP and MP4 outputs.

set -euo pipefail
IFS=$'\n\t'

readonly URL="https://unavailable.kajkowalski.nl"
readonly WIDTH=1152
readonly HEIGHT=648
readonly DURATION=6
readonly FPS=12
readonly MAX_BYTES=$((3 * 1024 * 1024)) # 3 MB

function die() {
	printf '%s\n' "$*" >&2
	exit 1
}

function check_git_branch() {
	git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
		die "Not inside a git repo."

	local current_branch
	current_branch="$(git branch --show-current 2>/dev/null || true)"

	[[ -n "${current_branch}" ]] ||
		die "Detached HEAD (or unknown branch). Please checkout 'feature/capture-video-sweep'."

	[[ "${current_branch}" == "feature/capture-video-sweep" ]] ||
		die "Please switch to 'feature/capture-video-sweep' (current: ${current_branch})."
}

function install_deps() {
	if ! command -v bun >/dev/null 2>&1; then
		die "bun not found in PATH. Install bun first."
	fi

	function ensure_playwright_chromium() {
		# Playwright manages its own Chromium build; this is effectively idempotent.
		bunx playwright install chromium >/dev/null
	}

	bun install
	ensure_playwright_chromium
}

function capture() {
	local width height url duration fps
	width="$1"
	height="$2"
	url="$3"
	duration="$4"
	fps="$5"
	shift 5

	bun capture \
		-w "${width}" \
		-h "${height}" \
		--url "${url}" \
		-d "${duration}" \
		--fps "${fps}" \
		"$@"
}

function run_if_not_exists() {
	local output_file
	output_file="$1"
	shift

	if [[ -f "${output_file}" ]]; then
		printf "Output file '%s' already exists. Skipping capture.\n" "${output_file}"
		return 0
	fi

	"$@"
}

function main() {
	check_git_branch
	install_deps

	local -a files
	files=(
		"preview_auto-sweep.webp"
		"preview_auto-sweep.mp4"
		"preview_explicit.mp4"
	)

	# 1) WebP auto-sweep to stay under 3 MB (best quality found)
	run_if_not_exists "${files[0]}" \
		capture "${WIDTH}" "${HEIGHT}" "${URL}" "${DURATION}" "${FPS}" \
		--max-bytes "${MAX_BYTES}" \
		-o "${files[0]}"

	# 2) MP4 auto-sweep to stay under 3 MB (best CRF found)
	run_if_not_exists "${files[1]}" \
		capture "${WIDTH}" "${HEIGHT}" "${URL}" "${DURATION}" "${FPS}" \
		--max-bytes "${MAX_BYTES}" \
		-o "${files[1]}"

	# 3) Optional: explicit MP4 quality without sweep
	run_if_not_exists "${files[2]}" \
		capture "${WIDTH}" "${HEIGHT}" "${URL}" "${DURATION}" "${FPS}" \
		--video-crf "22" \
		-o "${files[2]}"

	# Check file sizes (GNU coreutils `stat`)
	stat -c '%n	%s' "${files[@]}"

	# Workflow dispatch equivalents (inputs):
	# - width=1152
	# - height=648
	# - url=https://unavailable.kajkowalski.nl
	# - duration=6
	# - fps=12
	# - quality=100
	# - max_bytes=3145728
	# - video_crf=28
	# - out=preview.webp or out=preview.mp4
}

main "$@"
