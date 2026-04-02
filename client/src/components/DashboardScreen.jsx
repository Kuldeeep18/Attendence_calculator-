import {
  AttendanceSyncPanel,
  DailyUpdatePanel,
  HeroPanel,
  PlannerSetupPanel,
  ProfilePanel,
  ResultsGrid
} from '../features/dashboard/sections';

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

      <main className="app-grid">
        <HeroPanel
          attendanceData={attendanceData}
          linkedStudent={linkedStudent}
          pendingDates={pendingDates}
          formatDateLabel={formatDateLabel}
        />

        <section className="workspace-panel">
          <ProfilePanel
            currentViewerName={currentViewerName}
            viewer={viewer}
            linkedStudent={linkedStudent}
            onSignOut={onSignOut}
          />

          <AttendanceSyncPanel
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

          <DailyUpdatePanel
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

          <PlannerSetupPanel
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
          />

          {statusMessage ? <div className="success-banner">{statusMessage}</div> : null}
          {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

          <ResultsGrid
            plannerResult={plannerResult}
            nextSharedLecture={nextSharedLecture}
            bestSharedLecture={bestSharedLecture}
            recommendedSlots={recommendedSlots}
            attendanceData={attendanceData}
          />
        </section>
      </main>
    </div>
  );
}

export default DashboardScreen;
