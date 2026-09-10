import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCleanupSuggestions, reviewCleanupCandidate, scanCleanupSuggestions } from "../services/api_fixed2";

const TYPE_LABELS = { fully_rolled_out: "100% rolled out", fully_disabled: "Fully disabled" };

function ageInDays(value) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

function CleanupSuggestions({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [reviewed, setReviewed] = useState("false");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await fetchCleanupSuggestions({ search, candidate_type: type, reviewed: reviewed === "" ? undefined : reviewed === "true" });
      setItems(data.items || []); setTotal(Number(data.total || 0));
    } catch (err) { setError(err.message || "Unable to load cleanup suggestions."); }
    finally { setLoading(false); }
  }, [search, type, reviewed]);

  useEffect(() => { load(); }, [load]);

  async function scan() {
    setScanning(true); setError("");
    try { await scanCleanupSuggestions(); await load(); }
    catch (err) { setError(err.message || "Unable to scan flags for cleanup."); }
    finally { setScanning(false); }
  }

  async function markReviewed(item) {
    try {
      await reviewCleanupCandidate(item.flag_id);
      setItems((current) => current.map((candidate) => candidate.flag_id === item.flag_id ? { ...candidate, reviewed: true, reviewed_at: new Date().toISOString() } : candidate));
      setSelected((current) => current && current.flag_id === item.flag_id ? { ...current, reviewed: true } : current);
    } catch (err) { setError(err.message || "Unable to mark this candidate as reviewed."); }
  }

  const stats = useMemo(() => ({
    total,
    rolled: items.filter((x) => x.candidate_type === "fully_rolled_out").length,
    disabled: items.filter((x) => x.candidate_type === "fully_disabled").length,
    oldest: items.reduce((max, x) => Math.max(max, ageInDays(x.eligible_since)), 0),
  }), [items, total]);

  return (
    <main className="content-page">
      <div className="breadcrumbs"><button onClick={() => onNavigate("/landing")}>Landing</button><span>/</span>Cleanup Suggestions</div>
      <header className="evaluation-hero">
        <div><p className="eyebrow">Flag lifecycle</p><h1>Cleanup Suggestions</h1><p className="page-subtitle">Review stale flags before they become technical debt.</p></div>
        <button className="operations-primary" type="button" onClick={scan} disabled={scanning}>{scanning ? "Scanning…" : "Scan now"}</button>
      </header>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <section className="stats-grid" style={{ marginBottom: 16 }}>
        <article className="stat-card"><span>Candidates</span><strong>{stats.total}</strong></article>
        <article className="stat-card"><span>Fully rolled out</span><strong>{stats.rolled}</strong></article>
        <article className="stat-card"><span>Fully disabled</span><strong>{stats.disabled}</strong></article>
        <article className="stat-card"><span>Oldest candidate</span><strong>{stats.oldest}d</strong></article>
      </section>

      <section className="plain-panel">
        <div className="filters-bar" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input className="filter-input" placeholder="Search flag key" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="filter-select" value={type} onChange={(e) => setType(e.target.value)}><option value="">All reasons</option><option value="fully_rolled_out">100% rolled out</option><option value="fully_disabled">Fully disabled</option></select>
          <select className="filter-select" value={reviewed} onChange={(e) => setReviewed(e.target.value)}><option value="false">Needs review</option><option value="true">Reviewed</option><option value="">All</option></select>
        </div>

        {loading ? <p>Loading cleanup candidates…</p> : items.length ? (
          <div className="audit-table">
            <div className="audit-table-head"><div>Flag</div><div>Reason</div><div>State</div><div>Age</div><div>Owner</div><div>Action</div></div>
            <div className="audit-table-body">
              {items.map((item) => <div className="audit-table-row" key={item.id} onClick={() => setSelected(item)} style={{ cursor: "pointer" }}>
                <div className="cell flag-name"><strong>{item.flag_key || `Flag #${item.flag_id}`}</strong><small>{item.description || ""}</small></div>
                <div className="cell">{TYPE_LABELS[item.candidate_type] || item.candidate_type}</div>
                <div className="cell">{item.candidate_type === "fully_rolled_out" ? `${item.rollout_percentage ?? 100}%` : "Disabled"}</div>
                <div className="cell">{ageInDays(item.eligible_since)} days</div>
                <div className="cell">{item.owner_team || "Unassigned"}</div>
                <div className="cell" onClick={(e) => e.stopPropagation()}>{item.reviewed ? <span className="badge">Reviewed</span> : <button className="secondary-button" type="button" onClick={() => markReviewed(item)}>Mark reviewed</button>}</div>
              </div>)}
            </div>
          </div>
        ) : <div className="empty-state"><h3>No cleanup candidates</h3><p>Run a scan after flags have remained fully rolled out or disabled for the configured threshold.</p><button className="secondary-button" type="button" onClick={scan}>Run scan</button></div>}
      </section>

      {selected && <div className="modal-shade" onMouseDown={() => setSelected(null)}><section className="operations-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{selected.flag_key}</h2><p className="page-subtitle">Cleanup candidate details</p>
        <div className="summary-grid"><article><span>Reason</span><strong>{TYPE_LABELS[selected.candidate_type]}</strong></article><article><span>Eligible for</span><strong>{ageInDays(selected.eligible_since)} days</strong></article><article><span>Owner</span><strong>{selected.owner_team || "Unassigned"}</strong></article><article><span>Type</span><strong>{selected.flag_type || "—"}</strong></article></div>
        <p>{selected.description || "No description provided."}</p>
        <p><strong>Last updated:</strong> {selected.last_updated ? new Date(selected.last_updated).toLocaleString() : "—"}</p>
        <p><strong>Review status:</strong> {selected.reviewed ? "Reviewed" : "Needs review"}</p>
        <footer><button type="button" onClick={() => setSelected(null)}>Close</button>{!selected.reviewed && <button className="operations-primary" type="button" onClick={() => markReviewed(selected)}>Mark reviewed</button>}</footer>
      </section></div>}
    </main>
  );
}
export default CleanupSuggestions;
