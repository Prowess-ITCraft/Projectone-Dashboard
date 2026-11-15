import { useId } from 'react';
import { cn } from '@/lib/utils';

/*
  A labelled form control with optional number, hint and error.
  Children is a function that receives the ids to put on the control:
    <FormField label="Name">{(f) => <input className="input" {...f.control} />}</FormField>
  For a group of buttons (no single input to point at), pass `group`: the label becomes a plain caption and
  `f.control` carries aria-labelledby instead of an id.
*/
export function FormField({ label, number, hint, error, group = false, className, children }) {
  const base = useId();
  const ids = { control: `${base}-control`, label: `${base}-label`, hint: `${base}-hint`, error: `${base}-error` };
  const describedBy = [hint && ids.hint, error && ids.error].filter(Boolean).join(' ') || undefined;
  const control = group
    ? { 'aria-labelledby': ids.label, 'aria-describedby': describedBy }
    : { id: ids.control, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };

  const Label = group ? 'span' : 'label';
  return (
    <div className={cn('field', className)}>
      <Label className="field-label" id={ids.label} {...(group ? {} : { htmlFor: ids.control })}>
        {number !== undefined && <span className="field-num">{number}</span>}
        {label}
      </Label>
      {children({ control, ids })}
      {hint && (
        <p className="field-hint" id={ids.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={ids.error}>
          {error}
        </p>
      )}
    </div>
  );
}
