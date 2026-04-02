import DailyUpdatePanel from '../sections/DailyUpdatePanel';

function DailyUpdatePage({
  linkedStudent,
  pendingDates,
  attendanceData,
  formatDateLabel,
  dailyAttendanceDate,
  onSelectPendingDate,
  selectedPendingDate,
  onDailySubmit,
  dailySubjects,
  dailyEntries,
  onDailyEntryChange,
  dailyBusy,
  viewer
}) {
  return (
    <section className="workspace-panel">
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
    </section>
  );
}

export default DailyUpdatePage;
