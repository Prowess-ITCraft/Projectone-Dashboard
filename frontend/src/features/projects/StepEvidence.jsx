import { useEffect, useId, useRef, useState } from 'react';
import { CameraIcon, FilePdfIcon, ImageIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { Notice } from '@/components';
import { useApi } from '@/data/api';
import { useAction } from '@/lib/useAction';
import { formatTimestamp } from './labels';

const megabytes = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;
const extensionOf = (name) => (/\.([a-z0-9]+)$/i.exec(name ?? '')?.[1] ?? '').toLowerCase();
const isShowable = (mediaType) => mediaType === 'image/jpeg' || mediaType === 'image/png';

/* The files the picker offers: JPG, PNG, HEIC and PDF. The server checks the real content as well. */
const ACCEPT = '.jpg,.jpeg,.png,.heic,.heif,.pdf,image/jpeg,image/png,image/heic,image/heif,application/pdf';

/* Why a file cannot be added, or undefined. Quick feedback only: the server decides. */
export function evidenceProblem(file, limits, haveCount, extra = 0) {
  if (!limits.accepted.includes(extensionOf(file.name))) return `${file.name}: only ${limits.acceptedText} files can be added.`;
  if (file.size > limits.maxBytes) return `${file.name} is larger than ${megabytes(limits.maxBytes)}.`;
  if (haveCount + extra >= limits.maxFiles) return `A step can have at most ${limits.maxFiles} files.`;
  return undefined;
}

/* A small preview of an image file, read through the api so the session is used; other kinds show a file icon */
function Thumb({ projectId, item }) {
  const api = useApi();
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!isShowable(item.mediaType)) return undefined;
    let made = '';
    let live = true;
    api
      .getEvidenceBlob(projectId, item.id)
      .then((blob) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [api, projectId, item.id, item.mediaType]);
  if (url) return <img className="ev-thumb" src={url} alt="" />;
  const Kind = item.mediaType === 'application/pdf' ? FilePdfIcon : ImageIcon;
  return <Kind className="ev-icon" size={22} aria-hidden="true" />;
}

/* The evidence of one step, with the controls only an engineer has while the step awaits evidence */
export function StepEvidence({ projectId, step, limits, canAct, onFinish, busy: parentBusy }) {
  const api = useApi();
  const id = useId();
  const [run, { busy, error, clear }] = useAction();
  const [problem, setProblem] = useState('');
  const camera = useRef(null);
  const device = useRef(null);
  const awaiting = step.state === 'awaiting_evidence';
  const editable = canAct && awaiting;
  const working = busy || parentBusy;

  const open = async (item) => {
    clear();
    const blob = await run(() => api.getEvidenceBlob(projectId, item.id));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (isShowable(item.mediaType) || item.mediaType === 'application/pdf') {
      window.open(url, '_blank', 'noopener');
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const add = async (fileList) => {
    const files = [...(fileList ?? [])];
    setProblem('');
    clear();
    for (const [i, file] of files.entries()) {
      const why = evidenceProblem(file, limits, step.evidence.length, i);
      if (why) return setProblem(why);
    }
    for (const file of files) {
      if ((await run(async () => (await api.addEvidence(projectId, step.id, file), true))) === undefined) return undefined;
    }
    return undefined;
  };

  return (
    <section className="ev" aria-label={`Evidence for ${step.title}`}>
      <h4>Evidence</h4>
      {(error || problem) && <Notice tone="error">{problem || error}</Notice>}
      {step.evidence.length > 0 ? (
        <ul className="ev-list">
          {step.evidence.map((item) => (
            <li key={item.id} className="ev-item">
              <button type="button" className="ev-open" onClick={() => open(item)} aria-label={`Open ${item.name}`}>
                <Thumb projectId={projectId} item={item} />
                <span className="ev-name">{item.name}</span>
              </button>
              <small className="ev-by">
                {item.uploadedByName}, {formatTimestamp(item.uploadedAt)}
              </small>
              {editable && item.canRemove && (
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={working}
                  onClick={() => run(() => api.removeEvidence(projectId, step.id, item.id))}
                  aria-label={`Remove ${item.name}`}
                >
                  <TrashIcon size={15} aria-hidden="true" />
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">{editable ? 'No files yet. Add at least one to finish this step.' : 'No evidence was added.'}</p>
      )}

      {editable && (
        <div className="ev-add">
          <div className="action-row">
            <button type="button" className="btn ghost sm" disabled={working} onClick={() => camera.current?.click()}>
              <CameraIcon size={16} aria-hidden="true" />
              Take photo
            </button>
            <button type="button" className="btn ghost sm" disabled={working} onClick={() => device.current?.click()}>
              <UploadSimpleIcon size={16} aria-hidden="true" />
              Upload from device
            </button>
            <button type="button" className="btn sm" disabled={working || step.evidence.length < 1} onClick={onFinish}>
              Finish step
            </button>
          </div>
          {/* "capture" opens the camera on a phone; on a computer it is an ordinary file picker */}
          <input
            ref={camera}
            id={`${id}-camera`}
            data-testid="evidence-camera"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-label={`Take a photo for ${step.title}`}
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={device}
            id={`${id}-device`}
            data-testid="evidence-device"
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label={`Upload evidence for ${step.title}`}
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
          <small>
            {step.evidence.length} of {limits.maxFiles} files. {limits.acceptedText}, up to {megabytes(limits.maxBytes)} each.
          </small>
        </div>
      )}
      {canAct && step.state === 'complete' && <small>Evidence is locked once a step is complete.</small>}
    </section>
  );
}
