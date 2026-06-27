<p align="center">
  <img src="src-tauri/icons/icon-256.png" width="96" alt="Panasonic Pair Manager logo" />
</p>

<h1 align="center">Panasonic Pair Manager</h1>

<p align="center">
  A Windows-first desktop app for browsing Panasonic camera media, pairing RAW/JPG files, indexing videos, and deleting safely.
</p>

<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/magnum-qin/panasonic-pair-manager/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/magnum-qin/panasonic-pair-manager/ci.yml?branch=main&label=CI&logo=github" /></a>
  <a href="https://github.com/magnum-qin/panasonic-pair-manager/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/magnum-qin/panasonic-pair-manager?style=flat&logo=github" /></a>
  <a href="https://github.com/magnum-qin/panasonic-pair-manager/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/magnum-qin/panasonic-pair-manager?include_prereleases&logo=github" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/magnum-qin/panasonic-pair-manager" /></a>
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111" />
</p>

## Screenshot

![Panasonic Pair Manager screenshot](docs/images/app-screenshot.png)

## Highlights

- **RAW/JPG pairing**: groups Panasonic RAW, JPG, sidecar, and video files by stem.
- **Folder and SD card sources**: scans fixed folders and removable Panasonic-style media folders.
- **Fast browsing**: virtualized gallery controls, card-size presets, search, and sorting.
- **Preview and metadata**: previews images/videos and reads file details, ExifTool status, and FFmpeg availability.
- **Safer deletion**: reviews the exact files in a group before moving media to the recycle bin.
- **Multilingual UI**: English, Simplified Chinese, Traditional Chinese, Japanese, Korean, French, German, Spanish, and Portuguese.

## Install

Prebuilt installers are published from the GitHub Releases page when available:

[Download the latest release](https://github.com/magnum-qin/panasonic-pair-manager/releases)

For local builds, use the development setup below.

## Development

Requirements:

- Node.js 22 or newer
- Rust stable toolchain
- Windows as the primary target platform

Common commands:

```powershell
npm install
npm run tauri:dev
npm run build
npm run check
npm run tauri:check
```

## Project Structure

```text
src/              React frontend
src/components/   Shared UI primitives and reusable components
src/features/     Feature-level UI, hooks, and workflows
src/styles/       Design tokens, layout, component styles, and themes
src/locales/      Translation dictionaries
src-tauri/src/    Rust backend commands, scanning, database, deletion, thumbnails, and drive integration
```

## Quality Gates

Run these before opening a pull request:

```powershell
npm run check
npm run tauri:check
```

## Star History

<a href="https://star-history.com/#magnum-qin/panasonic-pair-manager&Date">
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=magnum-qin/panasonic-pair-manager&type=Date" />
</a>

## Contributing

Contributions are welcome. Keep changes focused, include user-visible notes in pull requests, and run the quality gates before submitting.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

## License

Licensed under the [MIT License](LICENSE).
