import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';

import {
  fetchAttendanceDashboard,
  fetchPlannerResult,
  fetchSelectableFriends,
  importWeeklyAttendance,
  linkStudentProfile,
  submitDailyAttendance
} from './api/plannerApi';
import { auth, firebaseEnabled } from './firebase';

const demoUser = {
  uid: 'local-demo-user',
  email: 'demo@student.local',
  displayName: 'Local Demo User'
};

function createEmptyAttendanceState() {
  return {
    profile: null,
    linked_student: null,
    subjects: [],
    recent_daily_logs: [],
    available_subjects: [],
    attendance_percentage: null,
    can_import_weekly: false
  };
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

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
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [friendsData, setFriendsData] = useState({
    current_user: null,
    friends: []
  });
  const [attendanceData, setAttendanceData] = useState(createEmptyAttendanceState);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bunkCount, setBunkCount] = useState(1);
  const [plannerResult, setPlannerResult] = useState(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [profileEnrollmentNo, setProfileEnrollmentNo] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [weeklyFiles, setWeeklyFiles] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [dailyAttendanceDate, setDailyAttendanceDate] = useState(getTodayString);
  const [dailyEntries, setDailyEntries] = useState({});
  const [dailyBusy, setDailyBusy] = useState(false);

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
        setAttendanceData(createEmptyAttendanceState());
        setSelectedUserIds([]);
        setPlannerResult(null);
        setImportSummary(null);
      }
      return;
    }

    let isMounted = true;

    async function loadWorkspace() {
      setLoadingFriends(true);
      setLoadingAttendance(true);
      setErrorMessage('');

      try {
        const [friendsResponse, attendanceResponse] = await Promise.all([
          fetchSelectableFriends(viewer),
          fetchAttendanceDashboard(viewer)
        ]);

        if (!isMounted) {
          return;
        }

        setFriendsData(friendsResponse);
        setAttendanceData(attendanceResponse);
        setSelectedUserIds((previous) => {
          const validFriendIds = new Set(friendsResponse.friends.map((friend) => friend.id));
          const preserved = previous.filter((friendId) => validFriendIds.has(friendId));
          return preserved.length ? preserved : friendsResponse.friends.map((friend) => friend.id);
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message);
        }
      } finally {
        if (isMounted) {
          setLoadingFriends(false);
          setLoadingAttendance(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, [authReady, viewer]);

  useEffect(() => {
    if (attendanceData.linked_student?.enrollment_no) {
      setProfileEnrollmentNo(attendanceData.linked_student.enrollment_no);
    }
  }, [attendanceData.linked_student?.enrollment_no]);

  useEffect(() => {
    const subjectNames = attendanceData.available_subjects || [];

    setDailyEntries((previous) => {
      const nextEntries = {};

      subjectNames.forEach((subjectName) => {
        nextEntries[subjectName] = previous[subjectName] || {
          was_class_held: false,
          was_present: false
        };
      });

      return nextEntries;
    });
  }, [attendanceData.available_subjects]);

  const currentViewerName =
    viewer?.displayName || viewer?.email?.split('@')[0] || 'Student';

  async function refreshAttendance(activeViewer = viewer) {
    if (!activeViewer) {
      return null;
    }

    const response = await fetchAttendanceDashboard(activeViewer);
    setAttendanceData(response);
    return response;
  }

  async function refreshFriends(activeViewer = viewer) {
    if (!activeViewer) {
      return null;
    }

    const response = await fetchSelectableFriends(activeViewer);
    setFriendsData(response);
    setSelectedUserIds((previous) => {
      const validFriendIds = new Set(response.friends.map((friend) => friend.id));
      const preserved = previous.filter((friendId) => validFriendIds.has(friendId));
      return preserved.length ? preserved : response.friends.map((friend) => friend.id);
    });
    return response;
  }

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

  async function handleLinkStudent(event) {
    event.preventDefault();
    setLinkBusy(true);
    setErrorMessage('');

    try {
      const response = await linkStudentProfile(profileEnrollmentNo, viewer);
      setAttendanceData(response);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleWeeklyImport(event) {
    event.preventDefault();

    if (!weeklyFiles.length) {
      setErrorMessage('Pick the weekly attendance PDFs before importing.');
      return;
    }

    setImportBusy(true);
    setErrorMessage('');

    try {
      const response = await importWeeklyAttendance(weeklyFiles, viewer);
      setImportSummary(response);
      setWeeklyFiles([]);
      await Promise.all([refreshAttendance(viewer), refreshFriends(viewer)]);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setImportBusy(false);
    }
  }

  function updateDailyEntry(subjectName, field, value) {
    setDailyEntries((previous) => {
      const currentEntry = previous[subjectName] || {
        was_class_held: false,
        was_present: false
      };

      if (field === 'was_present' && value) {
        return {
          ...previous,
          [subjectName]: {
            ...currentEntry,
            was_class_held: true,
            was_present: true
          }
        };
      }

      if (field === 'was_class_held' && !value) {
        return {
          ...previous,
          [subjectName]: {
            was_class_held: false,
            was_present: false
          }
        };
      }

      return {
        ...previous,
        [subjectName]: {
          ...currentEntry,
          [field]: value
        }
      };
    });
  }

  async function handleDailyAttendanceSubmit(event) {
    event.preventDefault();
    setDailyBusy(true);
    setErrorMessage('');

    try {
      const payload = {
        attendanceDate: dailyAttendanceDate,
        entries: Object.entries(dailyEntries).map(([subject_name, entry]) => ({
          subject_name,
          was_class_held: entry.was_class_held,
          was_present: entry.was_present
        }))
      };

      const response = await submitDailyAttendance(payload, viewer);
      setAttendanceData(response);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setDailyBusy(false);
    }
  }

  const linkedStudent = attendanceData.linked_student;
  const attendanceLoadingLabel = loadingAttendance ? 'Refreshing attendance...' : null;
  const dailySubjects = attendanceData.available_subjects || [];

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <main className="app-grid">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Smart Attendance Manager</p>
            <h1>Import weekly PDFs. Let students update the rest daily.</h1>
            <p className="hero-copy">
              The app now supports the real college workflow: you upload the weekly
              compiled attendance PDF, every student links their enrollment number,
              and then they can keep their attendance fresh with daily updates until
              the next weekly sheet arrives.
            </p>
          </div>

          <div className="feature-strip">
            <article className="mini-card">
              <span className="mini-label">Current Attendance</span>
              <strong>{attendanceData.attendance_percentage || '--'}</strong>
              <small>
                {linkedStudent
                  ? `${linkedStudent.division} • Enrollment ${linkedStudent.enrollment_no}`
                  : 'Link an imported enrollment number to see your live attendance.'}
              </small>
            </article>
            <article className="mini-card">
              <span className="mini-label">Group Limit</span>
              <strong>{plannerResult ? plannerResult.group_bunk_limit : '--'}</strong>
              <small>
                Lowest safe bunk capacity across the selected friends and your own
                current attendance snapshot.
              </small>
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
                <p className="section-kicker">Attendance Sync</p>
                <h2>Link your enrollment and import weekly PDFs.</h2>
              </div>
              {attendanceLoadingLabel ? <span className="helper-pill">{attendanceLoadingLabel}</span> : null}
            </div>

            <div className="sync-grid">
              <form className="stack-form" onSubmit={handleLinkStudent}>
                <label>
                  <span>Enrollment number</span>
                  <input
                    onChange={(event) => setProfileEnrollmentNo(event.target.value)}
                    placeholder="24002171210181"
                    type="text"
                    value={profileEnrollmentNo}
                  />
                </label>

                <button
                  className="primary-button"
                  disabled={linkBusy || !viewer}
                  type="submit"
                >
                  {linkBusy ? 'Linking...' : linkedStudent ? 'Refresh my link' : 'Link my attendance'}
                </button>

                <small className="muted-copy">
                  Link the same enrollment number that appears in the weekly college PDF.
                </small>
              </form>

              <div className="stack-panel">
                {linkedStudent ? (
                  <div className="identity-card">
                    <strong>{attendanceData.profile?.name || currentViewerName}</strong>
                    <span>
                      {linkedStudent.division} • Roll {linkedStudent.roll_no || '--'}
                    </span>
                    <small>
                      Enrollment {linkedStudent.enrollment_no}
                      {linkedStudent.mentor_name ? ` • Mentor ${linkedStudent.mentor_name}` : ''}
                    </small>
                  </div>
                ) : (
                  <div className="empty-state">
                    No linked weekly attendance record yet. Import the weekly PDF first,
                    then link your enrollment number here.
                  </div>
                )}

                {linkedStudent?.latest_import ? (
                  <div className="current-user-pill">
                    <span>Latest weekly import</span>
                    <strong>
                      {linkedStudent.latest_import.week_label || linkedStudent.latest_import.file_name}
                    </strong>
                    <small>
                      {linkedStudent.latest_import.report_date || 'Report date unavailable'}
                    </small>
                  </div>
                ) : null}
              </div>
            </div>

            {attendanceData.can_import_weekly ? (
              <form className="stack-form admin-import-form" onSubmit={handleWeeklyImport}>
                <label>
                  <span>Weekly attendance PDFs</span>
                  <input
                    multiple
                    onChange={(event) =>
                      setWeeklyFiles(Array.from(event.target.files || []))
                    }
                    type="file"
                    accept="application/pdf"
                  />
                </label>

                {weeklyFiles.length ? (
                  <div className="file-list">
                    {weeklyFiles.map((file) => (
                      <div className="file-pill" key={file.name}>
                        {file.name}
                      </div>
                    ))}
                  </div>
                ) : null}

                <button
                  className="primary-button"
                  disabled={importBusy || !viewer}
                  type="submit"
                >
                  {importBusy ? 'Importing weekly attendance...' : 'Upload weekly PDFs'}
                </button>
              </form>
            ) : null}

            {importSummary ? (
              <div className="status-grid">
                <div className="mini-card compact">
                  <span className="mini-label">Files imported</span>
                  <strong>{importSummary.total_files}</strong>
                  <small>{importSummary.total_students} students refreshed from the PDFs.</small>
                </div>
                {importSummary.imports.map((item) => (
                  <div className="mini-card compact" key={item.import.id}>
                    <span className="mini-label">{item.import.file_name}</span>
                    <strong>{item.student_count}</strong>
                    <small>{item.divisions.join(', ')}</small>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Daily Update</p>
                <h2>Submit today&apos;s attendance on top of the weekly baseline.</h2>
              </div>
              <span className="helper-pill">
                {linkedStudent ? 'Only linked students can update daily attendance' : 'Link first'}
              </span>
            </div>

            {linkedStudent ? (
              <form className="stack-form" onSubmit={handleDailyAttendanceSubmit}>
                <label className="inline-field">
                  <span>Date</span>
                  <input
                    onChange={(event) => setDailyAttendanceDate(event.target.value)}
                    type="date"
                    value={dailyAttendanceDate}
                  />
                </label>

                <div className="subject-check-grid">
                  {dailySubjects.map((subjectName) => (
                    <div className="subject-check-card" key={subjectName}>
                      <strong>{subjectName}</strong>
                      <label className="checkbox-row">
                        <input
                          checked={Boolean(dailyEntries[subjectName]?.was_class_held)}
                          onChange={(event) =>
                            updateDailyEntry(
                              subjectName,
                              'was_class_held',
                              event.target.checked
                            )
                          }
                          type="checkbox"
                        />
                        <span>Class was held</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={Boolean(dailyEntries[subjectName]?.was_present)}
                          onChange={(event) =>
                            updateDailyEntry(
                              subjectName,
                              'was_present',
                              event.target.checked
                            )
                          }
                          type="checkbox"
                        />
                        <span>I attended</span>
                      </label>
                    </div>
                  ))}
                </div>

                <button
                  className="primary-button"
                  disabled={dailyBusy || !viewer}
                  type="submit"
                >
                  {dailyBusy ? 'Saving daily update...' : 'Save daily attendance'}
                </button>
              </form>
            ) : (
              <div className="empty-state">
                The daily update panel unlocks after you link your enrollment number to an
                imported weekly attendance record.
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
                  <small>{attendanceData.attendance_percentage || 'No attendance linked yet'}</small>
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
                  <p className="section-kicker">Current Attendance</p>
                  <h2>Tracked subject totals</h2>
                </div>
              </div>

              {attendanceData.subjects.length ? (
                <div className="subject-list">
                  {attendanceData.subjects.map((subject) => {
                    const percentage = subject.total
                      ? `${((subject.attended / subject.total) * 100).toFixed(2)}%`
                      : '0.00%';

                    return (
                      <div className="subject-row" key={subject.subject_name}>
                        <div>
                          <strong>{subject.subject_name}</strong>
                          <span>
                            {subject.attended} attended out of {subject.total} conducted
                          </span>
                        </div>
                        <small>{percentage}</small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  Your subject totals will appear here after the weekly PDF is imported and
                  linked to your account.
                </div>
              )}
            </article>

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
