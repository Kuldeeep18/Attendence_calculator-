import HeroPanel from '../sections/HeroPanel';
import ProfilePanel from '../sections/ProfilePanel';

function OverviewPage({
  attendanceData,
  linkedStudent,
  pendingDates,
  formatDateLabel,
  currentViewerName,
  viewer,
  onSignOut,
  plannerResult
}) {
  const nextSharedLecture = plannerResult?.next_shared_lecture || null;

  return (
    <div className="app-grid">
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

        <article className="panel-card">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Overview</p>
              <h2>Quick snapshot</h2>
            </div>
          </div>

          <div className="status-grid">
            <div className="mini-card compact">
              <span className="mini-label">Tracked subjects</span>
              <strong>{attendanceData.subjects.length}</strong>
              <small>Subjects currently available in your attendance record.</small>
            </div>

            <div className="mini-card compact">
              <span className="mini-label">Pending updates</span>
              <strong>{pendingDates.length}</strong>
              <small>Daily attendance entries waiting to be filled.</small>
            </div>

            <div className="mini-card compact">
              <span className="mini-label">Next group slot</span>
              <strong>{nextSharedLecture ? 'Ready' : 'Not generated'}</strong>
              <small>
                {nextSharedLecture
                  ? nextSharedLecture.title
                  : 'Create a planner result to see the next shared bunk slot.'}
              </small>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

export default OverviewPage;
