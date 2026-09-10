import { useState } from "react";

function Login({ onLogin, onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [rawResponse, setRawResponse] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    if (!emailPattern.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setError("");
      setSubmitting(true);
      await onLogin({
        email,
        password,
      });
      onNavigate("/landing");
    } catch (loginError) {
      // Show readable message and attach raw response (if available) for debugging
      setError(loginError.message || "Invalid email or password.");
      setRawResponse(loginError.responseBody || null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-overlay" onClick={() => onNavigate("/home")}>
      <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
        <button className="auth-close" onClick={() => onNavigate("/home")} aria-label="Close">
          ×
        </button>
        <h2>
          Welcome Back! <span aria-hidden="true">👋</span>
        </h2>
        <p className="auth-subtitle">Login to your account</p>

        <form onSubmit={submit}>
          {error && <p className="auth-error">{error}</p>}
          {rawResponse ? (
            <div className="auth-error-raw" style={{ marginTop: 8 }}>
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>Show raw API response</summary>
                <pre style={{ maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap', background: 'var(--surface)', padding: 8, borderRadius: 6 }}>{typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse, null, 2)}</pre>
              </details>
            </div>
          ) : null}
          <label>
            Email
            <div className="input-with-icon">
              <span aria-hidden="true">✉</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
              />
            </div>
          </label>
          <label>
            Password
            <div className="input-with-icon">
              <span aria-hidden="true">🔒</span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="input-icon-button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </label>

          <a className="auth-forgot" href="#forgot">
            Forgot Password?
          </a>

          <button className="primary-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>

          <button
            type="button"
            className="secondary-button auth-create-button"
            onClick={() => onNavigate("/signup")}
          >
            Create Account
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <button className="link-button" onClick={() => onNavigate("/signup")}>
            Click here
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
