import { useState } from 'react';
import { DataTable, Icon, StatusBadge } from '@/components';
import { MODULE_TYPES, moduleLabel } from '@/domain/modules';
import { KIND_LABELS, KIND_OPTIONS } from './labels';

const truncate = (text, n = 48) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

/* A text box that saves when it loses focus, and only if the value changed */
function Cell({ value, onCommit, label, disabled, className = 'input', inputMode, multiline = false }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const shared = {
    'aria-label': label,
    disabled,
    value: draft,
    onChange: (e) => setDraft(e.target.value),
    onBlur: () => {
      if (draft === value) return;
      if (!onCommit(draft)) setDraft(value);
    },
  };
  return multiline ? (
    <textarea className={`${className} textarea`} rows={2} {...shared} />
  ) : (
    <input className={className} inputMode={inputMode} {...shared} />
  );
}

/*
  The parsed lines of one document, editable until the intake review is confirmed (text, quantity) and until the
  classification is confirmed (kind, module, pairing). Changing a classification asks for a reason first.
*/
export function LineTable({
  lines,
  products,
  textLocked,
  classLocked,
  canEdit,
  canClassify,
  onField,
  onClassify,
  onAccept,
  onDelete,
  onError,
}) {
  const columns = [
    'No',
    'Description',
    'Qty',
    'Kind',
    'Module and pairing',
    <span key="a" className="sr-only">
      Actions
    </span>,
  ];
  const pairedLine = (line) => products.find((p) => p.id === line.pairedToLineId);
  const textOff = textLocked || !canEdit;
  const classOff = classLocked || !canClassify;

  return (
    <DataTable columns={columns} isEmpty={!lines.length} empty="This document has no lines." className="lines">
      {lines.map((line) => {
        const pairOptions = products.filter((p) => p.id !== line.id);
        return (
          <tr key={line.id} className={line.kind === 'unknown' ? 'row-unknown' : ''}>
            <td className="sn num">{line.no}</td>
            <td className="desc">
              <Cell
                value={line.title}
                label={`Description of line ${line.no}`}
                multiline
                disabled={textOff}
                onCommit={(t) => {
                  if (!t.trim()) return false;
                  onField(line, { title: t.trim() });
                  return true;
                }}
              />
              {line.scopeItems?.length > 0 && (
                <details className="scope">
                  <summary>
                    {line.supportScope ? 'Support scope' : 'Scope'}, {line.scopeItems.length} items
                  </summary>
                  <ul>
                    {line.scopeItems.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </details>
              )}
            </td>
            <td>
              <Cell
                value={String(line.qty)}
                label={`Quantity of line ${line.no}`}
                className="input narrow"
                inputMode="decimal"
                disabled={textOff}
                onCommit={(t) => {
                  if (!(Number(t) > 0)) {
                    onError(`Line ${line.no}: the quantity must be above zero.`);
                    return false;
                  }
                  onField(line, { qty: Number(t) });
                  return true;
                }}
              />
            </td>
            <td>
              {classOff ? (
                <StatusBadge tone={line.kind === 'unknown' ? 'warning' : 'neutral'}>{KIND_LABELS[line.kind]}</StatusBadge>
              ) : (
                <select
                  className="input select"
                  aria-label={`Kind of line ${line.no}`}
                  value={line.kind}
                  onChange={(e) => onClassify(line, { kind: e.target.value })}
                >
                  {KIND_OPTIONS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              <small className="source">
                {line.classificationSource === 'manual' ? 'Set by a person' : line.matchedRule ? 'By rule' : 'No rule matched'}
              </small>
            </td>
            <td>
              <div className="module-stack">
                {classOff ? (
                  <span>{moduleLabel(line.moduleType)}</span>
                ) : (
                  <select
                    className="input select"
                    aria-label={`Module of line ${line.no}`}
                    value={line.moduleType ?? ''}
                    onChange={(e) => onClassify(line, { moduleType: e.target.value || null })}
                  >
                    <option value="">Not set</option>
                    {Object.entries(MODULE_TYPES).map(([k, m]) => (
                      <option key={k} value={k}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
                {line.suggestion && !classOff && (
                  <div className="suggestion">
                    <small>Suggested: {moduleLabel(line.suggestion.moduleType)}</small>
                    <button type="button" className="btn ghost sm" onClick={() => onAccept(line)}>
                      Accept for line {line.no}
                    </button>
                  </div>
                )}
                {line.kind === 'service' &&
                  (classOff ? (
                    <small className="source">
                      {pairedLine(line) ? `Paired with line ${pairedLine(line).no}` : 'Not paired with a product'}
                    </small>
                  ) : (
                    <select
                      className="input select pair"
                      aria-label={`Paired product of line ${line.no}`}
                      value={line.pairedToLineId ?? ''}
                      onChange={(e) => onClassify(line, { pairedToLineId: e.target.value || null })}
                    >
                      <option value="">Not paired with a product</option>
                      {pairOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {`Paired with line ${p.no}: ${truncate(p.title, 34)}`}
                        </option>
                      ))}
                    </select>
                  ))}
              </div>
            </td>
            <td>
              {!textOff && (
                <button type="button" className="x" aria-label={`Delete line ${line.no}`} onClick={() => onDelete(line)}>
                  <Icon name="Trash" size={16} />
                </button>
              )}
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
