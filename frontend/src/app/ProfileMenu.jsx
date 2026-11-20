import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretDownIcon, KeyIcon, SignOutIcon } from '@phosphor-icons/react';
import { Dialog, FormField, Notice } from '@/components';
import { useSession } from '@/app/session';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { ROLES } from '@/domain/permissions';

const MIN_PASSWORD = 10;

const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

/*
  The signed-in person at the top right: initials in a circle and the name (hidden on very small screens). It opens a
  menu with their name, email and role, "Change password" and "Sign out". Escape and a click outside close it, and the
  arrow keys move between the two items.
*/
export function ProfileMenu() {
  const { session, signOut } = useSession();
  const nav = useNavigate();
  const id = useId();
  const wrap = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const items = () => [...(wrap.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    items()[0]?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = items();
        const at = list.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
        list[next]?.focus();
      }
    };
    const onClick = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (!session) return null;

  const leave = () => {
    setOpen(false);
    signOut().finally(() => nav('/login', { replace: true }));
  };

  return (
    <div className="profile" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="profile-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={`Account menu, ${session.name}`}
        onClick={() => setOpen(!open)}
      >
        <span className="avatar" aria-hidden="true">
          {initialsOf(session.name)}
        </span>
        <span className="profile-name">{session.name}</span>
        <CaretDownIcon size={12} weight="bold" aria-hidden="true" />
      </button>
      {open && (
        <div className="profile-panel" id={`${id}-menu`} role="menu" aria-label="Account">
          <div className="profile-who">
            <b>{session.name}</b>
            <span>{session.email}</span>
            <small>{ROLES[session.role] ?? session.role}</small>
          </div>
          <button
            type="button"
            role="menuitem"
            className="profile-item"
            onClick={() => {
              setOpen(false);
              setChanging(true);
            }}
          >
            <KeyIcon size={16} aria-hidden="true" />
            Change password
          </button>
          <button type="button" role="menuitem" className="profile-item" onClick={leave}>
            <SignOutIcon size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
      <Dialog open={changing} onClose={() => setChanging(false)} title="Change password">
        <ChangePasswordForm onDone={() => setChanging(false)} />
      </Dialog>
    </div>
  );
}

function ChangePasswordForm({ onDone }) {
  const { changePassword } = useSession();
  const [form, setForm] = useState({ current: '', next: '', again: '' });
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setFailure('');
  };
  const errors = {
    current: !form.current ? 'Enter your current password.' : undefined,
    next:
      form.next.length < MIN_PASSWORD
        ? `Use at least ${MIN_PASSWORD} characters.`
        : form.next === form.current
          ? 'Choose a password different from the current one.'
          : undefined,
    again: form.again !== form.next ? 'The two new passwords do not match.' : undefined,
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      await changePassword(form.current, form.next);
      setDone(true);
    } catch (error) {
      setFailure(error.message);
    }
    setBusy(false);
  };

  if (done)
    return (
      <>
        <Notice>Your password was changed. Your other sessions were signed out.</Notice>
        <div className="dialog-actions">
          <button type="button" className="btn sm" onClick={onDone} data-autofocus>
            Close
          </button>
        </div>
      </>
    );

  return (
    <form onSubmit={submit} noValidate className="stack">
      {failure && <Notice tone="error">{failure}</Notice>}
      <FormField label="Current password" error={touched ? errors.current : undefined}>
        {(f) => <PasswordInput control={f.control} value={form.current} onChange={set('current')} />}
      </FormField>
      <FormField label="New password" hint={`At least ${MIN_PASSWORD} characters.`} error={touched ? errors.next : undefined}>
        {(f) => <PasswordInput control={f.control} value={form.next} onChange={set('next')} autoComplete="new-password" />}
      </FormField>
      <FormField label="New password again" error={touched ? errors.again : undefined}>
        {(f) => <PasswordInput control={f.control} value={form.again} onChange={set('again')} autoComplete="new-password" />}
      </FormField>
      <div className="dialog-actions">
        <button type="button" className="btn ghost sm" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn sm" disabled={busy}>
          {busy ? 'Saving' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
