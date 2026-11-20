import { useId, useState } from 'react';
import { Notice } from '@/components';
import { useApi } from '@/data/api';
import { useAction } from '@/lib/useAction';
import { formatTimestamp } from './labels';

/* The comments of one step, oldest first. An engineer can add one at any time while the step is unlocked, even after
   it is complete; nobody edits or deletes one here. */
export function StepComments({ projectId, step, canAct }) {
  const api = useApi();
  const id = useId();
  const [run, { busy, error }] = useAction();
  const [text, setText] = useState('');

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    if ((await run(async () => (await api.addStepComment(projectId, step.id, body), true))) !== undefined) setText('');
  };

  return (
    <section className="cm-panel" aria-label={`Comments on ${step.title}`}>
      <h4>Comments</h4>
      {step.comments.length > 0 ? (
        <ul className="cm-list">
          {step.comments.map((c) => (
            <li key={c.id}>
              <p>{c.body}</p>
              <small>
                {c.authorName}, {formatTimestamp(c.createdAt)}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">No comments yet.</p>
      )}
      {canAct && (
        <div className="cm-add">
          {error && <Notice tone="error">{error}</Notice>}
          <label htmlFor={`${id}-comment`} className="sr-only">{`Add a comment on ${step.title}`}</label>
          <textarea
            id={`${id}-comment`}
            rows={2}
            maxLength={2000}
            placeholder="Add a comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" className="btn ghost sm" disabled={busy || !text.trim()} onClick={add}>
            Add comment
          </button>
        </div>
      )}
    </section>
  );
}
