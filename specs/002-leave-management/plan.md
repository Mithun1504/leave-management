# Leave Management Plan

## Approach
- Add leave endpoints under `/api/leave`; reuse the auth module's JWT authentication and current-user lookup.
- Employees create requests and read their own requests and balances. Managers read and decide requests for employees currently assigned to them. Admins have no leave access.
- Keep routes thin; enforce leave rules in services and use shared validation and error responses.

## Services
- `LeaveRequestService` validates and creates requests, scopes request lists, and applies manager decisions.
- `BalanceService` calculates yearly allocations, weekday duration, and remaining balances.
- Resolve team scope from the current `users.manager_id` relationship at request and decision time; do not duplicate auth or manager assignments in leave records.

## Balance calculation
- Use the server's UTC calendar year. Allocations are 12 Casual, 10 Sick, and 15 Earned days; a new employee receives the full allocation at account creation.
- Count inclusive Monday-to-Friday dates; weekends are excluded, public holidays count as weekdays, and partial days are unsupported.
- Split multi-year requests by calendar year. For each leave type and year, remaining balance is allocation minus weekdays in approved requests. Pending and rejected requests do not reserve or reduce balance; unused days expire at year end.
- Approve only when the request's year-by-year weekday counts fit the employee's remaining balances.

## Concurrency
- Use SQLite write transactions for request creation and decisions.
- Use `BEGIN IMMEDIATE` transactions. While creating a request, check for overlapping pending or approved requests and insert within the same transaction; overlapping submissions conflict.
- While deciding, verify the request is still pending and the caller is its currently assigned manager, recalculate balances, then update the status atomically.
- SQLite serializes competing writes. A second decision after another decision returns a conflict; concurrent approvals cannot overdraw a balance.
