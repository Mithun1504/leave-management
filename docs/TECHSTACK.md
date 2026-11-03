# Tech Stack and Conventions

## Stack
| Area | Choice |
|---|---|
| Runtime | Node.js (LTS, 20 or newer) |
| Language | TypeScript (strict mode) |
| Framework | Express |
| Database | SQLite via `better-sqlite3` (single file, no server needed) |
| Validation | Zod |
| Auth | JWT (`jsonwebtoken`), passwords hashed with `bcryptjs` |
| Testing | Jest, ts-jest and Supertest |
| API contracts | OpenAPI 3.0 YAML files |

No frontend, no Docker, no ORM. Keep dependencies minimal.

## Project layout
```
src/
  app.ts            Express app setup
  server.ts         Starts the server
  db/               Database connection and schema
  modules/
    auth/           routes, service, middleware
    leave/          routes, service
  shared/           errors, validation helpers
tests/
  auth/
  leave/
specs/              Specifications (see AGENTS.md)
docs/               PRD and tech stack
```

## Conventions
- REST over JSON. Base path: `/api`.
- Dates are plain `YYYY-MM-DD` strings. "Today" is the server's UTC date.
- Error format: `{ "error": { "code": "STRING_CODE", "message": "Readable message" } }`
- HTTP status codes: 400 invalid input, 401 not logged in, 403 not allowed, 404 not found, 409 conflict, 422 business rule violated.
- Business logic lives in services, not in route handlers.
- Configuration through environment variables (`PORT`, `JWT_SECRET`, `DB_PATH`). Never commit secrets.
- Tests use a separate in-memory or temporary database.

## Commands
- `npm run dev` starts the server with reload.
- `npm test` runs all tests.
- `npm run build` compiles TypeScript.