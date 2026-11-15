import { NavLink } from 'react-router-dom';

/*
  Page tabs that are real links, so each tab has its own address and the back button works.
  `items` is a list of { to, label, count?, end? }; the current one is marked with aria-current.
*/
export function TabNav({ items, label }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="tab">
          {item.label}
          {item.count !== undefined && <span className="tab-count num">{item.count}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
