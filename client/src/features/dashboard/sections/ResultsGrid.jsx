function ResultsGrid({
  plannerResult,
  nextSharedLecture,
  bestSharedLecture,
  recommendedSlots,
  attendanceData
}) {
  return (
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
              <div className="user-card" key={user.id || user.name}>
                <strong>{user.name}</strong>
                <span>{user.attendance}</span>
                <small>{user.safe_bunks} safe bunks remaining</small>

                {user.timetable_subjects_before_after?.length ? (
                  <div className="user-subject-breakdown">
                    {user.timetable_subjects_before_after.map((item, index) => (
                      <div
                        className="user-subject-impact"
                        key={`${user.id || user.name}-${item.date}-${item.lecture_no}-${item.subject_name}-${index}`}
                      >
                        <strong>{item.subject_name}</strong>
                        <span>{item.before_attendance} {'->'} {item.after_attendance}</span>
                        <small>{item.title}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">Generate a plan to see group attendance projections here.</div>
        )}
      </article>
    </div>
  );
}

export default ResultsGrid;
