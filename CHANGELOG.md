# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.0] - 2026-03-04

### Added

- Add performance-adaptive detection to `StormEngine`: monitor rAF frame timing and apply `perf-reduced` CSS class when frames consistently exceed 18 ms, stripping flash-driven `border-color`/`box-shadow`/`background-color` transitions from `.panel` to avoid WebKit compositing thrashing.

### Changed

- Enable `customConditions: ["bun"]` in `tsconfig.json` so TypeScript resolves Bun-specific package exports during development.
- Bump `@types/bun` and `@typescript/native-preview` dev dependencies.

## [2.1.1] - 2026-03-03

### Fixed

- Prevent Cloudflare Rocket Loader from deferring the inlined early-theme script by emitting `data-cfasync="false"`, preserving first-paint theme selection and stable panel centering on deployed pages.

## [2.1.0] - 2026-03-03

### Added

- Add `vite-robots-txt` as a production dependency and generate crawler directives for this 404-only site.
- Add `biome lint` to the lint script.
- Add domain-split runtime modules under `src/theme/`, `src/calm/`, and `src/storm/`, plus dedicated `src/panel.ts` and `src/page-content.ts` entry helpers.
- Add JSR-style API doc comments across extracted theme, calm, panel, page-content, and storm modules.
- Add `bun run smoke` Playwright-based smoke test script (`scripts/smoke.ts`) that builds and validates the page via `vite preview`.
- Add Playwright e2e regression coverage for theme-control re-init listener cleanup and hotkey guards, plus `bun run test:e2e` script.
- Add Playwright accessibility regression test with `@axe-core/playwright` for WCAG A/AA violations.
- Add `dark-calm-off` accessibility test variant for dark-theme storm-active coverage.

### Changed

- Update `packageManager` field in `package.json` to `bun@1.3.10` to reflect current development environment.
- Bump package version to `2.1.0` after removing the legacy storm compatibility shim.
- Disable production source map output in Vite build so `dist/` no longer includes generated `.js.map` files.
- Configure `vite-robots-txt` with `disallowAll` + `meta: true` for auto-derived robots directives so search engines do not index or follow links from the error page.
- Remove hardcoded `<meta name="robots">` from `index.html` and let plugin-managed injection own robots directives.
- Refactor `StormEngine` phase handling into explicit strategy functions and remove the `src/storm.ts` compatibility shim now that imports are fully migrated to leaf modules.
- Adjust inline-theme injection order in `index.html` and wrap `inlineScript` output in `vite.config.ts` with a leading newline for cleaner generated markup.
- Harden capture CI shell scripts with strict env guards (`${VAR:?}`), brace-quoted expansions, and tab indentation via `shfmt`.
- Refactor `capture-summary.mjs` to parse inputs from a forwarded JSON env var instead of the raw webhook payload, adding safe type coercion.
- Import capture summary script via `action_path` instead of hardcoded workspace path.
- Bump `actions/download-artifact` to v8 in PR-preview workflow.
- Add `shfmt` and `sort-package-json` exec plugins to `.dprint.jsonc`.
- Switch Biome schema to local `node_modules` copy, enable domain-level lint categories, and change JS quote style to single quotes.
- Reorganize `package.json` scripts (alphabetize, split `lint` into `lint:biome`/`lint:eslint`) and bump `@biomejs/biome`, `@typescript/native-preview`, and `globals`.
- Move `prefers-reduced-motion`, calm-mode, and theme-locked CSS overrides to end of stylesheet and reorder `.theme-trigger__icon` transition before expanded state rule.
- Replace storm `*_MIN`/`*_MAX` pairs with immutable `Range` constants and overload `rand`/`randInt` to accept either `(min, max)` or a `Range` object.
- Parse blurb templates into typed AST (`TextPart | HostPart | CodePart`) to support backtick `<code>` spans and `\n` line breaks in blurb copy.
- Switch `shfmt` setup action to `kjanat/install-shfmt@v1` in autofix and lint CI workflows.
- Collapse multiline `permissions` block to single-line YAML in `pr-preview` workflow.
- Merge `gotoReady`/`gotoReadyWithPath` e2e helpers into a single `gotoReady` with optional path parameter.
- Switch e2e theme-control selectors from class names to `data-*` attribute selectors for resilience.
- Enable `fullyParallel` Playwright execution with dynamic worker count (2 in CI, auto locally).
- Use spread-based `testIgnore` override for WebKit skip instead of conditional empty array.
- Cache `ldconfig -p` output once in Playwright config and match Linux sonames by exact token/prefix (`lib.so` / `lib.so.*`) instead of raw substring checks.

