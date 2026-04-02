function AttendanceSyncPanel({
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
    <div className="panel-card">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Attendance Sync</p>
          <h2>Link enrollment and import weekly PDFs.</h2>
        </div>
        {attendanceLoadingLabel ? <span className="helper-pill">{attendanceLoadingLabel}</span> : null}
      </div>

      <div className="sync-grid">
        <form className="stack-form" onSubmit={onLinkStudent}>
          <label>
            <span>Enrollment number</span>
            <input
              onChange={(event) => onLinkEnrollmentChange(event.target.value)}
              placeholder="24002171210181"
              type="text"
              value={profileEnrollmentNo}
            />
          </label>

          <button className="primary-button" disabled={linkBusy || !viewer} type="submit">
            {linkBusy ? 'Linking...' : linkedStudent ? 'Refresh my link' : 'Link my attendance'}
          </button>
        </form>

        <div className="stack-panel">
          {linkedStudent ? (
            <div className="identity-card">
              <strong>{linkedStudent.name || currentViewerName}</strong>
              <span>{linkedStudent.division} | Roll {linkedStudent.roll_no || '--'}</span>
              <small>
                Enrollment {linkedStudent.enrollment_no}
                {linkedStudent.mentor_name ? ` | Mentor ${linkedStudent.mentor_name}` : ''}
              </small>
            </div>
          ) : (
            <div className="empty-state">Link your enrollment after the weekly PDF is imported.</div>
          )}

          {linkedStudent?.latest_import ? (
            <div className="current-user-pill">
              <span>Latest weekly upload</span>
              <strong>
                {linkedStudent.latest_import.week_label || linkedStudent.latest_import.file_name}
              </strong>
              <small>{formatDateLabel(linkedStudent.latest_import.report_date)}</small>
            </div>
          ) : null}
        </div>
      </div>

      {attendanceData.can_import_weekly ? (
        <form className="stack-form admin-import-form" onSubmit={onWeeklyImport}>
          <label>
            <span>Weekly attendance PDFs</span>
            <input multiple onChange={onWeeklyFilesChange} type="file" accept="application/pdf" />
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

          <button className="primary-button" disabled={importBusy || !viewer} type="submit">
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
  );
}

export default AttendanceSyncPanel;
