import React from "react";

function Card({ title, description, onClick }) {
  return (
    <button className="analysis-card" onClick={onClick}>
      <h3>{title}</h3>
      <p>{description}</p>
    </button>
  );
}

function Analysis({ flags, selectedEnvironment, onNavigate }) {
  return (
    <main className="content-page">
      <div className="breadcrumbs">
        <button onClick={() => onNavigate("/landing")}>Landing</button>
        <span>/</span>
        Analysis
      </div>

      <header className="evaluation-hero">
        <div>
          <h1>Analysis</h1>
          <p className="page-subtitle">Analytics and aggregated views for flags and rollouts.</p>
        </div>
      </header>

      <section className="analysis-grid">
        <Card
          title="All Flag Evaluations"
          description="Overview of evaluation counts and breakdowns across flags (last 7 days)."
          onClick={() => onNavigate("/evaluation/all")}
        />

        <Card
          title="Flag Evaluation Test"
          description="Evaluate a single flag in real-time for a user or context."
          onClick={() => onNavigate("/evaluation")}
        />

        <Card
          title="Rollout Analysis"
          description="Investigate rollouts, user inclusion and environment breakdowns."
          onClick={() => onNavigate("/rollouts")}
        />

        <Card
          title="Cleanup Suggestions"
          description="Flags that look stale and are candidates for removal."
          onClick={() => onNavigate("/cleanup")}
        />
      </section>
    </main>
  );
}

export default Analysis;
