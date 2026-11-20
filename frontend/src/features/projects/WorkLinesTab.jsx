import { DataTable, EmptyState } from '@/components';
import { moduleLabel } from '@/domain/modules';
import { KIND_LABELS } from './labels';

export const WORK_LINE_COLUMNS = ['Line', 'Description', 'Quantity', 'Kind', 'Module', 'Pairing'];

/*
  The order lines an engineer sees: a plain, read only table. There is nothing to edit, add or remove, and no money
  fields. The server sends only these fields, so there is nothing else to show.
*/
export default function WorkLinesTab({ lines }) {
  if (!lines.length) return <EmptyState>There are no order lines on this project yet.</EmptyState>;
  return (
    <DataTable className="lines-plain" columns={WORK_LINE_COLUMNS} caption="Order lines">
      {lines.map((line) => (
        <tr key={line.id}>
          <td className="num">{line.number}</td>
          <td className="ttl">{line.description}</td>
          <td className="num">{line.quantity}</td>
          <td>{KIND_LABELS[line.kind] ?? ''}</td>
          <td>{line.module ? moduleLabel(line.module) : ''}</td>
          <td>{line.pairing ?? ''}</td>
        </tr>
      ))}
    </DataTable>
  );
}
