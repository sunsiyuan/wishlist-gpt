# actions/

Machine-readable contracts for GPT Actions.

- `openapi.template.yaml`: Source OpenAPI template (uses `__BASE_URL__`).
- `public/openapi.yaml`: Generated artifact imported into GPT Actions.
- Generate the artifact with `npm run gen:openapi` (also runs on `npm run build`).
- Keep descriptions bilingual if possible (CN + EN).
- Changes here should be mirrored in `docs/API_SURFACE.md`.
