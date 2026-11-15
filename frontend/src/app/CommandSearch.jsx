import { useMemo, useState } from 'react';
import { CommandIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useModal } from '@/components/useModal';

/*
  Ctrl+K command search. `entries` is a list of { id, title, hint?, icon }; picking one calls onPick(id).
  The dialog keeps focus inside itself, closes on Escape and returns focus to where it was opened from.
*/
export function CommandSearch({ open, ...props }) {
  // mounting the dialog only while open gives every opening a fresh query and selection
  return open ? <SearchDialog {...props} /> : null;
}

function SearchDialog({ onClose, entries, onPick }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const panelRef = useModal(onClose);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? entries.filter((e) => `${e.title} ${e.hint ?? ''}`.toLowerCase().includes(s)) : entries).slice(0, 9);
  }, [q, entries]);

  const pick = (e) => {
    if (!e) return;
    onPick(e.id);
    onClose();
  };
  const onKey = (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (ev.key === 'Enter') {
      // closing hands focus back to the opener; without this the same keypress would then press that button too
      ev.preventDefault();
      pick(results[sel]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/50 px-4 pt-[14vh] backdrop-blur-sm">
      <button type="button" tabIndex={-1} aria-label="Close search" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="animate-in fade-in zoom-in-95 relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl duration-200"
      >
        <div className="flex items-center border-b border-border px-4">
          <MagnifyingGlassIcon className="mr-3 h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <input
            data-autofocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
            className="flex-1 bg-transparent py-4 text-body text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Search components, checklists and questionnaires"
          />
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} className="ml-2 hidden sm:inline-flex">
            <kbd className="m-0 inline-flex h-5 cursor-pointer items-center justify-center rounded-kbd border border-border bg-black/5 px-1.5 text-nano font-medium text-muted-foreground transition-colors hover:text-foreground dark:bg-white/10">
              ESC
            </kbd>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="ml-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <XIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
        {results.length ? (
          <ul className="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto p-1.5">
            {results.map((e, i) => (
              <li key={e.id}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => pick(e)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-ui transition-colors',
                    i === sel ? 'bg-accent text-foreground' : 'text-foreground/85',
                  )}
                >
                  <e.icon className={cn('h-[17px] w-[17px] shrink-0', i === sel ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="flex-1 truncate">{e.title}</span>
                  {e.hint && <span className="text-caption text-muted-foreground">{e.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center p-2 py-8">
            <CommandIcon className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-label font-medium text-muted-foreground">Nothing matches &quot;{q}&quot;</p>
          </div>
        )}
      </div>
    </div>
  );
}
