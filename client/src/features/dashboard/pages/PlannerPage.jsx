import { NavLink } from 'react-router-dom';

import PlannerSetupPanel from '../sections/PlannerSetupPanel';

function PlannerPage({
  onAddFriend,
  onFriendEnrollmentChange,
  friendEnrollmentNo,
  friendBusy,
  viewer,
  onPlannerSubmit,
  bunkCount,
  setBunkCount,
  bunkTimingPreference,
  setBunkTimingPreference,
  multiBunkPreference,
  setMultiBunkPreference,
  loadingFriends,
  selectedUserIds,
  friendsData,
  currentViewerName,
  attendanceData,
  onToggleFriend,
  submitBusy,
  plannerResult
}) {
  return (
    <section className="workspace-panel">
      <PlannerSetupPanel
        onAddFriend={onAddFriend}
        onFriendEnrollmentChange={onFriendEnrollmentChange}
        friendEnrollmentNo={friendEnrollmentNo}
        friendBusy={friendBusy}
        viewer={viewer}
        onPlannerSubmit={onPlannerSubmit}
        bunkCount={bunkCount}
        setBunkCount={setBunkCount}
        bunkTimingPreference={bunkTimingPreference}
        setBunkTimingPreference={setBunkTimingPreference}
        multiBunkPreference={multiBunkPreference}
        setMultiBunkPreference={setMultiBunkPreference}
        loadingFriends={loadingFriends}
        selectedUserIds={selectedUserIds}
        friendsData={friendsData}
        currentViewerName={currentViewerName}
        attendanceData={attendanceData}
        onToggleFriend={onToggleFriend}
        submitBusy={submitBusy}
      />

      <article className="panel-card">
        <div className="section-heading compact">
          <div>
            <p className="section-kicker">Planner Output</p>
            <h2>See detailed recommendations</h2>
          </div>
        </div>

        <div className="identity-card">
          <strong>{plannerResult ? 'Latest plan is ready.' : 'No plan generated yet.'}</strong>
          <span>
            {plannerResult
              ? 'Open the results page to review schedule slots and subject-level impact.'
              : 'Submit planner setup first, then open the results page to review recommendations.'}
          </span>
          <small>
            <NavLink className="inline-link" to="/dashboard/results">
              Open results page
            </NavLink>
          </small>
        </div>
      </article>
    </section>
  );
}

export default PlannerPage;
