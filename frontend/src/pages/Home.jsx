function DashboardPreview() {
  const rows = [
    { name: "New Checkout Flow", env: "Production", status: "on", updated: "2 min ago" },
    { name: "Search Enhancement", env: "Testing", status: "off", updated: "15 min ago" },
    { name: "AI Recommendations", env: "Development", status: "on", updated: "1 hour ago" },
    { name: "Dark Mode", env: "Production", status: "on", updated: "2 hours ago" },
  ];

  const metricCards = [
    { label: "Total Flags", value: "24", tag: "+12%" },
    { label: "Active Rollouts", value: "18", tag: "+4%" },
    { label: "Evaluations", value: "2.4M", tag: "+24%" },
    { label: "Environments", value: "5", tag: "Configured" },
  ];

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <span className="brand-mark">F</span>
          <span>FlagPilot</span>
        </div>
        <nav className="dashboard-nav">
          <button type="button" className="active">Overview</button>
          <button type="button">Feature Flags</button>
          <button type="button">Environments</button>
          <button type="button">Segments</button>
          <button type="button">Rollouts</button>
          <button type="button">Evaluations</button>
          <button type="button">Audit Logs</button>
          <button type="button">Integrations</button>
          <button type="button">Project Settings</button>
        </nav>
      </aside>

      <div className="dashboard-panel">
        <div className="dashboard-header">
          <h3>Overview</h3>
          <span className="date-pill">May 15 – May 22, 2026</span>
        </div>

        <div className="metrics-grid">
          {metricCards.map((card) => (
            <article className="metrics-card" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.tag}</small>
            </article>
          ))}
        </div>

        <div className="workspace-grid">
          <div className="chart-card">
            <div className="chart-header">
              <span>Evaluation Count (Last 7 Days)</span>
              <div className="chart-toggle">
                <button className="active">7 Days</button>
                <button>30 Days</button>
              </div>
            </div>
            <div className="chart-surface">
              <svg viewBox="0 0 440 170" preserveAspectRatio="none" aria-label="Evaluation chart">
                <defs>
                  <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8d7cf6" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#8d7cf6" stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <path d="M0,130 L50,110 L100,95 L150,98 L200,88 L250,60 L300,80 L350,75 L400,50 L440,70 L440,170 L0,170 Z" fill="url(#chartFill)"/>
                <path d="M0,130 L50,110 L100,95 L150,98 L200,88 L250,60 L300,80 L350,75 L400,50 L440,70" fill="none" stroke="#7c6ef5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          <div className="activity-card">
            <div className="chart-header">
              <span>Recent Activity</span>
            </div>
            <div className="activity-list">
              <div className="activity-item">
                <span className="activity-icon chat">✦</span>
                <div>
                  <strong>Chat Bot</strong>
                  <small>Rollout percentage changed</small>
                </div>
                <time>10:30 AM</time>
              </div>
              <div className="activity-item">
                <span className="activity-icon flag">F</span>
                <div>
                  <strong>New Dashboard</strong>
                  <small>Flag published in Production</small>
                </div>
                <time>09:15 AM</time>
              </div>
              <div className="activity-item">
                <span className="activity-icon flag">P</span>
                <div>
                  <strong>Payment V2</strong>
                  <small>Flag disabled in Staging</small>
                </div>
                <time>Yesterday</time>
              </div>
              <div className="activity-item">
                <span className="activity-icon sync">↻</span>
                <div>
                  <strong>Search Improvement</strong>
                  <small>Targeting rules updated</small>
                </div>
                <time>May 30</time>
              </div>
              <div className="activity-item">
                <span className="activity-icon spark">↗</span>
                <div>
                  <strong>Recommendation</strong>
                  <small>Flag enabled</small>
                </div>
                <time>May 19</time>
              </div>
            </div>
          </div>
        </div>

        <div className="summary-row">
          <div className="summary-box">
            <span>Total evaluations</span>
            <strong>12,410</strong>
            <small>+1,773</small>
          </div>
          <div className="summary-box">
            <span>Avg / Day</span>
            <strong>1,773</strong>
            <small>+12.3%</small>
          </div>
          <div className="summary-box">
            <span>Peak Day</span>
            <strong>May 22, 2026</strong>
            <small>1,910</small>
          </div>
        </div>
      </div>
    </div>
  );
}

