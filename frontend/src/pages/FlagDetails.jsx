import { useCallback, useEffect, useState } from "react";
import {
  deleteFlag as apiDeleteFlag,
  fetchFlagDetails,
  rollbackFlag as apiRollbackFlag,
  setFlagStatus as apiSetFlagStatus,
} from "../services/api_fixed2";

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function EventLabel({ event }) {
  const labels = {
    created: "Created",
    updated: "Updated",
    enabled: "Enabled",
    disabled: "Disabled",
    rollout_changed: "Rollout changed",
    rolled_back: "Rolled back",
    version_snapshot: "Version saved",
  };

  return (
    <span className={`event-pill event-${event}`}>
      {labels[event] || event}
    </span>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}) {
  return (
    <section className={`flag-section-card ${className}`.trim()}>
      <div className="flag-section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle ? (
            <p className="page-subtitle">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <article className="stat-card">
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>

      <div>
        <span>{label}</span>
        <strong>{value ?? "-"}</strong>
      </div>
    </article>
  );
}

function formatDisplayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  return String(value);
}

function formatLabel(value) {
  if (!value) return "-";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatVersion(value) {
  if (value === null || value === undefined || value === "") {
    return "v1.0";
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? `v${numericValue.toFixed(1)}`
    : `v${value}`;
}

function FlagDetails({
  flagId,
  actor,
  selectedEnvironment = "",
  onNavigate,
  onFlagChanged,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("history");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchFlagDetails(flagId);

      setDetail(data);

    } catch (err) {
      setError(
        err.message || "Could not load this flag."
      );
    } finally {
      setLoading(false);
    }
  }, [flagId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus() {
    if (!detail) return;

    setBusy(true);

    try {
      await apiSetFlagStatus(
        flagId,
        !detail.enabled,
        actor
      );

      await load();
      onFlagChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function rollbackTo(version) {
    if (
      !window.confirm(
        `Roll back to version ${version}? This overwrites the current configuration.`
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await apiRollbackFlag(
        flagId,
        version,
        actor
      );

      await load();
      onFlagChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeFlag() {
    if (
      !window.confirm(
        "Delete this feature flag? This cannot be undone."
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await apiDeleteFlag(flagId, actor);

      onFlagChanged?.();
      onNavigate("/flags");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flag-details-page">
        <p className="page-subtitle">
          Loading flag…
        </p>
      </main>
    );
  }

  if (error && !detail) {
    return (
      <main className="flag-details-page">
        <div className="breadcrumbs">
          <button
            onClick={() =>
              onNavigate("/flags")
            }
          >
            Flags
          </button>
        </div>

        <p className="auth-error">
          {error}
        </p>
      </main>
    );
  }

  if (!detail) return null;

  return (
    <main className="flag-details-page">
      <div className="breadcrumbs">
        <button
          onClick={() =>
            onNavigate("/flags")
          }
        >
          Flags
        </button>

        <span>/</span>

        {detail.name || detail.key}
      </div>

      <header className="flag-details-header">
        <div>
          <div className="flag-title-row">
            <h1>
              {detail.name || detail.key}
            </h1>

            <span
              className={
                detail.enabled
                  ? "status-on"
                  : "status-off"
              }
            >
              {detail.enabled
                ? "Enabled"
                : "Disabled"}
            </span>
          </div>

          <code className="flag-key">
            {detail.key}
          </code>

          <p className="page-subtitle">
            {detail.description ||
              "No description provided."}
          </p>
        </div>

        <div className="flag-details-actions">
          <button
            disabled={busy}
            onClick={toggleStatus}
          >
            {detail.enabled
              ? "Disable"
              : "Enable"}
          </button>

          <button
            disabled={busy}
            onClick={() =>
              onNavigate("/flags")
            }
          >
            Edit
          </button>

          <button
            className="danger-button"
            disabled={busy}
            onClick={removeFlag}
          >
            Delete
          </button>
        </div>
      </header>

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <section className="flag-summary-grid">
        <SectionCard
          title="Flag Information"
          subtitle="Core configuration for this feature flag."
          className="span-2"
        >
          <div className="flag-info-grid">
            <MetaItem
              label="Feature Name"
              value={
                detail.name || detail.key
              }
            />

            <MetaItem
              label="Flag Key"
              value={detail.key}
            />

            <MetaItem
              label="Description"
              value={
                detail.description || "-"
              }
            />

            <MetaItem
              label="Status"
              value={
                detail.enabled
                  ? "Enabled"
                  : "Disabled"
              }
            />

            <MetaItem
              label="Environment"
              value={formatLabel(
                detail.environment
              )}
            />

            <MetaItem
              label="Type"
              value={formatLabel(
                detail.type
              )}
            />

            <MetaItem
              label="Default Value"
              value={formatDisplayValue(
                detail.default_value
              )}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Ownership & Version"
          subtitle="Ownership and lifecycle metadata."
        >
          <div className="flag-info-grid compact-grid">
            <MetaItem
              label="Owner Team"
              value={
                detail.owner_team || "-"
              }
            />

            <MetaItem
              label="Created By"
              value={
                detail.created_by || "-"
              }
            />

            <MetaItem
              label="Created"
              value={formatDateTime(
                detail.created_at
              )}
            />

            <MetaItem
              label="Last Modified By"
              value={
                detail.updated_by || "-"
              }
            />

            <MetaItem
              label="Last Modified"
              value={formatDateTime(
                detail.updated_at
              )}
            />

            <MetaItem
              label="Current Version"
              value={formatVersion(
                detail.versions?.[0]?.version ??
                  1
              )}
            />
          </div>
        </SectionCard>

      </section>

      <section className="detail-tabs">
        <div className="tab-bar">
          <button
            className={
              activeTab === "history"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("history")
            }
          >
            Rollout Timeline / History
          </button>

          <button
            className={
              activeTab === "versions"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("versions")
            }
          >
            Version History
          </button>

          <button
            className={
              activeTab === "audit"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("audit")
            }
          >
            Audit Logs
          </button>
        </div>

        {activeTab === "history" && (
          <ul className="timeline">
            {(detail.history || []).map(
              (entry) => (
                <li key={entry.id}>
                  <EventLabel
                    event={entry.event}
                  />

                  <div>
                    <p>
                      {entry.summary ||
                        entry.event}
                    </p>

                    <small>
                      {entry.actor ||
                        "system"}{" "}
                      ·{" "}
                      {formatDateTime(
                        entry.created_at
                      )}
                    </small>
                  </div>
                </li>
              )
            )}

            {(!detail.history ||
              detail.history.length ===
                0) && (
              <p>
                No activity recorded yet.
              </p>
            )}
          </ul>
        )}

        {activeTab === "versions" && (
          <div className="version-table">
            {(detail.versions || []).map(
              (version) => (
                <div
                  className="version-row"
                  key={version.id}
                >
                  <div>
                    <strong>
                      v{version.version}
                    </strong>

                    <p>
                      {version.changes_summary ||
                        "—"}
                    </p>

                    <small>
                      {version.created_by ||
                        "system"}{" "}
                      ·{" "}
                      {formatDateTime(
                        version.created_at
                      )}
                    </small>
                  </div>

                  <button
                    disabled={
                      busy ||
                      version.version ===
                        detail
                          .versions?.[0]
                          ?.version
                    }
                    onClick={() =>
                      rollbackTo(
                        version.version
                      )
                    }
                  >
                    Rollback
                  </button>
                </div>
              )
            )}

            {(!detail.versions ||
              detail.versions.length ===
                0) && (
              <p>
                No versions recorded yet.
              </p>
            )}
          </div>
        )}

        {activeTab === "audit" && (
          <div className="plain-panel audit-scoped">
            {(detail.audit_logs || []).map(
              (log) => (
                <div
                  className="audit-row"
                  key={log.id}
                >
                  <strong>
                    {log.action}
                  </strong>

                  <span>
                    {log.field_changed
                      ? `${log.field_changed}: ${
                          log.old_value ??
                          "—"
                        } → ${
                          log.new_value ??
                          "—"
                        }`
                      : log.details}
                  </span>

                  <small>
                    {log.actor ||
                      "system"}{" "}
                    ·{" "}
                    {formatDateTime(
                      log.created_at
                    )}
                  </small>
                </div>
              )
            )}

            {(!detail.audit_logs ||
              detail.audit_logs.length ===
                0) && (
              <p>
                No audit entries yet.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default FlagDetails;