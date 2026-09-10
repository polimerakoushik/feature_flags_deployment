import { useState } from "react";

function BrandMark() {
  return <span className="brand-mark">F</span>;
}

function DashboardPreview() {
  return (
    <div className="signup-preview-shell">
      <div className="preview-window">
        <div className="preview-grid">
          <div className="preview-sidebar" />
          <div className="preview-main">
            <div className="preview-header" />
            <div className="preview-stats">
              <span />
              <span />
              <span />
            </div>
            <div className="preview-chart">
              <span className="chart-line" />
            </div>
          </div>
        </div>
      </div>
      <div className="avatar-row">
        <span className="avatar avatar-one" />
        <span className="avatar avatar-two" />
        <span className="avatar avatar-three" />
      </div>
    </div>
  );
}

const passwordRules = [
  { test: (value) => value.length >= 8, message: "Password must be at least 8 characters long." },
  { test: (value) => /[A-Z]/.test(value), message: "Password must contain at least one uppercase letter." },
  { test: (value) => /[a-z]/.test(value), message: "Password must contain at least one lowercase letter." },
  { test: (value) => /\d/.test(value), message: "Password must contain at least one number." },
  { test: (value) => /[@#$%&!*]/.test(value), message: "Password must contain at least one special character." },
];

function validatePassword(password) {
  return passwordRules.filter((rule) => !rule.test(password)).map((rule) => rule.message);
}

function Signup({ onSignup, onNavigate }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    age: "",
    gender: "",
    role: "",
    company: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "password") {
      setPasswordErrors(validatePassword(value));
    }
  }

  async function submit(event) {
    event.preventDefault();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.name || !form.email || !form.password) {
      setError("Full name, email and password are required.");
      return;
    }
    if (!emailPattern.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const passwordIssues = validatePassword(form.password);
    if (passwordIssues.length) {
      setPasswordErrors(passwordIssues);
      setError(passwordIssues[0]);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setError("");
      setSubmitting(true);
      await onSignup(form);
    } catch (submitError) {
      setError(submitError.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signup-page">
      <aside className="signup-visual">
        <div className="signup-brand">
          <BrandMark />
          <span>FlagPilot</span>
        </div>

        <div className="signup-banner-pill">Ship features, safer. Smarter.</div>

        <h1 className="signup-visual-title">Create Your <span>Account</span></h1>

        <p className="signup-visual-copy">
          Join thousands of engineering teams who use FlagPilot to release features with confidence and control.
        </p>

        <DashboardPreview />

        <div className="signup-feature-list">
          <div className="feature-row">
            <span className="feature-icon purple">✓</span>
            <div>
              <strong>Enterprise Grade Security</strong>
              <p>Your data is protected with industry-leading security practices.</p>
            </div>
          </div>
          <div className="feature-row">
            <span className="feature-icon cyan">⚡</span>
            <div>
              <strong>Built for Speed</strong>
              <p>Launch features faster without compromising stability or user experience.</p>
            </div>
          </div>
          <div className="feature-row">
            <span className="feature-icon gold">▣</span>
            <div>
              <strong>Powerful Insights</strong>
              <p>Make data-driven decisions with real-time analytics and evaluations.</p>
            </div>
          </div>
        </div>

        <div className="signup-footer-links">
          <span>© 2024 FlagPilot. All rights reserved.</span>
          <div>
            <a href="#">Terms of Service</a>
            <span>·</span>
            <a href="#">Privacy Policy</a>
          </div>
        </div>
      </aside>

      <section className="signup-panel">
        <form className="signup-form-grid" onSubmit={submit}>
          <div className="signup-form-top">
            <h2>Create Account</h2>
            <p className="auth-switch">
              Already have an account? <button type="button" className="link-button" onClick={() => onNavigate("/login")}>Log in</button>
            </p>
          </div>

          {error && <p className="auth-error">{error}</p>}
          {passwordErrors.length > 0 && (
            <ul className="password-rules">
              {passwordErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          <div className="signup-fields">
            <label className="field-group">
              <span>Full Name</span>
              <div className="input-with-icon">
                <span className="field-icon" aria-hidden="true">👤</span>
                <input
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
            </label>

            <label className="field-group">
              <span>Phone Number</span>
              <div className="input-with-icon">
                <span className="field-icon" aria-hidden="true">📞</span>
                <input
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>
            </label>

            <label className="field-group">
              <span>Email Address</span>
              <div className="input-with-icon">
                <span className="field-icon" aria-hidden="true">✉</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder="Enter your email address"
                />
              </div>
            </label>

            <label className="field-group">
              <span>Age</span>
              <div className="input-with-icon">
                <span className="field-icon" aria-hidden="true">🗓</span>
                <input
                  type="number"
                  min="0"
                  value={form.age}
                  onChange={(event) => update("age", event.target.value)}
                  placeholder="Enter your age"
                />
              </div>
            </label>

            <label className="field-group">
              <span>Gender</span>
              <div className="input-with-icon select-wrap">
                <span className="field-icon" aria-hidden="true">👥</span>
                <select value={form.gender} onChange={(event) => update("gender", event.target.value)}>
                  <option value="">Select your gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer-not">Prefer not to say</option>
                </select>
              </div>
            </label>

            <label className="field-group">
              <span>Role</span>
              <div className="input-with-icon select-wrap">
                <span className="field-icon" aria-hidden="true">🧑‍💼</span>
                <select value={form.role} onChange={(event) => update("role", event.target.value)}>
                  <option value="">Select your role</option>
                  <option value="admin">Admin</option>
                  <option value="developer">Developer</option>
                  <option value="product-manager">Product Manager</option>
                  <option value="qa">QA</option>
                </select>
              </div>
            </label>

            <label className="field-group field-full">
              <span>Team / Company</span>
              <div className="input-with-icon">
                <span className="field-icon" aria-hidden="true">🏢</span>
                <input
                  value={form.company}
                  onChange={(event) => update("company", event.target.value)}
                  placeholder="Enter your team or company name"
                />
              </div>
            </label>

            <label className="field-group">
              <span>Password</span>
              <div className="input-with-icon">
                <span className="field-icon" aria-hidden="true">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => update("password", event.target.value)}
                  placeholder="Create a strong password"
                />
                <button type="button" className="input-icon-button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>

            <label className="field-group">
              <span>Confirm Password</span>
              <div className="input-with-icon">
                <span className="field-icon" aria-hidden="true">🔒</span>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) => update("confirmPassword", event.target.value)}
                  placeholder="Confirm your password"
                />
                <button type="button" className="input-icon-button" onClick={() => setShowConfirm((value) => !value)}>
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
            </label>
          </div>

          <div className="password-guidance">
            <span className="guidance-badge">✓</span>
            Use at least 8 characters with a mix of letters, numbers &amp; symbols.
          </div>

          <button className="signup-submit" type="submit" disabled={submitting}>
            {submitting ? "Creating Account..." : "Create Account"} {!submitting && <span>→</span>}
          </button>

          <div className="social-separator">or sign up with</div>

          <div className="social-row">
            <button type="button" className="social-button"><span className="social-mark google">G</span>Google</button>
            <button type="button" className="social-button"><span className="social-mark github">◌</span>GitHub</button>
            <button type="button" className="social-button"><span className="social-mark microsoft">⊞</span>Microsoft</button>
            <button type="button" className="social-button"><span className="social-mark slack">#</span>Slack</button>
          </div>

          <p className="terms-text">
            By creating an account, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </p>
        </form>
      </section>
    </main>
  );
}

export default Signup;
