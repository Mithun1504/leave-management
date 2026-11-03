# Leave Management System: PRD

## Problem
Employees in a small company request leave over email and chat. Managers lose track of requests and nobody knows the remaining leave balance. We need a simple backend service that replaces this manual process.

## Goals
- Employees can request leave and see their balance.
- Managers can approve or reject requests from their team.
- Leave balances are always correct.

## Users and roles
| Role | Description |
|---|---|
| Admin | Creates and manages user accounts |
| Manager | Approves or rejects leave of the employees assigned to them |
| Employee | Applies for leave and views their own requests and balance |

Every employee has one assigned manager. A manager is also a user of the system.

## Modules

### 1. Authentication and roles
- Admin creates users (name, email, password, role, manager).
- Users log in with email and password and receive an access token.
- Every API endpoint, except login, requires a valid token.
- Access to features depends on the user's role.
- One admin account is created automatically when the system first starts.

### 2. Leave management
- Leave types: Casual, Sick, Earned.
- Yearly allocation per employee: Casual 12 days, Sick 10 days, Earned 15 days.
- An employee applies for leave with: leave type, start date, end date, reason.
- The assigned manager approves or rejects the request.
- Approved leave reduces the leave balance.
- Employees can view their own requests and remaining balance.
- Managers can view the requests of their team.

## Out of scope (for now)
- Frontend or UI
- Email or push notifications
- Public holiday calendar management
- Reports and analytics
- Leave carry-forward between years

## Success criteria
- An employee can apply, a manager can decide, and the balance reflects the decision.
- All business rules are covered by automated tests.