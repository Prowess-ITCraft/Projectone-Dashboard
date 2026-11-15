import { motion } from 'framer-motion';

/*
  A row of mutually exclusive choices; the current one sits on a solid pill that slides between options.
  `id` must be unique on the page because it names the sliding pill. `options` is a list of [value, label].
*/
export function SegmentedControl({ id, value, options, onChange, ...rest }) {
  return (
    <div className="seg" role="group" {...rest}>
      {options.map(([v, l]) => (
        <button type="button" key={String(v)} className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>
          {value === v && <motion.i layoutId={`seg-${id}`} className="seg-bg" />}
          <span>{l}</span>
        </button>
      ))}
    </div>
  );
}
