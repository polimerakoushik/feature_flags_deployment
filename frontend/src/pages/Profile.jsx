import { useEffect, useMemo, useState } from "react";

const fieldValue = (user, key, fallback = "Not provided") =>
  user?.[key] === null || user?.[key] === undefined || user?.[key] === ""
    ? fallback
    : user[key];

function Profile({ user, onUserUpdate, onNavigate }) {
  const [draft, setDraft] = useState(user || {});
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(user || {});
  }, [user]);

  const initials = useMemo(
    () => (fieldValue(user, "name", fieldValue(user, "email", "A")).slice(0, 1) || "A").toUpperCase(),
    [user]
  );
  const name = fieldValue(user, "name", "Your Name");
  const role = fieldValue(user, "role", "Developer");
  const team = fieldValue(user, "company", fieldValue(user, "team", "Product Team"));
  const location = fieldValue(user, "location", "Location not provided");
  const createdAt = user?.created_at || user?.createdAt;
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Recently";

  const updateField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      await onUserUpdate(draft);
      setIsEditing(false);
    } catch (updateError) {
      setError(updateError.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const display = (key, fallback) => fieldValue(isEditing ? draft : user, key, fallback);

  return (
    <main className="content-page profile-page profile-redesign">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate("/landing")}>Dashboard</button>
        <span>›</span>
        <span>Profile</span>
      </div>

      <header className="profile-header profile-redesign-header">
        <div>
          <h1>My Profile</h1>
          <p className="page-subtitle">Manage your account information, preferences and security settings.</p>
        </div>
        {!isEditing && (
          <button className="profile-edit-primary" onClick={() => setIsEditing(true)}>
            ✎&nbsp; Edit Profile
          </button>
        )}
      </header>

      <section className="profile-hero">
        <div className="profile-avatar profile-hero-avatar">{initials}</div>
        <div className="profile-hero-copy">
          <h2>{name}</h2>
          <strong>{role}</strong>
          <p>Passionate about building scalable products and feature management.</p>
          <div className="profile-meta">
            <span>⌖ {location}</span>
            <span>▣ Member since {memberSince}</span>
          </div>
        </div>
        <p className="profile-quote">“ Build today,<br />for a better tomorrow. ”</p>
      </section>

      <section className="profile-highlights">
        {[
          ["☎", "Phone", display("phone", "Not provided"), "phone"],
          ["✉", "Email", display("email", "Not provided"), "email"],
          ["▣", "Age", display("age", "Not provided"), "age"],
          ["⚥", "Gender", display("gender", "Not provided"), "gender"],
          ["▣", "Role", role, "role"],
          ["♟", "Team", team, "team"],
        ].map(([icon, label, value, tone]) => (
          <article className={`profile-highlight profile-highlight-${tone}`} key={label}>
            <span className="profile-highlight-icon">{icon}</span>
            <div><b>{label}</b><strong>{value}</strong></div>
          </article>
        ))}
      </section>

      <div className="profile-columns">
        <section className="profile-panel personal-panel">
          <h2>♧ <span>Personal Information</span></h2>
          {error && <p className="auth-error">{error}</p>}
          <div className="profile-form-grid">
            {[
              ["name", "Full Name"], ["email", "Email Address"], ["phone", "Phone Number"],
              ["age", "Age"], ["gender", "Gender"], ["role", "Role"], ["company", "Team"], ["location", "Location"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                {isEditing && key === "gender" ? (
                  <select value={draft[key] || ""} onChange={(event) => updateField(key, event.target.value)}>
                    <option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                ) : isEditing ? (
                  <input value={draft[key] || ""} onChange={(event) => updateField(key, event.target.value)} />
                ) : <output>{display(key, "Not provided")}</output>}
              </label>
            ))}
          </div>
          {(isEditing || draft.bio || user?.bio) && (
            <label className="profile-bio-field">
              <span>Bio</span>
              {isEditing ? <textarea value={draft.bio || ""} onChange={(event) => updateField("bio", event.target.value)} /> : <output>{display("bio", "No bio provided")}</output>}
            </label>
          )}
          {isEditing && (
            <div className="profile-form-actions">
              <button className="blue-button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
              <button onClick={() => { setDraft(user || {}); setError(""); setIsEditing(false); }}>Cancel</button>
            </div>
          )}
        </section>

        <aside className="profile-side-panels">
          <section className="profile-panel account-status-panel">
            <h2>⬡ <span>Account Status</span></h2>
            <div className="active-account"><b>✓</b><div><strong>Active Account</strong><span>Your account is active and in good standing.</span></div></div>
          </section>
          <section className="profile-panel activity-panel">
            <h2>◷ <span>Recent Activity</span><button onClick={() => onNavigate("/audit-logs")}>View All</button></h2>
            {["Logged in from this browser", "Updated profile information", "Viewed feature flags", "Changed settings", "Logged out"].map((activity, index) => (
              <div className="activity-row" key={activity}><b>{["↪", "✎", "◉", "⚙", "↪"][index]}</b><span>{activity}</span><time>{index === 0 ? "Just now" : `${index + 1}d ago`}</time></div>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default Profile;
