import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Flags from "./pages/Flags";
import Environments from "./pages/Environments";
import Evaluation from "./pages/Evaluation";
import AllFlagEvaluations from "./pages/AllFlagEvaluations";
import Analysis from "./pages/Analysis";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import FlagDetails from "./pages/FlagDetails";
import AuditLogs from "./pages/AuditLogs";
import FlagHistory from "./pages/FlagHistory";
import RolloutDetails from "./pages/RolloutDetails";
import RolloutUsers from "./pages/RolloutUsers";
import Rollouts from "./pages/Rollouts";
import CleanupSuggestions from "./pages/CleanupSuggestions";
import Profile from "./pages/Profile";
import {
  createFlag,
  deleteFlag,
  fetchCurrentUser,
  fetchEnvironments,
  fetchFlags,
  getAuthToken,
  AuthError,
  loginUser,
  signupUser,
  setAuthToken,
  updateCurrentUser,
  updateFlag,
} from "./services/api_fixed2";
import { fetchAuditLogs } from "./services/api_clean";
import "./App.css";
import "./ui-kit.css";
import { ENVIRONMENT_OPTIONS, environmentKey } from "./components/EnvironmentSwitcher";

const routeTitles = {
  "/landing": "Landing",
  "/dashboard": "Dashboard",
  "/cleanup": "Cleanup Suggestions",
  "/environments": "Environments",
  "/audit-logs": "Audit Logs",
  "/teams": "Teams",
  "/settings": "Settings",
  
};

const normaliseFlag = (flag) => ({
  ...flag,
  environment: String(flag.environment ?? "development").trim().toLowerCase().replace(/\s+/g, "_"),
  enabled: flag.enabled ?? flag.is_enabled ?? false,
  type: flag.type ?? "boolean",
  default_value: flag.default_value ?? (flag.enabled ?? flag.is_enabled ?? false),
  owner_team: flag.owner_team ?? "",
});

function SimplePage({ title, children, onNavigate }) {
  return (
    <main className="content-page">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate("/landing")}>Landing</button>
        <span>/</span>
        {title}
      </div>
      <h1>{title}</h1>
      <p className="page-subtitle">Manage your feature deployment workspace.</p>
      {children}
    </main>
  );
}

