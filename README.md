# Cliftin API

Cliftin is a read-only HTTP API for a live [Liftin](https://www.liftin.app/) SQLite database. It exposes program planning, routines, workouts, exercise history, and generated OpenAPI documentation.

The API has no authentication and does not enable CORS. The supplied Compose configuration publishes it only on loopback, so it is intended for the host machine and trusted local clients.

## API v1

The server listens on port `3000` inside the container.

- [`GET /openapi.json`](http://127.0.0.1:3000/openapi.json) returns the authoritative OpenAPI 3.1 document.
- [`GET /health`](http://127.0.0.1:3000/health) checks that the live database can be queried.
- API resources are under `/v1` and use numeric identifiers only.

Collections return `{ "items": [...] }`. Soft-deleted records are hidden from collections but can be returned by a direct numeric lookup with `isDeleted: true`.

Weight fields default to pounds. Endpoints with planned or performed weight data accept `?unit=kg` to opt into kilograms. Liftin-compatible conversion uses exactly `2.2` and returns values rounded to two decimal places.

## Docker Compose

The Compose service mounts Liftin's containing directory—not only the main database file—read-only at `/liftin`. This keeps the SQLite WAL and SHM sidecar files available to the process.

```sh
export TZ=America/Chicago
export LIFTIN_DIR="$HOME/Library/Containers/com.nstrm.Bello/Data/Library/Application Support/Liftin"
docker compose up --build
```

Then query the locally bound service:

```sh
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/openapi.json
curl 'http://127.0.0.1:3000/v1/workouts?limit=10'
curl 'http://127.0.0.1:3000/v1/programs/active/next-routine?unit=kg'
```

`TZ` is required and must be supplied by the host. `PORT` changes only the loopback host port; the container always listens on `3000`.

The service runs as a non-root user with a read-only container filesystem. It has read-only access to the database directory and does not modify Liftin data.

Do **not** open the database with SQLite immutable mode (for example, `immutable=1`). Immutable mode can ignore WAL state and return stale data. Keep the entire Liftin directory mounted so `BelloDataModel.sqlite`, `BelloDataModel.sqlite-wal`, and `BelloDataModel.sqlite-shm` are visible together.

## Local development

For development without Docker, point the server at the same live database and provide a timezone:

```sh
export TZ=America/Chicago
export LIFTIN_DB_PATH="$HOME/Library/Containers/com.nstrm.Bello/Data/Library/Application Support/Liftin/BelloDataModel.sqlite"
npm ci
npm run build
npm start
```

## Route inventory

System:

- `GET /health`
- `GET /openapi.json`

Programs and routines:

- `GET /v1/programs`
- `GET /v1/programs/active`
- `GET /v1/programs/:programId`
- `GET /v1/programs/:programId/plan`
- `GET /v1/programs/active/next-routine`
- `GET /v1/routines`
- `GET /v1/routines/:routineId`

Workouts:

- `GET /v1/workouts`
- `GET /v1/workouts/latest`
- `GET /v1/workouts/:workoutId`
- `GET /v1/workouts/:workoutId/routine`

Exercises:

- `GET /v1/exercises`
- `GET /v1/exercises/:exerciseId`
- `GET /v1/exercises/:exerciseId/statistics`
- `GET /v1/exercises/:exerciseId/performances`

See `/openapi.json` for complete query parameters, response schemas, examples, and error codes.
