import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormField, Notice } from '@/components';
import { useSession } from '@/app/session';
import { landingFor } from '@/app/navigation';
import logo from '@/assets/projectone-logo.png';
import { PasswordInput } from './PasswordInput';
import { ProjectSteps } from './ProjectSteps';

const MIN = 10;

/* Shown after signing in with a temporary password (a new or reset account). Nothing else opens until it is done. */
export default function ChangePasswordPage() {
  const { changePassword, signOut } = useSession();
  const nav = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', again: '' });
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setFailure('');
  };

  const errors = {
    current: !form.current ? 'Enter the password you signed in with.' : undefined,
    next:
      form.next.length < MIN
        ? `Use at least ${MIN} characters.`
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
      const me = await changePassword(form.current, form.next);
      nav(landingFor(me), { replace: true });
    } catch (error) {
      setFailure(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <main className="login-main">
        <div className="login-form-wrap">
          <div className="login-brand">
            <img src={logo} alt="" />
            <span>ProjectOne</span>
          </div>
          <h1 className="login-title">Choose a new password</h1>
          <p className="login-sub">You signed in with a temporary password. Choose your own to continue.</p>

          <form onSubmit={submit} noValidate className="login-form">
            {failure && <Notice tone="error">{failure}</Notice>}
            <FormField label="Current password" error={touched ? errors.current : undefined}>
              {(f) => <PasswordInput control={f.control} value={form.current} onChange={set('current')} />}
            </FormField>
            <FormField label="New password" hint={`At least ${MIN} characters.`} error={touched ? errors.next : undefined}>
              {(f) => <PasswordInput control={f.control} value={form.next} onChange={set('next')} autoComplete="new-password" />}
            </FormField>
            <FormField label="New password again" error={touched ? errors.again : undefined}>
              {(f) => <PasswordInput control={f.control} value={form.again} onChange={set('again')} autoComplete="new-password" />}
            </FormField>
            <button type="submit" className="btn login-submit" disabled={busy}>
              {busy ? 'Saving' : 'Save and continue'}
            </button>
          </form>
          <p className="login-foot">
            <button type="button" className="btn ghost sm" onClick={signOut}>
              Sign out
            </button>
          </p>
        </div>
      </main>
      <aside className="login-aside">
        <ProjectSteps />
      </aside>
    </div>
  );
}