function Home({ onNavigate }) {
  const benefits = [
    { icon: "🛡", title: "Safe Releases", body: "Roll out features with confidence and rollback instantly." },
    { icon: "🎯", title: "Smart Targeting", body: "Target users by attributes, segments, and environment rules." },
    { icon: "📊", title: "Actionable Insights", body: "Track performance with clear analytics and audit visibility." },
  ];

  const featureCards = [
    {
      icon: "🚩",
      title: "Feature Flags",
      body: "Create and manage feature flags with easy rollout controls and environment-specific states.",
      tone: "purple",
    },
    {
      icon: "⚙",
      title: "Advanced Targeting",
      body: "Target users by attributes, segments, and rules for precise delivery and safer releases.",
      tone: "mint",
    },
    {
      icon: "🚀",
      title: "Gradual Rollouts",
      body: "Roll out features gradually with percentage-based controls and deterministic evaluation logic.",
      tone: "blue",
    },
    {
      icon: "📈",
      title: "Analytics & Insights",
      body: "Track evaluations, usage, and audit trails to understand the impact of every release.",
      tone: "lavender",
    },
  ];

  const trustLogos = ["ACME", "PULSE", "aven.", "Cloudex", "pixelcorp", "deepvote"];

  return (
    <div className="marketing-page">
      <header className="marketing-navbar">
        <button className="marketing-logo" type="button" onClick={() => onNavigate("/home")}>
          <span className="brand-mark">F</span>
          <span>FlagPilot</span>
        </button>

        <nav className="marketing-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#use-cases">Use Cases</a>
          <a href="#pricing">Pricing</a>
          <a href="#docs">Docs</a>
          <a href="#security">Security</a>
          <a href="#about">About</a>
        </nav>

        <div className="marketing-actions">
          <button type="button" className="theme-toggle" aria-label="Toggle theme">☾</button>
          <button type="button" className="nav-login" onClick={() => onNavigate("/login")}>Log in</button>
          <button type="button" className="nav-cta" onClick={() => onNavigate("/signup")}>Get Started Free</button>
        </div>
      </header>

      <main className="marketing-inner">
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <div className="hero-badge">
              <span className="badge-icon">⚡</span>
              Ship Faster. Safer. Smarter.
            </div>

            <h1>
              Take control of
              <br />
              your features with
              <span className="hero-accent"> Confidence</span>
            </h1>

            <p className="hero-subtitle">
              FlagPilot helps engineering teams release features safely with feature flags,
              gradual rollouts, and powerful targeting — all in one place.
            </p>

            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={() => onNavigate("/signup")}>
                Get Started Free <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="outline-button" onClick={() => onNavigate("/login")}>
                <span aria-hidden="true">▶</span> Watch Demo
              </button>
            </div>

            <div className="benefit-row">
              {benefits.map((benefit) => (
                <div className="benefit-item" key={benefit.title}>
                  <span className="benefit-icon">{benefit.icon}</span>
                  <div>
                    <strong>{benefit.title}</strong>
                    <p>{benefit.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-hero-visual">
            <DashboardPreview />
          </div>
        </section>

        {/* <section className="logo-strip" aria-label="Trusted by engineering teams">
          <p>Trusted by engineering teams at</p>
          <div className="logo-row">
            {trustLogos.map((logo) => (
              <span key={logo} className="logo-item">{logo}</span>
            ))}
          </div>
        </section> */}

        <section className="feature-showcase" id="features">
          <h2>Everything you need to ship better</h2>
          <p>Powerful features to help you release with confidence and move fast.</p>

          <div className="feature-grid">
            {featureCards.map((card) => (
              <article className="feature-card" key={card.title}>
                <div className={`feature-icon ${card.tone}`}>
                  {card.icon}
                </div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;
