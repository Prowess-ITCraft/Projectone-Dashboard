import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FormField, Notice } from '@/components';
import { demoAccount, useSession } from '@/app/session';
import { landingFor } from '@/app/navigation';
import logo from '@/assets/projectone-logo.png';
import { PasswordInput } from './PasswordInput';
import { ProjectSteps } from './ProjectSteps';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { signIn, ended } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  // decided when the app is built: a production build leaves the box out entirely
  const demo = import.meta.env.DEV ? demoAccount() : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const errors = {
    email: !email.trim() ? 'Enter your email.' : !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : undefined,
    password: !password ? 'Enter your password.' : undefined,
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setFailure('');
    if (errors.email || errors.password) return;
    setBusy(true);
    try {
      const me = await signIn(email, password);
      nav(landingFor(me, loc.state?.from), { replace: true });
    } catch (error) {
      setFailure(error.message);
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail(demo.email);
    setPassword(demo.password);
    setFailure('');
  };

  return (
    <div className="login">
      <main className="login-main">
        <div className="login-form-wrap">
          <div className="login-brand">
            <img src={logo} alt="" />
            <span>ProjectOne</span>
          </div>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-sub">Sign in to your ProjectOne workspace</p>

          <form onSubmit={submit} noValidate className="login-form">
            {failure ? <Notice tone="error">{failure}</Notice> : ended && <Notice tone="info">{ended}</Notice>}
            <FormField label="Email" error={touched ? errors.email : undefined}>
              {(f) => (
                <input
                  {...f.control}
                  type="email"
                  className="input"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFailure('');
                  }}
                />
              )}
            </FormField>
            <FormField label="Password" error={touched ? errors.password : undefined}>
              {(f) => (
                <PasswordInput
                  control={f.control}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFailure('');
                  }}
                />
              )}
            </FormField>
            <button type="submit" className="btn login-submit" disabled={busy}>
              {busy ? 'Signing in' : 'Sign in'}
            </button>
          </form>

          {demo && (
            <div className="login-demo">
              <div>
                <b>Demo access</b>
                <span className="num">
                  {demo.email} / {demo.password}
                </span>
              </div>
              <button type="button" className="btn ghost sm" onClick={fillDemo}>
                Fill in
              </button>
            </div>
          )}
          <p className="login-foot">No account? Ask your Admin.</p>
        </div>
      </main>
      <aside className="login-aside">
        <ProjectSteps />
      </aside>
    </div>
  );
}
