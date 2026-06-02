# Contributing

Keep changes focused and easy to review.

## Before You Submit

Run the standard checks:

```powershell
npm run check
npm run tauri:check
```

## Code Organization

- Put feature-specific React code under `src/features/<feature-name>/`.
- Keep shared UI primitives in `src/components/`.
- Keep shared hooks in `src/hooks/`.
- Keep style tokens and shared layout rules in `src/styles/`.
- Keep Rust Tauri commands thin; move domain logic into focused modules.

## Pull Request Expectations

- Explain the user-visible behavior change.
- Include test coverage or a manual test note.
- Avoid unrelated formatting churn.
