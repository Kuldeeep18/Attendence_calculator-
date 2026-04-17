import { useEffect, useMemo, useState } from 'react';

function formatPercentage(ratio) {
  return `${(ratio * 100).toFixed(2)}%`;
}

function buildSubjectImpact(subject) {
  const attended = Number(subject.attended || 0);
  const total = Number(subject.total || 0);
  const currentRatio = total > 0 ? attended / total : 0;
  const futureRatio = attended / (total + 1);
  const dropRatio = Math.max(0, currentRatio - futureRatio);

  return {
    subject_name: subject.subject_name,
    attended,
    total,
    current_attendance: formatPercentage(currentRatio),
    future_attendance: formatPercentage(futureRatio),
    drop_percentage: `${(dropRatio * 100).toFixed(2)}%`
  };
}

function ResultsGrid({
  plannerResult,
  nextSharedLecture,
  bestSharedLecture,
  recommendedSlots,
  attendanceData
}) {
  const subjectImpactRows = useMemo(
    () => (attendanceData.subjects || []).map(buildSubjectImpact),
    [attendanceData.subjects]
  );
  const [selectedSubjectName, setSelectedSubjectName] = useState(
    subjectImpactRows[0]?.subject_name || ''
  );

  useEffect(() => {
    if (!subjectImpactRows.length) {
      if (selectedSubjectName) {
        setSelectedSubjectName('');
      }
      return;
    }

    if (!subjectImpactRows.some((subject) => subject.subject_name === selectedSubjectName)) {
      setSelectedSubjectName(subjectImpactRows[0].subject_name);
    }
  }, [selectedSubjectName, subjectImpactRows]);

  const selectedSubjectImpact =
    subjectImpactRows.find((subject) => subject.subject_name === selectedSubjectName) || null;
  const attendanceTotals = useMemo(
    () =>
      (attendanceData.subjects || []).reduce(
        (totals, subject) => ({
          attended: totals.attended + Number(subject.attended || 0),
          total: totals.total + Number(subject.total || 0)
        }),
        { attended: 0, total: 0 }
      ),
    [attendanceData.subjects]
  );
  const currentOverallRatio =
    attendanceTotals.total > 0 ? attendanceTotals.attended / attendanceTotals.total : 0;
  const futureOverallRatio = selectedSubjectImpact
    ? attendanceTotals.attended / (attendanceTotals.total + 1)
    : currentOverallRatio;
  const overallDropRatio = Math.max(0, currentOverallRatio - futureOverallRatio);

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
            <h2>Subject Drop Simulator</h2>
          </div>
        </div>

        {subjectImpactRows.length ? (
          <>
            <form className="planner-form" onSubmit={(event) => event.preventDefault()}>
              <label className="inline-field">
                <span>Select one subject to bunk 1 lecture</span>
                <select
                  onChange={(event) => setSelectedSubjectName(event.target.value)}
                  value={selectedSubjectName}
                >
                  {subjectImpactRows.map((subject) => (
                    <option key={subject.subject_name} value={subject.subject_name}>
                      {subject.subject_name}
                    </option>
                  ))}
                </select>
              </label>
            </form>

            <div className="status-grid">
              <div className="mini-card compact">
                <span className="mini-label">Selected Subject</span>
                <strong>{selectedSubjectImpact?.subject_name || '--'}</strong>
                <small>
                  {selectedSubjectImpact
                    ? `Current ${selectedSubjectImpact.current_attendance} | After 1 bunk ${selectedSubjectImpact.future_attendance}`
                    : 'Select a subject to simulate one bunk lecture.'}
                </small>
                {selectedSubjectImpact ? (
                  <small>Drop {selectedSubjectImpact.drop_percentage}</small>
                ) : null}
              </div>

              <div className="mini-card compact">
                <span className="mini-label">Overall Attendance Impact</span>
                <strong>
                  {formatPercentage(currentOverallRatio)} {'->'} {formatPercentage(futureOverallRatio)}
                </strong>
                <small>
                  {selectedSubjectImpact
                    ? `If you bunk one lecture in ${selectedSubjectImpact.subject_name}.`
                    : 'Select a subject to calculate the overall impact.'}
                </small>
                {selectedSubjectImpact ? (
                  <small>Drop {(overallDropRatio * 100).toFixed(2)}%</small>
                ) : null}
              </div>
            </div>

            <div className="subject-list">
              {subjectImpactRows.map((subject) => (
                <div
                  className={
                    subject.subject_name === selectedSubjectName
                      ? 'subject-row subject-row-active'
                      : 'subject-row'
                  }
                  key={subject.subject_name}
                >
                  <div>
                    <strong>{subject.subject_name}</strong>
                    <span>
                      Current {subject.current_attendance} | After 1 bunk {subject.future_attendance}
                    </span>
                  </div>
                  <small>Drop {subject.drop_percentage}</small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            Link your account and sync attendance to simulate subject-wise bunk drops.
          </div>
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
