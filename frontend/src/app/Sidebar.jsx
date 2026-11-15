import { useState } from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/*
  The sidebar. `groups` is a list of { heading?, items }, and each item is
  { id, title, icon, badge?, shortcut?, trailing?, children? }. Selecting an item calls onSelect(id);
  an item with children opens and closes instead.
*/

const flatten = (items) =>
  items.reduce((acc, item) => {
    acc.push(item);
    if (item.children) acc.push(...flatten(item.children));
    return acc;
  }, []);

function BrandHeader({ logo, product, onHome }) {
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
      <span className="font-display truncate py-0.5 text-brand leading-[1.3] font-bold tracking-[-0.01em] text-foreground">{product}</span>
    </button>
  );
}

function NavItem({ item, activeId, onSelect, level = 0 }) {
  const isActive = activeId === item.id;
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const childActive = hasChildren && flatten(children).some((c) => c.id === activeId);
  const [isOpen, setIsOpen] = useState(childActive);
  // opening the group when navigation lands on one of its children is derived during render, not in an effect
  const [prevChildActive, setPrevChildActive] = useState(childActive);
  if (childActive !== prevChildActive) {
    setPrevChildActive(childActive);
    if (childActive) setIsOpen(true);
  }

  const handleClick = () => (hasChildren ? setIsOpen(!isOpen) : onSelect(item.id));

  return (
    <div className="flex w-full flex-col">
      <button
        type="button"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex w-full items-center justify-between rounded-nav py-[7px] pr-2.5 text-left transition-all duration-200 select-none',
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
            className={cn(
              'h-[17px] w-[17px] shrink-0 transition-colors',
              isActive ? '' : 'text-muted-foreground group-hover:text-foreground',
            )}
            weight={isActive ? 'fill' : 'regular'}
          />
          <span className="truncate text-ui">{item.title}</span>
        </span>

        <span className="flex items-center gap-2">
          {item.shortcut && (
            <kbd className="hidden h-5 items-center justify-center rounded-kbd border border-border bg-background/60 px-1.5 text-nano font-medium text-muted-foreground group-hover:inline-flex">
              {item.shortcut}
            </kbd>
          )}
          {item.badge !== undefined && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-micro font-medium text-primary tabular-nums">
              {item.badge}
            </span>
          )}
          {item.trailing}
          {hasChildren && (
            <CaretRightIcon
              className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-90')}
              weight="bold"
            />
          )}
        </span>
      </button>

      {hasChildren && (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div className="absolute top-0 bottom-0 border-l border-border" style={{ left: `${level * 12 + 18}px` }} />
            {children.map((child) => (
              <NavItem key={child.id} item={child} activeId={activeId} onSelect={onSelect} level={level + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ className = '', groups, bottomItems = [], activeId, onSelect, logo, product, onHome }) {
  return (
    <div className={cn('flex h-full w-(--sidebar-w) flex-col p-3 font-sans', className)}>
      <BrandHeader logo={logo} product={product} onHome={onHome} />

      <nav
        aria-label="Main"
        className="mt-1 flex flex-1 flex-col gap-5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {group.heading && <span className="mb-1 px-2.5 text-caption font-medium text-muted-foreground">{group.heading}</span>}
            {group.items.map((item) => (
              <NavItem key={item.id} item={item} activeId={activeId} onSelect={onSelect} />
            ))}
          </div>
        ))}
      </nav>

      {bottomItems.length > 0 && (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          {bottomItems.map((item) => (
            <NavItem key={item.id} item={item} activeId={activeId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
