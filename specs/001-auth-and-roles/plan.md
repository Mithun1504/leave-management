# Authentication and Roles Plan

## Endpoints
- `POST /api/auth/login` accepts email and password; success returns an access token. Unknown email and wrong password share the same 401 response.
- `POST /api/users` creates a user and is restricted to admins. Require non-empty name, email, password, and role; employees require one manager, while admins and managers have none.
- These paths are proposed because the spec defines endpoint behavior but not paths. Add the chosen paths to the spec before implementation.
- Use the documented JSON error envelope and status codes from `docs/TECHSTACK.md`.

## Users table
- `id`: primary identifier.
- `name`, `email`: required; email is unique.
- `password_hash`: bcrypt hash, never plaintext.
- `role`: admin, manager, or employee.
- `manager_id`: reference to another user; required for employees and null for admins/managers.
- `is_active`: account status used to reject requests for inactive users; new users and bootstrap admin start active.
- Enforce role and manager assignment rules when creating an account; preserve the bootstrap account across restarts.

## Middleware
- Allow login without authentication; protect every other API endpoint with authentication middleware.
- Read and verify the access token, then resolve the current user and account status on each request.
- Reject missing, invalid, expired, inactive-account, or unknown-user tokens with 401.
- Apply the current user's role permissions; deny disallowed actions with 403.
- Keep authorization and business logic out of route handlers where possible, in keeping with service conventions.

## Password and token handling
- Hash passwords with `bcryptjs` before storage and compare submitted passwords against hashes during login.
- Return the same 401 error for unknown email and incorrect password; never return a token for either case.
- Sign access tokens as JWTs with `jsonwebtoken` and `JWT_SECRET`; set expiry from deployment configuration.
- Resolve current role and active status from the user record rather than relying on stale role claims in a token.
- Supply bootstrap admin credentials through deployment configuration; do not hardcode or log credentials or secrets.
