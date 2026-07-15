# AGENTS.md

## Project
- Name: `cliftin`
- Stack: Fastify + TypeBox + TypeScript + `kysely` + `better-sqlite3`
- Purpose: serve a read-only HTTP API over Liftin workout SQLite data

## Runtime and Environment
- Node: target `>=24` (current dev setup uses `fnm`; keep project version files current).
- DB path must come from env var only: `LIFTIN_DB_PATH`.
- Local development may use `.env.local` to point at the live database.
- Missing/invalid DB path should fail fast with actionable error text.

## HTTP Surface
- Versioned API routes are under `/v1`; the generated OpenAPI 3.1.2 document is at `/openapi.json`.
- Keep request schemas strict and document response shapes through TypeBox route schemas.
- Collections return `{items, nextCursor?}`; default weight unit is `lb` and clients may request `unit=kg`.

## Data/Schema Conventions
- User-facing term is `week` (DB table is `ZPERIOD`).
- Active program resolution:
  - Prefer `ZWORKOUTPROGRAMSINFO.ZSELECTEDWORKOUTPROGRAMID` mapped to `ZWORKOUTPLAN.ZID`.
  - Do not rely solely on `ZWORKOUTPLAN.ZISCURRENT`.
- Ordering quirks:
  - Weeks: order by `ZPERIOD.Z_FOK_WORKOUTPLAN`, then `Z_PK`.
  - Routines within week: order by `ZROUTINE.Z_FOK_PERIOD`, then `Z_PK`.
- Planned RPE sentinel:
  - `16` means unspecified/default and should be normalized to `null`.
- Soft deletes: hide soft-deleted resources from collections, but preserve direct historical lookup with `isDeleted: true` where the API contract specifies it.

## Units and Weight Representation
- Stored weight values are kg-based in the database.
- The API uses the Liftin-specific conversion `kg * 2.2` for pounds and sends weight-like values as `{value, unit}`.
- Return timestamps in UTC. Interpret inclusive date-only `from`/`to` filters in the process `TZ`.

## Quality Bar
- Before committing:
  - run `npm test`
  - ensure lint passes (posttest also runs lint)
- Prefer focused commits with descriptive messages.
- Document new DB quirks in `reference/db_schema.md`.

## Notes
- `ZWORKOUTPLAN.ZISTEMPLATE` exists but currently all rows are `0` in this dataset.
- Reference schema + quirks live in `reference/db_schema.md`.
