function AuthScreen({
  authBusy,
  authMode,
  credentials,
  errorMessage,
  firebaseEnabled,
  onCredentialsChange,
  onModeChange,
  onSubmit
}) {
  return (
    <div className="page-shell auth-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <main className="auth-layout">
        <section className="auth-promo">
          <p className="eyebrow">Smart Attendance Manager</p>
          <h1>Weekly PDFs in. Daily attendance out.</h1>
          <p className="hero-copy">
            Sign up with your name, email, and enrollment number. The app links your
            attendance record, finds pending academic dates from the calendar PDF,
            and lets you add friends by enrollment.
          </p>

          <div className="feature-strip auth-feature-strip">
            <article className="mini-card">
              <span className="mini-label">Weekly Source</span>
              <strong>PDF imports</strong>
              <small>Admins upload the compiled attendance sheets each week.</small>
            </article>
            <article className="mini-card">
              <span className="mini-label">Daily Flow</span>
              <strong>Calendar aware</strong>
              <small>The app suggests attendance dates from the academic calendar.</small>
            </article>
          </div>
        </section>

        <section className="auth-card">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Authentication</p>
              <h2>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
            </div>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="mode-toggle">
              <button
                className={authMode === 'signin' ? 'toggle-active' : ''}
                onClick={() => onModeChange('signin')}
                type="button"
              >
                Sign in
              </button>
              <button
                className={authMode === 'signup' ? 'toggle-active' : ''}
                onClick={() => onModeChange('signup')}
                type="button"
              >
                Sign up
              </button>
            </div>

            {authMode === 'signup' ? (
              <>
                <label>
                  <span>Name</span>
                  <input
                    onChange={(event) => onCredentialsChange('name', event.target.value)}
                    placeholder="Ava Johnson"
                    type="text"
                    value={credentials.name}
                  />
                </label>

                <label>
                  <span>Enrollment number</span>
                  <input
                    onChange={(event) =>
                      onCredentialsChange('enrollmentNo', event.target.value)
                    }
                    placeholder="24002171210181"
                    type="text"
                    value={credentials.enrollmentNo}
                  />
                </label>
              </>
            ) : null}

            <label>
              <span>Email</span>
              <input
                onChange={(event) => onCredentialsChange('email', event.target.value)}
                placeholder="student@campus.edu"
                type="email"
                value={credentials.email}
              />
            </label>

            <label>
              <span>Password</span>
              <input
                onChange={(event) => onCredentialsChange('password', event.target.value)}
                placeholder="Minimum 6 characters"
                type="password"
                value={credentials.password}
              />
            </label>

            <button className="primary-button" disabled={authBusy} type="submit">
              {authBusy
                ? 'Working...'
                : authMode === 'signup'
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>

          {firebaseEnabled ? null : (
            <div className="identity-card demo-card">
              <strong>Local auth mode is active</strong>
              <span>Accounts are saved only in this browser for testing.</span>
              <small>
                Add Firebase keys in `client/.env` when you are ready for real hosted auth.
              </small>
            </div>
          )}

          {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        </section>
      </main>
    </div>
  );
}

export default AuthScreen;
