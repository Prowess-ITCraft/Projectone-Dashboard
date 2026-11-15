import { FormField, Icon } from '@/components';
import { lineAmount, paiseToInput, toPaise } from '@/domain/money';

let keySeed = 0;
export const newRow = (line = {}) => ({
  key: `r${++keySeed}`,
  title: line.title ?? '',
  qty: line.qty === undefined ? '1' : String(line.qty),
  rate: paiseToInput(line.ratePaise),
  amount: paiseToInput(line.amountPaise),
  amountTouched: line.amountPaise !== null && line.amountPaise !== undefined,
  scope: (line.scopeItems ?? []).join('\n'),
  keep: {
    ratePaise: line.ratePaise ?? null,
    amountPaise: line.amountPaise ?? null,
    supportScope: line.supportScope ?? false,
    perEndpoint: line.perEndpoint ?? false,
  },
});

/* The amount follows quantity times rate until a person types an amount of their own */
export function withAmount(row, patch) {
  const next = { ...row, ...patch };
  if ('amount' in patch) next.amountTouched = true;
  if (!next.amountTouched) {
    const rate = toPaise(next.rate);
    next.amount = rate === null ? '' : paiseToInput(lineAmount(next.qty || 0, rate));
  }
  return next;
}

/*
  Editable order lines for the manual entry form. Without money access (`showMoney` false) the rate and amount
  columns are not shown and the stored values are kept as they were.
*/
export function LineRowsEditor({ rows, onChange, showMoney }) {
  const update = (key, patch) => onChange(rows.map((r) => (r.key === key ? withAmount(r, patch) : r)));
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
            {showMoney && (
              <>
                <FormField label="Rate">
                  {(f) => (
                    <input
                      {...f.control}
                      className="input"
                      inputMode="decimal"
                      value={row.rate}
                      onChange={(e) => update(row.key, { rate: e.target.value })}
                    />
                  )}
                </FormField>
                <FormField label="Amount">
                  {(f) => (
                    <input
                      {...f.control}
                      className="input"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(e) => update(row.key, { amount: e.target.value })}
                    />
                  )}
                </FormField>
              </>
            )}
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
