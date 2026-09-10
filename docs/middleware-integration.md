# Middleware integration examples

This project exposes a lightweight `FlagCacheClient` that can be plugged into a consuming application to avoid repeated API calls for simple feature checks.

## What it does

- Refreshes a cached flag list from the feature-flag API every few seconds.
- Reads the most recent `flags` metadata from the backend.
- Evaluates a flag locally using deterministic hashing and target rules.
- Keeps the server as the source of truth for authoritative decisions.

## FastAPI example

Use the demo app at `backend/examples/fastapi_flag_integration_demo.py`.

1. Start the feature-flag API on port `8002`.
2. Set the API URL if it is not localhost:
   `export FEATURE_FLAG_API_URL=http://localhost:8002/api`
3. Run the consumer app:
   `uvicorn backend.examples.fastapi_flag_integration_demo:app --host 0.0.0.0 --port 9001 --reload`
4. Hit the endpoint:
   `curl "http://localhost:9001/checkout?user_id=user-123&groups=beta-users"`

The response includes `enabled: true|false` based on the cached flag state.

## Django example

Use the demo app at `backend/examples/django_flag_integration_demo.py`.

1. Ensure the project is configured with Django installed.
2. Set `FEATURE_FLAG_API_URL` if needed.
3. Start the demo app:
   `python backend/examples/django_flag_integration_demo.py`
4. Open:
   `http://localhost:9002/checkout?user_id=user-123&group=beta-users`

## Recommended pattern

- Use the cached client for low-latency UI or request gating.
- Call the authoritative feature-flag API when the decision must be audited or updated immediately.
- Keep the cache refresh interval short enough for your SLA, but not so short that it creates unnecessary network traffic.

## Safety note

`FlagCacheClient` is intentionally conservative and should not replace server-side evaluation for secure or compliance-critical checks. It is best used as a performance optimization layer in front-end or middleware code.