function matchFlagDetailsRoute(pathname) {
  const base = String(pathname).split("?")[0];
  const match = base.match(/^\/flags\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function matchRolloutRoute(pathname) {
  const base = String(pathname).split("?")[0];
  const match = base.match(/^\/flags\/(\d+)\/rollout$/);
  return match ? Number(match[1]) : null;
}

function matchRolloutUsersRoute(pathname) {
  const base = String(pathname).split("?")[0];
  const match = base.match(/^\/flags\/(\d+)\/rollout\/users$/);
  return match ? Number(match[1]) : null;
}

function matchAuditFlagHistoryRoute(pathname) {
  const base = String(pathname).split("?")[0];
  const match = base.match(/^\/audit-logs\/flag\/(\d+)\/history$/);
  return match ? Number(match[1]) : null;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [pathname, setPathname] = useState(() =>
    window.location.pathname === "/" ? "/home" : window.location.pathname
  );
  const [environments, setEnvironments] = useState([]);
  const [flags, setFlags] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState("development");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setPathname(path);
    window.scrollTo(0, 0);
  };

  const clearSession = (message) => {
    setAuthToken(null);
    setCurrentUser(null);
    setEnvironments([]);
    setFlags([]);
    setAuditLogs([]);
    setSelectedEnvironment("development");
    setNotice(message || "");
    navigate("/login");
  };

  useEffect(() => {
    const pop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return undefined;
    }

    let retryTimer;
    let active = true;

    async function loadData() {
      setLoading(true);
      const [environmentResult, flagResult, auditResult] = await Promise.allSettled([
        fetchEnvironments(),
        fetchFlags(),
        fetchAuditLogs(),
      ]);

      if (!active) return;

      if (environmentResult.status === "fulfilled") {
        const loadedEnvironments = Array.isArray(environmentResult.value) && environmentResult.value.length
          ? environmentResult.value
          : ENVIRONMENT_OPTIONS;
        setEnvironments(loadedEnvironments);
        if (loadedEnvironments.length) {
          const availableKeys = loadedEnvironments.map(environmentKey).filter(Boolean);
          setSelectedEnvironment((current) => availableKeys.includes(current) ? current : availableKeys[0]);
        }
      }
      if (flagResult.status === "fulfilled") {
        setFlags(flagResult.value.map(normaliseFlag));
      }
      if (auditResult.status === "fulfilled") {
        const val = auditResult.value;
        if (Array.isArray(val)) setAuditLogs(val);
        else if (val && val.items) setAuditLogs(val.items);
        else setAuditLogs([]);
      }

      const results = { environments: environmentResult, flags: flagResult, audits: auditResult };
      const failedKey = Object.keys(results).find((k) => results[k].status === "rejected");
      if (failedKey) {
        const failure = results[failedKey];
        if (failure.reason instanceof AuthError) {
          clearSession("Your session has expired. Please log in again.");
          return;
        }
        setNotice(`Some data (${failedKey}) could not be loaded. Retrying automatically...`);
        retryTimer = window.setTimeout(loadData, 3000);
      } else {
        setNotice("");
      }
      setLoading(false);
    }

    loadData();
    return () => {
      active = false;
      window.clearTimeout(retryTimer);
    };
  }, [currentUser]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;

    let active = true;
    fetchCurrentUser()
      .then((user) => {
        if (active) {
          persistUser(user);
        }
      })
      .catch(() => {
        if (active) {
          clearSession("Your session has expired. Please log in again.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const persistUser = (user) => {
    setCurrentUser(user);
  };

  const signup = async (data) => {
    await signupUser(data);
    const response = await loginUser({
      email: data.email,
      password: data.password,
    });
    setAuthToken(response.access_token);
    persistUser(response.user);
    setNotice("Account created successfully.");
    navigate("/landing");
  };

  const login = async (data) => {
    const response = await loginUser(data);
    setAuthToken(response.access_token);
    persistUser(response.user);
    navigate("/landing");
  };

  const updateUser = async (data) => {
    const updatedUser = await updateCurrentUser(data);
    persistUser(updatedUser);
    setNotice("Account updated.");
  };

  const signOut = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setEnvironments([]);
    setFlags([]);
    setAuditLogs([]);
    setSelectedEnvironment("development");
    setNotice("");
    window.history.pushState({}, "", "/home");
    setPathname("/home");
    window.scrollTo(0, 0);
  };

  const saveNewFlag = async (data) => {
    setSaving(true);
    try {
      const created = await createFlag(data);
      setFlags((items) => [normaliseFlag(created), ...items]);
      setNotice("Feature flag created successfully.");
    } finally {
      setSaving(false);
    }
  };

  const saveFlag = async (id, data) => {
    setSaving(true);
    try {
      const updated = await updateFlag(id, data);
      setFlags((items) =>
        items.map((item) => (item.id === id ? normaliseFlag(updated) : item))
      );
      setNotice("Feature flag updated successfully.");
    } finally {
      setSaving(false);
    }
  };

  const removeFlag = async (id) => {
    if (!window.confirm("Delete this feature flag?")) return;
    await deleteFlag(id);
    setFlags((items) => items.filter((item) => item.id !== id));
    setNotice("Feature flag deleted.");
  };

  if (!currentUser) {
    if (pathname === "/login") {
      return <Login onLogin={login} onNavigate={navigate} />;
    }
    if (pathname === "/signup") {
      return <Signup onSignup={signup} onNavigate={navigate} />;
    }
    // Protected routes must not render public content after a missing or
    // expired token; send the user to the login screen instead.
    if (pathname !== "/home" && pathname !== "/") {
      return <Login onLogin={login} onNavigate={navigate} />;
    }
    return <Home onNavigate={navigate} />;
  }

  if (pathname === "/home") {
    return <Home onNavigate={navigate} />;
  }

  const flagDetailsId = matchFlagDetailsRoute(pathname);
  const rolloutId = matchRolloutRoute(pathname);
  const rolloutUsersId = matchRolloutUsersRoute(pathname);
  const auditFlagHistoryId = matchAuditFlagHistoryRoute(pathname);
  const activePath = pathname === "/signup" ? "/landing" : flagDetailsId ? "/flags" : pathname;
  const page =
    rolloutUsersId ? (
      <RolloutUsers flagId={rolloutUsersId} onNavigate={navigate} />
    ) : rolloutId ? (
      <RolloutDetails flagId={rolloutId} onNavigate={navigate} />
    ) : flagDetailsId ? (
      <FlagDetails
        flagId={flagDetailsId}
        actor={currentUser?.email || currentUser?.name || "system"}
        selectedEnvironment={selectedEnvironment}
        onNavigate={navigate}
        onFlagChanged={() => {}}
      />
    ) : activePath === "/profile" ? (
      <Profile user={currentUser} onUserUpdate={updateUser} onSignOut={signOut} onNavigate={navigate} />
    ) : activePath === "/landing" ? (
      <Landing user={currentUser} flags={flags} environments={environments} onNavigate={navigate} />
    ) : activePath === "/dashboard" || activePath === "/flags/new" ? (
      <Dashboard
        flags={flags}
        environments={environments}
        selectedEnvironment={selectedEnvironment}
        onSelectEnvironment={setSelectedEnvironment}
        loading={loading}
        saving={saving}
        notice={notice}
        onNewFlag={saveNewFlag}
        onEditFlag={saveFlag}
        onDeleteFlag={removeFlag}
        onNavigate={navigate}
        onOpenFlag={(id) => navigate(`/flags/${id}`)}
        startCreate={activePath === "/flags/new"}
      />
    ) : activePath === "/flags" ? (
      <Flags
        flags={flags}
        environments={environments}
        selectedEnvironment={selectedEnvironment}
        onSelectEnvironment={setSelectedEnvironment}
        loading={loading}
        saving={saving}
        notice={notice}
        onNewFlag={saveNewFlag}
        onEditFlag={saveFlag}
        onDeleteFlag={removeFlag}
        onNavigate={navigate}
        onOpenFlag={(id) => navigate(`/flags/${id}`)}
      />
    ) : activePath === "/cleanup" ? (
      <CleanupSuggestions onNavigate={navigate} />
    ) : activePath === "/evaluation/all" ? (
      <AllFlagEvaluations
        flags={flags}
        selectedEnvironment={selectedEnvironment}
        onNavigate={navigate}
      />
    ) : activePath === "/analysis" ? (
      <Analysis
        flags={flags}
        selectedEnvironment={selectedEnvironment}
        onNavigate={navigate}
      />
    ) : activePath === "/evaluation" ? (
      <Evaluation
        flags={flags}
        selectedEnvironment={selectedEnvironment}
        onNavigate={navigate}
      />
    ) : activePath === "/environments" ? (
      <Environments
        selectedEnvironment={selectedEnvironment}
        onSelectEnvironment={setSelectedEnvironment}
        onNavigate={navigate}
      />
    ) : activePath === "/rollouts" ? (
      <Rollouts onNavigate={navigate} />
    ) : auditFlagHistoryId ? (
      <FlagHistory flagId={auditFlagHistoryId} onNavigate={navigate} />
    ) : activePath === "/audit-logs" ? (
      <AuditLogs onNavigate={navigate} selectedEnvironment={selectedEnvironment} />
    ) : (
      <SimplePage title={routeTitles[activePath] || "Dashboard"} onNavigate={navigate}>
        <div className="summary-grid">
          <article>
            <span>Total feature flags</span>
            <strong>{flags.length}</strong>
          </article>
          <article>
            <span>Enabled flags</span>
            <strong>{flags.filter((flag) => flag.enabled).length}</strong>
          </article>
          <article>
            <span>Environments</span>
            <strong>{environments.length}</strong>
          </article>
        </div>
      </SimplePage>
    );

  return (
    <div className="reference-app">
      <Navbar
        pathname={activePath}
        user={currentUser}
        onUserUpdate={updateUser}
        onSignOut={signOut}
        onNavigate={navigate}
      />
      <div className="reference-main">
        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice("")}>x</button>
          </div>
        )}
        {page}
      </div>
    </div>
  );
}

export default App;
