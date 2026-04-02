function PlannerSetupPanel({
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
  submitBusy
}) {
  return (
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
          <span>How many upcoming classes to bunk?</span>
          <input
            min="0"
            onChange={(event) => setBunkCount(Number(event.target.value))}
            type="number"
            value={bunkCount}
          />
          <small className="field-help">
            Example: 2 means the planner will try to find two safe bunk opportunities.
          </small>
        </label>

        <label className="inline-field">
          <span>When should we prefer bunking?</span>
          <select
            onChange={(event) => setBunkTimingPreference(event.target.value)}
            value={bunkTimingPreference}
          >
            <option value="NONE">No preference</option>
            <option value="BEFORE_BREAK">Before the break</option>
            <option value="AFTER_BREAK">After the break</option>
          </select>
          <small className="field-help">
            Use this if you prefer morning or post-break lecture slots.
          </small>
        </label>

        {bunkCount >= 2 ? (
          <label className="inline-field">
            <span>How should multiple bunks be placed?</span>
            <select
              onChange={(event) => setMultiBunkPreference(event.target.value)}
              value={multiBunkPreference}
            >
              <option value="NONE">No preference</option>
              <option value="CONSECUTIVE">Consecutive lectures (back-to-back)</option>
              <option value="ALONE">Separate lectures (not back-to-back)</option>
            </select>
            <small className="field-help">
              This helps when you want bunks grouped together or spaced apart.
            </small>
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
          {submitBusy ? 'Calculating plan...' : 'Show group bunk plan'}
        </button>
      </form>
    </div>
  );
}

export default PlannerSetupPanel;
