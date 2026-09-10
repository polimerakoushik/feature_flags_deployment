# Final Demo Walkthrough

## 1. Authentication
- Sign in with an existing account.

## 2. Environment-aware flags
- Select Development, Testing, or Production.
- Open Feature Flags and verify the selected environment is reflected in configuration.

## 3. Create and configure a flag
- Create a Boolean/String/Number flag with key, default value, enabled state, description, and owner team.
- Open Flag Details.
- Configure environment override.

## 4. Targeting and rollout
- Add specific users and groups.
- Set a deterministic percentage rollout.
- Reorder targeting rules where supported.

## 5. Evaluation
- Enter a user ID, groups, and attributes.
- Evaluate and show the resolved value/reason.

## 6. Analytics
- Open Flag Details → Evaluation Count.
- Switch between 7 and 30 days.
- Change the environment and verify the chart follows the environment filter.

## 7. Audit
- Open Audit Logs.
- Filter by environment/action/user/flag and inspect before/after changes.

## 8. Cleanup
- Open Cleanup Suggestions.
- Run a scan.
- Review a stale 100%-rolled-out or fully-disabled candidate.
- Mark it reviewed.

## 9. Integration proof
- Run the FastAPI and Django middleware examples from `backend/examples/`.
- Use the API/middleware documentation in `docs/middleware-integration.md`.
