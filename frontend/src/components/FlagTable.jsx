import React from "react";

export default function FlagTable({ flags = [], onOpenFlag, onEditFlag, onDeleteFlag }) {
  return (
    <div className="operations-list">
      <div className="list-heading">Flags</div>
      <table>
        <thead>
          <tr>
            <th>Flag</th>
            <th>Owner</th>
            <th>Type</th>
            <th>Rollout</th>
            <th>Updated</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.id} className="clickable-row">
              <td onClick={() => onOpenFlag(f.id)}>
                <div className="flag-left">
                  <div className="flag-icon">{(f.name || f.key || "").charAt(0).toUpperCase()}</div>
                  <div className="flag-meta">
                    <div className="flag-name">{f.name || f.key}</div>
                    <div className="flag-slug">{f.key}</div>
                  </div>
                </div>
              </td>
              <td>{f.owner_team || "—"}</td>
              <td>{f.type || "boolean"}</td>
              <td>
                <div className="rollout-preview" title={`Rollout ${f.rollout_percentage || 0}%`}>
                  <div className="rollout-preview-fill" style={{ width: `${f.rollout_percentage || 0}%` }} />
                </div>
                <div className="rollout-percent">{f.rollout_percentage ?? "—"}%</div>
              </td>
              <td className="flag-updated">{f.updated_at ? new Date(f.updated_at).toLocaleString() : "—"}</td>
              <td style={{ textAlign: "right" }} className="flag-actions">
                <button onClick={() => onEditFlag(f.id)} className="secondary-button">Edit</button>
                <button onClick={() => onDeleteFlag(f.id)} className="danger-button" style={{ marginLeft: 8 }}>Delete</button>
              </td>
            </tr>
          ))}
          {flags.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 24 }}>
                No flags
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
