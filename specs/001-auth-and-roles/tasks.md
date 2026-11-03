# Authentication and Roles Tasks

1. **Project scaffolding:** Add `package.json`, strict `tsconfig.json`, Jest with ts-jest, and `.gitignore` entries for `node_modules`, `.env`, and `*.db`. **Acceptance criteria:** none directly; foundation for AC1–AC9.
2. **User persistence and bootstrap:** Create the users table with role, manager assignment, active status, unique email, and password hash fields; seed the configured bootstrap admin idempotently. Add tests. **Acceptance criteria:** AC1.
3. **Admin user creation:** Add the admin-only user creation endpoint, validation, password hashing, manager assignment rules, and tests for accepted and rejected inputs. **Acceptance criteria:** AC2, AC3, AC8.
4. **Login and token issuance:** Add credential verification, generic 401 failures, and expiring JWT issuance using configured secrets and lifetime. Add tests. **Acceptance criteria:** AC4, AC5.
5. **Authentication and role middleware:** Protect all routes except login; check token validity, expiry, current account status, and current role permissions. Add tests for access denial and role changes. **Acceptance criteria:** AC6, AC7, AC9.
6. **Acceptance coverage:** Review the full auth test suite and ensure each criterion AC1–AC9 has an automated test, including bootstrap restart and token edge cases. **Acceptance criteria:** AC1–AC9 (test coverage).
