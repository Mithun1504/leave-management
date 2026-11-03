# Leave Management

## Overview
Employees request leave and view their requests and remaining balances. Their assigned manager reviews requests and approves or rejects them. Approved leave reduces the employee's balance.

## Scope
- Leave types are Casual, Sick, and Earned.
- Employees submit a request with leave type, start date, end date, and reason.
- The currently assigned manager can approve or reject requests from their employees.
- Employees can view their own requests and remaining balances.
- Managers can view requests for employees currently assigned to them.
- Yearly allocations are Casual: 12 days, Sick: 10 days, Earned: 15 days per employee.
- Dates use `YYYY-MM-DD`; “today” is the server's UTC date.

## Out of scope
- Frontend or UI, email or push notifications, public holiday calendar management, reports, and analytics.
- Leave carry-forward between years.
- Request editing, cancellation, and decision audit history or decision reasons.
- Authentication and role definitions, covered by `specs/001-auth-and-roles/spec.md`.

## User stories
- As an employee, I want to request Casual, Sick, or Earned leave with dates and a reason.
- As an employee, I want to see my leave requests and remaining balances.
- As a manager, I want to review requests from employees assigned to me and approve or reject them.
- As a manager, I want to view requests for my team.

## Business rules
- Each employee has one assigned manager; the currently assigned manager decides the employee's requests.
- Each employee receives yearly allocations of 12 Casual, 10 Sick, and 15 Earned days.
- The allocation year is the calendar year. Balances initialize on January 1; an employee created later in the year receives the full annual allocation when their account is created. Unused days expire at year end.
- A request includes one leave type, start date, end date, and non-empty reason. Start date must be today or later and no later than end date.
- Leave duration is the inclusive count of weekdays (Monday through Friday). Weekends are excluded; holidays are counted as weekdays because holiday calendar management is out of scope. Partial days are not supported.
- A request spanning calendar years is counted against each year's allocation for the weekdays in that year.
- Pending requests do not reserve or reduce balance. Rejected requests do not affect balance. Approved requests reduce the corresponding balance.
- A manager may approve a request only if its requested days fit the employee's remaining balance when the decision is made.
- Overlapping requests with an existing pending or approved request are rejected.
- Employees can access only their own leave records. Managers can access and decide requests only for employees currently assigned to them. Admins and unrelated employees have no leave-record access.
- A request can be decided only while pending. Once approved or rejected, its decision is final; a new request is required for further consideration.

## Leave statuses
- `Pending`: assigned when a request is submitted.
- `Approved`: set when the assigned manager approves a pending request.
- `Rejected`: set when the assigned manager rejects a pending request.
- Approved and rejected are final statuses. No other statuses or transitions are supported.

## Acceptance criteria
1. **Submit request:** Given an employee, when they submit a supported leave type, valid start and end dates, and a non-empty reason, then a request is recorded with status `Pending`.
2. **Leave types and allocation:** Given the start of a calendar year, when balances are initialized, then each employee receives 12 Casual, 10 Sick, and 15 Earned days; an employee created during the year receives those full allocations at account creation.
3. **Manager decision:** Given a pending request from an employee currently assigned to a manager, when that manager approves or rejects it, then its status changes to the corresponding final status. A manager cannot decide a request outside their assigned team or decide it again.
4. **Approved balance:** Given a pending request whose weekday duration fits the remaining balance, when the assigned manager approves it, then those weekdays are deducted from the matching leave type and calendar year's balance. Approval is denied if the remaining balance is insufficient.
5. **Employee view:** Given an employee, when they view requests and balances, then the response contains only their own requests and their remaining balances.
6. **Manager view:** Given a manager, when they view team requests, then the response contains requests only from employees currently assigned to them.
7. **Balance effects:** Given a pending or rejected request, when the employee's balance is viewed, then that request has not reserved or reduced balance.
8. **Access boundaries:** Given an admin or an unrelated employee, when they attempt to access another employee's leave records or decide that employee's request, then access is denied.

## Edge cases
- Invalid date values, start date before today, or start date after end date: reject the request.
- Missing or empty reason, missing fields, or unsupported leave type: reject the request.
- A request overlapping a pending or approved request: reject the new request.
- A request that exceeds remaining balance: the manager cannot approve it.
- Weekends are excluded, public holidays count as weekdays, and partial-day requests are rejected.
- A request crossing December 31 is split across the respective calendar-year balances.
- If manager assignment changes before a decision, only the currently assigned manager can decide; the manager team view reflects current assignments.
- A decision cannot be changed after approval or rejection; submit a new request for further consideration.
