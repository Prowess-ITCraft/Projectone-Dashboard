import { ShieldCheckIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/*
  Marks a customer audited through PrismSuite: shown only once a PrismSuite report is attached to one of its projects.
  Text with a shield until the owner supplies the PrismSuite logo, which then replaces the icon and text.
*/
export function PrismSuiteBadge({ className }) {
  return (
    <span className={cn('prism-badge', className)} title="Audited through PrismSuite">
      <ShieldCheckIcon size={13} weight="fill" aria-hidden="true" />
      <span className="sr-only">Audited through </span>
      PrismSuite
    </span>
  );
}
