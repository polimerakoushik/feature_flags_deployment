import { useMemo, useState } from "react";
import "../ui-kit.css";
import { environmentKey, environmentName } from "../components/EnvironmentSwitcher";
import { FlagEditor } from "./Dashboard";

export default function Flags({
  flags = [],
  environments = [],
  selectedEnvironment,
  onSelectEnvironment,
  onNavigate,
  onOpenFlag,
  onNewFlag,
  onEditFlag,
  onDeleteFlag,
  saving = false,
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [environmentFilter, setEnvironmentFilter] = useState("all");
  const [editor, setEditor] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const activeEnvironment = String(environmentFilter || "").trim().toLowerCase();
    return flags.filter((f) => {
      if (!f) return false;
      const flagEnvironment = String(f.environment || "").toLowerCase();
      if (activeEnvironment && activeEnvironment !== "all" && flagEnvironment !== activeEnvironment) {
        return false;
      }
      if (status !== "all" && (f.enabled ? "enabled" : "disabled") !== status) return false;
      if (owner !== "all" && (f.owner_team || "Unassigned") !== owner) return false;
      if (!q) return true;
      return (
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.key && f.key.toLowerCase().includes(q)) ||
        (f.description && f.description.toLowerCase().includes(q))
      );
    });
  }, [flags, search, environmentFilter, status, owner]);

  const owners = [...new Set(flags.map((flag) => flag.owner_team || "Unassigned"))].sort();
  const enabledCount = flags.filter((flag) => flag.enabled).length;
  const environmentsCount = new Set(flags.map((flag) => flag.environment).filter(Boolean)).size;

  return (
    <main className="content-page">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate("/landing")}>Landing</button>
        <span>/</span>
        <strong>Feature Flags</strong>
      </div>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, margin: "18px 0" }}>
        <div>
          <h1 style={{ margin: 0 }}>Feature Flags</h1>
          <p className="page-subtitle">Manage and control feature releases across different environments.</p>
        </div>
        <button className="primary" style={{ background: "#2563eb", borderColor: "#2563eb" }} onClick={() => { setIsCreating(true); setEditor(null); }}>＋ Create Feature Flag</button>
      </header>

      <section className="summary-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: 16 }}>
        {[
          ["🚩", "Total Flags", flags.length, "All feature flags in system", "#eef6ff"],
          ["✓", "Enabled Flags", enabledCount, "Currently enabled", "#ecfdf5"],
          ["×", "Disabled Flags", flags.length - enabledCount, "Currently disabled", "#fff1f2"],
          ["▥", "Environments", environmentsCount, environments.map(environmentName).join(", ") || "Configured environments", "#f5f3ff"],
        ].map(([icon, label, value, hint, background]) => (
          <article key={label} className="stat-card" style={{ display: "flex", gap: 12, alignItems: "center", background }}>
            <span style={{ width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(99,102,241,.15)", color: "var(--primary)", fontSize: 22, fontWeight: 800 }}>{icon}</span>
            <div><span>{label}</span><strong style={{ display: "block", fontSize: 24 }}>{value}</strong><small>{hint}</small></div>
          </article>
        ))}
      </section>

      <section className="flag-section-card" style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.5fr) repeat(3, minmax(140px, 1fr)) auto", gap: 10, alignItems: "center" }}>
          <input placeholder="⌕  Search by name or key..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Statuses</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select>
          <select value={environmentFilter} onChange={(e) => setEnvironmentFilter(e.target.value)}><option value="all">All Environments</option>{environments.map((env) => { const key = environmentKey(env); return <option key={key} value={key}>{environmentName(env)}</option>; })}</select>
          <select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="all">All Owners</option>{owners.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button className="secondary-button" onClick={() => { setSearch(""); setStatus("all"); setOwner("all"); setEnvironmentFilter("all"); }}>Clear Filters</button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table className="exact-table">
            <thead><tr><th>Name</th><th>Environment</th><th>Status</th><th>Targeting</th><th>Owner</th><th>Last Updated</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((flag) => (
                <tr key={flag.id}>
                  <td><button className="link-button" onClick={() => onOpenFlag(flag.id)}>{flag.name || flag.key}</button><small style={{ display: "block", color: "var(--muted)" }}>{flag.key}</small></td>
                  <td><span className="badge">{environmentName({ name: flag.environment })}</span></td>
                  <td><span className={`flag-badge ${flag.enabled ? "on" : "off"}`}>{flag.enabled ? "● Enabled" : "○ Disabled"}</span></td>
                  <td>{flag.rollout_percentage != null ? `${flag.rollout_percentage}% users` : "All users"}</td>
                  <td>{flag.owner_team || "Unassigned"}</td>
                  <td>{flag.updated_at ? new Date(flag.updated_at).toLocaleString() : "—"}</td>
                  <td><button className="secondary-button" onClick={() => setEditor(flag)}>Edit</button><button className="danger-button" onClick={() => onDeleteFlag(flag.id)} style={{ marginLeft: 6 }}>Delete</button></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan="7" style={{ textAlign: "center", padding: 28 }}>No flags found.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="page-subtitle" style={{ margin: "14px 0 0" }}>Showing 1 to {filtered.length} of {filtered.length} flags</p>
      </section>
      {(editor || isCreating) && (
        <FlagEditor
          flag={isCreating ? null : editor}
          selectedEnvironment={selectedEnvironment}
          environments={environments}
          saving={saving}
          onClose={() => { setEditor(null); setIsCreating(false); }}
          onSave={async (environment, data) => {
            if (isCreating) {
              await onNewFlag(data);
            } else {
              await onEditFlag(editor.id, data);
            }
            setEditor(null);
            setIsCreating(false);
          }}
        />
      )}
    </main>
  );
}
