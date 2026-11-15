import { cn } from '@/lib/utils';

/*
  An inline message inside a page. `tone` is info, warning or error; errors are announced to screen readers at once,
  the others politely. Pass `actions` for buttons that sit on the right.
*/
export function Notice({ tone = 'info', title, actions, className, children }) {
  return (
    <div className={cn('notice', `notice-${tone}`, className)} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="notice-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {actions && <div className="notice-actions">{actions}</div>}
    </div>
  );
}
