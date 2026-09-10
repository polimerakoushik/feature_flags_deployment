import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

import {
  fetchAllFlagsMetrics,
  fetchFlagMetrics,
} from "../services/api_fixed2";

const COLORS = [
  "#5b5bf0",
  "#2f7be6",
  "#59a14f",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
];

const DAYS = 7;
const analyticsCache = new Map();

function localDateKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function analyticsCacheKey({ environment, days, startDate, endDate }) {
  return [
    localDateKey(),
    environment || "all",
    days,
    startDate || "",
    endDate || "",
  ].join(":");
}

/* =========================================================
   HELPERS
========================================================= */

function formatNumber(value) {
  if (
    value === undefined ||
    value === null ||
    Number.isNaN(Number(value))
  ) {
    return "-";
  }

  return Number(value).toLocaleString();
}

function formatPercentage(value) {
  if (
    value === undefined ||
    value === null ||
    Number.isNaN(Number(value))
  ) {
    return "0%";
  }

  return `${Number(value).toFixed(1)}%`;
}

function normalizeMetricSeries(response, days) {
  const metrics = Array.isArray(response)
    ? response
    : response?.metrics || response?.data?.metrics || [];

  const dailyTotals = new Map();
  metrics.forEach((item) => {
    const date = new Date(item.bucket || item.timestamp || item.date);
    if (Number.isNaN(date.getTime())) return;
    const dayKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    dailyTotals.set(
      dayKey,
      (dailyTotals.get(dayKey) || 0) +
        (Number(item.count ?? item.evaluations ?? item.value) || 0)
    );
  });

  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (days - index - 1));
    const dayKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      bucket: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: dailyTotals.get(dayKey) || 0,
    };
  });
}

/* =========================================================
   STAT TILE
========================================================= */

