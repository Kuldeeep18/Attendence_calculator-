function HeroPanel({
  attendanceData,
  linkedStudent,
  pendingDates,
  formatDateLabel
}) {
  return (
    <section className="hero-panel">
      <div>
        <p className="eyebrow">Smart Attendance Manager</p>
        <h1>Weekly PDFs in. Daily prompts from the academic calendar out.</h1>
        <p className="hero-copy">
          The app now uses your academic calendar PDF to suggest pending attendance
          dates after the latest weekly upload, and it supports adding friends by enrollment.
        </p>
      </div>

      <div className="feature-strip">
        <article className="mini-card">
          <span className="mini-label">Current Attendance</span>
          <strong>{attendanceData.attendance_percentage || '--'}</strong>
          <small>
            {linkedStudent
              ? `${linkedStudent.division} | Enrollment ${linkedStudent.enrollment_no}`
              : 'Link your imported enrollment number to see live attendance.'}
          </small>
        </article>
        <article className="mini-card">
          <span className="mini-label">Pending Dates</span>
          <strong>{pendingDates.length}</strong>
          <small>
            {attendanceData.last_weekly_upload_date
              ? `From ${formatDateLabel(attendanceData.last_weekly_upload_date)} to ${formatDateLabel(attendanceData.current_date)}`
              : 'Import and link a weekly attendance sheet first.'}
          </small>
        </article>
      </div>
    </section>
  );
}

export default HeroPanel;
