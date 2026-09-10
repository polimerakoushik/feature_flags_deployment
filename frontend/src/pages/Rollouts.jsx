import { useEffect, useMemo, useState } from "react";
import { fetchFlags } from "../services/api_fixed2";
import { environmentName } from "../components/EnvironmentSwitcher";

function rolloutValue(flag) {
  const value = Number(flag.rollout_percentage);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function Rollouts({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flags, setFlags] = useState([]);
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let active = true;
    fetchFlags()
      .then((data) => active && setFlags(Array.isArray(data) ? data : []))
      .catch((err) => active && setError(err.message || "Unable to load rollouts."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const environments = useMemo(
    () => [...new Set(flags.map((flag) => String(flag.environment || "all").toLowerCase()))],
    [flags]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return flags.filter((flag) => {
      const value = rolloutValue(flag);
      const flagEnvironment = String(flag.environment || "all").toLowerCase();
      const flagStatus = value >= 100 ? "completed" : "in_progress";
      const textMatch = !query || [flag.name, flag.key].some((valueToSearch) =>
        String(valueToSearch || "").toLowerCase().includes(query)
      );
      return textMatch &&
        (environment === "all" || flagEnvironment === environment) &&
        (status === "all" || flagStatus === status);
    });
  }, [flags, search, environment, status]);

  const total = flags.length;
  const completed = flags.filter((flag) => rolloutValue(flag) >= 100).length;
  const average = total ? Math.round(flags.reduce((sum, flag) => sum + rolloutValue(flag), 0) / total) : 0;

  if (loading) return <main className="content-page"><p className="page-subtitle">Loading rollouts…</p></main>;
  if (error) return <main className="content-page"><p className="auth-error">{error}</p></main>;

  return (
    <main className="content-page rollouts-page">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate("/landing")}>Dashboard</button><span>›</span><span>Rollouts</span>
      </div>
      <header className="rollouts-header">
        <div><h1>Rollouts</h1><p className="page-subtitle">Manage and track the rollout percentage of your feature flags across environments.</p></div>
        <button className="rollouts-primary" onClick={() => onNavigate("/flags")}>＋ Create Rollout</button>
      </header>

      <section className="rollout-stats">
        <article className="rollout-stat rollout-stat-blue"><span>⚑</span><div><b>Total Features</b><strong>{total}</strong><small>Feature flags with rollouts</small></div></article>
        <article className="rollout-stat rollout-stat-green"><span>✓</span><div><b>Fully Rolled Out</b><strong>{completed}</strong><small>At 100% rollout</small></div></article>
        <article className="rollout-stat rollout-stat-yellow"><span>◷</span><div><b>In Progress</b><strong>{total - completed}</strong><small>Rollout &lt; 100%</small></div></article>
        <article className="rollout-stat rollout-stat-purple"><span>📈</span><div><b>Average Rollout</b><strong>{average}%</strong><small>Across all features</small></div></article>
      </section>

      <section className="rollout-table-card">
        <div className="rollout-filters">
          <label className="rollout-search">⌕<input placeholder="Search features..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select value={environment} onChange={(event) => setEnvironment(event.target.value)}><option value="all">All Environments</option>{environments.map((item) => <option key={item} value={item}>{environmentName({ name: item })}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All Status</option><option value="completed">Completed</option><option value="in_progress">In Progress</option></select>
          <button className="rollout-clear" onClick={() => { setSearch(""); setEnvironment("all"); setStatus("all"); }}>⚱ Clear Filters</button>
        </div>
        <div className="rollout-table-wrap">
          <table className="rollout-table">
            <thead><tr><th>Feature</th><th>Key</th><th>Environment</th><th>Rollout</th><th>Status</th><th>Last Updated</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((flag) => {
                const value = rolloutValue(flag);
                const done = value >= 100;
                return <tr key={flag.id}>
                  <td><button className="rollout-feature-link" onClick={() => onNavigate(`/flags/${flag.id}/rollout`)}>{flag.name || flag.key}</button></td>
                  <td><code>{flag.key}</code></td>
                  <td><span className={`rollout-environment rollout-environment-${String(flag.environment || "all").toLowerCase()}`}>{environmentName({ name: flag.environment || "all" })}</span></td>
                  <td><div className="rollout-progress"><span><i style={{ width: `${value}%` }} /></span><b>{value}%</b></div></td>
                  <td><span className={`rollout-status ${done ? "completed" : "progress"}`}>{done ? "Completed" : "In Progress"}</span></td>
                  <td>{flag.updated_at ? new Date(flag.updated_at).toLocaleString([], { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td><button className="rollout-open" onClick={() => onNavigate(`/flags/${flag.id}/rollout`)}>Open Rollout</button><button className="rollout-more" aria-label={`More actions for ${flag.name || flag.key}`}>⋮</button></td>
                </tr>;
              })}
              {!filtered.length && <tr><td colSpan="7" className="rollout-empty">No rollouts match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="rollout-footer">Showing 1 to {filtered.length} of {filtered.length} features <span><button disabled>‹</button><b>1</b><button disabled>›</button></span></footer>
      </section>
    </main>
  );
}

export default Rollouts;
