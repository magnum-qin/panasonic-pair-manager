# Panasonic Pair Manager

Panasonic Pair Manager is a Windows-first Tauri desktop app for browsing and managing Panasonic camera media. It scans fixed folders and removable SD cards, groups RAW/JPG pairs, indexes videos, previews media, and supports safer deletion workflows.

## Development

Requirements:

- Node.js 22 or newer
- Rust stable toolchain
- Windows is the primary target

Common commands:

```powershell
npm install
npm run tauri:dev
npm run build
npm run check
npm run tauri:check
```

## Project Structure

- `src/`: React frontend.
- `src/components/`: shared UI primitives and reusable components.
- `src/features/`: feature-level UI and hooks.
- `src/styles/`: design tokens, layout, component styles, and themes.
- `src/locales/`: translation dictionaries.
- `src-tauri/src/`: Rust backend commands, scanning, database, deletion, thumbnail cache, and removable drive integration.

## Quality Gates

Before opening a pull request, run:

```powershell
npm run check
npm run tauri:check
```
