# Stage preparation and release

- The owner requested all stages 51–100 to be prepared and stored on GitHub, with releases in batches of exactly ten only when explicitly requested.
- The public boundary is recorded in `content/release.json`. Ordinary implementation, generation, builds, pushes, pull requests, and previews are not authorization to increase it or deploy production.
- Never merge or deploy this preparation branch as part of routine verification. Preserve the current live game until the owner requests an update.
- Unreleased puzzles and complete solutions belong in `content/`, outside the hosted `dist/` directory. Keep preview entrypoints under ignored `work/` only.
- Stages 101 onward and frost mechanics are outside this task. Do not add them to runtime data or player-facing announcements.
- Preserve stage 1–50 identities, puzzle content, progress keys, and existing mango hint behavior.
- For an authorized release, run `npm run release:stages -- --to N` for the next ten-stage boundary, then `npm test`. See `docs/stage-releases.md`.
- Do not set a release schedule or enable automatic merging.
