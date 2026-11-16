import { useEffect, useState } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';

/* What a Project One project goes through, in four plain steps, for the sign-in page */
export const STEPS = [
  { title: 'Order read', text: 'Every line of the order reviewed and classified by a person' },
  { title: 'Planned', text: 'Lookup tables confirmed and a schedule the customer agreed to' },
  { title: 'Built in order', text: 'Checklists done step by step, each with photo evidence' },
  { title: 'Signed off', text: 'A verified completion report, not a promise' },
];

/* After the last step the list rests on "all done" for one beat before starting again */
const BEATS = STEPS.length + 2;

/*
  The steps light up one after another, like work moving through a project. With reduced motion turned on they all
  show as done and nothing moves. The panel says nothing to screen readers while it cycles; the list itself is readable.
*/
export function ProjectSteps({ intervalMs = 2200 }) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduce) return undefined;
    const timer = setInterval(() => setBeat((b) => (b + 1) % BEATS), intervalMs);
    return () => clearInterval(timer);
  }, [reduce, intervalMs]);

  const active = reduce ? STEPS.length : beat;
  const stateOf = (i) => (i < active ? 'done' : i === active ? 'current' : 'pending');

  return (
    <section className="steps-card" aria-labelledby="steps-title">
      <h2 className="steps-eyebrow" id="steps-title">
        What happens when you run a project
      </h2>
      <ol className="steps-list">
        {STEPS.map((step, i) => (
          <li key={step.title} className={cn('steps-item', `is-${stateOf(i)}`)} data-state={stateOf(i)}>
            <span className="steps-rail" aria-hidden="true">
              <span className="steps-dot" />
              {i < STEPS.length - 1 && <span className="steps-line" />}
            </span>
            <span className="steps-body">
              <b>{step.title}</b>
              <small>{step.text}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
