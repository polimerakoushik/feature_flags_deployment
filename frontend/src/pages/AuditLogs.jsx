import { useEffect, useState } from "react";
import { exportAuditLogs, fetchAuditLogs } from "../services/api_clean";

const ACTIONS = [
  "created", "updated", "deleted", "enabled", "disabled",
  "rollout_changed", "rolled_back",
  "target_user_added", "target_user_removed",
  "target_group_added", "target_group_removed",
];

const PAGE_SIZE = 10;

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function AuditLogs({ onNavigate }) {
  const [filters, setFilters] = useState({
    search: "", action: "", environment: "", date_from: "", date_to: "", sort: "desc",
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAuditLogs({ ...filters, page, page_size: PAGE_SIZE })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filters, page]);

  function updateFilter(field, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  }

  async function downloadExport() {
    try {
      setError("");
      const blob = await exportAuditLogs(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-logs.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "The export could not be completed.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <main className="content-page">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate("/landing")}>Landing</button>
        <span>/</span>
        Audit Logs
      </div>
      <h1>Audit Logs</h1>
      <p className="page-subtitle">Every create, update, delete, and rollout change across your flags.</p>

      <section className="audit-filters">
        <label>
          Search
          <input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Flag name or user"
          />
        </label>
        <label>
          Action
          <select value={filters.action} onChange={(event) => updateFilter("action", event.target.value)}>
            <option value="">All actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>{action.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <label>
          Environment
          <input
            value={filters.environment}
            onChange={(event) => updateFilter("environment", event.target.value)}
            placeholder="e.g. production"
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.date_from}
            onChange={(event) => updateFilter("date_from", event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.date_to}
            onChange={(event) => updateFilter("date_to", event.target.value)}
          />
        </label>
        <label>
          Sort
          <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
        {/* <button
          type="button"
          className="secondary-button export-button"
          onClick={downloadExport}
        >
          Export CSV
        </button> */}
      </section>

      {error && <p className="auth-error">{error}</p>}

      <div className="plain-panel">
        {loading ? (
          <p>Loading audit logs…</p>
        ) : result.items.length ? (
          <div className="audit-table">
            <div className="audit-table-head">
              <div>ID</div>
              <div>Flag Name</div>
              <div>Created By</div>
              <div>Date Created</div>
              <div>Action</div>
              <div>Changes</div>
            </div>
            <div className="audit-table-body">
              {result.items.map((log) => (
                <div className="audit-table-row" key={log.id}>
                  <div className="cell id">{log.id}</div>
                  <div className="cell flag-name">
                    <a
                      href={`#/audit-logs/flag/${log.entity_id}/history`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(`/audit-logs/flag/${log.entity_id}/history`);
                      }}
                    >
                      {log.entity_name || `${log.entity_type} #${log.entity_id}`}
                    </a>
                  </div>
                  <div className="cell created-by">
                    <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                      <div className="avatar-small" style={{background: 'linear-gradient(135deg, var(--primary), var(--primary-700))'}}>
                        {(log.actor || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="actor-name">{(log.actor || 'system').split('@')[0]}</div>
                        <small className="actor-email">{log.actor && log.actor.includes('@') ? log.actor : ''}</small>
                      </div>
                    </div>
                  </div>
                  <div className="cell date">{formatDateTime(log.created_at)}</div>
                  <div className="cell action">
                    <span className={`badge badge-${String(log.action).replaceAll(" ", "-")}`}>
                      {String(log.action).replaceAll("_", " ").replaceAll("-", " ").replaceAll("", "").trim()}
                    </span>
                  </div>
                  <div className="cell changes">
                    {log.field_changed ? (
                      <>
                        <strong>{log.field_changed}</strong>
                        <div className="change-values">{log.old_value ?? "—"} → {log.new_value ?? "—"}</div>
                      </>
                    ) : (
                      <>{log.details ?? ""}</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p>No audit logs match these filters.</p>
        )}
      </div>

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
          Previous
        </button>
        <span>Page {page} of {totalPages} · {result.total} entries</span>
        <button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
          Next
        </button>
      </div>
    </main>
  );
}

export default AuditLogs;
