import React from "react";

export default function FlagCard({ flag, onOpen, onEdit, onDelete }) {
  if (!flag) return null;
  const { id, name, key, description, enabled, rollout_percentage, owner_team } = flag;

  return (
    <article className="flag-card">
      <header className="flag-card-header">
        <div>
          <h3 className="flag-title" onClick={onOpen} style={{ cursor: "pointer" }}>{name || key}</h3>
          <div className="flag-slug">{key}</div>
        </div>
        <div className={`flag-badge ${enabled ? "on" : "off"}`}>{enabled ? "Enabled" : "Disabled"}</div>
      </header>

      <div className="flag-card-body">
        <p className="flag-desc">{description}</p>
      </div>

      <footer className="flag-card-footer">
        <div className="flag-meta">
          <span className="flag-owner">{owner_team || "—"}</span>
          <span className="flag-rollout">Rollout: {typeof rollout_percentage === "number" ? `${rollout_percentage}%` : "—"}</span>
        </div>
        <div className="flag-actions">
          <button className="secondary-button" onClick={onEdit}>Edit</button>
          <button className="danger-button" onClick={onDelete}>Delete</button>
        </div>
      </footer>
    </article>
  );
}
