import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import AttendancePage from './pages/AttendancePage';
import DailyUpdatePage from './pages/DailyUpdatePage';
import OverviewPage from './pages/OverviewPage';
import PlannerPage from './pages/PlannerPage';
import ResultsPage from './pages/ResultsPage';

const NAV_ITEMS = [
  { path: 'overview', label: 'Overview' },
  { path: 'attendance', label: 'Attendance Sync' },
  { path: 'daily-update', label: 'Daily Update' },
  { path: 'planner', label: 'Planner' },
  { path: 'results', label: 'Results' }
];

function DashboardScreen({
  attendanceData,
  attendanceLoadingLabel,
  bunkCount,
  bunkTimingPreference,
  multiBunkPreference,
  currentViewerName,
  dailyAttendanceDate,
  dailyBusy,
  dailyEntries,
  errorMessage,
  friendBusy,
  friendEnrollmentNo,
  friendsData,
  importBusy,
  importSummary,
  linkBusy,
  linkedStudent,
  loadingFriends,
  onAddFriend,
  onDailyEntryChange,
  onDailySubmit,
  onFriendEnrollmentChange,
  onLinkEnrollmentChange,
  onLinkStudent,
  onPlannerSubmit,
  onSelectPendingDate,
  onSignOut,
  onToggleFriend,
  onWeeklyFilesChange,
  onWeeklyImport,
  plannerResult,
  profileEnrollmentNo,
  selectedUserIds,
  statusMessage,
  submitBusy,
  viewer,
  weeklyFiles,
  formatDateLabel,
  setBunkCount,
  setBunkTimingPreference,
  setMultiBunkPreference
}) {
  const pendingDates = attendanceData.pending_attendance_dates || [];
  const dailySubjects = attendanceData.available_subjects || [];
  const selectedPendingDate =
    pendingDates.find((pendingDate) => pendingDate.date === dailyAttendanceDate) || null;
  const nextSharedLecture = plannerResult?.next_shared_lecture || null;
  const bestSharedLecture = plannerResult?.best_shared_lecture || null;
  const recommendedSlots = plannerResult?.recommended_slots || [];

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <main className="dashboard-shell">
        <header className="panel-card dashboard-navbar">
          <div className="navbar-brand">
            <p className="section-kicker">Smart Attendance Manager</p>
            <h2>{currentViewerName}</h2>
          </div>

          <nav className="navbar-links" aria-label="Dashboard pages">
            {NAV_ITEMS.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'nav-link nav-link-active' : 'nav-link'
                }
                key={item.path}
                to={`/dashboard/${item.path}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button className="ghost-button" onClick={onSignOut} type="button">
            Sign out
          </button>
        </header>

        {statusMessage ? <div className="success-banner">{statusMessage}</div> : null}
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

        <Routes>
          <Route index element={<Navigate to="/dashboard/overview" replace />} />
          <Route
            path="overview"
            element={
              <OverviewPage
                attendanceData={attendanceData}
                linkedStudent={linkedStudent}
                pendingDates={pendingDates}
                formatDateLabel={formatDateLabel}
                currentViewerName={currentViewerName}
                viewer={viewer}
                onSignOut={onSignOut}
                plannerResult={plannerResult}
              />
            }
          />
          <Route
            path="attendance"
            element={
              <AttendancePage
                attendanceLoadingLabel={attendanceLoadingLabel}
                onLinkStudent={onLinkStudent}
                onLinkEnrollmentChange={onLinkEnrollmentChange}
                profileEnrollmentNo={profileEnrollmentNo}
                linkBusy={linkBusy}
                viewer={viewer}
                linkedStudent={linkedStudent}
                currentViewerName={currentViewerName}
                formatDateLabel={formatDateLabel}
                attendanceData={attendanceData}
                onWeeklyImport={onWeeklyImport}
                onWeeklyFilesChange={onWeeklyFilesChange}
                weeklyFiles={weeklyFiles}
                importBusy={importBusy}
                importSummary={importSummary}
              />
            }
          />
          <Route
            path="daily-update"
            element={
              <DailyUpdatePage
                linkedStudent={linkedStudent}
                pendingDates={pendingDates}
                attendanceData={attendanceData}
                formatDateLabel={formatDateLabel}
                dailyAttendanceDate={dailyAttendanceDate}
                onSelectPendingDate={onSelectPendingDate}
                selectedPendingDate={selectedPendingDate}
                onDailySubmit={onDailySubmit}
                dailySubjects={dailySubjects}
                dailyEntries={dailyEntries}
                onDailyEntryChange={onDailyEntryChange}
                dailyBusy={dailyBusy}
                viewer={viewer}
              />
            }
          />
          <Route
            path="planner"
            element={
              <PlannerPage
                onAddFriend={onAddFriend}
                onFriendEnrollmentChange={onFriendEnrollmentChange}
                friendEnrollmentNo={friendEnrollmentNo}
                friendBusy={friendBusy}
                viewer={viewer}
                onPlannerSubmit={onPlannerSubmit}
                bunkCount={bunkCount}
                setBunkCount={setBunkCount}
                bunkTimingPreference={bunkTimingPreference}
                setBunkTimingPreference={setBunkTimingPreference}
                multiBunkPreference={multiBunkPreference}
                setMultiBunkPreference={setMultiBunkPreference}
                loadingFriends={loadingFriends}
                selectedUserIds={selectedUserIds}
                friendsData={friendsData}
                currentViewerName={currentViewerName}
                attendanceData={attendanceData}
                onToggleFriend={onToggleFriend}
                submitBusy={submitBusy}
                plannerResult={plannerResult}
              />
            }
          />
          <Route
            path="results"
            element={
              <ResultsPage
                plannerResult={plannerResult}
                nextSharedLecture={nextSharedLecture}
                bestSharedLecture={bestSharedLecture}
                recommendedSlots={recommendedSlots}
                attendanceData={attendanceData}
              />
            }
          />
          <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default DashboardScreen;
