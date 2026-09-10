export const ENVIRONMENT_OPTIONS = [
  { id: "development", key: "development", name: "Development" },
  { id: "staging", key: "staging", name: "Staging" },
  { id: "production", key: "production", name: "Production" },
];

export function environmentKey(environment) {
  if (!environment) return "";
  return String(environment.key || environment.environment || environment.name || environment.id || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function environmentName(environment) {
  if (!environment) return "";
  return environment.name || environment.environment || environment.key || String(environment.id || "");
}

function EnvironmentSwitcher({ selectedEnvironment, onChange, environments = [] }) {
  const source = environments.length ? environments : ENVIRONMENT_OPTIONS;
  const options = source
    .map((environment) => ({ key: environmentKey(environment), name: environmentName(environment) }))
    .filter((environment) => environment.key);

  return (
    <label className="environment-switcher">
      <span>Environment:</span>
      <select value={selectedEnvironment ?? ""} onChange={(event) => onChange(event.target.value)}>
        {options.map((environment) => (
          <option key={environment.key} value={environment.key}>{environment.name}</option>
        ))}
      </select>
    </label>
  );
}

export default EnvironmentSwitcher;
