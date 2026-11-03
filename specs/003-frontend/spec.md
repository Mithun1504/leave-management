# Frontend

## Overview
A minimal browser UI for the existing authentication, user creation, and leave APIs. It uses the existing endpoints only; the admin user-list view is omitted because its endpoint does not exist.

## Screens and endpoints
- **Login (all roles):** `POST /api/auth/login` with email and password; receive and store `accessToken`.
- **Admin: create user:** `POST /api/users` with name, email, password, role, and `managerId` for employees.
- **Admin: list users:** No screen is built; see Gaps.
- **Employee: balance:** `GET /api/leave/balances`.
- **Employee: apply for leave:** `POST /api/leave/requests` with leave type, start date, end date, and reason.
- **Employee: my requests:** `GET /api/leave/requests`.
- **Manager: team requests:** `GET /api/leave/requests`.
- **Manager: approve or reject:** `POST /api/leave/requests/{requestId}/decision` with `Approved` or `Rejected`.

## Behavior
- Store the access token in `sessionStorage`; attach it as a Bearer token to authenticated API requests. Clear it on logout and return to login.
- Login does not return a role. Resolve navigation using existing permissions: `GET /api/leave/balances` succeeds for employees; if forbidden, `GET /api/leave/requests` succeeds for managers; if both are forbidden, an empty `POST /api/users` validation request distinguishes admins (400) from forbidden users (403). This probe creates no user.
- Show only navigation and screens for the resolved role. Backend authorization remains authoritative; on 401, clear the session and return to login.
- Show a loading state during API calls and prevent duplicate form submissions while pending.
- For API errors, display the readable `error.message` from `{ "error": { "code": "STRING_CODE", "message": "Readable message" } }`.
- Show request status and returned balances from the API; do not calculate balances in the browser.

## Gaps
- `GET /api/users` is not defined. Admins can create users, but the user-list screen is omitted; employee creation requires entering an existing manager's ID manually.
- Login has no role field; navigation is inferred from existing endpoint authorization responses as described above.

## Manual smoke-test checklist
- Log in as an employee; verify employee navigation, current balances, request form, and own request list.
- Submit a valid employee request; verify it appears with `Pending` status and pending leave does not change balances.
- Log in as a manager; verify only current team requests appear, then approve and reject pending requests.
- Log in as an admin; create a user and verify the user-list screen is absent.
- Submit invalid input and verify the API's readable error message is shown with a loading state that clears.
- Log out; verify the token is removed from `sessionStorage` and login is shown.
