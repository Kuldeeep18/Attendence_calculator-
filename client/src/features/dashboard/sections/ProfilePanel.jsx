function ProfilePanel({
  currentViewerName,
  viewer,
  linkedStudent,
  onSignOut
}) {
  return (
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
  );
}

export default ProfilePanel;
