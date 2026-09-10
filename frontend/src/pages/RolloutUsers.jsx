import { useEffect, useState } from "react";
import { fetchRolloutUsers, fetchFlagDetails } from "../services/api_fixed2";

function RolloutUsers({ flagId, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("enabled");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [total, setTotal] = useState(null);
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("development");

  useEffect(() => {
    // parse status/page/search/environment from query string
    const params = new URLSearchParams(window.location.search);
    const qStatus = params.get("status") || "enabled";
    const qPage = parseInt(params.get("page") || "1", 10) || 1;
    const qSearch = params.get("search") || "";
    const qEnv = params.get("environment") || "development";
    setStatus(qStatus);
    setPage(qPage);
    setSearch(qSearch);
    setEnvironment(qEnv);
  }, [flagId, window.location.search]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        // First, try to leverage flag details if the backend provides explicit included/excluded id lists
        const flag = await fetchFlagDetails(flagId).catch(() => null);
        if (!active) return;
        if (flag && Array.isArray(flag.target_users) && (flag.included_user_ids || flag.excluded_user_ids)) {
          // Use the exact ids returned by the flag details when present
          const ids = status === "enabled" ? (flag.included_user_ids || []) : (flag.excluded_user_ids || []);
          const normalizedFromFlag = ids.map((userId, index) => ({ user_id: String(userId), reason: status, environment, key: `${userId}-${index}` }));
          setUsers(normalizedFromFlag);
          setTotal(ids.length);
          return;
        }

        // Fallback to the rollout/users endpoint
        const resp = await fetchRolloutUsers(flagId, { status, page, page_size: pageSize, search, environment });
        if (!active) return;
        const normalizedUsers = (resp.users || resp.items || []).map((user, index) => {
          if (typeof user === "string") {
            return { user_id: user, reason: status, environment, key: `${user}-${index}` };
          }
          return {
            user_id: user.user_id ?? user.userId ?? user.id ?? user.name ?? `unknown-${index}`,
            reason: user.reason ?? user.source ?? status,
            environment: user.environment ?? environment,
            key: `${user.user_id ?? user.userId ?? user.id ?? index}-${index}`,
          };
        });
        setUsers(normalizedUsers);
        setTotal(resp.total ?? normalizedUsers.length ?? 0);
      } catch (err) {
        setError(err.message || "Unable to load users.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [flagId, status, page, pageSize, search, environment]);

  return (
    <main className="flag-details-page">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate(`/flags/${flagId}/rollout`)}>Back to Rollout</button>
      </div>
      <h1>Users ({status})</h1>
      <p className="page-subtitle">Showing users who evaluate as {status} for this flag.</p>

      <div className="user-list-controls">
        <label>Status</label>
        <select value={status} onChange={(e) => { const v = e.target.value; setStatus(v); setPage(1); onNavigate(`/flags/${flagId}/rollout/users?status=${encodeURIComponent(v)}&environment=${encodeURIComponent(environment)}`); }}>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>

        <label>Search</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="user id contains..." />
        <button onClick={() => { setPage(1); onNavigate(`/flags/${flagId}/rollout/users?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&environment=${encodeURIComponent(environment)}`); }}>Search</button>
      </div>

      {loading ? <p>Loading users…</p> : null}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <div className="panel-table-wrap">
          <div className="table-summary-row">
            <p>Total: {total ?? users.length}</p>
          </div>
          {users.length ? (
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Source</th>
                    <th>Environment</th>
                    <th>Evaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.key || user.user_id}>
                      <td>{user.user_id}</td>
                      <td>{user.reason || status}</td>
                      <td>{user.environment || environment}</td>
                      <td><span className={status === "enabled" ? "status-enabled" : "status-disabled"}>{status === "enabled" ? "Enabled" : "Disabled"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state-card">
              <h3>No users found</h3>
              <p>There are no {status} users matching this search.</p>
            </div>
          )}

          <div className="pagination">
            <button disabled={page <= 1} onClick={() => { const next = Math.max(1, page - 1); setPage(next); onNavigate(`/flags/${flagId}/rollout/users?status=${encodeURIComponent(status)}&page=${next}&environment=${encodeURIComponent(environment)}`); }}>Prev</button>
            <span>Page {page}</span>
            <button disabled={users.length < pageSize} onClick={() => { const next = page + 1; setPage(next); onNavigate(`/flags/${flagId}/rollout/users?status=${encodeURIComponent(status)}&page=${next}&environment=${encodeURIComponent(environment)}`); }}>Next</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default RolloutUsers;
