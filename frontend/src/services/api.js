// Vite forwards /api to FastAPI during local development. Set
// VITE_API_BASE_URL for a deployed backend, for example https://api.example.com.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const AUTH_TOKEN_KEY = "flag-manager-token";
const AUTH_ERROR_STATUS = 401;

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  const token = getAuthToken();
  let response;
  try {
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
    response = await fetch(`${API_BASE_URL}${path}`, { headers,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The API request timed out. Restart FastAPI and check the database connection.");
    }
    throw new Error("Unable to reach the API. Start the FastAPI backend and confirm the configured port is reachable.");
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === AUTH_ERROR_STATUS) {
      throw new AuthError(body.detail || "Your session has expired. Please log in again.");
    }
    // Include status and any backend detail in the thrown error for easier debugging
    const detail = body.detail || (Object.keys(body).length ? JSON.stringify(body) : null);
    throw new Error(`${response.status} ${response.statusText}${detail ? ': ' + detail : ''}`);
  }

  return response.status === 204 ? null : response.json();
}

async function requestWithFallback(paths, options = {}) {
  let lastError;
  for (const path of paths) {
    try {
      return await request(path, options);
    } catch (error) {
      lastError = error;
      if (!/Not Found/i.test(error.message || "")) {
        throw error;
      }
    }
  }
  throw lastError || new Error("The request could not be completed.");
}

export const fetchEnvironments = (name) => {
  const query = name ? `?${new URLSearchParams({ name })}` : "";
  return request(`/environments${query}`);
};

export const fetchFlagEnvironmentOverrides = (flagId) => request(`/flags/${flagId}/environments`);
export const updateFlagEnvironmentOverride = (flagId, environmentId, payload) =>
  request(`/flags/${flagId}/environments/${environmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const fetchFlags = () => request("/flags");

export const fetchFlagDetails = (id) =>
  requestWithFallback([`/flags/${id}/details`, `/flags/${id}`]).then((flag) => {
    const rolloutPercentage = flag.rollout_percentage ?? 100;
    const clampedRollout = Math.max(0, Math.min(100, Number(rolloutPercentage) || 0));
    const targetUsers = flag.target_users ?? [];
    const totalUsers = flag.total_users ?? targetUsers.length;
    const includedUsers =
      flag.included_users ?? Math.floor((totalUsers * clampedRollout) / 100);

    return {
      ...flag,
      rollout_percentage: clampedRollout,
      tags: flag.tags ?? [],
      dependencies: flag.dependencies ?? [],
      linked_experiments: flag.linked_experiments ?? [],
      versions: flag.versions ?? [],
      audit_logs: flag.audit_logs ?? [],
      history: flag.history ?? [],
      target_users: targetUsers,
      target_groups: flag.target_groups ?? [],
      total_users: totalUsers,
      included_users: includedUsers,
      excluded_users: flag.excluded_users ?? Math.max(totalUsers - includedUsers, 0),
      environment_configs:
        flag.environment_configs ??
        [
          {
            environment: flag.environment ?? "development",
            value: flag.default_value,
            is_override: false,
          },
        ],
    };
  });

export const createFlag = (data) => request("/flags", { method: "POST", body: JSON.stringify(data) });
export const updateFlag = (id, data) => request(`/flags/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteFlag = (id) => request(`/flags/${id}`, { method: "DELETE" });

export const setFlagStatus = (id, enabled) =>
  request(`/flags/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });

export const setFlagRollout = (id, rollout_percentage) =>
  request(`/flags/${id}/rollout`, {
    method: "PUT",
    body: JSON.stringify({ rollout_percentage }),
  });

// Rollout-specific APIs
export const fetchRolloutStatistics = (flagId, environment = "development") =>
  request(`/flags/${flagId}/rollout/statistics?environment=${encodeURIComponent(environment)}`);

export const fetchRolloutUsers = (flagId, { status = "enabled", page = 1, page_size = 50, search = "", environment = "development" } = {}) =>
  request(`/flags/${flagId}/rollout/users?status=${encodeURIComponent(status)}&page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(page_size)}&search=${encodeURIComponent(search)}&environment=${encodeURIComponent(environment)}`);

// Bulk add target users (multiple IDs in one request)
export const addFlagTargetUsersBulk = (flagId, userIds = []) =>
  request(`/flags/${flagId}/target-users/bulk`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });

export const rollbackFlag = (id, versionNumber) =>
  request(`/flags/${id}/rollback/${versionNumber}`, { method: "POST" });

export const fetchAuditLogs = () => request("/audit-logs");

// Target users API for flag-level whitelisting
export const fetchFlagTargetUsers = (flagId) => request(`/flags/${flagId}/target-users`);
export const addFlagTargetUser = (flagId, userId) =>
  request(`/flags/${flagId}/target-users`, { method: "POST", body: JSON.stringify({ user_id: userId }) });
export const deleteFlagTargetUser = (flagId, userId) =>
  request(`/flags/${flagId}/target-users/${encodeURIComponent(userId)}`, { method: "DELETE" });

// Target groups API for group-level whitelisting
export const fetchGroups = () => request("/groups");
export const fetchFlagTargetGroups = (flagId) => request(`/flags/${flagId}/target-groups`);
export const addFlagTargetGroup = (flagId, groupName) =>
  request(`/flags/${flagId}/target-groups`, { method: "POST", body: JSON.stringify({ group_name: groupName }) });
export const deleteFlagTargetGroup = (flagId, groupName) =>
  request(`/flags/${flagId}/target-groups/${encodeURIComponent(groupName)}`, { method: "DELETE" });

export const evaluateFlag = ({ flagKey, environment, userId = "", groups = [], userContext = {} }) =>
  request("/evaluate", {
    method: "POST",
    body: JSON.stringify({
      flag_key: flagKey,
      environment,
      user_id: userId || userContext.user_id || userContext.userId || null,
      groups: Array.isArray(groups) ? groups : [],
      user_context: userContext || {},
    }),
  });

export const signupUser = (data) =>
  requestWithFallback(["/users/signup", "/auth/register", "/auth/signup"], {
    method: "POST",
    body: JSON.stringify(data),
  });

export const loginUser = (data) =>
  requestWithFallback(["/users/login", "/auth/login"], {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fetchCurrentUser = () => request("/users/me");
export const updateCurrentUser = (data) => request("/users/me", { method: "PUT", body: JSON.stringify(data) });
