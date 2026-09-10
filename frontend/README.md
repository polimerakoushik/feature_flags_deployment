# FlagPilot Frontend

React/Vite dashboard for the Intelligent Feature Deployment and Rollout Platform.

## Run

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` when the API is not served through the Vite `/api` proxy.

## Production build

```bash
npm run build
```

## Main flows

1. Sign in.
2. Select an environment.
3. Create or open a feature flag.
4. Configure status, environment override, users/groups, and rollout.
5. Evaluate the flag with a user context.
6. Review evaluation metrics on the Flag Details page for 7 or 30 days.
7. Inspect Audit Logs.
8. Open Cleanup Suggestions, scan, inspect candidates, and mark them reviewed.

The dashboard uses live API data by default; no fabricated evaluation or cleanup metrics are used in the normal flow.
