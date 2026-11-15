const STATE_LABEL = { done: 'Done', todo: 'Not done', blocked: 'Blocked', locked: 'Locked' };

/*
  Every stage in strict order. Done is green, not done or blocked is red, and a locked stage is grey and says why
  it is locked. Stages the app has no screens for yet are marked as coming later.
*/
export function StageTracker({ tracker }) {
  return (
    <ol className="stages" aria-label="Project stages">
      {tracker.map((stage) => (
        <li key={stage.id} className={`stage stage-${stage.state}`}>
          <span className="stage-dot num" aria-hidden="true">
            {stage.state === 'done' ? '✓' : stage.no}
          </span>
          <div className="stage-body">
            <div className="stage-head">
              <b>{stage.name}</b>
              <span className="stage-state">{STATE_LABEL[stage.state]}</span>
              {!stage.built && <span className="stage-later">Coming later</span>}
            </div>
            <small>{stage.state === 'done' ? stage.gate : (stage.reason ?? stage.gate)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}
