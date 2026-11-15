import { cn } from '@/lib/utils';

/* "Nothing here yet" text. Renders as a paragraph by default; pass `as="li"` inside a list. */
export function EmptyState({ as: Tag = 'p', className, children }) {
  return <Tag className={cn('empty', className)}>{children}</Tag>;
}
