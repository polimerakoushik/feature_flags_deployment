import { useEffect, useState } from "react";
import { fetchFlagHistory } from "../services/api_clean";
import { fetchFlagDetails } from "../services/api";

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function FlagHistory({ flagId, onNavigate }) {
  const [entries, setEntries] = useState([]);
  const [flag, setFlag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    // Fetch comprehensive flag details (includes audit_logs and history) and individual flag_history
    Promise.allSettled([fetchFlagDetails(flagId), fetchFlagHistory(flagId)])
      .then((results) => {
        if (!active) return;
        const [flagRes, histRes] = results;
        if (flagRes.status === "fulfilled") setFlag(flagRes.value);
        if (histRes.status === "fulfilled") {
          // histRes may be array
        }

        // Build unified timeline from: flagRes.audit_logs and histRes (or flagRes.history)
        const auditLogs = flagRes.status === "fulfilled" && Array.isArray(flagRes.value.audit_logs) ? flagRes.value.audit_logs : [];
        const histRows = (histRes.status === "fulfilled" && Array.isArray(histRes.value)) ? histRes.value : (flagRes.status === "fulfilled" && Array.isArray(flagRes.value.history) ? flagRes.value.history : []);

        // Normalize and merge
        const normalized = [];
        auditLogs.forEach((a) => {
          normalized.push({
            id: `audit-${a.id}`,
            kind: "audit",
            action: a.action,
            actor: a.actor,
            created_at: a.created_at,
            field_changed: a.field_changed,
            old_value: a.old_value,
            new_value: a.new_value,
            details: a.details,
          });
        });
        histRows.forEach((h) => {
          normalized.push({
            id: `history-${h.id}`,
            kind: "history",
            action: h.event || h.event,
            actor: h.actor,
            created_at: h.created_at,
            summary: h.summary,
            environment: h.environment,
          });
        });

        // Sort newest first
        normalized.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
        setEntries(normalized);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load history");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [flagId]);

  return (
    <main className="content-page">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate("/audit-logs")}>← Back to Audit Logs</button>
        <span>/</span>
        Flag History
      </div>

      <div className="header-row">
        <div>
          <h1 className="flag-title">{flag ? (flag.name || flag.key) : "Flag History"}</h1>
          {flag && (
            <div className="flag-subtitle">Feature Flag ID: {flag.id} · Status: {flag.enabled ? "Enabled" : "Disabled"} · Environment: {flag.environment}</div>
          )}
        </div>
      </div>

      {loading ? (
        <p>Loading history…</p>
      ) : error ? (
        <div className="auth-error">{error} <button onClick={() => window.location.reload()}>Try Again</button></div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <strong>No history available</strong>
          <p>No audit events have been recorded for this feature flag.</p>
        </div>
      ) : (
        <section className="flag-history-list">
          {entries.map((e) => (
            <article key={e.id} className={`flag-history-entry ${e.kind}`}>
              <div className="entry-left">
                <div className={`entry-badge entry-${e.kind}`}>{e.kind === "audit" ? (e.action || "Updated") : (e.action || "Event")}</div>
                <div className="entry-time">{formatDateTime(e.created_at)}</div>
              </div>
              <div className="entry-main">
                <div className="entry-head">
                  <div className="entry-title">{e.kind === "audit" ? (String(e.action).replaceAll("_", " ")) : (String(e.action).replaceAll("_", " "))}</div>
                  <div className="entry-actor">{e.actor || "system"} · {e.environment ?? (flag && flag.environment) ?? "—"}</div>
                </div>

                <div className="entry-content">
                  {e.kind === "audit" ? (
                    e.field_changed ? (
                      <div className="field-change">
                        <div className="field-name">{e.field_changed}</div>
                        <div className="before-after">
                          <div className="before">{e.old_value ?? "—"}</div>
                          <div className="arrow">→</div>
                          <div className="after">{e.new_value ?? "—"}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="details">{e.details}</div>
                    )
                  ) : (
                    <div className="summary">{e.summary}</div>
                  )}
                </div>

                <div className="entry-meta-footer">ID: {String(e.id).startsWith('audit-') ? e.id.replace('audit-', '') : String(e.id).replace('history-', '')}</div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default FlagHistory;
