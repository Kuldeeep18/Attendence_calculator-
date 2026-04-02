import ResultsGrid from '../sections/ResultsGrid';

function ResultsPage({
  plannerResult,
  nextSharedLecture,
  bestSharedLecture,
  recommendedSlots,
  attendanceData
}) {
  return (
    <section className="workspace-panel">
      {!plannerResult ? (
        <article className="panel-card">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Results</p>
              <h2>No plan generated yet</h2>
            </div>
          </div>
          <div className="empty-state">
            Create a group bunk plan in the Planner page first, then view full timetable and
            attendance projections here.
          </div>
        </article>
      ) : null}

      <ResultsGrid
        plannerResult={plannerResult}
        nextSharedLecture={nextSharedLecture}
        bestSharedLecture={bestSharedLecture}
        recommendedSlots={recommendedSlots}
        attendanceData={attendanceData}
      />
    </section>
  );
}

export default ResultsPage;
