import { cn } from '@/lib/utils';

/*
  A glass card with an optional header: title on the left, then a hint and actions pushed to the right.
  `as` takes a tag or a component, so a motion.section can animate in. `flush` runs content (a table) edge to edge.
*/
export function Card({ as: Tag = 'section', title, hint, actions, flush = false, className, children, ...rest }) {
  const hasHeader = title || hint || actions;
  return (
    <Tag className={cn('card', flush && 'tbl', className)} {...rest}>
      {hasHeader && (
        <header className="card-h">
          {title && <h3>{title}</h3>}
          {hint && <span className="hint">{hint}</span>}
          {actions}
        </header>
      )}
      {children}
    </Tag>
  );
}
