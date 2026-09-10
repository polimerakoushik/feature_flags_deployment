const ROLLOUT_SPEC = `I need you to fix and implement the percentage rollout behavior in my existing Feature Flag Management application.

IMPORTANT:
This must be a REAL working implementation, not just a UI change.

The main requirement is:

If there are 50 eligible users and the rollout percentage is 50%:

Total users = 50
Rollout = 50%
Enabled users = exactly 25
Disabled users = exactly 25

The system must select 25 users for the rollout and the remaining 25 users must be excluded.

The same user assignment must be used everywhere:

1. View Enabled Users
2. View Disabled Users
3. Evaluation Test Panel
4. POST /evaluate
5. Rollout Statistics

There must be ONE source of truth.

=================================================
1. FIRST INSPECT THE EXISTING PROJECT
=================================================

Before changing code, inspect:

- User model
- Feature Flag model
- Rollout implementation
- Evaluation service
- /evaluate endpoint
- Environment logic
- Targeting logic
- Enabled Users API
- Disabled Users API
- Rollout Statistics API
- Redis/cache
- Database schema
- Existing Manage Rollout page
- Existing Evaluation Test Panel

Do not rebuild the project.

Reuse the existing architecture.

Do not create a second evaluation engine.

=================================================
2. CORE REQUIREMENT
=================================================

Assume the system has:

50 eligible users:

user-001
user-002
user-003
...
user-050

Rollout:

50%

Expected:

25 ENABLED
25 DISABLED

Example:

ENABLED:

user-003
user-007
user-009
user-012
...
25 users

DISABLED:

user-001
user-002
user-004
user-005
...
25 users

The exact users can be selected using a randomized/seeded assignment, but the assignment MUST remain stable.

=================================================
3. VERY IMPORTANT — STABLE ASSIGNMENT
=================================================

Do NOT randomly select users every time /evaluate is called.

That would create incorrect behavior.

For example, this is WRONG:

Request 1:
user-001 → Enabled

Request 2:
user-001 → Disabled

Request 3:
user-001 → Enabled

Do NOT do this.

Instead, when the rollout population is determined, create a stable assignment for the eligible users.

Example:

50 users
50% rollout

Assign exactly 25 users:

user-003 → ENABLED
user-007 → ENABLED
user-009 → ENABLED
...

The assignment remains stable.

Repeated evaluation of the same user must always return the same result.

=================================================
4. RANDOM BUT DETERMINISTIC/STABLE
=================================================

The user selection should appear random, but must be stable.

Do not use a runtime random value such as:

Math.random()

or equivalent random selection during every evaluation.

Use a deterministic/seeded approach OR persist the selected assignments.

The important requirement is:

Random-looking selection
+
Stable assignment
+
Exactly the required number of enabled users

For example:

50 users × 50% = exactly 25 enabled.

=================================================
5. ROUNDING
=================================================

For percentage rollout, calculate the enabled count correctly.

Examples:

50 users × 0% = 0 enabled

50 users × 10% = 5 enabled

50 users × 25% = 12 or 13 depending on the defined rounding rule

50 users × 50% = 25 enabled

50 users × 75% = 37 or 38 depending on the defined rounding rule

50 users × 100% = 50 enabled

Define one consistent rounding rule.

For the 50-user/50% case:

MUST be exactly:

25 enabled
25 disabled

=================================================
6. DO NOT CHANGE THE USER POPULATION
=================================================

The percentage must be calculated from the actual eligible users returned by the backend.

Do NOT create fake users.

Do NOT hard-code:

50

25

25

The system should work for:

10 users
50 users
100 users
500 users
1000 users

Example:

100 users at 25%

Expected:

25 enabled
75 disabled

=================================================
7. ENABLED USERS
=================================================

When the user clicks:

View Enabled Users

show ONLY users that are actually enabled according to the rollout evaluation.

Example:

Total:

50

Rollout:

50%

Enabled:

25

The Enabled Users page must display exactly 25 user IDs.

Example:

user-003
user-007
user-009
user-012
...

There must NOT be:

- 24 users
- 26 users
- Duplicate users
- Users that evaluate to disabled

=================================================
8. DISABLED USERS
=================================================

When the user clicks:

View Disabled Users

show ONLY the remaining users that are not included in the rollout.

For 50 users at 50%:

Disabled = exactly 25.

The Enabled and Disabled sets must be mutually exclusive.

There must be no overlap.

The following must always be true:

enabled_users + disabled_users = total_users

and:

enabled_users ∩ disabled_users = empty

=================================================
9. EVALUATION TEST PANEL
=================================================

The Evaluation Test Panel must use the SAME assignment used by the Enabled/Disabled Users pages.

Example:

Enabled user:

user-003

When I select:

user-003

and click:

Evaluate

the result must be:

✓ ENABLED

Flag is enabled for this user.

Example:

Disabled user:

user-001

When I select:

user-001

and click:

Evaluate

the result must be:

✕ DISABLED

Do not calculate a different result in the frontend.

=================================================
10. EVALUATION RESPONSE
=================================================

The backend evaluation endpoint should return enough information for the UI.

For example:

{
  "flag_key": "new-checkout",
  "user_id": "user-003",
  "enabled": true,
  "reason": "percentage_rollout",
  "rollout_percentage": 50
}

For disabled:

{
  "flag_key": "new-checkout",
  "user_id": "user-001",
  "enabled": false,
  "reason": "percentage_rollout",
  "rollout_percentage": 50
}

Adapt this to the existing API response structure.

Do not break the existing API contract unnecessarily.

=================================================
11. FRONTEND EVALUATION MESSAGE
=================================================

If evaluation returns:

enabled = true

show:

✓ Flag is enabled for this user

If evaluation returns:

enabled = false

show:

✕ Flag is disabled for this user

Also show:

Reason:
Percentage Rollout

Do not show "Enabled" simply because the rollout percentage is greater than 0.

Use the actual evaluation response.

=================================================
12. ROLLOUT STATISTICS
=================================================

The Rollout page must display real values.

Example:

TOTAL USERS
50

ENABLED USERS
25
50%

DISABLED USERS
25
50%

Do not calculate these independently in React.

The backend should provide the actual values.

... (truncated for brevity in this file; full spec was saved to docs/flag-cleanup.md)
`;

export default ROLLOUT_SPEC;
