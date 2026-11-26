import { useId, useState } from 'react';
import { FileIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { Card, FormField, SegmentedControl } from '@/components';
import { ACCEPT_ATTRIBUTE } from '@/domain/files';

/*
  When `value` is given the card holds a chosen file (not yet uploaded) and shows it with a remove button instead of the zone.
  A drop zone for one kind of document. The real control is a file input that is hidden visually but still reachable by
  keyboard; dropping a file, choosing one, or pressing Enter on the zone all end in onFile(file, type).
  `types` is the list of [value, label] the user picks between; with one type the choice is not shown.
*/
export function UploadCard({ title, hint, types, disabled = false, busy = false, onFile, value = null, onClear, onTypeChange }) {
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
          {(f) => (
            <SegmentedControl
              {...f.control}
              id={`${id}-type`}
              value={type}
              options={types}
              onChange={(next) => {
                setType(next);
                onTypeChange?.(next);
              }}
            />
          )}
        </FormField>
      )}
      {value ? (
        <div className="picked-file">
          <FileIcon size={22} aria-hidden="true" />
          <span className="strong">{value.name}</span>
          <button type="button" className="btn ghost sm" onClick={onClear} disabled={disabled}>
            <TrashIcon size={15} aria-hidden="true" />
            Remove {title.toLowerCase()}
          </button>
        </div>
      ) : (
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
          <span className="strong">{busy ? 'Adding the file' : 'Choose a file or drop it here'}</span>
          <small>PDF or Word, up to 25 MB</small>
          <input
            id={`${id}-file`}
            aria-label={`Choose a file or drop it here, ${title}`}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => {
              take(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </Card>
  );
}