### Fixed

- Make smoke test deterministic by waiting for `.storm-streak` and a non-empty `--cloud-bg` CSS variable instead of a fixed timeout.
- Guard calm media query initialization for non-browser imports and add `MediaQueryList.addListener`/`removeListener` fallbacks for Safari <14.
- Treat empty or whitespace-only `?host=` values as unset so host falls back to `window.location.hostname`.
- Remove redundant body theme-attribute writes, normalize the `t` keyboard shortcut check, and add Safari <14 fallback for system-theme change listeners.
- Route cloud puff offset sampling through shared `rand` helpers instead of direct `Math.random()` calls.
- Trim whitespace on `?calm=` query parameter before matching on/off patterns.
- Replace silent fallback in `pickRandom` with an explicit throw on impossible out-of-range index.
- Guard bolt-shuffle loop against zero `boltCount` and scope `activeBoltCount` inside the guard.
- Skip repeated `keydown` events and `contentEditable` elements in theme keyboard shortcut handler.
- Validate and normalize `StormEngine` `boltCount` constructor argument, falling back to default for non-finite or sub-1 values.
- Clamp `StormEngine` `boltCount` to a bounded `1..MAX_BOLT_COUNT` range and fall back to default when out of range.
- Disable `.theme-trigger__icon` transition under reduced-motion for both expanded and collapsed states.
- Filter theme option controls to valid parsed values before click handling and roving keyboard navigation.

## [2.0.5] - 2026-03-02

### Added

- Add this `CHANGELOG.md` and backfill release history from `v1.0.0` through `v2.0.4`.

### Changed

- Add a collapsed "opposite theme" screenshot preview block to `README.md` by mirroring `prefers-color-scheme` sources.

## [2.0.4] - 2026-03-02

### Changed

- Move `vite-svg-to-ico` from `devDependencies` to `dependencies` so npm registers this package as a dependent.

## [2.0.3] - 2026-03-02

### Fixed

- Prevent hidden-but-scrollable viewport movement by disabling root vertical scrolling caused by oversized decorative storm overlays.

## [2.0.2] - 2026-03-01

### Fixed

- Make light-mode capture deterministic by passing `?theme=light`/`?theme=dark` so early theme selection runs correctly before emulation timing races.

## [2.0.1] - 2026-03-01

### Fixed

- Respect `prefers-reduced-motion: reduce` by disabling theme drawer open animation.

## [2.0.0] - 2026-03-01

### Added

- Add first-class light theme support with early-theme initialization to prevent FOUC.
- Add procedural lightning `StormEngine` with CSS variable-driven flash/bolt state.
- Add accessible theme controls (System/Dark/Light) with keyboard navigation, URL theme lock, and persistence.
- Add color-scheme-aware capture tooling and CI artifacts for dark/light previews.

### Changed

- Replace static CSS lightning keyframes with procedural storm rendering.

### Fixed

- Fix reduced-motion handling, capture reliability ordering, and no-JS fallback content.

## [1.0.3] - 2026-02-26

### Fixed

- Use absolute asset paths (including favicon links) for CDN proxy compatibility.

## [1.0.2] - 2026-02-26

### Fixed

- Disable Cloudflare Rocket Loader interference on module script execution via `data-cfasync="false"`.

## [1.0.1] - 2026-02-26

### Added

- Add npm publish workflow with OIDC provenance.

### Fixed

- Fix publish workflow run-name formatting.
- Remove unnecessary `<br>` from the error message.

## [1.0.0] - 2026-02-25

### Added

- Initial public release of the 404 page package.

[Unreleased]: https://github.com/kjanat/404/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/kjanat/404/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/kjanat/404/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/kjanat/404/compare/v2.0.5...v2.1.0
[2.0.5]: https://github.com/kjanat/404/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/kjanat/404/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/kjanat/404/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/kjanat/404/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/kjanat/404/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/kjanat/404/compare/v1.0.3...v2.0.0
[1.0.3]: https://github.com/kjanat/404/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/kjanat/404/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/kjanat/404/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/kjanat/404/tree/v1.0.0

<!--markdownlint-disable-file no-inline-html no-duplicate-heading-->
