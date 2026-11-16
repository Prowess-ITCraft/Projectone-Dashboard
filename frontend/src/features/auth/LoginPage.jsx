import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { FormField, Notice } from '@/components';
import { DEMO_ACCOUNT, useSession } from '@/app/session';
import logo from '@/assets/projectone-logo.png';
import { ProjectSteps } from './ProjectSteps';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { signIn } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState(false);

  const errors = {
    email: !email.trim() ? 'Enter your email.' : !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : undefined,
    password: !password ? 'Enter your password.' : undefined,
  };

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    setFailed(false);
    if (errors.email || errors.password) return;
    if (!signIn(email, password)) {
      setFailed(true);
      return;
    }
    const from = loc.state?.from;
    nav(from && from !== '/login' ? from : '/dashboard', { replace: true });
  };

  const fillDemo = () => {
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    setFailed(false);
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
            {failed && <Notice tone="error">That email and password do not match.</Notice>}
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
                    setFailed(false);
                  }}
                />
              )}
            </FormField>
            <FormField label="Password" error={touched ? errors.password : undefined}>
              {(f) => (
                <div className="login-password">
                  <input
                    {...f.control}
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFailed(false);
                    }}
                  />
                  <button
                    type="button"
                    className="login-eye"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              )}
            </FormField>
            <button type="submit" className="btn login-submit">
              Sign in
            </button>
          </form>

          <div className="login-demo">
            <div>
              <b>Demo access</b>
              <span className="num">
                {DEMO_ACCOUNT.email} / {DEMO_ACCOUNT.password}
              </span>
            </div>
            <button type="button" className="btn ghost sm" onClick={fillDemo}>
              Fill in
            </button>
          </div>
          <p className="login-foot">No account? Ask your Admin.</p>
        </div>
      </main>
      <aside className="login-aside">
        <ProjectSteps />
      </aside>
    </div>
  );
}
