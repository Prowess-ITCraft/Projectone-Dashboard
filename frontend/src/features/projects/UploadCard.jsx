import { useId, useState } from 'react';
import { UploadSimpleIcon } from '@phosphor-icons/react';
import { Card, FormField, SegmentedControl } from '@/components';

/*
  A drop zone for one kind of document. The real control is a file input that is hidden visually but still reachable by
  keyboard; dropping a file, choosing one, or pressing Enter on the zone all end in onFile(file, type).
  `types` is the list of [value, label] the user picks between; with one type the choice is not shown.
*/
export function UploadCard({ title, hint, types, disabled = false, busy = false, onFile }) {
  const id = useId();
  const [type, setType] = useState(types[0][0]);
  const [dragging, setDragging] = useState(false);

  const take = (files) => {
    const file = files?.[0];
    if (file && !disabled) onFile(file, type);
  };

  return (
    <Card title={title} hint={hint} className="upload-card">
      {types.length > 1 && (
        <FormField label="This is a" group>
          {(f) => <SegmentedControl {...f.control} id={`${id}-type`} value={type} options={types} onChange={setType} />}
        </FormField>
      )}
      <label
        htmlFor={`${id}-file`}
        className={`dropzone${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files);
        }}
      >
        <UploadSimpleIcon size={22} aria-hidden="true" />
        <span className="strong">{busy ? 'Adding the file' : 'Choose a PDF or drop it here'}</span>
        <small>PDF only, up to 25 MB</small>
        <input
          id={`${id}-file`}
          aria-label={`Choose a PDF or drop it here, ${title}`}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
    </Card>
  );
}
