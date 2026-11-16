import { FormField, Icon } from '@/components';

let seed = 0;
export const newSiteDraft = () => ({ key: `s${++seed}`, name: '', address: '' });

/*
  Chooses the sites a project covers: tick any of the customer's existing sites and add new ones in place.
  A project may cover several sites, or none yet; choosing sites never blocks a stage.
*/
export function SitePicker({ sites = [], selected, onSelected, drafts, onDrafts, legend = 'Sites' }) {
  const toggle = (id) => onSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const setDraft = (key, patch) => onDrafts(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <fieldset className="plain-set site-picker">
      <legend>{legend}</legend>
      {sites.length > 0 && (
        <ul className="site-choices">
          {sites.map((site) => (
            <li key={site.id}>
              <label className="site-choice">
                <input type="checkbox" checked={selected.includes(site.id)} onChange={() => toggle(site.id)} />
                <span>
                  <b>{site.name}</b>
                  {site.address && <small>{site.address}</small>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {drafts.map((d, i) => (
        <div key={d.key} className="site-draft">
          <div className="form-grid">
            <FormField label={`New site ${i + 1} name`}>
              {(f) => <input {...f.control} className="input" value={d.name} onChange={(e) => setDraft(d.key, { name: e.target.value })} />}
            </FormField>
            <FormField label={`New site ${i + 1} address`}>
              {(f) => (
                <input {...f.control} className="input" value={d.address} onChange={(e) => setDraft(d.key, { address: e.target.value })} />
              )}
            </FormField>
          </div>
          <button type="button" className="btn ghost sm" onClick={() => onDrafts(drafts.filter((x) => x.key !== d.key))}>
            <Icon name="Trash" size={15} />
            Remove new site {i + 1}
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onDrafts([...drafts, newSiteDraft()])}>
        <Icon name="Plus" size={15} />
        Add a new site
      </button>
      {!sites.length && !drafts.length && <p className="muted">No site yet. You can add sites now or later.</p>}
    </fieldset>
  );
}
