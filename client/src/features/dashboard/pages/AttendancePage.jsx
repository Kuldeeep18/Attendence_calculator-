import AttendanceSyncPanel from '../sections/AttendanceSyncPanel';

function AttendancePage({
  attendanceLoadingLabel,
  onLinkStudent,
  onLinkEnrollmentChange,
  profileEnrollmentNo,
  linkBusy,
  viewer,
  linkedStudent,
  currentViewerName,
  formatDateLabel,
  attendanceData,
  onWeeklyImport,
  onWeeklyFilesChange,
  weeklyFiles,
  importBusy,
  importSummary
}) {
  return (
    <section className="workspace-panel">
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
    </section>
  );
}

export default AttendancePage;
