import { useEffect, useMemo, useState } from "react";
import { ENVIRONMENT_OPTIONS, environmentKey, environmentName } from "../components/EnvironmentSwitcher";
import { fetchEnvironments, fetchFlagEnvironmentOverrides, fetchFlags } from "../services/api_fixed2";

const MATRIX_ENVIRONMENTS = [
  { key: "production", name: "Production" },
  { key: "staging", name: "Staging" },
  { key: "development", name: "Development" },
];

function displayEnvironment(environment) {
  return environmentName(environment) || environment.key;
}

function normalizeEnvironmentKey(value) {
  const key = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return key === "developing" ? "development" : key;
}

function flagEnvironmentKey(flag) {
  return normalizeEnvironmentKey(environmentKey(flag));
}

function EnvironmentStatus({ flag, environment, override }) {
  if (!override && environment.key !== flagEnvironmentKey(flag)) {
    return <span className="environment-empty">—</span>;
  }

  const enabled = override ? Boolean(override.value ?? override.enabled) : Boolean(flag.enabled);
  const rollout = override?.rollout_percentage ?? flag.rollout_percentage;

  if (!enabled) {
    return <span className="environment-status environment-status-off">✓&nbsp; Off</span>;
  }

  return (
    <span className="environment-status environment-status-on">
      ✓&nbsp; {rollout != null && Number(rollout) < 100 ? `${rollout}%` : "100%"}
    </span>
  );
}

function Environments({ selectedEnvironment, onSelectEnvironment, onNavigate }) {
  const [environmentData, setEnvironmentData] = useState([]);
  const [flags, setFlags] = useState([]);
  const [overridesByFlag, setOverridesByFlag] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadMatrix() {
      setLoading(true);
      setError("");
      try {
        const [loadedEnvironments, loadedFlags] = await Promise.all([
          fetchEnvironments(),
          fetchFlags(),
        ]);
        const safeFlags = Array.isArray(loadedFlags) ? loadedFlags : [];
        const overrideResults = await Promise.allSettled(
          safeFlags.map((flag) => fetchFlagEnvironmentOverrides(flag.id))
        );
        const overrideEntries = safeFlags.map((flag, index) => {
          const result = overrideResults[index];
          if (result.status === "rejected") {
            console.warn(`Unable to load environment overrides for flag ${flag.id}`, result.reason);
            return [flag.id, []];
          }
          return [flag.id, Array.isArray(result.value) ? result.value : []];
        });
        if (!active) return;
        setEnvironmentData(Array.isArray(loadedEnvironments) ? loadedEnvironments : []);
        setFlags(safeFlags);
        setOverridesByFlag(Object.fromEntries(overrideEntries));
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load environment data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMatrix();
    return () => {
      active = false;
    };
  }, []);

  const environments = useMemo(() => {
    const known = new Map();
    [...ENVIRONMENT_OPTIONS, ...environmentData].forEach((environment) => {
      const key = environmentKey(environment);
      if (key) known.set(key, { key, name: displayEnvironment(environment) });
    });
    return MATRIX_ENVIRONMENTS.map((environment) => known.get(environment.key) || environment);
  }, [environmentData]);

  const filteredFlags = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return flags;
    return flags.filter((flag) =>
      [flag.name, flag.key, flag.description].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  }, [flags, search]);

  function findOverride(flag, environment) {
    return (overridesByFlag[flag.id] || []).find(
      (item) => normalizeEnvironmentKey(item.environment) === environment.key ||
        String(item.environment_id) === String(environment.id)
    );
  }

  return (
    <main className="environments-matrix-page">
      <header className="environments-matrix-toolbar">
        <label className="environments-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search flags, keys, descriptions... (⌘ K)"
          />
        </label>
        <label className="environments-toolbar-select">
          <span>Env:</span>
          <select value={selectedEnvironment || "development"} onChange={(event) => onSelectEnvironment(event.target.value)}>
            <option value="all">All Environments</option>
            {environments.map((environment) => (
              <option key={environment.key} value={environment.key}>{environment.name}</option>
            ))}
          </select>
        </label>
        <button className="environments-toolbar-button" type="button" onClick={() => onNavigate("/flags/new")}>＋ Create Flag</button>
      </header>

      <section className="environment-matrix-card">
        <div className="environment-matrix-heading">
          <div>
            <p className="environment-matrix-eyebrow">▣&nbsp; Environment Release Matrix</p>
            <h1>Cross-environment state comparison</h1>
            <p>Cross-environment state comparison for all feature toggles.</p>
          </div>
          <span className="environment-count">{environments.length} Target Environments</span>
        </div>

        {loading && <p className="page-subtitle">Loading environment data...</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && !error && (
          <div className="environment-matrix-table-wrap">
            <table className="environment-matrix-table">
              <thead>
                <tr>
                  <th>FEATURE FLAG</th>
                  {environments.map((environment) => <th key={environment.key}>{environment.name.toUpperCase()}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredFlags.map((flag) => (
                  <tr key={flag.id}>
                    <td>
                      <button type="button" className="environment-flag-name" onClick={() => onNavigate(`/flags/${flag.id}`)}>
                        {flag.name || flag.key}
                      </button>
                      <small>{flag.key}</small>
                    </td>
                    {environments.map((environment) => (
                      <td key={environment.key}>
                        <EnvironmentStatus
                          flag={flag}
                          environment={environment}
                          override={findOverride(flag, environment)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredFlags.length && <div className="environment-matrix-empty">No feature flags found.</div>}
          </div>
        )}
      </section>
    </main>
  );
}

export default Environments;
