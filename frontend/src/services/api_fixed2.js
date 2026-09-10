// Stable API helper (api_fixed2)
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "/api";
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
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
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
    const detail = body.detail || (Object.keys(body).length ? JSON.stringify(body) : null);
    throw new Error(`${response.status} ${response.statusText}${detail ? ": " + detail : ""}`);
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
    const includedUsers = flag.included_users ?? Math.floor((totalUsers * clampedRollout) / 100);

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
      // if backend provides exact id lists for target users, expose them to the UI
      included_user_ids: flag.included_user_ids ?? [],
      excluded_user_ids: flag.excluded_user_ids ?? [],
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

export const fetchRolloutStatistics = (flagId, environment = "development") =>
  request(`/flags/${flagId}/rollout/statistics?environment=${encodeURIComponent(environment)}`);

export const fetchFlagMetrics = (flagId, days = 7, environment = "") => {
  const q = new URLSearchParams({ days: String(days) });
  if (environment) q.append("environment", environment);
  return request(`/flags/${flagId}/metrics?${q.toString()}`);
};

export const fetchAllFlagsMetrics = (days = 7, environment = "", dateRange = {}) => {
  const q = new URLSearchParams({ days: String(days) });
  if (environment) q.append("environment", environment);
  if (dateRange.startDate) q.append("start_date", dateRange.startDate);
  if (dateRange.endDate) q.append("end_date", dateRange.endDate);
  return request(`/metrics/flags/summary?${q.toString()}`);
};

export const fetchRolloutUsers = (flagId, { status = "enabled", page = 1, page_size = 50, search = "", environment = "development" } = {}) =>
  request(`/flags/${flagId}/rollout/users?status=${encodeURIComponent(status)}&page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(page_size)}&search=${encodeURIComponent(search)}&environment=${encodeURIComponent(environment)}`);

export const addFlagTargetUsersBulk = (flagId, userIds = []) =>
  request(`/flags/${flagId}/target-users/bulk`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });

export const rollbackFlag = (id, versionNumber) =>
  request(`/flags/${id}/rollback/${versionNumber}`, { method: "POST" });

export const fetchAuditLogs = ({ actor, flag_key, start_date, end_date, page = 1, page_size = 50 } = {}) => {
  const q = new URLSearchParams();
  if (actor) q.append("actor", actor);
  if (flag_key) q.append("flag_key", flag_key);
  if (start_date) q.append("start_date", start_date);
  if (end_date) q.append("end_date", end_date);
  q.append("page", String(page));
  q.append("page_size", String(page_size));
  return request(`/audit-logs?${q.toString()}`).then((res) => {
    if (Array.isArray(res)) return { items: res, total: res.length, page: 1, page_size: res.length };
    return res;
  });
};

export const fetchFlagTargetUsers = (flagId) => request(`/flags/${flagId}/target-users`);
export const addFlagTargetUser = (flagId, userId) =>
  request(`/flags/${flagId}/target-users`, { method: "POST", body: JSON.stringify({ user_id: userId }) });
export const deleteFlagTargetUser = (flagId, userId) =>
  request(`/flags/${flagId}/target-users/${encodeURIComponent(userId)}`, { method: "DELETE" });

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

// Debug helper: performs the same evaluate POST but returns raw response details for troubleshooting
export async function evaluateFlagDebug({ flagKey, environment, userId = "", groups = [], userContext = {} }) {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/evaluate`;
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        flag_key: flagKey,
        environment,
        user_id: userId || userContext.user_id || userContext.userId || null,
        groups: Array.isArray(groups) ? groups : [],
        user_context: userContext || {},
      }),
    });
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }

  const result = { ok: resp.ok, status: resp.status, statusText: resp.statusText };
  try {
    const text = await resp.text();
    result.bodyText = text;
    try {
      result.bodyJson = text ? JSON.parse(text) : null;
    } catch (parseErr) {
      // ignore JSON parse error
    }
  } catch (err) {
    result.bodyText = null;
    result.bodyJson = null;
  }

  return result;
}


export const signupUser = ({ name, email, password, phone, age, gender, role, company }) =>
  request("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone ? phone.trim() : null,
      age: age ? Number(age) : null,
      gender: gender || null,
      role: role || "Developer",
      company: company ? company.trim() : null,
    }),
  });

export const loginUser = (data) =>
  request("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fetchCurrentUser = () => request("/users/me");
export const updateCurrentUser = (data) => request("/users/me", { method: "PUT", body: JSON.stringify(data) });


export const scanCleanupSuggestions = () =>
  request("/cleanup/scan", { method: "POST" });

export const fetchCleanupSuggestions = ({ page = 1, size = 20, search = "", candidate_type = "", reviewed } = {}) => {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (search) q.append("search", search);
  if (candidate_type) q.append("candidate_type", candidate_type);
  if (typeof reviewed === "boolean") q.append("reviewed", String(reviewed));
  return request(`/cleanup/suggestions?${q.toString()}`);
};

export const reviewCleanupCandidate = (flagId, note = "") =>
  request(`/cleanup/suggestions/${flagId}/review`, {
    method: "PATCH",
    body: JSON.stringify({ note: note || null }),
  });
