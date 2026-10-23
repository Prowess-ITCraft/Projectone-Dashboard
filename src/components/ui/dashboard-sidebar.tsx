import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CaretRight, MagnifyingGlass, Command, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  shortcut?: string;
  trailing?: React.ReactNode;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

const flatten = (items: NavItemData[]): NavItemData[] =>
  items.reduce<NavItemData[]>((acc, item) => {
    acc.push(item);
    if (item.children) acc.push(...flatten(item.children));
    return acc;
  }, []);

function BrandHeader({ logo, product, onHome }: { logo: string; product: string; onHome?: () => void }) {
  return (
    <button
      type="button"
      onClick={onHome}
      aria-label={`${product} home`}
      className="mb-4 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors select-none hover:bg-black/5 dark:hover:bg-white/5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <img src={logo} alt="" className="h-full w-full object-contain" />
      </span>
      <span className="font-display truncate py-0.5 text-[17px] leading-[1.3] font-bold tracking-[-0.01em] text-foreground">{product}</span>
    </button>
  );
}

function NavItem({
  item, activeId, onSelect, level = 0,
}: {
  item: NavItemData; activeId: string; onSelect: (id: string) => void; level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children?.length;
  const childActive = hasChildren && flatten(item.children!).some((c) => c.id === activeId);
  const [isOpen, setIsOpen] = useState(childActive);
  useEffect(() => { if (childActive) setIsOpen(true); }, [childActive]);

  const handleClick = () => (hasChildren ? setIsOpen(!isOpen) : onSelect(item.id));

  return (
    <div className="flex w-full flex-col">
      <button
        type="button"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex w-full items-center justify-between rounded-[7px] py-[7px] pr-2.5 text-left transition-all duration-200 select-none',
          isActive
            ? 'nav-active font-medium'
            : childActive
              ? 'text-foreground hover:bg-black/5 dark:hover:bg-white/5'
              : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5',
        )}
        style={{ paddingLeft: `${level * 12 + 10}px` }}
        onClick={handleClick}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <item.icon
            className={cn('h-[17px] w-[17px] shrink-0 transition-colors', isActive ? '' : 'text-muted-foreground group-hover:text-foreground')}
            weight={isActive ? 'fill' : 'regular'}
          />
          <span className="truncate text-[13.5px]">{item.title}</span>
        </span>

        <span className="flex items-center gap-2">
          {item.shortcut && (
            <kbd className="hidden h-5 items-center justify-center rounded-[4px] border border-border bg-background/60 px-1.5 text-[10.5px] font-medium text-muted-foreground group-hover:inline-flex">
              {item.shortcut}
            </kbd>
          )}
          {item.badge !== undefined && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary tabular-nums">
              {item.badge}
            </span>
          )}
          {item.trailing}
          {hasChildren && (
            <CaretRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-90')} weight="bold" />
          )}
        </span>
      </button>

      {hasChildren && (
        <div className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-in-out', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div className="absolute top-0 bottom-0 border-l border-border" style={{ left: `${level * 12 + 18}px` }} />
            {item.children!.map((child) => (
              <NavItem key={child.id} item={child} activeId={activeId} onSelect={onSelect} level={level + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarNav({
  className = '', groups, bottomItems = [], activeId, onSelect, logo, product, onHome,
}: {
  className?: string;
  groups: NavGroupData[];
  bottomItems?: NavItemData[];
  activeId: string;
  onSelect: (id: string) => void;
  logo: string;
  product: string;
  onHome?: () => void;
}) {
  return (
    <div className={cn('flex h-full w-[260px] flex-col p-3 font-sans', className)}>
      <BrandHeader logo={logo} product={product} onHome={onHome} />

      <nav aria-label="Main" className="mt-1 flex flex-1 flex-col gap-5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {group.heading && <span className="mb-1 px-2.5 text-[12px] font-medium text-muted-foreground">{group.heading}</span>}
            {group.items.map((item) => <NavItem key={item.id} item={item} activeId={activeId} onSelect={onSelect} />)}
          </div>
        ))}
      </nav>

      {bottomItems.length > 0 && (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          {bottomItems.map((item) => <NavItem key={item.id} item={item} activeId={activeId} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  );
}

export type SearchEntry = { id: string; title: string; hint?: string; icon: React.ElementType };

/* ⌘K / Ctrl+K command search */
export function CommandSearch({
  open, onClose, entries, onPick,
}: {
  open: boolean; onClose: () => void; entries: SearchEntry[]; onPick: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? entries.filter((e) => `${e.title} ${e.hint ?? ''}`.toLowerCase().includes(s)) : entries).slice(0, 9);
  }, [q, entries]);

  useEffect(() => { if (open) { setQ(''); setSel(0); } }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  if (!open) return null;

  const pick = (e?: SearchEntry) => { if (!e) return; onPick(e.id); onClose(); };
  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') onClose();
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (ev.key === 'Enter') pick(results[sel]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/50 px-4 pt-[14vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="animate-in fade-in zoom-in-95 relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl duration-200">
        <div className="flex items-center border-b border-border px-4">
          <MagnifyingGlass className="mr-3 h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            className="flex-1 bg-transparent py-4 text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Search components, checklists and questionnaires"
          />
          <kbd onClick={onClose} className="ml-2 hidden h-5 cursor-pointer items-center justify-center rounded-[4px] border border-border bg-black/5 px-1.5 text-[10.5px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex dark:bg-white/10">ESC</kbd>
          <button type="button" onClick={onClose} aria-label="Close search" className="ml-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        {results.length ? (
          <ul ref={listRef} className="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto p-1.5">
            {results.map((e, i) => (
              <li key={e.id}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => pick(e)}
                  className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13.5px] transition-colors', i === sel ? 'bg-accent text-foreground' : 'text-foreground/85')}
                >
                  <e.icon className={cn('h-[17px] w-[17px] shrink-0', i === sel ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="flex-1 truncate">{e.title}</span>
                  {e.hint && <span className="text-[12px] text-muted-foreground">{e.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center p-2 py-8">
            <Command className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-[13px] font-medium text-muted-foreground">Nothing matches "{q}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
