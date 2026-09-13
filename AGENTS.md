# CareAtlas contributor instructions

- Use the existing React, Vite, TypeScript, Tailwind and React Leaflet architecture. Keep changes focused; do not rewrite the app.
- Read the relevant data contracts in `docs/` before changing data or screening behavior.
- Keep the public app focused on New Jersey. Do not restore retired prototype routes.
- Use official, source-backed geography and healthcare data. Never invent facilities, coordinates, access details or evidence. Preserve missing values and provenance.
- Keep fixtures separate from production data. Do not add patient data, diagnoses, medical advice, facility rankings or gap classifications based on pins alone.
- Work on `main` unless asked for a branch. Inspect status and pull before editing; never overwrite unrelated changes or force-push.
- Run `npm ci` if dependencies are absent. After editing, run `npm run check:changed`; use `npm test` for a complete verification. See `docs/testing.md` for focused commands.
- Use terminal checks for routine verification. Do not use the app browser connector for routine testing. Do not repeat passing tests unless relevant files change. The full suite already includes the production build.
- Commit and push the completed change after checks pass. Summarize what changed, verification and any remaining limits.
