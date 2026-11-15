/*
  A plain table that scrolls sideways on narrow screens. Columns give the header cells; rows are the children,
  so each page keeps full control of its cells. When `isEmpty` is true the `empty` message fills one full-width row.
*/
export function DataTable({ columns, isEmpty = false, empty, caption, className, children }) {
  return (
    <div className="scroll">
      <table className={className}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {isEmpty && (
            <tr>
              <td colSpan={columns.length} className="empty">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
