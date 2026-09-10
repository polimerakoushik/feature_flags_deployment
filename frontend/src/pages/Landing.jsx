function Landing({ user, flags, environments, onNavigate }) {
  const enabledFlags = flags.filter((flag) => flag.enabled).length;
  const disabledFlags = flags.length - enabledFlags;
  const displayName = user?.name || user?.email?.split("@")[0] || "there";
  const quickStart = [
    ["⚑", "Manage feature flags", "Create, update or archive feature flags.", "/flags", "blue"],
    ["◎", "Select environment", "Switch between development, staging or production.", "/environments", "purple"],
    ["▥", "View evaluations", "Check how flags are being evaluated.", "/evaluation/all", "green"],
    ["▤", "View audit logs", "Track changes and user activity across the project.", "/audit-logs", "orange"],
  ];

  return (
    <main className="landing-page landing-redesign">
      <section className="landing-hero landing-redesign-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">WELCOME BACK</p>
          <h1>👋 {displayName}&apos;s launch desk</h1>
          <p>Your signed-in workspace is ready. Jump into flags, evaluate a rule, or check the environments connected to this project.</p>
          <div className="landing-actions">
            <button className="blue-button" onClick={() => onNavigate("/flags")}>→&nbsp; Open dashboard</button>
            <button className="secondary-button" onClick={() => onNavigate("/evaluation")}>▥&nbsp; Evaluate flag</button>
          </div>
        </div>
        <div className="landing-illustration" aria-hidden><span>⚑</span><div>✓ Build<br />✓ Deploy<br />▣ Measure<br />↻ Repeat</div></div>
      </section>

      <section className="landing-summary landing-redesign-summary">
        <article className="summary-blue"><i>⚑</i><div><span>Total flags</span><strong>{flags.length}</strong><small>All feature flags in project</small></div></article>
        <article className="summary-green"><i>✓</i><div><span>Enabled</span><strong>{enabledFlags}</strong><small>Actively in use</small></div></article>
        <article className="summary-red"><i>−</i><div><span>Disabled</span><strong>{disabledFlags}</strong><small>Turned off</small></div></article>
        <article className="summary-purple"><i>◇</i><div><span>Environments</span><strong>{environments.length}</strong><small>Connected environments</small></div></article>
      </section>

      <section className="landing-next landing-quick-start">
        <h2>Quick start</h2><p>Common actions to help you get started quickly.</p>
        <div className="quick-start-grid">{quickStart.map(([icon, title, description, path, tone]) => (
          <button key={title} className={`quick-start-card quick-${tone}`} onClick={() => onNavigate(path)}>
            <i>{icon}</i><strong>{title}</strong><span>{description}</span><b>›</b>
          </button>
        ))}</div>
      </section>

      <section className="landing-bottom-grid">
        <blockquote>“Feature flags give you the power to build,<br />release and learn — safely.”<small>— FlagPilot</small></blockquote>
        <div className="landing-help"><i>?</i><div><strong>Need help?</strong><span>Check documentation or reach out to your team.</span></div><button onClick={() => onNavigate("/audit-logs")}>View Docs ↗</button></div>
      </section>
    </main>
  );
}

export default Landing;
