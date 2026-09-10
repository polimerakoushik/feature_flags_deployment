import { useEffect, useState } from "react";

const items = [
  ["/landing", "Overview", "🏠"],
 
  ["/flags", "Feature Flags", "🏳️"],
  ["/environments", "Environments", "🌐"],
 // ["/segments", "Segments", "👥"],
  ["/rollouts", "Rollouts", "⚙️"],
  ["/cleanup", "Cleanup Suggestions", "🧹"],
  ["/evaluation", "Evaluations", "📈"],
  ["/evaluation/all", "All Flag Evaluations", "📊"],
 // ["/analysis", "Analysis", "🔎"],
  ["/audit-logs", "Audit Logs", "📜"],
  //["/integrations", "Integrations", "🔌"],
 // ["/settings", "Project Settings", "⚙️"],
];

function Navbar({ pathname, user, onUserUpdate, onSignOut, onNavigate }) {
  const initials = (user?.name || user?.email || "A").slice(0, 1).toUpperCase();

  return (
    <aside className="exact-sidebar custom-sidebar">
      <div className="sidebar-top">
        <button className="exact-logo" onClick={() => onNavigate("/landing")}>
          <span className="brand-mark">F</span>
          <span className="brand-name">FlagPilot</span>
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map(([path, label, icon]) => (
          <button
            key={path}
            className={`nav-item ${pathname === path ? "active" : ""}`}
            onClick={() => onNavigate(path)}
            title={label}
          >
            <span className="nav-icon" aria-hidden>
              {icon}
            </span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">

        <section className="exact-account compact">
          <button className="exact-user" type="button" onClick={() => onNavigate("/profile")}
          >
            <span>{initials}</span>
            <div>
              <strong>{user?.name || "Koushik Admin"}</strong>
              <small>{user?.role || "Administrator"}</small>
            </div>
          </button>

          <div className="account-actions">
            <button className="signout-button" type="button" onClick={onSignOut}>
              Logout
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}

export default Navbar;
