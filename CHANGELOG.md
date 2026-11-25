# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Opening a list slides and fades it in. It used to stay at no height, then appear all at once.

## [0.2.0] - 2026-11-25

### Added

- `columns` option on `group-dropdown-list`: how many columns its tiles are in.

### Changed

- Lists have 2 columns by default, instead of 1. Set `columns: 1` for the old layout.

## [0.1.0] - 2026-11-25

### Added

- `group-dropdown-tile`, a tile with a caret, and `group-dropdown-list`, the list of the group's
  members it opens.

[Unreleased]: https://github.com/kyler-frazier/hass-group-dropdown/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/kyler-frazier/hass-group-dropdown/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kyler-frazier/hass-group-dropdown/releases/tag/v0.1.0
