# AI Coding Agent Guide

## Project
Build a small backend service for employee leave requests, manager decisions, and accurate leave balances. Admins manage accounts; employees request leave and view their own balances and requests; managers decide requests from their teams. The PRD is the product authority, and feature behavior must be specified before implementation.

## Tech stack
- Node.js 20+ (LTS), TypeScript in strict mode, Express.
- SQLite via `better-sqlite3`; validate inputs with Zod.
- JWT auth with `jsonwebtoken`; hash passwords with `bcryptjs`.
- Jest, ts-jest, and Supertest for automated tests.
- OpenAPI 3.0 YAML for API contracts. REST/JSON under `/api`.
- No frontend, Docker, or ORM. Keep dependencies minimal.

## Layout
```text
docs/                 PRD, tech stack, and project documentation
specs/<NNN-feature>/  Numbered feature specifications
src/                  Application source
  app.ts              Express app setup
  server.ts           Server startup
  db/                 Database connection and schema
  modules/             Feature modules (auth, leave)
  shared/              Shared errors and validation helpers
tests/                 Automated tests, organized by feature
  auth/
  leave/
```

## Spec-driven workflow
For each change, follow these steps in order:
1. **Spec:** Write or locate the feature spec in `specs/<NNN-feature>/`, including scope and acceptance criteria.
2. **Clarify:** Resolve ambiguity with the user before proceeding; do not invent product behavior.
3. **Plan:** Break the specified change into small, ordered tasks.
4. **Tasks:** Select one task and define its expected outcome and relevant tests.
5. **Implement:** Complete that task only, keeping business logic in services rather than route handlers.
6. **Verify:** Run the relevant tests and build checks, and confirm each acceptance criterion is covered by a test.

## Rules
- Never implement behavior that is not in a spec.
- Ask the user when requirements or expected behavior are ambiguous.
- Update the spec before changing behavior; keep the spec and implementation aligned.
- Work on one task at a time. Finish and verify it before starting the next.
- Every acceptance criterion needs an automated test.
- Keep secrets out of source control; configure `PORT`, `JWT_SECRET`, and `DB_PATH` through environment variables.
- Dates use `YYYY-MM-DD`; interpret “today” as the server's UTC date.
- Use the documented error response and HTTP status conventions in `docs/TECHSTACK.md`.
