import { useEffect, useMemo, useRef, useState } from "react";
import EnvironmentSwitcher, { ENVIRONMENT_OPTIONS, environmentKey, environmentName } from "../components/EnvironmentSwitcher";
import { fetchCleanupSuggestions, fetchAllFlagsMetrics } from "../services/api_fixed2";

function getEnvironmentName(selectedEnvironment, environments = []) {
  const source = environments.length ? environments : ENVIRONMENT_OPTIONS;
  const match = source.find((item) => environmentKey(item) === selectedEnvironment);
  return match ? environmentName(match) : selectedEnvironment || "Development";
}

export function FlagEditor({ flag, selectedEnvironment, environments = [], onClose, onSave, saving }) {
  const [key, setKey] = useState(flag?.key ?? "");
  const [type, setType] = useState(flag?.type ?? "boolean");
  const [defaultValue, setDefaultValue] = useState(
    flag?.default_value ?? (type === "boolean" ? true : "")
  );
  const [enabled, setEnabled] = useState(flag?.enabled ?? true);
  const [description, setDescription] = useState(flag?.description ?? "");
  const [owner, setOwner] = useState(flag?.owner_team ?? "");
  const [environment, setEnvironment] = useState(flag?.environment ?? selectedEnvironment ?? "development");
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current || saving) return;

    submittingRef.current = true;
    try {
      setError("");
      const payload = {
        key,
        type,
        default_value:
          type === "number"
            ? Number(defaultValue)
            : type === "boolean"
              ? Boolean(defaultValue)
              : String(defaultValue),
        description,
        owner_team: owner,
        enabled,
        environment,
      };

      await onSave(environment, payload);
    } catch (saveError) {
      setError(saveError.message || "Unable to save feature flag.");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div className="modal-shade" onMouseDown={onClose}>
      <form
        className="operations-modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2>{flag ? "Edit Feature Flag" : "Create Feature Flag"}</h2>
        {error && <p className="auth-error">{error}</p>}

        <label>
          Flag Key
          <input required value={key} onChange={(event) => setKey(event.target.value)} />
        </label>

        <label>
          Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="boolean">Boolean</option>
            <option value="string">String</option>
            <option value="number">Number</option>
          </select>
        </label>

        <label>
          Default Value
          {type === "boolean" ? (
            <select
              value={String(defaultValue)}
              onChange={(event) => setDefaultValue(event.target.value === "true")}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              type={type === "number" ? "number" : "text"}
              value={defaultValue}
              onChange={(event) => setDefaultValue(event.target.value)}
              placeholder={type === "number" ? "0" : "Enter default value"}
            />
          )}
        </label>

        <label className="toggle-row">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
        </label>

        <label>
          Description
          <textarea
            rows="3"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional description"
          />
        </label>

        <label>
          Owner Team
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="Optional team name"
          />
        </label>

        <label>
          Environment
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
            disabled={Boolean(flag)}
            title={flag ? "A flag's environment cannot be changed after creation." : undefined}
          >
            {(environments.length ? environments : ENVIRONMENT_OPTIONS).map((item) => {
              const key = environmentKey(item);
              return (
              <option key={key} value={key}>
                {environmentName(item)}
              </option>
              );
            })}
          </select>
          {flag && <small className="field-help">The environment is fixed after this flag is created.</small>}
        </label>

        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="operations-primary" disabled={saving || submittingRef.current}>
            {saving || submittingRef.current ? "Saving..." : "Save"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Dashboard({
  flags,
  environments = [],
  selectedEnvironment,
  onSelectEnvironment,
  loading,
  saving,
  onNewFlag,
  onEditFlag,
  onDeleteFlag,
  onOpenFlag,
  onNavigate,
  startCreate = false,
}) {
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(undefined);
  const [cleanupItems, setCleanupItems] = useState([]);
  const [cleanupError, setCleanupError] = useState("");
  const [evaluationTotal, setEvaluationTotal] = useState(null);
  const [evaluationError, setEvaluationError] = useState("");

  useEffect(() => {
    if (startCreate) setEditor(null);
  }, [startCreate]);
  const environment = getEnvironmentName(selectedEnvironment, environments);
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    const activeEnvironment = String(selectedEnvironment || "").trim().toLowerCase();
    return flags.filter((flag) => {
      const flagEnvironment = String(flag.environment || "").toLowerCase();
      const environmentMatches = !activeEnvironment || flagEnvironment === activeEnvironment;
      const textMatches = `${flag.key} ${flag.owner_team || ""}`.toLowerCase().includes(query);
      return environmentMatches && textMatches;
    });
  }, [flags, search, selectedEnvironment]);
  const active = flags.filter((flag) => flag.enabled).length;
  const activity = flags
    .slice(0, 4)
    .map((flag) => `${flag.key.replaceAll("_", " ")} ${flag.enabled ? "enabled" : "disabled"}`);

  const save = async (environment, data) => {
    const payload = { ...data, environment };
    await (editor ? onEditFlag(editor.id, payload) : onNewFlag(payload));
    setEditor(undefined);
  };


  useEffect(() => {
    let activeRequest = true;
    setEvaluationError("");
    fetchAllFlagsMetrics(30, selectedEnvironment || "")
      .then((data) => {
        if (activeRequest) setEvaluationTotal(Number(data?.total_evaluations || 0));
      })
      .catch((error) => {
        if (activeRequest) {
          setEvaluationTotal(0);
          setEvaluationError(error.message || "Unable to load evaluation analytics.");
        }
      });
    return () => { activeRequest = false; };
  }, [selectedEnvironment]);

  useEffect(() => {
    let activeRequest = true;
    setCleanupError("");
    fetchCleanupSuggestions({ page: 1, size: 5, reviewed: false })
      .then((data) => {
        if (activeRequest) setCleanupItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((error) => {
        if (activeRequest) {
          setCleanupItems([]);
          setCleanupError(error.message || "Unable to load cleanup suggestions.");
        }
      });
    return () => { activeRequest = false; };
  }, [flags]);

  const topFlags = useMemo(() => {
    if (!flags || !flags.length) return [];
    const sorted = [...flags].sort((a, b) => {
      const ena = a && a.enabled ? 1 : 0;
      const enb = b && b.enabled ? 1 : 0;
      if (enb !== ena) return enb - ena;
      return (a.key || "").toString().localeCompare((b.key || "").toString());
    });
    return sorted.slice(0, 5);
  }, [flags]);

  return (
    <main className="operations-dashboard">
      <header className="operations-header">
        <div>
          <p>Overview</p>
          <h1>Feature Flags</h1>
        </div>
        <EnvironmentSwitcher
          selectedEnvironment={selectedEnvironment}
          onChange={onSelectEnvironment}
          environments={environments}
        />
        <label className="operations-search">
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search flags"
          />
        </label>
        <button className="operations-primary" onClick={() => setEditor(null)}>
          + New Flag
        </button>
      </header>

      <div className="rollout-page-grid">
        <div className="left-column">
          <section className="stats-grid rollout-stats span-2" style={{ marginBottom: 12 }}>
            <div className="stat-card">
              <div className="stat-icon">🏷️</div>
              <div>
                <span>Active</span>
                <strong>{active}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Enabled in the selected workspace</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏸️</div>
              <div>
                <span>Inactive</span>
                <strong>{flags.length - active}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Currently disabled</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div>
                <span>Evaluations (30d)</span>
                <strong>{evaluationTotal === null ? "—" : evaluationTotal.toLocaleString()}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Live Redis + persisted PostgreSQL counts</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🌐</div>
              <div>
                <span>Environments</span>
                <strong>{environments.length}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Configured for this workspace</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🧹</div>
              <div>
                <span>Cleanup</span>
                <strong>{cleanupItems.length}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Candidates currently awaiting review</div>
              </div>
            </div>
          </section>

          <section className="evaluation-card">
            <h2>Evaluations</h2>
            <div style={{ padding: 16 }}>
              {evaluationError ? <p className="auth-error">{evaluationError}</p> : (
                <>
                  <strong style={{ fontSize: 28 }}>{evaluationTotal === null ? "—" : evaluationTotal.toLocaleString()}</strong>
                  <p className="rollout-control__hint" style={{ color: 'var(--muted)', marginTop: 8 }}>Total evaluations recorded over the last 30 days.</p>
                  <button className="secondary-button" type="button" onClick={() => onNavigate("/evaluation/all")}>View evaluation analytics →</button>
                </>
              )}
            </div>
          </section>

        </div>

          <section className="operations-list span-2">
            <div className="list-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Feature Flags</h2>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Manage your feature flags and rollout status.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="secondary-button" onClick={() => onSelectEnvironment('development')}>View All Flags</button>
              </div>
            </div>

            <div className="filters-bar" style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 8, alignItems: 'center' }}>
              <input className="filter-input" placeholder="Search flags" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="filter-select" value={selectedEnvironment} onChange={(e) => onSelectEnvironment(e.target.value)}>
                {environments.map((env) => {
                  const key = environmentKey(env);
                  return <option key={key} value={key}>{environmentName(env)}</option>;
                })}
              </select>
              <select className="filter-select">
                <option value="">All Statuses</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <div style={{ marginLeft: 'auto' }}>
                <button className="operations-primary" onClick={() => setEditor(null)}>+ New Flag</button>
              </div>
            </div>

            <div className="flags-list">
              {loading ? (
                <div className="flags-loading">Loading flags...</div>
              ) : (
                filtered.map((flag) => {
                  const displayName = (flag.name || flag.key || '').replaceAll('_', ' ');
                  const slug = flag.key || '';
                  const rollout = flag.rollout_percentage ?? flag.rolloutPercentage ?? 0;
                  const typeLabel = flag.type ? (flag.type === 'experiment' ? 'Experiment' : 'Release') : 'Release';

                  return (
                    <div key={flag.id} className="flag-row" onClick={() => onOpenFlag?.(flag.id)}>
                      <div className="flag-left">
                        <div className="flag-icon" aria-hidden>
                          { (flag.key || 'F').slice(0,1).toUpperCase() }
                        </div>
                        <div className="flag-meta">
                          <div className="flag-name"><strong>{displayName}</strong></div>
                          <div className="flag-slug">{slug}</div>
                        </div>
                      </div>

                      <div className="flag-status">
                        <span className={flag.enabled ? 'badge-enabled badge' : 'badge-disabled badge'}>{flag.enabled ? 'Enabled' : 'Disabled'}</span>
                      </div>

                      <div className="flag-env">
                        <span className="badge-updated badge">{environment}</span>
                      </div>

                      <div className="flag-type">
                        <span className="badge-rollout_changed badge">{typeLabel}</span>
                      </div>

                      <div className="flag-rollout">
                        <div className="rollout-preview" aria-hidden>
                          <div className="rollout-preview-fill" style={{ width: `${rollout}%` }} />
                        </div>
                        <div className="rollout-percent">{rollout}%</div>
                      </div>

                      <div className="flag-updated">{flag.updated_at ? new Date(flag.updated_at).toLocaleString() : '—'}<div className="flag-updated-by">by {flag.owner_team || 'Admin'}</div></div>

                      <div className="flag-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="secondary-button" onClick={() => setEditor(flag)}>Edit</button>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pagination" style={{ marginTop: 12 }}>
                <button className="secondary-button">&lt;</button>
                <div className="page-num active">1</div>
                <div className="page-num">2</div>
                <div className="page-num">3</div>
                <button className="secondary-button">&gt;</button>
              </div>
            </div>
          </section>

        <section className="flag-section-card" style={{ padding: 16, marginTop: 16 }}>
          <div className="flag-section-heading"><div><h2>Cleanup Suggestions</h2><p className="page-subtitle">Stale flags ready for review.</p></div><button className="secondary-button" type="button" onClick={() => onNavigate("/cleanup")}>View all</button></div>
          {cleanupError ? <p className="auth-error">{cleanupError}</p> : cleanupItems.length ? cleanupItems.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div><strong>{item.flag_key || `Flag #${item.flag_id}`}</strong><div style={{ color: "var(--muted)", fontSize: 12 }}>{item.candidate_type === "fully_rolled_out" ? "100% rolled out" : "Fully disabled"}</div></div>
              <button className="secondary-button" type="button" onClick={() => onNavigate("/cleanup")}>Review</button>
            </div>
          )) : <p className="page-subtitle">No stale flags need review.</p>}
        </section>

        <aside className="right-column">
          <section className="activity-card">
            <h2>Recent Activity</h2>
            {activity.length ? (
              activity.map((item, index) => <p key={index}>- {item}</p>)
            ) : (
              <p>No feature-flag activity yet.</p>
            )}
          </section>

          <section className="flag-section-card" style={{ padding: 12 }}>
            <h3>Environment Summary</h3>
            <div style={{ marginTop: 8 }}>
              <p><strong>{environments.length}</strong> environments</p>
              <ul style={{ marginTop: 8 }}>
                {environments.slice(0, 6).map((env) => (
                  <li key={env.id || env.environment || env.name}>{env.name || env.environment || env.id}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="flag-section-card" style={{ padding: 12 }}>
            <h3>Top Performing Flags</h3>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topFlags.length ? (
                topFlags.map((f) => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{f.key}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>{f.owner_team || 'Unassigned'}</div>
                    </div>
                    <div>
                      <span className={f.enabled ? 'badge-enabled' : 'badge-disabled'}>{f.enabled ? 'ENABLED' : 'DISABLED'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p>No flags available</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {editor !== undefined && (
        <FlagEditor
          flag={editor}
          selectedEnvironment={selectedEnvironment}
          environments={environments}
          saving={saving}
          onClose={() => setEditor(undefined)}
          onSave={save}
        />
      )}
    </main>
  );
}

export default Dashboard;
