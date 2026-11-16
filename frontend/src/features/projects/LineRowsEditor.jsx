import { FormField, Icon } from '@/components';

let keySeed = 0;
export const newRow = (line = {}) => ({
  key: `r${++keySeed}`,
  title: line.title ?? '',
  qty: line.qty === undefined ? '1' : String(line.qty),
  scope: (line.scopeItems ?? []).join('\n'),
  keep: {
    supportScope: line.supportScope ?? false,
    perEndpoint: line.perEndpoint ?? false,
  },
});

export const withPatch = (row, patch) => ({ ...row, ...patch });

/* Editable order lines for the manual entry form: description, quantity and scope bullets only */
export function LineRowsEditor({ rows, onChange }) {
  const update = (key, patch) => onChange(rows.map((r) => (r.key === key ? withPatch(r, patch) : r)));
  return (
    <div className="line-editor">
      {rows.map((row, i) => (
        <fieldset key={row.key} className="line-edit">
          <legend>Line {i + 1}</legend>
          <FormField label="Description">
            {(f) => (
              <input {...f.control} className="input" value={row.title} onChange={(e) => update(row.key, { title: e.target.value })} />
            )}
          </FormField>
          <div className="line-edit-numbers">
            <FormField label="Quantity">
              {(f) => (
                <input
                  {...f.control}
                  className="input"
                  inputMode="decimal"
                  value={row.qty}
                  onChange={(e) => update(row.key, { qty: e.target.value })}
                />
              )}
            </FormField>
          </div>
          <FormField label="Scope bullets" hint="One per line. Optional.">
            {(f) => (
              <textarea
                {...f.control}
                className="input textarea"
                rows={2}
                value={row.scope}
                onChange={(e) => update(row.key, { scope: e.target.value })}
              />
            )}
          </FormField>
          {rows.length > 1 && (
            <button type="button" className="btn ghost sm" onClick={() => onChange(rows.filter((r) => r.key !== row.key))}>
              <Icon name="Trash" size={15} />
              Remove line {i + 1}
            </button>
          )}
        </fieldset>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, newRow()])}>
        <Icon name="Plus" size={15} />
        Add a line
      </button>
    </div>
  );
}
