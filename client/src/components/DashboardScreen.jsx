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

        <section className="workspace-panel">
          <div className="panel-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Profile</p>
                <h2>{currentViewerName}</h2>
              </div>
              <button className="ghost-button" onClick={onSignOut} type="button">
                Sign out
              </button>
            </div>

            <div className="identity-card">
              <strong>{currentViewerName}</strong>
              <span>{viewer?.email || 'demo@student.local'}</span>
              <small>
                {linkedStudent
                  ? `${linkedStudent.name || currentViewerName} | ${linkedStudent.division} | Roll ${linkedStudent.roll_no || '--'}`
                  : 'Link your enrollment number to connect the imported attendance record to this account.'}
              </small>
            </div>
          </div>

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

          <div className="panel-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Planner Setup</p>
                <h2>Pick the crew and simulate the bunk.</h2>
              </div>
              <span className="helper-pill">You are always included in the calculation</span>
            </div>

            <form className="inline-form" onSubmit={onAddFriend}>
              <label className="inline-field grow-field">
                <span>Add friend by enrollment</span>
                <input
                  onChange={(event) => onFriendEnrollmentChange(event.target.value)}
                  placeholder="Enter your friend's enrollment number"
                  type="text"
                  value={friendEnrollmentNo}
                />
              </label>
              <button className="primary-button" disabled={friendBusy || !viewer} type="submit">
                {friendBusy ? 'Adding friend...' : 'Add friend'}
              </button>
            </form>

            <small className="muted-copy">
              Your friend must sign up and link their enrollment before they can be added here.
            </small>

            <form className="planner-form" onSubmit={onPlannerSubmit}>
              <label className="inline-field">
                <span>Future bunks to simulate</span>
                <input
                  min="0"
                  onChange={(event) => setBunkCount(Number(event.target.value))}
                  type="number"
                  value={bunkCount}
                />
              </label>

              <label className="inline-field">
                <span>Bunk timing preference</span>
                <select
                  onChange={(event) => setBunkTimingPreference(event.target.value)}
                  value={bunkTimingPreference}
                >
                  <option value="NONE">None</option>
                  <option value="BEFORE_BREAK">Before break bunk</option>
                  <option value="AFTER_BREAK">After break bunk</option>
                </select>
              </label>

              {bunkCount >= 2 ? (
                <label className="inline-field">
                  <span>2+ bunk mode</span>
                  <select
                    onChange={(event) => setMultiBunkPreference(event.target.value)}
                    value={multiBunkPreference}
                  >
                    <option value="NONE">None</option>
                    <option value="CONSECUTIVE">Consecutive lectures</option>
                    <option value="ALONE">Alone lectures</option>
                  </select>
                </label>
              ) : null}

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
                  <div className="empty-state">Add friends by enrollment to start planning bunks.</div>
                ) : (
                  friendsData.friends.map((friend) => (
                    <label className="friend-option" key={friend.id}>
                      <input
                        checked={selectedUserIds.includes(friend.id)}
                        onChange={() => onToggleFriend(friend.id)}
                        type="checkbox"
                      />
                      <div>
                        <strong>{friend.name}</strong>
                        <span>{friend.attendance}</span>
                        {friend.enrollment_no ? <small>{friend.enrollment_no}</small> : null}
                      </div>
                      <small>{friend.subject_count} subjects tracked</small>
                    </label>
                  ))
                )}
              </div>

              <button className="primary-button" disabled={submitBusy || !viewer || loadingFriends} type="submit">
                {submitBusy ? 'Calculating plan...' : 'Generate group bunk plan'}
              </button>
            </form>
          </div>

          {statusMessage ? <div className="success-banner">{statusMessage}</div> : null}
          {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

          <div className="results-grid">
            <article className="panel-card schedule-panel">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Next Group Bunk</p>
                  <h2>Best timetable-based lecture plan</h2>
                </div>
              </div>

              {plannerResult?.schedule_recommendation_error ? (
                <div className="error-banner">{plannerResult.schedule_recommendation_error}</div>
              ) : recommendedSlots.length ? (
                <div className="schedule-panel-body">
                  {plannerResult?.timetable?.file_name ? (
                    <div className="current-user-pill">
                      <span>Timetable source</span>
                      <strong>{plannerResult.timetable.file_name}</strong>
                      <small>
                        {plannerResult.timetable.effective_from
                          ? `Effective from ${plannerResult.timetable.effective_from}`
                          : 'Using the uploaded timetable in the project folder.'}
                      </small>
                    </div>
                  ) : null}

                  {nextSharedLecture ? (
                    <div className="slot-highlight-card">
                      <span className="slot-tag">Next lecture to bunk together</span>
                      <strong>{nextSharedLecture.title}</strong>
                      <small>{nextSharedLecture.calendar_description}</small>
                    </div>
                  ) : null}

                  {bestSharedLecture ? (
                    <div className="slot-highlight-card subtle">
                      <span className="slot-tag">Best attendance buffer</span>
                      <strong>{bestSharedLecture.title}</strong>
                      <small>
                        Lowest post-bunk attendance stays at{' '}
                        {(bestSharedLecture.minimum_future_ratio * 100).toFixed(2)}%.
                      </small>
                    </div>
                  ) : null}

                  <div className="slot-list">
                    {recommendedSlots.map((slot) => (
                      <div className="slot-card" key={`${slot.date}-${slot.lecture_no}`}>
                        <div className="slot-card-header">
                          <div>
                            <strong>{slot.title}</strong>
                            <span>{slot.calendar_description}</span>
                          </div>
                          <small>
                            Lowest after bunk {(slot.minimum_future_ratio * 100).toFixed(2)}%
                          </small>
                        </div>

                        <div className="slot-participant-list">
                          {slot.participants.map((participant) => (
                            <div className="slot-participant-row" key={`${slot.title}-${participant.user_id}`}>
                              <div>
                                <strong>{participant.name}</strong>
                                <span>
                                  {participant.division} | {participant.subject_name}
                                </span>
                              </div>
                              <small>
                                {participant.before_attendance} {'->'} {participant.after_attendance}
                              </small>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  Generate a group bunk plan to see the next shared lecture and the
                  before-vs-after attendance impact for each selected student.
                </div>
              )}
            </article>

            <article className="panel-card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Current Attendance</p>
                  <h2>Tracked subject totals</h2>
                </div>
              </div>

              {attendanceData.subjects.length ? (
                <div className="subject-list">
                  {attendanceData.subjects.map((subject) => (
                    <div className="subject-row" key={subject.subject_name}>
                      <div>
                        <strong>{subject.subject_name}</strong>
                        <span>{subject.attended} attended out of {subject.total} conducted</span>
                      </div>
                      <small>
                        {subject.total ? `${((subject.attended / subject.total) * 100).toFixed(2)}%` : '0.00%'}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Your subject totals will appear here after linking your account.</div>
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
                        <span>Current {subject.attendance} | Future {subject.future_attendance}</span>
                      </div>
                      <small>Risk drop {subject.risk_drop}%</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Generate a plan to see bunk-safe subject recommendations.</div>
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
                <div className="empty-state">Generate a plan to see group attendance projections here.</div>
              )}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DashboardScreen;
