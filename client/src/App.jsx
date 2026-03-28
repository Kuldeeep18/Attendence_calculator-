import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';

import { fetchPlannerResult, fetchSelectableFriends } from './api/plannerApi';
import { auth, firebaseEnabled } from './firebase';

const demoUser = {
  uid: 'local-demo-user',
  email: 'demo@student.local',
  displayName: 'Local Demo User'
};

function App() {
  const [viewer, setViewer] = useState(firebaseEnabled ? null : demoUser);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [authMode, setAuthMode] = useState('signin');
  const [credentials, setCredentials] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsData, setFriendsData] = useState({
    current_user: null,
    friends: []
  });
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bunkCount, setBunkCount] = useState(1);
  const [plannerResult, setPlannerResult] = useState(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!firebaseEnabled) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setViewer(currentUser);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady || !viewer) {
      if (authReady) {
        setFriendsData({ current_user: null, friends: [] });
        setSelectedUserIds([]);
      }
      return;
    }

    let isMounted = true;

    async function loadFriends() {
      setLoadingFriends(true);
      setErrorMessage('');

      try {
        const response = await fetchSelectableFriends(viewer);

        if (!isMounted) {
          return;
        }

        setFriendsData(response);
        setSelectedUserIds(response.friends.map((friend) => friend.id));
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message);
        }
      } finally {
        if (isMounted) {
          setLoadingFriends(false);
        }
      }
    }

    loadFriends();

    return () => {
      isMounted = false;
    };
  }, [authReady, viewer]);

  const currentViewerName =
    viewer?.displayName || viewer?.email?.split('@')[0] || 'Student';

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!firebaseEnabled) {
      return;
    }

    setAuthBusy(true);
    setErrorMessage('');

    try {
      if (authMode === 'signup') {
        const registration = await createUserWithEmailAndPassword(
          auth,
          credentials.email,
          credentials.password
        );

        if (credentials.name.trim()) {
          await updateProfile(registration.user, {
            displayName: credentials.name.trim()
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      }

      setCredentials((previous) => ({
        ...previous,
        password: ''
      }));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (!firebaseEnabled) {
      return;
    }

    await signOut(auth);
    setPlannerResult(null);
  }

  function toggleFriend(friendId) {
    setSelectedUserIds((previous) =>
      previous.includes(friendId)
        ? previous.filter((currentId) => currentId !== friendId)
        : [...previous, friendId]
    );
  }

  async function handlePlannerSubmit(event) {
    event.preventDefault();
    setSubmitBusy(true);
    setErrorMessage('');

    try {
      const result = await fetchPlannerResult(
        {
          selectedUserIds,
          bunkCount
        },
        viewer
      );

      setPlannerResult(result);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <main className="app-grid">
        <section className="hero-panel">
          <p className="eyebrow">Smart Attendance Manager</p>
          <h1>Plan group bunks without flying blind.</h1>
          <p className="hero-copy">
            React handles the experience, Node owns the API, Firebase secures user
            sessions, and Supabase stores the attendance data that powers the
            planner.
          </p>

          <div className="feature-strip">
            <article className="mini-card">
              <span className="mini-label">Group Limit</span>
              <strong>
                {plannerResult ? plannerResult.group_bunk_limit : '--'}
              </strong>
              <small>Lowest safe bunk capacity across the selected squad.</small>
            </article>
            <article className="mini-card">
              <span className="mini-label">Future Status</span>
              <strong className={plannerResult?.future_status === 'UNSAFE' ? 'danger' : ''}>
                {plannerResult ? plannerResult.future_status : '--'}
              </strong>
              <small>Instant simulation based on your proposed bunk count.</small>
            </article>
          </div>
        </section>

        <section className="workspace-panel">
          <div className="panel-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Authentication</p>
                <h2>{firebaseEnabled ? 'Firebase session' : 'Development mode'}</h2>
              </div>
              {viewer && firebaseEnabled ? (
                <button className="ghost-button" onClick={handleSignOut} type="button">
                  Sign out
                </button>
              ) : null}
            </div>

            {firebaseEnabled ? (
              viewer ? (
                <div className="identity-card">
                  <strong>{currentViewerName}</strong>
                  <span>{viewer.email}</span>
                  <small>
                    Your Node API requests are authenticated with a Firebase ID token.
                  </small>
                </div>
              ) : (
                <form className="auth-form" onSubmit={handleAuthSubmit}>
                  <div className="mode-toggle">
                    <button
                      className={authMode === 'signin' ? 'toggle-active' : ''}
                      onClick={() => setAuthMode('signin')}
                      type="button"
                    >
                      Sign in
                    </button>
                    <button
                      className={authMode === 'signup' ? 'toggle-active' : ''}
                      onClick={() => setAuthMode('signup')}
                      type="button"
                    >
                      Create account
                    </button>
                  </div>

                  {authMode === 'signup' ? (
                    <label>
                      <span>Name</span>
                      <input
                        onChange={(event) =>
                          setCredentials((previous) => ({
                            ...previous,
                            name: event.target.value
                          }))
                        }
                        placeholder="Ava Johnson"
                        type="text"
                        value={credentials.name}
                      />
                    </label>
                  ) : null}

                  <label>
                    <span>Email</span>
                    <input
                      onChange={(event) =>
                        setCredentials((previous) => ({
                          ...previous,
                          email: event.target.value
                        }))
                      }
                      placeholder="student@campus.edu"
                      type="email"
                      value={credentials.email}
                    />
                  </label>

                  <label>
                    <span>Password</span>
                    <input
                      onChange={(event) =>
                        setCredentials((previous) => ({
                          ...previous,
                          password: event.target.value
                        }))
                      }
                      placeholder="Minimum 6 characters"
                      type="password"
                      value={credentials.password}
                    />
                  </label>

                  <button className="primary-button" disabled={authBusy} type="submit">
                    {authBusy
                      ? 'Working...'
                      : authMode === 'signup'
                        ? 'Create and continue'
                        : 'Sign in'}
                  </button>
                </form>
              )
            ) : (
              <div className="identity-card demo-card">
                <strong>{demoUser.displayName}</strong>
                <span>{demoUser.email}</span>
                <small>
                  Firebase config is optional during local development. The backend will
                  accept development headers until you add real Firebase credentials.
                </small>
              </div>
            )}
          </div>

          <div className="panel-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Planner Setup</p>
                <h2>Pick the crew and simulate the bunk.</h2>
              </div>
              <span className="helper-pill">
                You are always included in the calculation
              </span>
            </div>

            <form className="planner-form" onSubmit={handlePlannerSubmit}>
              <label className="inline-field">
                <span>Future bunks to simulate</span>
                <input
                  min="0"
                  onChange={(event) => setBunkCount(Number(event.target.value))}
                  type="number"
                  value={bunkCount}
                />
              </label>

              <div className="friend-selector">
                <div className="selector-header">
                  <strong>Select friends</strong>
                  <small>{loadingFriends ? 'Loading roster...' : `${selectedUserIds.length} selected`}</small>
                </div>

                <div className="current-user-pill">
                  <span>You</span>
                  <strong>{friendsData.current_user?.name || currentViewerName}</strong>
                </div>

                {friendsData.friends.length === 0 ? (
                  <div className="empty-state">
                    Add friendship rows in Supabase to start planning bunks with friends.
                  </div>
                ) : (
                  friendsData.friends.map((friend) => (
                    <label className="friend-option" key={friend.id}>
                      <input
                        checked={selectedUserIds.includes(friend.id)}
                        onChange={() => toggleFriend(friend.id)}
                        type="checkbox"
                      />
                      <div>
                        <strong>{friend.name}</strong>
                        <span>{friend.attendance}</span>
                      </div>
                      <small>{friend.subject_count} subjects tracked</small>
                    </label>
                  ))
                )}
              </div>

              <button
                className="primary-button"
                disabled={submitBusy || !viewer || loadingFriends}
                type="submit"
              >
                {submitBusy ? 'Calculating plan...' : 'Generate group bunk plan'}
              </button>
            </form>
          </div>

          {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

          <div className="results-grid">
            <article className="panel-card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Recommendations</p>
                  <h2>Best subjects to bunk</h2>
                </div>
              </div>

              {plannerResult?.recommended_subjects?.length ? (
                <div className="subject-list">
                  {plannerResult.recommended_subjects.map((subject) => (
                    <div className="subject-row" key={subject.subject_name}>
                      <div>
                        <strong>{subject.subject_name}</strong>
                        <span>
                          Current {subject.attendance} • Future {subject.future_attendance}
                        </span>
                      </div>
                      <small>Risk drop {subject.risk_drop}%</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  No common safe subjects yet. Pick more friends or improve attendance.
                </div>
              )}
            </article>

            <article className="panel-card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">User Breakdown</p>
                  <h2>Individual safe bunks</h2>
                </div>
              </div>

              {plannerResult?.users?.length ? (
                <div className="user-grid">
                  {plannerResult.users.map((user) => (
                    <div className="user-card" key={user.name}>
                      <strong>{user.name}</strong>
                      <span>{user.attendance}</span>
                      <small>{user.safe_bunks} safe bunks remaining</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  Generate a plan to see group attendance projections here.
                </div>
              )}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