function StatTile({ title, value, hint }) {
  return (
    <article
      className="stat-card"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        minHeight: 110,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "var(--muted)",
          fontWeight: 500,
        }}
      >
        {title}
      </span>

      <strong
        style={{
          fontSize: 22,
          marginTop: 8,
        }}
      >
        {value}
      </strong>

      {hint ? (
        <small
          style={{
            color: "var(--muted)",
            marginTop: 6,
          }}
        >
          {hint}
        </small>
      ) : null}
    </article>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({ message }) {
  return (
    <div
      style={{
        minHeight: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted)",
        fontSize: 14,
        textAlign: "center",
        padding: 20,
      }}
    >
      {message}
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function AllFlagEvaluations({
  flags: ownedFlags = [],
  selectedEnvironment = "",
  onNavigate,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [flagMetrics, setFlagMetrics] = useState({});
  const [longRangeMetrics, setLongRangeMetrics] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricRange, setMetricRange] = useState(DAYS);
  const [analyticsRange, setAnalyticsRange] = useState("7");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [selectedFlagId, setSelectedFlagId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const analyticsEnvironment = "";
  const customRange =
    analyticsRange === "custom" && customStartDate && customEndDate
      ? { startDate: customStartDate, endDate: customEndDate }
      : {};
  const customDaySpan =
    customStartDate && customEndDate
      ? Math.ceil(
          (new Date(customEndDate) - new Date(customStartDate)) /
            (24 * 60 * 60 * 1000)
        ) + 1
      : 0;
  const analyticsDays =
    analyticsRange === "custom"
      ? Math.max(1, customDaySpan || DAYS)
      : Number(analyticsRange);

  const usedData = data;

  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    let active = true;
    const cacheKey = analyticsCacheKey({
      environment: analyticsEnvironment,
      days: analyticsDays,
      ...customRange,
    });
    const cachedResponse = analyticsCache.get(cacheKey);
    if (cachedResponse) {
      setData(cachedResponse);
      setLoading(false);
      setError("");
    } else {
      setLoading(true);
    }

    async function loadMetrics() {
      try {
        const response = await fetchAllFlagsMetrics(
          analyticsDays,
          analyticsEnvironment,
          customRange
        );

        if (!active) return;

        analyticsCache.set(cacheKey, response || null);
        setData(response || null);
        if (response && Array.isArray(response.flags) && response.flags.length) {
          setSelectedFlagId(response.flags[0].flag_id);
        }
      } catch (err) {
        if (!active) return;

        setError(
          err?.message ||
            "Unable to load evaluation analytics. Please try again."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadMetrics();

    return () => {
      active = false;
    };
  }, [
    selectedEnvironment,
    analyticsDays,
    analyticsRange,
    customStartDate,
    customEndDate,
  ]);

  useEffect(() => {
    if (analyticsRange !== "7" || customRange.startDate) return;
    const cacheKey = analyticsCacheKey({
      environment: analyticsEnvironment,
      days: 30,
    });
    if (analyticsCache.has(cacheKey)) return;
    fetchAllFlagsMetrics(30, analyticsEnvironment).then((response) => {
      analyticsCache.set(cacheKey, response || null);
    }).catch(() => {
      // The selected range remains the source of truth if prefetch fails.
    });
  }, [analyticsRange, selectedEnvironment, customRange.startDate]);

  const allFlags = useMemo(() => {
    const metricsFlags = Array.isArray(data?.flags) ? data.flags : [];
    const byId = new Map();

    ownedFlags.forEach((flag) => {
      const id = flag.id ?? flag.flag_id;
      if (id !== undefined && id !== null) {
        byId.set(String(id), {
          flag_id: id,
          flag_key: flag.key ?? flag.flag_key ?? flag.name ?? flag.flag_name,
          flag_name: flag.name ?? flag.flag_name,
          status: flag.enabled === false || flag.is_enabled === false ? "inactive" : "active",
          total: 0,
          environments: {},
        });
      }
    });

    metricsFlags.forEach((flag) => {
      const id = flag.flag_id ?? flag.id;
      if (id !== undefined && id !== null) {
        byId.set(String(id), { ...byId.get(String(id)), ...flag, flag_id: id });
      }
    });

    return Array.from(byId.values());
  }, [data, ownedFlags]);

  useEffect(() => {
    setSelectedFlagId((current) => {
      if (allFlags.some((flag) => String(flag.flag_id) === String(current))) {
        return current;
      }
      return allFlags[0]?.flag_id ?? null;
    });
  }, [allFlags]);

  const selectedFlag = useMemo(
    () => allFlags.find((flag) => String(flag.flag_id) === String(selectedFlagId)),
    [allFlags, selectedFlagId]
  );

  useEffect(() => {
    let active = true;

    async function loadLongRangeMetrics() {
      if (!selectedFlag) {
        setLongRangeMetrics([]);
        return;
      }

      try {
        const response = await fetchFlagMetrics(
          selectedFlag.flag_id,
          30,
          analyticsEnvironment
        );
        if (active) {
          setLongRangeMetrics(normalizeMetricSeries(response, 30));
        }
      } catch (err) {
        console.warn(`Failed to load 30-day metrics for flag ${selectedFlag.flag_id}`, err);
        if (active) setLongRangeMetrics([]);
      }
    }

    loadLongRangeMetrics();
    return () => {
      active = false;
    };
  }, [selectedFlag, selectedEnvironment]);

  const selectedFlagSeries = metricRange === 30
    ? longRangeMetrics
    : flagMetrics[String(selectedFlagId)] || [];
  const chartSeries = selectedFlagSeries.slice(-metricRange);
  const selectedFlagSevenDayTotal = (flagMetrics[String(selectedFlagId)] || []).reduce(
    (total, item) => total + (Number(item.count) || 0),
    0
  );
  const selectedFlagThirtyDayTotal = longRangeMetrics.reduce(
    (total, item) => total + (Number(item.count) || 0),
    0
  );
  const selectedFlagRollout = selectedFlag?.rollout_percentage
    ?? ownedFlags.find((flag) => String(flag.id ?? flag.flag_id) === String(selectedFlagId))?.rollout_percentage
    ?? 100;
  const selectedFlagEnabled = selectedFlag?.status !== "inactive"
    && ownedFlags.find((flag) => String(flag.id ?? flag.flag_id) === String(selectedFlagId))?.enabled !== false;
  const environmentComparison = useMemo(() => {
    const totals = selectedFlag?.environments || {};
    return ["development", "staging", "production"].map((environment) => ({
      environment: environment[0].toUpperCase() + environment.slice(1),
      evaluations: Object.entries(totals).reduce(
        (sum, [name, count]) =>
          name.toLowerCase() === environment ? sum + (Number(count) || 0) : sum,
        0
      ),
    }));
  }, [selectedFlag]);

  useEffect(() => {
    let active = true;

    async function loadFlagMetrics() {
      if (!allFlags.length) {
        setFlagMetrics({});
        setMetricsLoading(false);
        return;
      }

      setMetricsLoading(true);
      const results = await Promise.all(
        allFlags.map(async (flag) => {
          try {
            const response = await fetchFlagMetrics(
              flag.flag_id,
              DAYS,
              analyticsEnvironment
            );
            return [
              String(flag.flag_id),
              normalizeMetricSeries(response, DAYS),
            ];
          } catch (err) {
            console.warn(`Failed to load metrics for flag ${flag.flag_id}`, err);
            return [String(flag.flag_id), []];
          }
        })
      );

      if (active) {
        setFlagMetrics(Object.fromEntries(results));
        setMetricsLoading(false);
      }
    }

    loadFlagMetrics();

    return () => {
      active = false;
    };
  }, [allFlags, selectedEnvironment]);

  /* =======================================================
     FLAGS
  ======================================================= */

  const flags = allFlags;

  /* =======================================================
     FILTER FLAGS
  ======================================================= */

  const filteredFlags = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return flags.filter((flag) => {
      const status = flag.status || "active";

      if (
        statusFilter === "active" &&
        status !== "active"
      ) {
        return false;
      }

      if (
        statusFilter === "inactive" &&
        status !== "inactive"
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const flagKey = String(
        flag.flag_key || ""
      ).toLowerCase();

      const flagName = String(
        flag.flag_name || ""
      ).toLowerCase();

      return (
        flagKey.includes(query) ||
        flagName.includes(query)
      );
    });
  }, [flags, searchTerm, statusFilter]);

  /* =======================================================
     ENVIRONMENT DATA
  ======================================================= */

  const environmentData = useMemo(() => {
    const totals = {};

    flags.forEach((flag) => {
      const environments = flag.environments || {};

      Object.entries(environments).forEach(
        ([environment, count]) => {
          const numericCount = Number(count) || 0;

          totals[environment] =
            (totals[environment] || 0) +
            numericCount;
        }
      );
    });

    return Object.entries(totals)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [flags]);

  /* =======================================================
     TOTAL EVALUATIONS
  ======================================================= */

  const totalEvaluations = useMemo(() => {
    if (usedData?.total_evaluations !== undefined) {
      return Number(usedData.total_evaluations) || 0;
    }

    return flags.reduce(
      (total, flag) =>
        total + (Number(flag.total) || 0),
      0
    );
  }, [usedData, flags]);

  /* =======================================================
     REAL TIME SERIES
     
     Backend can return any of these:
     
     data.daily_evaluations
     data.evaluation_series
     data.timeseries
  ======================================================= */

  const timeseries = useMemo(() => {
    const rawSeries =
      usedData?.daily_evaluations ||
      usedData?.evaluation_series ||
      usedData?.timeseries ||
      [];

    if (!Array.isArray(rawSeries)) {
      return [];
    }

    return rawSeries
      .map((item) => {
        const date =
          item.date ||
          item.day ||
          item.timestamp ||
          item.label;

        const value =
          item.evaluations ??
          item.evaluation_count ??
          item.count ??
          item.value ??
          0;

        return {
          date: date ? String(date) : "",
          evaluations: Number(value) || 0,
        };
      })
      .filter((item) => item.date);
  }, [data]);

  /* =======================================================
     AVERAGE PER DAY
  ======================================================= */

  const averagePerDay = useMemo(() => {
    if (timeseries.length > 0) {
      const total = timeseries.reduce(
        (sum, item) =>
          sum + item.evaluations,
        0
      );

      return Math.round(
        total / timeseries.length
      );
    }

    return Math.round(
      totalEvaluations / analyticsDays
    );
  }, [timeseries, totalEvaluations, analyticsDays]);

  /* =======================================================
     PEAK DAY
  ======================================================= */

  const peakDay = useMemo(() => {
    if (!timeseries.length) {
      return null;
    }

    return timeseries.reduce(
      (peak, current) => {
        return current.evaluations >
          peak.evaluations
          ? current
          : peak;
      }
    );
  }, [timeseries]);

  /* =======================================================
     FLAG COUNTS
  ======================================================= */

  const totalFlags =
    Number(data?.owned_flags_count) ||
    flags.length;

  const activeFlags =
    Number(data?.active_flags_count) ||
    flags.filter(
      (flag) =>
        (flag.status || "active") ===
        "active"
    ).length;

  const inactiveFlags = Math.max(
    0,
    totalFlags - activeFlags
  );

  /* =======================================================
     MOST / LEAST EVALUATED
  ======================================================= */

  const mostEvaluatedFlag = useMemo(() => {
    if (!flags.length) {
      return null;
    }

    return [...flags].sort(
      (a, b) =>
        (Number(b.total) || 0) -
        (Number(a.total) || 0)
    )[0];
  }, [flags]);

  const leastEvaluatedFlag = useMemo(() => {
    if (!flags.length) {
      return null;
    }

    return [...flags].sort(
      (a, b) =>
        (Number(a.total) || 0) -
        (Number(b.total) || 0)
    )[0];
  }, [flags]);

  /* =======================================================
     ENVIRONMENT TABLE
  ======================================================= */

  const environmentTableData = useMemo(() => {
    return environmentData.map((item) => ({
      ...item,

      percentage:
        totalEvaluations > 0
          ? (item.value /
              totalEvaluations) *
            100
          : 0,
    }));
  }, [environmentData, totalEvaluations]);

  /* =======================================================
     TOP FLAGS
  ======================================================= */

  const topFlags = useMemo(() => {
    return flags
      .map((flag) => ({
        id: flag.flag_id,

        name:
          flag.flag_key ||
          flag.flag_name ||
          "Unknown Flag",

        value: Number(flag.total) || 0,

        status:
          flag.status || "active",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [flags]);

  /* =======================================================
     CSV EXPORT
  ======================================================= */

  function handleExportCSV() {
    if (!flags.length) {
      return;
    }

    const headers = [
      "Flag",
      "Status",
      "Total Evaluations",
    ];

    const rows = flags.map((flag) => [
      flag.flag_key || "",
      flag.status || "active",
      Number(flag.total) || 0,
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value).replace(
                /"/g,
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "flag-evaluations.csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="content-page all-evaluations-page">
      {/* =====================================================
          BREADCRUMBS
      ====================================================== */}

      <div className="breadcrumbs">
        <button
          type="button"
          onClick={() =>
            onNavigate("/landing")
          }
        >
          Landing
        </button>

        <span>/</span>

        <span>Analysis</span>

        <span>/</span>

        <strong>
          All Flag Evaluations
        </strong>
      </div>

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>
            All Flag Evaluations
          </h1>

          <p className="page-subtitle">
            Track evaluation activity
            across all feature flags &
            environments.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {[7, 30].map((days) => (
            <button
              key={days}
              type="button"
              className={analyticsRange === String(days) ? "primary-button" : "secondary-button"}
              onClick={() => setAnalyticsRange(String(days))}
            >
              Last {days} Days
            </button>
          ))}
          <button
            type="button"
            className={analyticsRange === "custom" ? "primary-button" : "secondary-button"}
            onClick={() => setAnalyticsRange("custom")}
          >
            Custom Dates
          </button>
          {analyticsRange === "custom" ? (
            <>
              <input
                type="date"
                aria-label="Analytics start date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
              />
              <input
                type="date"
                aria-label="Analytics end date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
              />
            </>
          ) : null}

          <button
            type="button"
            className="secondary-button"
            onClick={
              handleExportCSV
            }
            disabled={!flags.length}
          >
            Export CSV
          </button>

        </div>
      </header>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error ? (
        <div
          className="flag-section-card"
          style={{
            marginTop: 16,
            border:
              "1px solid #fecaca",
            background: "#fff7f7",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      <section className="flag-section-card analytics-overview-card all-evaluations-overview" style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            paddingBottom: 18,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Evaluation Metrics &amp; Analytics</h2>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Inspect invocation counts and evaluation activity for your feature flags.
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
            <span>Select Flag:</span>
            <select
              className="filter-select"
              value={selectedFlagId ?? ""}
              onChange={(event) => setSelectedFlagId(event.target.value)}
              disabled={!allFlags.length}
            >
              {!allFlags.length ? <option value="">No flags available</option> : null}
              {allFlags.map((flag) => (
                <option key={flag.flag_id} value={flag.flag_id}>
                  {flag.flag_key || flag.flag_name || `Flag ${flag.flag_id}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="evaluation-summary-grid">
          <StatTile
            title="Current Status"
            value={selectedFlag ? (selectedFlagEnabled ? "Active (Enabled)" : "Inactive (Disabled)") : "-"}
            hint={selectedFlag?.flag_key || "Select a flag"}
          />
          <StatTile
            title="Rollout Percentage"
            value={`${Math.max(0, Math.min(100, Number(selectedFlagRollout) || 0))}% Rollout`}
            hint="Configured rollout"
          />
          <StatTile
            title="7-Day Invocations"
            value={formatNumber(selectedFlagSevenDayTotal)}
            hint="Selected flag"
          />
          <StatTile
            title="30-Day Invocations"
            value={formatNumber(selectedFlagThirtyDayTotal)}
            hint="Selected flag"
          />
        </div>

        <div className="flag-section-card" style={{ marginTop: 18, background: "var(--surface)" }}>
          <div className="card-header">
            <h3 style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 13 }}>
              Evaluation Traffic Curve
            </h3>
            <div style={{ display: "flex", gap: 6 }}>
              {[7, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={metricRange === days ? "primary-button" : "secondary-button"}
                  onClick={() => setMetricRange(days)}
                >
                  Last {days} Days
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 310, marginTop: 12 }}>
            {selectedFlag ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="evaluationTrafficFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [formatNumber(value), "Invocations"]} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#7c3aed"
                    strokeWidth={3}
                    fill="url(#evaluationTrafficFill)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={selectedFlag ? "No evaluations for this flag in the selected period." : "Select a flag to view its graph."} />
            )}
          </div>
        </div>
      </section>

      <section className="flag-section-card" style={{ marginTop: 18 }}>
        <div className="card-header">
          <div>
            <h2>Evaluations by Environment</h2>
            <p className="page-subtitle">
              Compare evaluation volume across Development, Staging, and Production.
            </p>
          </div>
        </div>
        <div style={{ height: 300, marginTop: 12 }}>
          {selectedFlag ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={environmentComparison} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="environment" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => [formatNumber(value), "Evaluations"]} />
                <Bar dataKey="evaluations" fill="#5b5bf0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Select a flag to compare environments." />
          )}
        </div>
      </section>

      {false && (
      /* =====================================================
          MAIN GRID
      ====================================================== */

      <div
        className="rollout-page-grid"
        style={{ marginTop: 18 }}
      >
        {/* ===================================================
            LEFT COLUMN
        ==================================================== */}

        <div className="left-column">
          {/* =================================================
              FEATURE FLAG LIST
          ================================================== */}

          <div className="flag-section-card">
            <div className="card-header">
              <div>
                <h3>
                  Select a Feature Flag
                </h3>

                <p className="page-subtitle">
                  Choose a flag to inspect
                </p>
              </div>
            </div>

            <div className="flag-select-box" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="selected-flag" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', padding: 10, borderRadius: 12, border: '1px solid var(--border)', flex: 1 }}>
                <div className="flag-avatar" style={{ width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#eef2ff,#eef6ff)', color: '#5b5bf0', fontWeight: 800 }}>{String(selectedFlag?.flag_key || selectedFlag?.flag_name || selectedFlagId || '—').slice(0, 1).toUpperCase()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{selectedFlag?.flag_key || selectedFlag?.flag_name || selectedFlagId || 'Select a flag'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{selectedFlag?.flag_key || ''}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span className="badge" style={{ background: '#e8fdf5', color: '#059669', border: '1px solid rgba(5,150,105,0.08)' }}>{selectedFlag?.status === 'inactive' ? 'Inactive' : 'Active'}</span>
                </div>
                <div className="select-caret" style={{ marginLeft: 8, color: 'var(--muted)' }}>▾</div>
              </div>

              <div className="days-toggle" style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={"secondary-button" + (DAYS === 7 ? ' active' : '')}>7 Days</button>
                <button type="button" className={"secondary-button" + (DAYS === 30 ? ' active' : '')}>30 Days</button>
              </div>
            </div>

            {/* Search */}
            <div
              style={{
                marginTop: 12,
              }}
            >
              <input
                type="text"
                placeholder="Search feature flags..."
                className="filter-input"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
              />
            </div>

            {/* Status Filters */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 10,
              }}
            >
              <button
                type="button"
                className={
                  statusFilter === "all"
                    ? "primary-button"
                    : "secondary-button"
                }
                onClick={() =>
                  setStatusFilter("all")
                }
              >
                All
              </button>

              <button
                type="button"
                className={
                  statusFilter ===
                  "active"
                    ? "primary-button"
                    : "secondary-button"
                }
                onClick={() =>
                  setStatusFilter(
                    "active"
                  )
                }
              >
                Active
              </button>

              <button
                type="button"
                className={
                  statusFilter ===
                  "inactive"
                    ? "primary-button"
                    : "secondary-button"
                }
                onClick={() =>
                  setStatusFilter(
                    "inactive"
                  )
                }
              >
                Inactive
              </button>
            </div>

            {/* Flag List */}
            <div
              style={{
                marginTop: 12,
              }}
            >
              {loading ? (
                <div className="placeholder">
                  Loading flags...
                </div>
              ) : filteredFlags.length >
                0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: 8,
                    maxHeight: 420,
                    overflowY: "auto",
                    paddingRight: 6,
                  }}
                >
                  {filteredFlags
                    .slice(0, 200)
                    .map((flag) => {
                      const status =
                        flag.status ||
                        "active";

                      return (
                        <button
                          key={
                            flag.flag_id
                          }
                          type="button"
                          className="card-list-item flag-list-item"
                          style={{
                            justifyContent:
                              "space-between",
                            padding:
                              "10px 12px",
                            borderRadius: 10,
                            background:
                              (selectedFlagId === flag.flag_id ? 'linear-gradient(90deg, rgba(99,78,255,0.06), rgba(123,97,255,0.03))' : 'transparent'),
                            border:
                              "1px solid var(--border)",
                            cursor:
                              "pointer",
                            textAlign:
                              "left",
                            width: "100%",
                          }}
                          onClick={() => {
                            setSelectedFlagId(flag.flag_id);
                            onNavigate(
                              `/flags/${flag.flag_id}`
                            );
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              gap: 10,
                              alignItems:
                                "center",
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                minWidth: 36,
                                borderRadius:
                                  8,
                                background:
                                  "#eef2ff",
                                display:
                                  "grid",
                                placeItems:
                                  "center",
                                color:
                                  "#5b5bf0",
                                fontWeight:
                                  800,
                              }}
                            >
                              {(
                                flag.flag_key ||
                                "?"
                              )
                                .slice(
                                  0,
                                  1
                                )
                                .toUpperCase()}
                            </div>

                            <div
                              style={{
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight:
                                    700,
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {flag.flag_key ||
                                  flag.flag_name ||
                                  "Unnamed Flag"}
                              </div>

                              <div
                                style={{
                                  color:
                                    "var(--muted)",
                                  fontSize: 13,
                                  marginTop: 2,
                                }}
                              >
                                {formatNumber(
                                  flag.total
                                )}{" "}
                                evaluations
                              </div>
                            </div>
                          </div>

                          <span
                            style={{
                              background:
                                status ===
                                "inactive"
                                  ? "#fff0f0"
                                  : "#ecfdf0",
                              color:
                                status ===
                                "inactive"
                                  ? "#dc2626"
                                  : "#16a34a",
                              padding:
                                "6px 8px",
                              borderRadius: 8,
                              fontSize: 12,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {status ===
                            "inactive"
                              ? "Inactive"
                              : "Active"}
                          </span>
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div className="placeholder">
                  No flags found
                </div>
              )}
            </div>
          </div>

          {/* =================================================
              ENVIRONMENT SUMMARY
          ================================================== */}

          <div className="flag-section-card">
            <h3>
              Evaluation Activity by
              Environment
            </h3>

            <div
              style={{
                marginTop: 12,
              }}
            >
              {loading ? (
                <div className="placeholder">
                  Loading...
                </div>
              ) : environmentTableData.length >
                0 ? (
                <table className="env-config-table">
                  <tbody>
                    {environmentTableData.map(
                      (environment) => (
                        <tr
                          key={
                            environment.name
                          }
                        >
                          <td
                            style={{
                              padding:
                                "10px 8px",
                              fontWeight:
                                700,
                              textTransform:
                                "capitalize",
                            }}
                          >
                            {
                              environment.name
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "10px 8px",
                            }}
                          >
                            {formatNumber(
                              environment.value
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                "10px 8px",
                              width: 140,
                            }}
                          >
                            <div
                              style={{
                                height: 8,
                                background:
                                  "#f3f4f6",
                                borderRadius:
                                  6,
                                overflow:
                                  "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(
                                    100,
                                    environment.percentage
                                  )}%`,
                                  height:
                                    "100%",
                                  background:
                                    "#5b5bf0",
                                  borderRadius:
                                    6,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              ) : (
                <EmptyState message="No environment analytics available." />
              )}
            </div>
          </div>

          <div className="flag-section-card" style={{ marginTop: 12 }}>
            <div className="card-header">
              <div>
                <h3>Evaluation Trend</h3>
                <p className="page-subtitle">
                  Select a feature flag to view its hourly evaluation volume.
                </p>
              </div>
            </div>

            {allFlags.length ? (
              <>
                <label
                  htmlFor="all-flag-evaluation-select"
                  style={{ display: "block", fontWeight: 700, marginTop: 16 }}
                >
                  Feature flag
                </label>
                <select
                  id="all-flag-evaluation-select"
                  className="filter-select"
                  value={selectedFlagId ?? ""}
                  onChange={(event) => setSelectedFlagId(event.target.value)}
                  style={{ marginTop: 8, width: "100%", maxWidth: 420 }}
                >
                  {allFlags.map((flag) => (
                    <option key={flag.flag_id} value={flag.flag_id}>
                      {flag.flag_key || flag.flag_name || `Flag ${flag.flag_id}`}
                    </option>
                  ))}
                </select>

                <div style={{ height: 300, marginTop: 16 }}>
                  {metricsLoading && !Object.keys(flagMetrics).length ? (
                    <div className="placeholder">Loading graph...</div>
                  ) : selectedFlag ? (
                    (flagMetrics[String(selectedFlag.flag_id)] || []).length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={flagMetrics[String(selectedFlag.flag_id)]}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value) => [formatNumber(value), "Evaluations"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#5b5bf0"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState message="No evaluations for this flag in the selected period." />
                    )
                  ) : (
                    <EmptyState message="Select a feature flag to view its graph." />
                  )}
                </div>
              </>
            ) : metricsLoading ? (
              <div className="placeholder" style={{ marginTop: 16 }}>
                Loading flags...
              </div>
            ) : (
              <EmptyState message="No feature flags found." />
            )}
          </div>
        </div>

        {/* ===================================================
            RIGHT COLUMN
        ==================================================== */}

        <div className="right-column">
          {/* =================================================
              STAT CARDS
          ================================================== */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <StatTile
              title="Total Evaluations"
              value={formatNumber(
                totalEvaluations
              )}
              hint={`Last ${analyticsDays} days`}
            />

            <StatTile
              title="Average / Day"
              value={formatNumber(
                averagePerDay
              )}
              hint={`Last ${analyticsDays} days`}
            />

            <StatTile
              title="Peak Day"
              value={
                peakDay?.date || "-"
              }
              hint={
                peakDay
                  ? `${formatNumber(
                      peakDay.evaluations
                    )} evaluations`
                  : "No trend data"
              }
            />

            <StatTile
              title="Peak Evaluations"
              value={formatNumber(
                peakDay?.evaluations
              )}
              hint={
                peakDay?.date
                  ? `On ${peakDay.date}`
                  : "No trend data"
              }
            />
          </div>

          {/* =================================================
              CHART ROW
          ================================================== */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "2fr 1fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            {/* Evaluation Trend */}
            <div className="flag-section-card">
              <div className="card-header">
                <h3>
                  Evaluation Count Over
                  Time
                </h3>
              </div>

              <div
                style={{
                  height: 280,
                  marginTop: 8,
                }}
              >
                {loading ? (
                  <div className="placeholder">
                    Loading chart...
                  </div>
                ) : timeseries.length >
                  0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart
                      data={timeseries}
                      margin={{
                        top: 10,
                        right: 20,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                      />

                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 12,
                        }}
                      />

                      <YAxis
                        tick={{
                          fontSize: 12,
                        }}
                      />

                      <Tooltip
                        formatter={(
                          value
                        ) => [
                          formatNumber(
                            value
                          ),
                          "Evaluations",
                        ]}
                      />

                      <Line
                        type="monotone"
                        dataKey="evaluations"
                        stroke="#5b5bf0"
                        strokeWidth={3}
                        dot={{
                          r: 3,
                        }}
                        activeDot={{
                          r: 5,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No daily evaluation trend data is available from the backend." />
                )}
              </div>
            </div>

            {/* Environment Pie */}
            <div className="flag-section-card">
              <div className="card-header">
                <h3>
                  Evaluations by
                  Environment
                </h3>
              </div>

              <div
                style={{
                  height: 280,
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                }}
              >
                {loading ? (
                  <div className="placeholder">
                    Loading...
                  </div>
                ) : environmentData.length >
                  0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={
                          environmentData
                        }
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {environmentData.map(
                          (
                            entry,
                            index
                          ) => (
                            <Cell
                              key={`environment-${index}`}
                              fill={
                                COLORS[
                                  index %
                                    COLORS.length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip
                        formatter={(
                          value
                        ) =>
                          formatNumber(
                            value
                          )
                        }
                      />

                      <Legend
                        verticalAlign="bottom"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No environment data available." />
                )}
              </div>
            </div>
          </div>

          {/* =================================================
              ENVIRONMENT TABLE + FLAG SUMMARY
          ================================================== */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 320px",
              gap: 12,
              marginTop: 12,
            }}
          >
            {/* Environment Table */}
            <div className="flag-section-card">
              <h3>
                Evaluation Activity by
                Environment
              </h3>

              <div
                style={{
                  marginTop: 12,
                }}
              >
                {loading ? (
                  <div className="placeholder">
                    Loading...
                  </div>
                ) : environmentTableData.length >
                  0 ? (
                  <table className="exact-table">
                    <thead>
                      <tr>
                        <th>
                          Environment
                        </th>

                        <th>
                          Evaluations
                        </th>

                        <th>
                          Percentage
                        </th>

                        <th>
                          Distribution
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {environmentTableData.map(
                        (environment) => (
                          <tr
                            key={
                              environment.name
                            }
                          >
                            <td
                              style={{
                                padding: 12,
                                textTransform:
                                  "capitalize",
                                fontWeight:
                                  600,
                              }}
                            >
                              {
                                environment.name
                              }
                            </td>

                            <td
                              style={{
                                padding: 12,
                              }}
                            >
                              {formatNumber(
                                environment.value
                              )}
                            </td>

                            <td
                              style={{
                                padding: 12,
                              }}
                            >
                              {formatPercentage(
                                environment.percentage
                              )}
                            </td>

                            <td
                              style={{
                                padding: 12,
                              }}
                            >
                              <div
                                style={{
                                  width: 120,
                                  height: 8,
                                  background:
                                    "#f3f4f6",
                                  borderRadius:
                                    6,
                                  overflow:
                                    "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      environment.percentage
                                    )}%`,
                                    height:
                                      "100%",
                                    background:
                                      "#5b5bf0",
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState message="No environment analytics available." />
                )}
              </div>
            </div>

            {/* All Flags Summary */}
            <div className="flag-section-card">
              <h3>
                All Flags Summary
              </h3>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                  }}
                >
                  <span>
                    Total Flags
                  </span>

                  <strong>
                    {formatNumber(
                      totalFlags
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                  }}
                >
                  <span>
                    Active Flags
                  </span>

                  <strong>
                    {formatNumber(
                      activeFlags
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                  }}
                >
                  <span>
                    Inactive Flags
                  </span>

                  <strong>
                    {formatNumber(
                      inactiveFlags
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: 12,
                  }}
                >
                  <span>
                    Most Evaluated
                  </span>

                  <strong
                    style={{
                      maxWidth: 150,
                      overflow:
                        "hidden",
                      textOverflow:
                        "ellipsis",
                      whiteSpace:
                        "nowrap",
                    }}
                    title={
                      mostEvaluatedFlag?.flag_key ||
                      ""
                    }
                  >
                    {mostEvaluatedFlag?.flag_key ||
                      "-"}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: 12,
                  }}
                >
                  <span>
                    Least Evaluated
                  </span>

                  <strong
                    style={{
                      maxWidth: 150,
                      overflow:
                        "hidden",
                      textOverflow:
                        "ellipsis",
                      whiteSpace:
                        "nowrap",
                    }}
                    title={
                      leastEvaluatedFlag?.flag_key ||
                      ""
                    }
                  >
                    {leastEvaluatedFlag?.flag_key ||
                      "-"}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================
              TOP FLAGS
          ================================================== */}

          <div
            className="flag-section-card"
            style={{
              marginTop: 12,
            }}
          >
            <div className="card-header">
              <div>
                <h3>
                  Most Evaluated Feature
                  Flags
                </h3>

                <p className="page-subtitle">
                  Top flags by evaluation
                  count
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 12,
                marginTop: 14,
              }}
            >
              {topFlags.length > 0 ? (
                topFlags.map(
                  (flag, index) => (
                    <button
                      key={flag.id}
                      type="button"
                      onClick={() =>
                        onNavigate(
                          `/flags/${flag.id}`
                        )
                      }
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 12,
                        padding: 12,
                        border:
                          "1px solid var(--border)",
                        borderRadius: 10,
                        background:
                          "transparent",
                        cursor:
                          "pointer",
                        textAlign:
                          "left",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          minWidth: 36,
                          borderRadius:
                            8,
                          background:
                            "#eef2ff",
                          display:
                            "grid",
                          placeItems:
                            "center",
                          color:
                            COLORS[
                              index %
                                COLORS.length
                            ],
                          fontWeight:
                            800,
                        }}
                      >
                        {index + 1}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontWeight:
                              700,
                            overflow:
                              "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace:
                              "nowrap",
                          }}
                          title={
                            flag.name
                          }
                        >
                          {flag.name}
                        </div>

                        <div
                          style={{
                            color:
                              "var(--muted)",
                            fontSize: 13,
                            marginTop: 3,
                          }}
                        >
                          {formatNumber(
                            flag.value
                          )}{" "}
                          evaluations
                        </div>
                      </div>
                    </button>
                  )
                )
              ) : (
                <div
                  style={{
                    gridColumn:
                      "1 / -1",
                  }}
                >
                  <EmptyState message="No flag evaluation data available." />
                </div>
              )}
            </div>
          </div>

          {/* Automated analysis */}
          <div
            className="flag-section-card"
            style={{ marginTop: 12 }}
          >
            <h3>Automated Analysis</h3>
            <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
              <p>
                Average evaluations per day (last {analyticsDays} days): <strong>{formatNumber(averagePerDay)}</strong>.
              </p>
              <p>
                Peak day: <strong>{peakDay ? `${peakDay.date} (${formatNumber(peakDay.evaluations)} evaluations)` : 'n/a'}</strong>.
              </p>
              <p>
                Most evaluated flag: <strong>{mostEvaluatedFlag?.flag_key || mostEvaluatedFlag?.flag_name || '-'}</strong> with <strong>{formatNumber(mostEvaluatedFlag?.total || mostEvaluatedFlag?.value || 0)}</strong> evaluations.
              </p>
              <p>
                Top environments by evaluation volume: <strong>{environmentData.slice(0,3).map(e => e.name).join(', ') || 'n/a'}</strong>.
              </p>

              <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '12px 0' }} />

              <h4 style={{ marginTop: 0 }}>Actionable insights</h4>
              <ul style={{ marginTop: 8 }}>
                <li>Consider reviewing <strong>{mostEvaluatedFlag?.flag_key || '—'}</strong> for performance or telemetry sampling because it accounts for a large portion of evaluations.</li>
                <li>If a single environment dominates evaluations (e.g., production), ensure sampling is configured appropriately to reduce load.</li>
                <li>Investigate flags with unexpectedly low evaluation counts — they may be inactive or misconfigured.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      )}
    </main>
  );
}

export default AllFlagEvaluations;
