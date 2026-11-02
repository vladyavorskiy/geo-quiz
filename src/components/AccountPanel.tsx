import { useState } from 'react';
import { supabase } from '../logic/cloud';
import { STRINGS } from '../logic/i18n';
import type { Lang } from '../logic/types';

export type SyncState = 'off' | 'syncing' | 'ok' | 'error';

interface Props {
  lang: Lang;
  email: string | null; // кто вошёл; null — никто
  sync: SyncState;
}

/** Вход в облако для синхронизации прогресса между устройствами. */
export function AccountPanel({ lang, email, sync }: Props) {
  const t = STRINGS[lang];
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!supabase) return <p className="account-note">{t.cloudOff}</p>;

  if (email) {
    return (
      <div className="account">
        <span>{t.signedInAs(email)} · <span className={`sync-${sync}`}>{t.syncState[sync]}</span></span>
        <button type="button" onClick={() => supabase!.auth.signOut()}>{t.signOut}</button>
      </div>
    );
  }

  async function run(kind: 'in' | 'up') {
    setBusy(true);
    setMessage('');
    const creds = { email: login.trim(), password };
    const { data, error } = kind === 'in'
      ? await supabase!.auth.signInWithPassword(creds)
      : await supabase!.auth.signUp(creds);
    setBusy(false);
    if (error) setMessage(explain(error.message));
    else if (kind === 'up' && !data.session) setMessage(t.confirmEmail); // в Supabase включено подтверждение почты
  }

  /** Самые частые ошибки Supabase — понятным текстом, остальные как есть. */
  function explain(msg: string) {
    if (/fetch|network/i.test(msg)) return t.errNetwork;
    if (/invalid login credentials/i.test(msg)) return t.errCredentials;
    if (/already registered|already exists/i.test(msg)) return t.errExists;
    return msg;
  }

  return (
    <form className="account" onSubmit={(e) => { e.preventDefault(); run('in'); }}>
      <input id="cloud-email" type="email" autoComplete="email" placeholder="Email" value={login} onChange={(e) => setLogin(e.target.value)} required />
      <input id="cloud-password" type="password" autoComplete="current-password" placeholder={t.password} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit" className="primary" disabled={busy}>{t.signIn}</button>
      <button type="button" disabled={busy || !login || password.length < 6} onClick={() => run('up')}>{t.signUp}</button>
      {message && <p className="account-note">{message}</p>}
    </form>
  );
}
