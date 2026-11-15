import { DotsThreeOutlineIcon } from '@phosphor-icons/react';

/*
  Phone navigation: a tab for each built area marked for the bar, then More, which opens the full menu in the drawer.
  Hidden by CSS above the nav breakpoint.
*/
export function BottomBar({ items, activeId, onSelect, moreOpen, onMore }) {
  return (
    <nav className="bottom-bar" aria-label="Quick">
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onSelect(item.id);
            }}
          >
            <span className="bb-icon">
              <item.icon size={20} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
            </span>
            {item.title}
          </a>
        );
      })}
      <button type="button" aria-expanded={moreOpen} aria-controls="app-sidebar" onClick={onMore}>
        <span className="bb-icon">
          <DotsThreeOutlineIcon size={20} weight={moreOpen ? 'fill' : 'regular'} aria-hidden="true" />
        </span>
        More
      </button>
    </nav>
  );
}
