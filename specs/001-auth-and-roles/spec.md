# Authentication and Roles

## Overview
This feature establishes user accounts, email-and-password login, access tokens, and role-based access to system features.

## Scope
- An admin creates user accounts; this feature does not define other account-management operations.
- `POST /api/users` creates accounts. The authenticated caller must be an admin. The request contains `name`, `email`, `password`, `role`, and `managerId` for employees; `managerId` is omitted or null for admins and managers. Success returns the created account with HTTP 201.
- Users log in with email and password and receive an access token.
- `POST /api/auth/login` accepts `email` and `password` and returns an `accessToken` on success.
- A valid token is required for every API endpoint except login.
- Access to features depends on whether the user is an admin, manager, or employee.
- One bootstrap admin account is created automatically on first start, using credentials supplied through deployment configuration.

## Out of scope
- Leave request, approval, balance, and allocation behavior, specified by the leave module.
- Frontend or UI, notifications, public holiday management, reports, analytics, and leave carry-forward.
- Token refresh, logout, password reset, and account recovery.

## Roles
- **Admin:** creates and manages user accounts.
- **Manager:** approves or rejects leave requests from employees assigned to them.
- **Employee:** applies for leave and views their own requests and balance.
- Every employee has one assigned manager. A manager is also a user.

## User stories
- As an admin, I want to create and manage user accounts so system users can access appropriate features.
- As a user, I want to log in with my email and password and receive an access token.
- As a user, I want features to be available according to my role.
- As an employee, I want my manager assignment to determine which manager handles my requests.

## Business rules
- User creation is performed by an admin and includes non-empty name, email, password, and role.
- Email addresses must be unique. No further field-format or password-strength constraints are defined in this feature.
- A manager assignment is required for employees and unset for admins and managers.
- Login uses email and password and returns an access token on success.
- Every API endpoint except login requires a valid access token.
- Authorization depends on the user's role and the feature's defined permissions.
- Employees have exactly one assigned manager; managers are system users.
- The bootstrap admin credentials are supplied through deployment configuration and are not hardcoded. Subsequent starts preserve the existing bootstrap account without creating another.
- Bootstrap credentials are configured with `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD`.
- A valid access token expires according to a lifetime supplied through deployment configuration.
- Token lifetime is configured with `JWT_EXPIRES_IN` and signed with `JWT_SECRET`.
- Each request resolves the user's current account status and role; deny access if the account no longer exists or is inactive, and apply current role permissions.
- Unknown email and incorrect password produce the same authentication failure response (401).
- Duplicate email is rejected with HTTP 409; missing or empty required fields are rejected with HTTP 400; invalid role or manager assignment is rejected with HTTP 422.
- Account-management operations beyond creating users are not defined in this feature.

## Acceptance criteria
1. **Initial admin:** Given the system is starting for the first time and deployment credentials are configured, when initialization completes, then one bootstrap admin account exists with those credentials. On subsequent starts, the existing account is preserved and no duplicate is created.
2. **Create user:** Given an authenticated admin, when they create a user with non-empty name, unique email, non-empty password, and role, then an account with those attributes is created; an employee also has exactly one assigned manager, while an admin or manager has no manager assignment.
3. **Admin restriction:** Given a non-admin user, when they attempt to create or manage user accounts, then access is denied.
4. **Login:** Given a user with valid credentials, when they log in with their email and password, then they receive an access token.
5. **Invalid login:** Given an unknown email or incorrect password, when the user attempts login, then no access token is issued and the same 401 authentication failure response is returned for either case.
6. **Protected endpoint:** Given a request to any API endpoint other than login without a valid token, when it is processed, then access is denied.
7. **Role access:** Given an authenticated user, when they access a feature, then access follows the permissions defined for their role and that feature.
8. **Employee assignment:** Given an employee account, when it is created, then exactly one system user with the manager role is assigned to it.
9. **Current authorization:** Given an issued token, when its configured lifetime has elapsed or the user's account is inactive or no longer exists, then a protected request is denied; otherwise, authorization uses the user's current role.

## Edge cases
- Missing, malformed, expired, or otherwise invalid access token: request is denied.
- Duplicate email, missing required fields, or invalid role or manager assignment: user creation is rejected.
- The bootstrap admin already exists on a later system start: preserve the account and do not create a duplicate.
- If a user's role changes while a token is active, subsequent requests use the current role. If the user's account becomes inactive or is removed, subsequent requests are denied.
