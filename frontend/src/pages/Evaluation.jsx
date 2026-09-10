import { useEffect, useState } from "react";
import { ENVIRONMENT_OPTIONS } from "../components/EnvironmentSwitcher";
import { evaluateFlag } from "../services/api_fixed2";

function getEnvironmentName(selectedEnvironment) {
  return (
    ENVIRONMENT_OPTIONS.find((item) => item.id === selectedEnvironment)?.name ||
    "Development"
  );
}

function Evaluation({ flags, selectedEnvironment, onNavigate }) {
  const [flagKey, setFlagKey] = useState("");
  const [environment, setEnvironment] = useState(getEnvironmentName(selectedEnvironment));
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState(undefined);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setEnvironment(getEnvironmentName(selectedEnvironment));
  }, [selectedEnvironment]);

  async function submit(event) {
    if (event) event.preventDefault();
    setChecking(true);
    setError("");
    setResult(undefined);
    try {
      const response = await evaluateFlag({
        flagKey,
        environment,
        userContext: userId.trim() ? { user_id: userId.trim() } : {},
      });
      setResult(response.value);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChecking(false);
    }
  }

  function clearForm() {
    setFlagKey("");
    setUserId("");
    setResult(undefined);
    setError("");
  }

  return (
    <main className="content-page evaluation-page">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate("/landing")}>Home</button>
        <span>/</span>
        Evaluations
      </div>

      <header className="evaluation-hero">
        <div>
          <h1>Flag Evaluation</h1>
          <p className="page-subtitle">Check whether a feature flag is enabled for the selected environment and user.</p>
        </div>
      </header>

      <section className="evaluate-panel">
        <form className="evaluate-card" onSubmit={submit}>
          <div className="form-row">
            <label className="form-field">
              <div className="field-label">Feature Flag</div>
              <select required value={flagKey} onChange={(e) => setFlagKey(e.target.value)}>
                <option value="">Select a flag</option>
                {flags.map((flag) => (
                  <option key={flag.id} value={flag.key}>{flag.name || flag.key}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <div className="field-label">Environment</div>
              <select required value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                {ENVIRONMENT_OPTIONS.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <div className="field-label">User ID (Optional)</div>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user ID"
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={checking || !flagKey}>
              {checking ? "Evaluating..." : "Evaluate Flag"}
            </button>
            <button type="button" className="secondary-button" onClick={clearForm}>
              Clear
            </button>
            <div className="helper-link">
              <small>Not sure which User ID to use? <a href="#">Learn how to get user ID</a></small>
            </div>
          </div>
        </form>

        <aside className="evaluate-side">
          <div className="result-card">
            {result === undefined ? (
              <div className="placeholder">Real-time Results will appear here.</div>
            ) : (
              <div className={`evaluation-result large ${result ? "result-on" : "result-off"}`}>
                <strong>{result ? "Enabled" : "Disabled"}</strong>
                <span>API result: <code>{String(result)}</code></span>
              </div>
            )}

            {error && <p className="form-error">{error}</p>}
          </div>

          <div className="feature-cards">
            <div className="feature-card">Real-time Results</div>
            <div className="feature-card">User Targeting</div>
            <div className="feature-card">Environment Aware</div>
            <div className="feature-card">API Compatible</div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default Evaluation;
