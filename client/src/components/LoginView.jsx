import { useState } from 'react';
import { requestJson } from '../api';

export default function LoginView({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Create an account or log in to sync scripts with the database.');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setBusy(true);
    setStatus(mode === 'login' ? 'Logging you in...' : 'Creating your account...');

    try {
      const data = await requestJson(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setStatus('Synced with the database.');
      onAuthSuccess(data.token, data.user, data.scripts || []);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="login-view">
        <div className="login-copy">
          <p className="eyebrow">Narrivox AI Studio</p>
          <img
            className="brand-logo"
            src="./assets/narrivox-logo.jpeg"
            alt="Narrivox AI logo"
          />
          <h1>Write sharper YouTube scripts with a branded AI workspace.</h1>
          <p className="lede">
            Sign in with your email to open your script dashboard, save generation
            history, and shape scripts with tones ranging from satire to criticism
            to movie-review style breakdowns.
          </p>
          <div className="feature-chips">
            <span>Gemini powered</span>
            <span>History sidebar</span>
            <span>Email login</span>
          </div>
        </div>

        <section className="glass-card auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Authentication tabs">
            <button
              type="button"
              className={`tab-button${mode === 'login' ? ' active' : ''}`}
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`tab-button${mode === 'signup' ? ' active' : ''}`}
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => setMode('signup')}
            >
              Sign Up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'login' ? (
              <div className="section-heading">
                <h2>Email Login</h2>
                <p>Sign in to open your saved scripts and continue from any previous session.</p>
              </div>
            ) : (
              <div className="section-heading">
                <h2>Create Account</h2>
                <p>Your login details and script history are stored in the app database.</p>
              </div>
            )}

            <label>
              <span>Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="creator@narrivox.ai"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'login' ? 'Enter password' : 'At least 8 characters'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <button type="submit" className="primary-button" disabled={busy}>
              {mode === 'login' ? 'Enter Workspace' : 'Create Account'}
            </button>
          </form>

          <p className="helper-text">{status}</p>
        </section>
      </section>
    </main>
  );
}
