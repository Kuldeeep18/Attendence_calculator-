function DailyUpdatePanel({
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
    <div className="panel-card">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Daily Update</p>
          <h2>Use the academic calendar to fill pending attendance dates.</h2>
        </div>
        <span className="helper-pill">{linkedStudent ? `${pendingDates.length} pending` : 'Link first'}</span>
      </div>

      {linkedStudent ? (
        <>
          <div className="status-grid">
            <div className="mini-card compact">
              <span className="mini-label">Today</span>
              <strong>{formatDateLabel(attendanceData.current_date)}</strong>
              <small>The daily prompts stop at the current local date.</small>
            </div>
            <div className="mini-card compact">
              <span className="mini-label">Last weekly upload</span>
              <strong>{formatDateLabel(attendanceData.last_weekly_upload_date)}</strong>
              <small>{attendanceData.academic_calendar?.file_name || 'Academic calendar not found'}</small>
            </div>
          </div>

          {attendanceData.academic_calendar_error ? (
            <div className="error-banner">{attendanceData.academic_calendar_error}</div>
          ) : null}

          {pendingDates.length ? (
            <>
              <div className="pending-date-grid">
                {pendingDates.map((pendingDate) => (
                  <button
                    className={
                      pendingDate.date === dailyAttendanceDate
                        ? 'pending-date-button pending-date-button-active'
                        : 'pending-date-button'
                    }
                    key={pendingDate.date}
                    onClick={() => onSelectPendingDate(pendingDate.date)}
                    type="button"
                  >
                    <strong>{pendingDate.label}</strong>
                    <span>{pendingDate.description || 'Instructional day'}</span>
                  </button>
                ))}
              </div>

              {selectedPendingDate ? (
                <form className="stack-form" onSubmit={onDailySubmit}>
                  <div className="current-user-pill">
                    <span>Selected date</span>
                    <strong>{selectedPendingDate.label}</strong>
                    <small>
                      {selectedPendingDate.description || 'Regular teaching day'}
                    </small>
                  </div>

                  <div className="subject-check-grid">
                    {dailySubjects.map((subjectName) => (
                      <div className="subject-check-card" key={subjectName}>
                        <strong>{subjectName}</strong>
                        <label className="checkbox-row">
                          <input
                            checked={Boolean(dailyEntries[subjectName]?.was_class_held)}
                            onChange={(event) =>
                              onDailyEntryChange(subjectName, 'was_class_held', event.target.checked)
                            }
                            type="checkbox"
                          />
                          <span>Class was held</span>
                        </label>
                        <label className="checkbox-row">
                          <input
                            checked={Boolean(dailyEntries[subjectName]?.was_present)}
                            onChange={(event) =>
                              onDailyEntryChange(subjectName, 'was_present', event.target.checked)
                            }
                            type="checkbox"
                          />
                          <span>I attended</span>
                        </label>
                      </div>
                    ))}
                  </div>

                  <button className="primary-button" disabled={dailyBusy || !viewer} type="submit">
                    {dailyBusy ? 'Saving daily update...' : 'Save daily attendance'}
                  </button>
                </form>
              ) : (
                <div className="empty-state">
                  Select one of the pending regular teaching dates to save attendance.
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              No pending instructional dates between the latest weekly upload and today.
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">Link your enrollment number to unlock the daily update flow.</div>
      )}
    </div>
  );
}

export default DailyUpdatePanel;
