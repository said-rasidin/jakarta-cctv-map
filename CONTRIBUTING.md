# Contributing

Thank you for helping improve Jakarta CCTV Map. Contributions can include camera-location corrections, bug fixes, documentation, accessibility improvements, and new features.

## Before starting

- Search existing issues and pull requests to avoid duplicate work.
- Open an issue before making a large architectural or user-interface change.
- Never include private credentials, personal information, or recorded CCTV footage.
- Keep changes focused so they are easy to review.

## Development workflow

1. Fork the repository and create a branch from `main`.
2. Install dependencies with `npm ci`.
3. Start the application with `npm run dev`.
4. Make the change and add or update tests when behavior changes.
5. Run the required checks:

   ```bash
   npm run validate-data
   npm run lint
   npm test
   npm run build
   ```

6. Open a pull request explaining the problem, the solution, and how it was verified.

## Correct camera data

Generated files should not be edited by hand. If a camera is displayed at the wrong location:

1. Find its site ID in `data/cameras.json` or the application.
2. Verify the coordinates using a reliable source.
3. Add or update the site in `data/overrides.json`:

   ```json
   {
     "camera-site-id": {
       "lat": -6.2088,
       "lng": 106.8456,
       "district": "Central Jakarta"
     }
   }
   ```

4. Run `npm run ingest` and `npm run validate-data`.
5. Include the regenerated `data/cameras.json` and `data/unresolved-locations.json` files in the pull request.

For a removed, renamed, or unavailable upstream camera, include the source URL and evidence in an issue. Do not work around upstream access controls or add private camera feeds.

## Pull request checklist

- The change has a clear purpose and no unrelated edits.
- User-facing behavior is documented.
- Tests cover new or changed logic where appropriate.
- Data corrections include a reliable source or explanation.
- All required quality checks pass.
- No secrets, generated caches, recordings, or personal data are included.

By contributing, you agree that your contribution may be distributed under the repository's license.
