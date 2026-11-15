import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/*
  A row of mutually exclusive choices; the current one sits on a lime glass pill that slides between options.
  `id` must be unique on the page because it names the sliding pill. `options` is a list of [value, label, tone?]:
  an option with tone 'off' (such as No on a yes/no question) shows a neutral glass pill instead of lime when selected.
*/
export function SegmentedControl({ id, value, options, onChange, ...rest }) {
  return (
    <div className="seg" role="group" {...rest}>
      {options.map(([v, l, tone]) => {
        const selected = value === v;
        const off = tone === 'off';
        return (
          <button
            type="button"
            key={String(v)}
            className={cn(selected && 'on', selected && !off && 'positive')}
            aria-pressed={selected}
            onClick={() => onChange(v)}
          >
            {selected && <motion.i layoutId={`seg-${id}`} className={cn('seg-bg', !off && 'positive')} />}
            <span>{l}</span>
          </button>
        );
      })}
    </div>
  );
}
