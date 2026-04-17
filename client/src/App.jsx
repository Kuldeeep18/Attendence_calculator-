import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';

import {
  addFriendByEnrollment,
  fetchAttendanceDashboard,
  fetchPlannerResult,
  fetchSelectableFriends,
  importWeeklyAttendance,
  linkStudentProfile,
  submitDailyAttendance
} from './api/plannerApi';
import AuthScreen from './features/auth/AuthScreen';
import DashboardScreen from './features/dashboard/DashboardScreen';
import { auth, firebaseEnabled } from './firebase';
import {
  createLocalUser,
  getCurrentLocalUser,
  signInLocalUser,
  signOutLocalUser
} from './localAuth';

function createEmptyAttendanceState() {
  return {
    profile: null,
    linked_student: null,
    subjects: [],
    recent_daily_logs: [],
    submitted_daily_dates: [],
    available_subjects: [],
    attendance_percentage: null,
    can_import_weekly: false,
    current_date: null,
    last_weekly_upload_date: null,
    academic_calendar: null,
    academic_calendar_error: null,
    timetable_lecture_hints: {},
    timetable_error: null,
    pending_attendance_dates: []
  };
}

function formatDateLabel(dateString) {
  if (!dateString) {
    return '--';
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const monthLabel = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];

  return `${weekday}, ${monthLabel} ${day}, ${year}`;
}

function normalizeNonNegativeInteger(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return 0;
  }

  return Math.floor(parsedValue);
}

function createBlankDailyEntries(subjectNames = [], suggestedLectureCounts = {}) {
  return Object.fromEntries(
    subjectNames.map((subjectName) => [
      subjectName,
      {
        held_lectures: normalizeNonNegativeInteger(suggestedLectureCounts[subjectName]),
        attended_lectures: 0,
        proxy_lectures: 0,
        use_proxy: false
      }
    ])
  );
}

const BUNK_TIMING_PREFERENCE = {
  NONE: 'NONE',
  BEFORE_BREAK: 'BEFORE_BREAK',
  AFTER_BREAK: 'AFTER_BREAK'
};

const MULTI_BUNK_PREFERENCE = {
  NONE: 'NONE',
  CONSECUTIVE: 'CONSECUTIVE',
  ALONE: 'ALONE'
};

