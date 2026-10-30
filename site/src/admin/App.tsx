import { useEffect, useRef, useState } from 'preact/hooks';
import type { Session } from '@supabase/supabase-js';
import { sb } from './client';
import { Notice, Loading, useRoute } from './ui';
import { QuotationList, QuotationDetail } from './Quotations';
import { CustomerList, CustomerDetail } from './Customers';
import { ProductList, ProductForm } from './Products';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr('Sign-in failed. Check your email and password.');
  }

  return (
    <main id="admin-main" class="login">
      <form class="panel enquiry" onSubmit={submit} aria-labelledby="login-h">
        <h1 id="login-h" style="font-size:1.8rem">Geo Excel admin</h1>
        <p class="muted" style="margin-top:0">Sign in with your admin account.</p>
        {err && <Notice kind="bad">{err}</Notice>}
        <div class="field"><label for="a-email">Email</label>
          <input id="a-email" type="email" autocomplete="username" required value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></div>
        <div class="field"><label for="a-pass">Password</label>
          <input id="a-pass" type="password" autocomplete="current-password" required value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} /></div>
        <button class="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function NotAuthorised({ email }: { email: string }) {
  return (
    <main id="admin-main" class="login">
      <div class="panel" role="alert">
        <h1 style="font-size:1.8rem">Not authorised</h1>
        <p>The account <strong>{email}</strong> is not an administrator of this site, so no data is available to it.</p>
        <button class="btn" type="button" onClick={() => sb.auth.signOut()}>Sign out</button>
      </div>
    </main>
  );
}

const TABS = [
  { key: 'quotations', label: 'Quotations' },
  { key: 'customers', label: 'Customers' },
  { key: 'products', label: 'Products' },
] as const;

function Dashboard({ email }: { email: string }) {
  const [parts, go] = useRoute();
  const area = parts[0] ?? 'quotations';
  const id = parts[1];
  const main = useRef<HTMLElement>(null);

  // Move focus to the page heading on navigation so keyboard and screen-reader users land in the new view.
  useEffect(() => { main.current?.querySelector<HTMLElement>('h1')?.focus(); }, [parts.join('/')]);

  let view;
  if (area === 'quotations') view = id ? <QuotationDetail id={id} go={go} /> : <QuotationList go={go} />;
  else if (area === 'customers') view = id ? <CustomerDetail id={id} go={go} /> : <CustomerList go={go} />;
  else if (area === 'products') view = id ? <ProductForm id={id} go={go} /> : <ProductList go={go} />;
  else view = <Notice kind="info">Page not found. <a href="#/quotations">Go to quotations</a></Notice>;

  return (
    <>
      <header class="admin-bar">
        <div class="wrap bar">
          <strong class="admin-title">Geo Excel admin</strong>
          <nav aria-label="Admin sections" class="admin-nav">
            {TABS.map((t) => <a href={`#/${t.key}`} aria-current={area === t.key ? 'page' : undefined}>{t.label}</a>)}
          </nav>
          <span class="admin-user">{email}</span>
          <button class="btn btn-sm" type="button" onClick={() => sb.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <main id="admin-main" ref={main} class="wrap admin-main">{view}</main>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Authorisation is decided by the database (is_admin(), enforced by RLS on every table). This only picks which screen to show.
  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    setIsAdmin(null);
    sb.rpc('is_admin').then(({ data, error }) => setIsAdmin(!error && data === true));
  }, [session?.user.id]);

  if (session === undefined) return <main id="admin-main" class="login"><Loading label="Checking session…" /></main>;
  if (!session) return <Login />;
  if (isAdmin === null) return <main id="admin-main" class="login"><Loading label="Checking permissions…" /></main>;
  if (!isAdmin) return <NotAuthorised email={session.user.email ?? 'this account'} />;
  return <Dashboard email={session.user.email ?? ''} />;
}
