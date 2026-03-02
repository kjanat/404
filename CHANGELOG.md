# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `vite-robots-txt` as a production dependency and generate crawler directives for this 404-only site.
- Add `biome lint` to the lint script.

### Changed

- Update `packageManager` field in `package.json` to `bun@1.3.10` to reflect current development environment.
- Disable production source map output in Vite build so `dist/` no longer includes generated `.js.map` files.
- Configure `vite-robots-txt` with `disallowAll` + `meta: true` for auto-derived robots directives so search engines do not index or follow links from the error page.
- Remove hardcoded `<meta name="robots">` from `index.html` and let plugin-managed injection own robots directives.

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

[Unreleased]: https://github.com/kjanat/404/compare/v2.0.5...HEAD
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