function App() {
  const [viewer, setViewer] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [credentials, setCredentials] = useState({
    name: '',
    email: '',
    enrollmentNo: '',
    password: ''
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [friendsData, setFriendsData] = useState({ current_user: null, friends: [] });
  const [attendanceData, setAttendanceData] = useState(createEmptyAttendanceState);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bunkCount, setBunkCount] = useState(1);
  const [bunkTimingPreference, setBunkTimingPreference] = useState(BUNK_TIMING_PREFERENCE.NONE);
  const [multiBunkPreference, setMultiBunkPreference] = useState(MULTI_BUNK_PREFERENCE.NONE);
  const [plannerResult, setPlannerResult] = useState(null);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [profileEnrollmentNo, setProfileEnrollmentNo] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [weeklyFiles, setWeeklyFiles] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [dailyAttendanceDate, setDailyAttendanceDate] = useState('');
  const [dailyEntries, setDailyEntries] = useState({});
  const [dailyBusy, setDailyBusy] = useState(false);
  const [friendEnrollmentNo, setFriendEnrollmentNo] = useState('');
  const [friendBusy, setFriendBusy] = useState(false);

  useEffect(() => {
    if (!firebaseEnabled) {
      setViewer(getCurrentLocalUser());
      setAuthReady(true);
      return undefined;
    }

    return onAuthStateChanged(auth, (currentUser) => {
      setViewer(currentUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!authReady || !viewer) {
      return;
    }

    let isMounted = true;

    async function loadWorkspace() {
      setLoadingFriends(true);
      setLoadingAttendance(true);

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
        setSelectedUserIds(friendsResponse.friends.map((friend) => friend.id));
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
    const suggestedLectureCounts =
      attendanceData.timetable_lecture_hints?.[dailyAttendanceDate] || {};
    setDailyEntries(createBlankDailyEntries(subjectNames, suggestedLectureCounts));
  }, [
    attendanceData.available_subjects,
    attendanceData.timetable_lecture_hints,
    dailyAttendanceDate
  ]);

  useEffect(() => {
    const pendingDates = attendanceData.pending_attendance_dates || [];
    const firstPendingDate = pendingDates[0]?.date || '';

    if (!pendingDates.length) {
      if (dailyAttendanceDate) {
        setDailyAttendanceDate('');
      }
      return;
    }

    if (!pendingDates.some((item) => item.date === dailyAttendanceDate)) {
      setDailyAttendanceDate(firstPendingDate);
    }
  }, [attendanceData.pending_attendance_dates, dailyAttendanceDate]);

  useEffect(() => {
    if (bunkCount < 2 && multiBunkPreference !== MULTI_BUNK_PREFERENCE.NONE) {
      setMultiBunkPreference(MULTI_BUNK_PREFERENCE.NONE);
    }
  }, [bunkCount, multiBunkPreference]);

  const currentViewerName =
    viewer?.displayName ||
    attendanceData.profile?.name ||
    viewer?.email?.split('@')[0] ||
    'Student';

  async function refreshFriends(activeViewer = viewer) {
    const response = await fetchSelectableFriends(activeViewer);
    setFriendsData(response);
    setSelectedUserIds((previous) => {
      const validFriendIds = new Set(response.friends.map((friend) => friend.id));
      const preserved = previous.filter((friendId) => validFriendIds.has(friendId));
      return preserved.length ? preserved : response.friends.map((friend) => friend.id);
    });
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      let signedInUser = null;

      if (firebaseEnabled) {
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

          await registration.user.getIdToken(true);
          signedInUser = registration.user;
        } else {
          const loginResult = await signInWithEmailAndPassword(
            auth,
            credentials.email,
            credentials.password
          );
          signedInUser = loginResult.user;
        }
      } else {
        if (authMode === 'signup') {
          signedInUser = createLocalUser({
            name: credentials.name,
            email: credentials.email,
            password: credentials.password
          });
        } else {
          signedInUser = signInLocalUser({
            email: credentials.email,
            password: credentials.password
          });
        }

        setViewer(signedInUser);
      }

      if (authMode === 'signup' && credentials.enrollmentNo.trim()) {
        try {
          await linkStudentProfile(credentials.enrollmentNo, signedInUser);
          setStatusMessage('Account created and enrollment linked.');
        } catch (linkError) {
          setErrorMessage(linkError.message);
          setStatusMessage('Account created, but the enrollment still needs to be linked.');
        }
      } else if (authMode === 'signup') {
        setStatusMessage('Account created successfully.');
      }

      setCredentials((previous) => ({
        ...previous,
        password: '',
        enrollmentNo: authMode === 'signup' ? '' : previous.enrollmentNo
      }));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (firebaseEnabled) {
      await signOut(auth);
    } else {
      signOutLocalUser();
      setViewer(null);
    }

    setFriendsData({ current_user: null, friends: [] });
    setAttendanceData(createEmptyAttendanceState());
    setSelectedUserIds([]);
    setImportSummary(null);
    setWeeklyFiles([]);
    setDailyAttendanceDate('');
    setDailyEntries({});
    setFriendEnrollmentNo('');
    setProfileEnrollmentNo('');
    setBunkCount(1);
    setBunkTimingPreference(BUNK_TIMING_PREFERENCE.NONE);
    setMultiBunkPreference(MULTI_BUNK_PREFERENCE.NONE);
    setAuthMode('signin');
    setErrorMessage('');
    setPlannerResult(null);
    setStatusMessage('');
  }

  async function handleLinkStudent(event) {
    event.preventDefault();
    setLinkBusy(true);
    setErrorMessage('');

    try {
      setAttendanceData(await linkStudentProfile(profileEnrollmentNo, viewer));
      setStatusMessage('Enrollment linked successfully.');
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
      setAttendanceData(await fetchAttendanceDashboard(viewer));
      await refreshFriends(viewer);
      setStatusMessage('Weekly attendance imported successfully.');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setImportBusy(false);
    }
  }

  async function handleAddFriend(event) {
    event.preventDefault();
    setFriendBusy(true);
    setErrorMessage('');

    try {
      const response = await addFriendByEnrollment(friendEnrollmentNo, viewer);
      setFriendsData({ current_user: response.current_user, friends: response.friends });
      setFriendEnrollmentNo('');
      setStatusMessage(`Friend added${response.added_friend?.name ? `: ${response.added_friend.name}` : '.'}`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setFriendBusy(false);
    }
  }

  function handleDailyEntryChange(subjectName, field, value) {
    setDailyEntries((previous) => {
      const current = previous[subjectName] || {
        held_lectures: 0,
        attended_lectures: 0,
        proxy_lectures: 0,
        use_proxy: false
      };
      const next = {
        ...current
      };

      if (field === 'toggle_proxy') {
        next.use_proxy = !current.use_proxy;

        if (!next.use_proxy) {
          next.proxy_lectures = 0;
        }
      } else if (field === 'proxy_quick_add') {
        next.use_proxy = true;
        next.proxy_lectures = normalizeNonNegativeInteger(current.proxy_lectures + 1);
      } else {
        next[field] = normalizeNonNegativeInteger(value);

        if (field === 'proxy_lectures' && next.proxy_lectures > 0) {
          next.use_proxy = true;
        }
      }

      next.held_lectures = normalizeNonNegativeInteger(next.held_lectures);
      next.attended_lectures = normalizeNonNegativeInteger(next.attended_lectures);
      next.proxy_lectures = normalizeNonNegativeInteger(next.proxy_lectures);

      if (next.attended_lectures > next.held_lectures) {
        next.attended_lectures = next.held_lectures;
      }

      if (next.proxy_lectures > next.attended_lectures) {
        next.proxy_lectures = next.attended_lectures;
      }

      if (!next.use_proxy) {
        next.proxy_lectures = 0;
      }

      return {
        ...previous,
        [subjectName]: next
      };
    });
  }

  async function handleDailySubmit(event) {
    event.preventDefault();
    const pendingDates = attendanceData.pending_attendance_dates || [];

    if (!pendingDates.length) {
      setErrorMessage(
        'There are no pending regular teaching dates to update right now.'
      );
      return;
    }

    if (!pendingDates.some((pendingDate) => pendingDate.date === dailyAttendanceDate)) {
      setErrorMessage(
        'Select one of the pending regular teaching dates generated after the latest weekly coverage date.'
      );
      return;
    }

    const invalidDailyEntry = Object.entries(dailyEntries).find(([, entry]) =>
      entry.attended_lectures > entry.held_lectures ||
      entry.proxy_lectures > entry.attended_lectures
    );

    if (invalidDailyEntry) {
      setErrorMessage('Each subject must satisfy: attended lectures <= held lectures, and proxy lectures <= attended lectures.');
      return;
    }

    setDailyBusy(true);
    setErrorMessage('');

    try {
      setAttendanceData(
        await submitDailyAttendance(
          {
            attendanceDate: dailyAttendanceDate,
            entries: Object.entries(dailyEntries).map(([subject_name, entry]) => ({
              subject_name,
              held_lectures: entry.held_lectures,
              attended_lectures: entry.attended_lectures,
              proxy_lectures: entry.proxy_lectures
            }))
          },
          viewer
        )
      );
      setStatusMessage(`Saved daily attendance for ${formatDateLabel(dailyAttendanceDate)}.`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setDailyBusy(false);
    }
  }

  async function handlePlannerSubmit(event) {
    event.preventDefault();
    setSubmitBusy(true);
    setErrorMessage('');

    try {
      setPlannerResult(
        await fetchPlannerResult(
          {
            selectedUserIds,
            bunkCount,
            bunkTimingPreference,
            multiBunkPreference
          },
          viewer
        )
      );
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSubmitBusy(false);
    }
  }

  if (!authReady) {
    return (
      <div className="page-shell auth-shell">
        <main className="auth-layout">
          <section className="auth-card">
            <div className="identity-card">
              <strong>Loading session...</strong>
              <small>Checking your authentication state.</small>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!viewer) {
    return (
      <Routes>
        <Route
          path="/auth"
          element={
            <AuthScreen
              authBusy={authBusy}
              authMode={authMode}
              credentials={credentials}
              errorMessage={errorMessage}
              firebaseEnabled={firebaseEnabled}
              onCredentialsChange={(field, value) =>
                setCredentials((previous) => ({ ...previous, [field]: value }))
              }
              onModeChange={setAuthMode}
              onSubmit={handleAuthSubmit}
            />
          }
        />
        <Route path="*" element={<Navigate replace to="/auth" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="/dashboard/*"
        element={
          <DashboardScreen
            attendanceData={attendanceData}
            attendanceLoadingLabel={
              loadingAttendance || loadingFriends ? 'Refreshing workspace...' : null
            }
            bunkCount={bunkCount}
            bunkTimingPreference={bunkTimingPreference}
            multiBunkPreference={multiBunkPreference}
            currentViewerName={currentViewerName}
            dailyAttendanceDate={dailyAttendanceDate}
            dailyBusy={dailyBusy}
            dailyEntries={dailyEntries}
            errorMessage={errorMessage}
            friendBusy={friendBusy}
            friendEnrollmentNo={friendEnrollmentNo}
            friendsData={friendsData}
            formatDateLabel={formatDateLabel}
            importBusy={importBusy}
            importSummary={importSummary}
            linkBusy={linkBusy}
            linkedStudent={attendanceData.linked_student}
            loadingFriends={loadingFriends}
            onAddFriend={handleAddFriend}
            onDailyEntryChange={handleDailyEntryChange}
            onDailySubmit={handleDailySubmit}
            onFriendEnrollmentChange={setFriendEnrollmentNo}
            onLinkEnrollmentChange={setProfileEnrollmentNo}
            onLinkStudent={handleLinkStudent}
            onPlannerSubmit={handlePlannerSubmit}
            onSelectPendingDate={setDailyAttendanceDate}
            onSignOut={handleSignOut}
            onToggleFriend={(friendId) =>
              setSelectedUserIds((previous) =>
                previous.includes(friendId)
                  ? previous.filter((currentId) => currentId !== friendId)
                  : [...previous, friendId]
              )
            }
            onWeeklyFilesChange={(event) => setWeeklyFiles(Array.from(event.target.files || []))}
            onWeeklyImport={handleWeeklyImport}
            plannerResult={plannerResult}
            profileEnrollmentNo={profileEnrollmentNo}
            selectedUserIds={selectedUserIds}
            setBunkCount={setBunkCount}
            setBunkTimingPreference={setBunkTimingPreference}
            setMultiBunkPreference={setMultiBunkPreference}
            statusMessage={statusMessage}
            submitBusy={submitBusy}
            viewer={viewer}
            weeklyFiles={weeklyFiles}
          />
        }
      />
      <Route path="*" element={<Navigate replace to="/dashboard/overview" />} />
    </Routes>
  );
}

export default App;
