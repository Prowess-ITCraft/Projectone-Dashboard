import { cn } from '@/lib/utils';

/*
  A status label. `tone` picks the colour, `shape` the size:
    badge   small label on a tile
    pill    task status in a table (usually a button that cycles the status)
    toggle  a yes/no or high/medium/low value that can be clicked to change
    chip    a tag after a line of text
*/
export const TONES = ['positive', 'accent', 'warning', 'neutral', 'muted'];

export function StatusBadge({ tone = 'muted', shape = 'badge', as: Tag = 'span', className, children, ...rest }) {
  const props = Tag === 'button' ? { type: 'button', ...rest } : rest;
  return (
    <Tag className={cn(shape, `tone-${tone}`, className)} {...props}>
      {children}
    </Tag>
  );
}

/* Checklist task states and how each one looks */
export const TASK_STATUS = [
  { label: 'Pending', tone: 'muted' },
  { label: 'In progress', tone: 'warning' },
  { label: 'Done', tone: 'positive' },
];
