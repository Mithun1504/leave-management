# Leave Management Data Model

## Tables

### `users` (owned by the auth module)

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Required, non-empty |
| `email` | TEXT | Required, unique, non-empty |
| `password_hash` | TEXT | Required; bcrypt hash |
| `role` | TEXT | Required; `admin`, `manager`, or `employee` |
| `manager_id` | INTEGER | Self-reference to `users.id`; required for employees, null for admins and managers |
| `is_active` | INTEGER | Required boolean value, defaults to true |
| `is_bootstrap` | INTEGER | Required boolean value, defaults to false; at most one bootstrap admin |

### `leave_requests`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | Primary key |
| `employee_id` | INTEGER | Required foreign key to `users.id`; referenced user must have employee role |
| `leave_type` | TEXT | Required; `Casual`, `Sick`, or `Earned` |
| `start_date` | TEXT | Required `YYYY-MM-DD`; today or later in server UTC |
| `end_date` | TEXT | Required `YYYY-MM-DD`; on or after `start_date` |
| `reason` | TEXT | Required, non-empty |
| `status` | TEXT | Required; `Pending`, `Approved`, or `Rejected`; defaults to `Pending` |

## Constraints and relationships
- `users.manager_id` references the currently assigned manager. Leave requests do not store a manager ID; team access and decision authority follow the current assignment.
- Each leave request belongs to one employee. The employee reference must identify a user whose role is `employee`.
- A request's inclusive weekday duration is split by calendar year for balance checks. Holidays count as weekdays; partial days are unsupported.
- An employee may not have overlapping requests in `Pending` or `Approved` status. Check this rule transactionally during request creation.
- Only a `Pending` request may transition to `Approved` or `Rejected`; those statuses are final.
- No allocation or balance table is stored. Annual allocations are fixed by leave type; balances are calculated from approved request weekdays for the relevant calendar year.
- The decision actor, decision time, decision reason, request creation time, editing, and deletion are outside the leave feature's data model.
