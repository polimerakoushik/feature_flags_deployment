import { useCallback, useEffect, useState } from "react";
import {
  fetchFlagDetails,
  fetchEnvironments,
  fetchFlagEnvironmentOverrides,
  updateFlagEnvironmentOverride,
  fetchRolloutStatistics,
  fetchGroups,
  addFlagTargetUsersBulk,
  fetchFlagTargetUsers,
  fetchFlagTargetGroups,
  addFlagTargetGroup,
  deleteFlagTargetGroup,
  evaluateFlagDebug,
} from "../services/api_fixed2";
import GroupMultiSelect from "../components/GroupMultiSelect";

function formatLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeEnvironment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function matchesEnvironment(item, environment, selectedEnvironment) {
  if (
    selectedEnvironment?.id &&
    Number(item.environment_id) === Number(selectedEnvironment.id)
  ) {
    return true;
  }
  return normalizeEnvironment(item.environment) === normalizeEnvironment(environment);
}

function StatCard({ icon, label, value, sub }) {
  return (
    <article className="stat-card">
      <span className="stat-icon" aria-hidden="true">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value ?? "-"}</strong>
        {sub ? <small>{sub}</small> : null}
      </div>
    </article>
  );
}


function RolloutDetails({ flagId, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flag, setFlag] = useState(null);

  const [env, setEnv] = useState("production");
  const [environments, setEnvironments] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [stats, setStats] = useState(null);
  const [rollout, setRollout] = useState(0);
  const [saving, setSaving] = useState(false);

  const [targetUsers, setTargetUsers] = useState([]);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);

  const [availableGroups, setAvailableGroups] = useState([]);
  const [targetGroups, setTargetGroups] = useState([]);
  const [draftGroups, setDraftGroups] = useState([]);
  const [groupSaving, setGroupSaving] = useState(false);

  const [toast, setToast] = useState("");

  const [evalUserId, setEvalUserId] = useState("");
  const [evalGroups, setEvalGroups] = useState("");
  const [evalEnv, setEvalEnv] = useState("production");
  const [evalResult, setEvalResult] = useState(null);
  const [evalError, setEvalError] = useState("");
  const [evalChecking, setEvalChecking] = useState(false);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const detail = await fetchFlagDetails(flagId);
      const [loadedEnvironments, loadedOverrides, loadedGroups] = await Promise.all([
        fetchEnvironments(),
        fetchFlagEnvironmentOverrides(flagId),
        fetchGroups(),
      ]);
      const availableEnvironments = Array.isArray(loadedEnvironments)
        ? loadedEnvironments
        : [];
      const environmentOverrides = Array.isArray(loadedOverrides)
        ? loadedOverrides
        : [];
      const availableGroupNames = Array.isArray(loadedGroups)
        ? loadedGroups.filter((group) => typeof group === "string" && group.trim())
        : [];
      const currentEnv =
        environmentOverrides.some(
          (item) => normalizeEnvironment(item.environment) === "production"
        )
          ? "production"
          : detail?.environment || "production";

      setFlag(detail);
      setEnvironments(availableEnvironments);
      setOverrides(environmentOverrides);
      setEnv(currentEnv);
      setEvalEnv(currentEnv);
      setRollout(
        Number(
          environmentOverrides.find(
            (item) => matchesEnvironment(item, currentEnv)
          )?.rollout_percentage ??
            detail?.rollout_percentage ??
            0
        )
      );

      const [statistics, users, groups] = await Promise.all([
        fetchRolloutStatistics(flagId, currentEnv),
        fetchFlagTargetUsers(flagId),
        fetchFlagTargetGroups(flagId),
      ]);

      const safeUsers = Array.isArray(users)
        ? users
        : detail?.target_users || [];

      const safeGroups = Array.isArray(groups)
        ? groups
        : detail?.target_groups || [];

      setStats(statistics || null);
      setTargetUsers(safeUsers);
      setTargetGroups(safeGroups);
      setDraftGroups(safeGroups);
      setAvailableGroups(availableGroupNames);
    } catch (err) {
      setError(err?.message || "Unable to load rollout data.");
    } finally {
      setLoading(false);
    }
  }, [flagId]);

  const refreshStats = useCallback(
    async (environment = env, { showError = true } = {}) => {
      try {
        const result = await fetchRolloutStatistics(flagId, environment);
        setStats(result || null);
      } catch (err) {
        if (showError) {
          setError(err?.message || "Unable to fetch rollout statistics.");
        }
      }
    },
    [flagId, env]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading) return;

    const hash = window.location.hash;
    if (!hash) return;

    const id = hash.substring(1);
    const element = document.getElementById(id);

    if (element) {
      window.setTimeout(() => {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    }
  }, [loading]);

  async function saveRollout() {
    const value = Number(rollout);

    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Rollout percentage must be between 0 and 100.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const selectedEnvironment = environments.find(
        (item) =>
          normalizeEnvironment(item.key ?? item.name) === normalizeEnvironment(env)
      );
      if (!selectedEnvironment?.id) {
        throw new Error("The selected environment could not be found.");
      }
      const updatedOverride = await updateFlagEnvironmentOverride(
        flagId,
        selectedEnvironment.id,
        { rollout_percentage: value }
      );
      setOverrides((items) => [
        ...items.filter(
          (item) =>
            !matchesEnvironment(item, env, selectedEnvironment)
        ),
        updatedOverride,
      ]);
      setRollout(value);
      showToast("Rollout updated successfully.");
      await refreshStats(env, { showError: false });
    } catch (err) {
      setError(err?.message || "Unable to save rollout.");
    } finally {
      setSaving(false);
    }
  }

  async function setAllUsers(value) {
    const action = value === 100 ? "Enable" : "Disable";

    if (!window.confirm(`${action} feature for all users?`)) return;

    setSaving(true);
    setError("");

    try {
      const selectedEnvironment = environments.find(
        (item) =>
          normalizeEnvironment(item.key ?? item.name) === normalizeEnvironment(env)
      );
      if (!selectedEnvironment?.id) {
        throw new Error("The selected environment could not be found.");
      }
      await updateFlagEnvironmentOverride(flagId, selectedEnvironment.id, {
        rollout_percentage: value,
      });
      setRollout(value);
      showToast(
        value === 100
          ? "Feature enabled for all users."
          : "Feature disabled for all users."
      );
      await refreshStats(env, { showError: false });
    } catch (err) {
      setError(err?.message || `Unable to ${action.toLowerCase()} feature.`);
    } finally {
      setSaving(false);
    }
  }

  function parseUserIds(value) {
    return Array.from(
      new Set(
        value
          .split(/[\n,;]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  async function addUsers() {
    const ids = parseUserIds(bulkInput);

    if (!ids.length) {
      setError("Please provide at least one user ID.");
      return;
    }

    setBulkAdding(true);
    setError("");

    try {
      await addFlagTargetUsersBulk(flagId, ids);
      setBulkInput("");
      showToast(`Added ${ids.length} user${ids.length === 1 ? "" : "s"}.`);
      await loadData();
    } catch (err) {
      setError(err?.message || "Unable to add users.");
    } finally {
      setBulkAdding(false);
    }
  }

  async function saveGroups() {
    const selected = Array.from(new Set(draftGroups || []));
    const existing = new Set(targetGroups || []);
    const newGroups = selected.filter((group) => !existing.has(group));
    const removedGroups = Array.from(existing).filter(
      (group) => !selected.includes(group)
    );

    if (!newGroups.length && !removedGroups.length) {
      setTargetGroups(selected);
      showToast("Target groups are up to date.");
      return;
    }

    setGroupSaving(true);
    setError("");

    try {
      await Promise.all([
        ...newGroups.map((group) => addFlagTargetGroup(flagId, group)),
        ...removedGroups.map((group) => deleteFlagTargetGroup(flagId, group)),
      ]);

      setTargetGroups(selected);
      setDraftGroups(selected);
      showToast("Target groups updated.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Unable to save target groups.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function evaluate() {
    setEvalChecking(true);
    setEvalError("");
    setEvalResult(null);

    try {
      const groups = evalGroups
        .split(/[\n,;]+/)
        .map((group) => group.trim())
        .filter(Boolean);

      const userId = evalUserId.trim() || null;

      const response = await evaluateFlagDebug({
        flagKey: flag?.key,
        environment: evalEnv,
        userId,
        groups,
      });

      if (!response?.ok) {
        throw new Error(
          response?.error ||
            `${response?.status || ""} ${response?.statusText || ""}`.trim() ||
            "Evaluation request failed."
        );
      }

      if (response.bodyJson && typeof response.bodyJson === "object") {
        const value =
          response.bodyJson.value ??
          response.bodyJson.enabled ??
          response.bodyJson.result ??
          response.bodyJson;

        setEvalResult(value);
        return;
      }

      if (response.bodyText) {
        setEvalResult(response.bodyText);
        return;
      }

      throw new Error("The evaluation endpoint returned an empty response.");
    } catch (err) {
      setEvalError(err?.message || "Evaluation failed.");
    } finally {
      setEvalChecking(false);
    }
  }

  async function handleEnvironmentChange(event) {
    const nextEnv = event.target.value;
    setEnv(nextEnv);
    const selectedEnvironment = environments.find(
      (item) =>
        normalizeEnvironment(item.key ?? item.name) ===
        normalizeEnvironment(nextEnv)
    );
    const nextOverride = overrides.find((item) =>
      matchesEnvironment(item, nextEnv, selectedEnvironment)
    );
    setRollout(
      Number(nextOverride?.rollout_percentage ?? flag?.rollout_percentage ?? 0)
    );
    setEvalEnv(nextEnv);
    await refreshStats(nextEnv);
  }

  if (loading) {
    return (
      <main className="flag-details-page">
        <p className="page-subtitle">Loading rollout details...</p>
      </main>
    );
  }

  if (!flag) {
    return (
      <main className="flag-details-page">
        <button
          type="button"
          className="secondary-button"
          onClick={() => onNavigate?.(`/flags/${flagId}`)}
        >
          Back to Flag
        </button>
        <p className="form-error">
          {error || "Feature flag was not found."}
        </p>
      </main>
    );
  }

  const totalUsers = Number(
    stats?.total_users ??
      targetUsers.length ??
      flag?.target_users?.length ??
      0
  );

  const effectivePercent = Math.max(
    0,
    Math.min(
      100,
      Number(stats?.rollout_percentage ?? rollout) || 0
    )
  );

  // Summary cards describe the selected environment's rollout percentage,
  // rather than the current sample of explicitly targeted users.
  const enabledUsers = Math.round(totalUsers * (effectivePercent / 100));

  const disabledUsers = Math.max(totalUsers - enabledUsers, 0);

  const enabledPercent = effectivePercent;

  const disabledPercent = Math.max(0, 100 - enabledPercent);

  return (
    <main className="flag-details-page">
      <div className="breadcrumbs">
        <button
          type="button"
          onClick={() => onNavigate?.(`/flags/${flagId}`)}
        >
          ← Back to Flag
        </button>
      </div>

      <header className="flag-details-header">
        <div>
          <div className="rollout-title-row">
            <h1>{flag.name || flag.key}</h1>
            <span className={flag.enabled ? "status-on" : "status-off"}>
              {flag.enabled ? "Active" : "Inactive"}
            </span>
          </div>
          <code className="flag-key">{flag.key}</code>
          {flag.description ? (
            <p className="page-subtitle">{flag.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="primary-button rollout-view-flag"
          onClick={() => onNavigate?.(`/flags/${flagId}`)}
        >
          View Flag Details
        </button>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="flag-section-card rollout-stats rollout-summary-card">
        <div className="stats-grid">
          <StatCard icon="👤" label="Total Users" value={totalUsers.toLocaleString()} />
          <StatCard
            icon="👤"
            label="Included (approx)"
            value={enabledUsers}
            sub={`${enabledPercent}%`}
          />
          <StatCard
            icon="👤"
            label="Excluded (approx)"
            value={disabledUsers}
            sub={`${disabledPercent}%`}
          />
          <StatCard icon="👤" label="Target Groups" value={targetGroups.length} />
        </div>
      </section>

      <div className="rollout-environment-tabs" role="tablist" aria-label="Environments">
        {environments
          .filter((environment) =>
            ["development", "staging", "production"].includes(
              String(environment.key ?? environment.name).toLowerCase()
            )
          )
          .map((environment) => {
            const key = environment.key ?? environment.name;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={String(env).toLowerCase() === String(key).toLowerCase()}
                className={String(env).toLowerCase() === String(key).toLowerCase() ? "active" : ""}
                key={environment.id ?? key}
                onClick={() => handleEnvironmentChange({ target: { value: key } })}
              >
                {environment.name ?? key}
              </button>
            );
          })}
      </div>

      <div className="rollout-page-grid">
        <div className="left-column">
          <section className="flag-section-card targeting-card">
            <h2>Targeting Rules</h2>
            <p className="page-subtitle">Define rules to target specific users or groups.</p>
            <strong>Manual Target Users</strong>
            <textarea
              rows={3}
              value={bulkInput}
              onChange={(event) => setBulkInput(event.target.value)}
              placeholder="Enter user IDs (comma separated)"
            />
            <small className="field-hint">Example: user-001, user-002, user-003</small>

            <strong className="targeting-label">Target Groups</strong>
            <GroupMultiSelect
              options={availableGroups}
              selected={draftGroups}
              onChange={setDraftGroups}
              disabled={groupSaving}
              placeholder="Select one or more groups..."
            />
            <div className="group-chips">
              {targetGroups.map((group) => (
                <span className="chip group-chip" key={group}>{group} ×</span>
              ))}
            </div>
            <div className="target-groups-actions">
              <button
                type="button"
                className="primary-button"
                onClick={async () => {
                  if (bulkInput.trim()) await addUsers();
                  await saveGroups();
                }}
                disabled={bulkAdding || groupSaving}
              >
                {bulkAdding || groupSaving ? "Saving..." : "Save Targeting"}
              </button>
            </div>
          </section>

          <section className="flag-section-card user-lists">
            <h2>Enabled / Disabled Users</h2>
            <p className="page-subtitle">View users who are explicitly enabled or disabled for this flag.</p>
            <div className="user-list-actions">
              <button type="button" className="secondary-button" onClick={() => onNavigate?.(`/flags/${flagId}/rollout/users?status=enabled&environment=${encodeURIComponent(env)}`)}>View Enabled Users</button>
              <button type="button" className="secondary-button" onClick={() => onNavigate?.(`/flags/${flagId}/rollout/users?status=disabled&environment=${encodeURIComponent(env)}`)}>View Disabled Users</button>
            </div>
          </section>
        </div>

        <div className="right-column">
          <section className="flag-section-card rollout-control">
            <h2>Percentage Rollout</h2>
            <p className="page-subtitle">Deterministic rollout based on the user ID and flag key.</p>
            <div className="rollout-current-environment">
              <span>▣</span>
              <div>
                <small>Environment</small>
                <strong>{formatLabel(env)}</strong>
              </div>
              <div className="current-rollout">
                <small>Current Rollout</small>
                <strong>{effectivePercent}%</strong>
              </div>
            </div>

            <div className="rollout-preview" aria-hidden="true">
              <div
                className="rollout-preview-fill"
                style={{ width: `${effectivePercent}%` }}
              />
            </div>

            <label htmlFor="rollout-slider">Rollout percentage</label>
            <input
              id="rollout-slider"
              className="rollout-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={effectivePercent}
              onChange={(event) =>
                setRollout(Number(event.target.value))
              }
            />

            <div className="rollout-input-row">
              <input
                className="rollout-input"
                type="number"
                min="0"
                max="100"
                value={rollout}
                onChange={(event) => {
                  const value = event.target.value;
                  setRollout(value === "" ? "" : Number(value));
                }}
              />
              <span>%</span>
            </div>

            <p className="rollout-helper">
              Enabled for {effectivePercent}% of users.
            </p>

            <div className="quick-set-row">
              {[0, 10, 25, 50, 75, 100].map((value) => (
                <button
                  type="button"
                  className="quick-set-btn"
                  key={value}
                  onClick={() => setRollout(value)}
                >
                  {value}%
                </button>
              ))}
            </div>

            <div className="rollout-submit-row">
              <button
                type="button"
                className="primary-button"
                onClick={saveRollout}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setAllUsers(100)}
                disabled={saving}
              >
                Enable All
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setAllUsers(0)}
                disabled={saving}
              >
                Disable All
              </button>
            </div>
          </section>

          <section className="flag-section-card evaluation-panel">
            <h2>Evaluation Test</h2>
            <p className="page-subtitle">Run an ad-hoc evaluation using the same engine as the API.</p>
            <div className="eval-panel-grid">
              <label>
                Environment
                <select
                  value={evalEnv}
                  onChange={(event) => setEvalEnv(event.target.value)}
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </label>

              <label>
                User ID (optional)
                <input
                  value={evalUserId}
                  onChange={(event) => setEvalUserId(event.target.value)}
                  placeholder="user-123"
                />
              </label>

              <label>
                Groups (optional)
                <input
                  value={evalGroups}
                  onChange={(event) => setEvalGroups(event.target.value)}
                  placeholder="group-a,group-b"
                />
              </label>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={evaluate}
              disabled={evalChecking}
            >
              {evalChecking ? "Checking..." : "Evaluate"}
            </button>

            {evalResult !== null ? (
              <div className="evaluation-result">
                <strong>Evaluation Result</strong>
                <code>{String(evalResult)}</code>
              </div>
            ) : null}

            {evalError ? (
              <p className="form-error">{evalError}</p>
            ) : null}
          </section>

        </div>
      </div>

     

      {toast ? <div className="page-toast success">{toast}</div> : null}
    </main>
  );
}

export default RolloutDetails;
