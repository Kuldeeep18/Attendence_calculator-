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
  const calendarStatusText = attendanceData.academic_calendar?.file_name
    ? attendanceData.academic_calendar.file_name
    : attendanceData.last_weekly_upload_date
      ? 'Academic calendar could not be loaded'
      : 'Upload a weekly attendance PDF to enable calendar-based dates';
  const selectedDateLectureHints =
    attendanceData.timetable_lecture_hints?.[dailyAttendanceDate] || {};

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
              <span className="mini-label">Weekly coverage till</span>
              <strong>{formatDateLabel(attendanceData.last_weekly_upload_date)}</strong>
              <small>{calendarStatusText}</small>
            </div>
          </div>

          {attendanceData.academic_calendar_error ? (
            <div className="error-banner">{attendanceData.academic_calendar_error}</div>
          ) : null}

          {attendanceData.timetable_error ? (
            <div className="error-banner">{attendanceData.timetable_error}</div>
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
                        <small className="subject-lecture-hint">
                          Timetable suggestion: {selectedDateLectureHints[subjectName] || 0} lecture(s)
                        </small>

                        <label className="inline-field compact-field">
                          <span>Lectures held</span>
                          <input
                            min="0"
                            onChange={(event) =>
                              onDailyEntryChange(subjectName, 'held_lectures', event.target.value)
                            }
                            type="number"
                            value={dailyEntries[subjectName]?.held_lectures ?? 0}
                          />
                        </label>

                        <label className="inline-field compact-field">
                          <span>Lectures attended</span>
                          <input
                            min="0"
                            onChange={(event) =>
                              onDailyEntryChange(subjectName, 'attended_lectures', event.target.value)
                            }
                            type="number"
                            value={dailyEntries[subjectName]?.attended_lectures ?? 0}
                          />
                        </label>

                        <div className="proxy-action-row">
                          <button
                            className={
                              dailyEntries[subjectName]?.use_proxy
                                ? 'ghost-button proxy-button-active'
                                : 'ghost-button'
                            }
                            onClick={() => onDailyEntryChange(subjectName, 'toggle_proxy', true)}
                            type="button"
                          >
                            {dailyEntries[subjectName]?.use_proxy ? 'Proxy enabled' : 'Add proxy'}
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() => onDailyEntryChange(subjectName, 'proxy_quick_add', 1)}
                            type="button"
                          >
                            Proxy +1
                          </button>
                        </div>

                        {dailyEntries[subjectName]?.use_proxy ? (
                          <label className="inline-field compact-field">
                            <span>Proxy lectures</span>
                            <input
                              min="0"
                              onChange={(event) =>
                                onDailyEntryChange(subjectName, 'proxy_lectures', event.target.value)
                              }
                              type="number"
                              value={dailyEntries[subjectName]?.proxy_lectures ?? 0}
                            />
                          </label>
                        ) : null}

                        <small className="subject-impact-note">
                          This update adds +{dailyEntries[subjectName]?.attended_lectures ?? 0}/
                          {dailyEntries[subjectName]?.held_lectures ?? 0} for this subject.
                        </small>
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
              No pending instructional dates between the weekly coverage date and today.
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
