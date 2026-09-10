// Lightweight audit-log helpers to avoid a broken shared request wrapper.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const AUTH_TOKEN_KEY = "flag-manager-token";

function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

async function rawFetch(path, opts = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const token = getAuthToken();
    const headers = opts.headers ? { ...opts.headers } : {};
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal, headers, ...opts });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail || (Object.keys(body).length ? JSON.stringify(body) : null);
      const err = new Error(`${res.status} ${res.statusText}${detail ? ': ' + detail : ''}`);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.blob();
  } finally {
    window.clearTimeout(timeout);
  }
}

export const fetchAuditLogs = ({
  actor,
  flag_key,
  search,
  action,
  environment,
  start_date,
  end_date,
  date_from,
  date_to,
  page = 1,
  page_size = 50,
} = {}) => {
  const q = new URLSearchParams();
  const effectiveStart = start_date || date_from || "";
  const effectiveEnd = end_date || date_to || "";

  if (search) q.append("search", search);
  if (actor) q.append("actor", actor);
  if (flag_key) q.append("flag_key", flag_key);
  if (action) q.append("action", action);
  if (environment) q.append("environment", environment);
  if (effectiveStart) q.append("start_date", effectiveStart);
  if (effectiveEnd) q.append("end_date", effectiveEnd);

  q.append("page", String(page));
  q.append("page_size", String(page_size));

  return rawFetch(`/audit-logs?${q.toString()}`).then((res) => {
    if (Array.isArray(res)) return { items: res, total: res.length, page: 1, page_size: res.length };
    return res;
  });
};

export const exportAuditLogs = async (filters = {}) => {
  const q = new URLSearchParams();
  if (filters.search) q.append("search", filters.search);
  if (filters.action) q.append("action", filters.action);
  if (filters.environment) q.append("environment", filters.environment);
  if (filters.date_from) q.append("date_from", filters.date_from);
  if (filters.date_to) q.append("date_to", filters.date_to);
  const path = `/audit-logs/export?${q.toString()}`;
  return rawFetch(path, { method: "GET" });
};

export const fetchFlagHistory = (flagId) => {
  if (!flagId) return Promise.resolve([]);
  return rawFetch(`/flags/${flagId}/history`);
};
