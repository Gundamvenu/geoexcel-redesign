import { useState } from 'preact/hooks';
import { sb } from './client';
import { StatusBadge, Notice, Loading, fmt, useLoad, must, type Status } from './ui';

type CRow = { id: string; name: string; company: string | null; email: string; phone: string | null; country: string | null; created_at: string; quotations: { count: number }[] };
type CDetail = { id: string; name: string; company: string | null; email: string; phone: string | null; country: string | null; city: string | null; notes: string | null; created_at: string;
  quotations: { id: string; reference: string; status: Status; created_at: string }[] };

export function CustomerList({ go }: { go: (to: string) => void }) {
  const [term, setTerm] = useState('');
  const { data, loading, error, reload } = useLoad(async () =>
    must(await sb.from('customers').select('id, name, company, email, phone, country, created_at, quotations(count)').order('created_at', { ascending: false }).limit(500)) as unknown as CRow[], []);
  const rows = (data ?? []).filter((c) => !term || `${c.name} ${c.company ?? ''} ${c.email} ${c.country ?? ''}`.toLowerCase().includes(term.toLowerCase()));

  return (
    <section aria-labelledby="h-c">
      <h1 id="h-c" tabIndex={-1}>Customers</h1>
      <div class="toolbar">
        <div class="field" style="flex:1;min-width:200px">
          <label for="c-search">Search</label>
          <input id="c-search" type="search" placeholder="Name, company, email or country" value={term} onInput={(e) => setTerm((e.target as HTMLInputElement).value)} />
        </div>
        <button class="btn btn-sm" type="button" onClick={reload}>Refresh</button>
      </div>
      {loading && <Loading />}
      {error && <Notice kind="bad">Could not load customers: {error}</Notice>}
      {!loading && !error && rows.length === 0 && <Notice kind="info">{data?.length ? 'No customers match this search.' : 'No customers yet. They appear when someone submits a quotation request.'}</Notice>}
      {rows.length > 0 && (
        <div class="table-wrap"><table class="data">
          <caption class="sr-only">Customers</caption>
          <thead><tr><th scope="col">Name</th><th scope="col">Company</th><th scope="col">Email</th><th scope="col">Country</th><th scope="col">Requests</th><th scope="col">Since</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id}>
              <th scope="row"><a href={`#/customers/${c.id}`} onClick={(e) => { e.preventDefault(); go(`/customers/${c.id}`); }}>{c.name}</a></th>
              <td>{c.company ?? ''}</td><td>{c.email}</td><td>{c.country ?? ''}</td><td>{c.quotations?.[0]?.count ?? 0}</td><td>{fmt(c.created_at)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

export function CustomerDetail({ id, go }: { id: string; go: (to: string) => void }) {
  const { data: c, loading, error, reload } = useLoad(async () =>
    must(await sb.from('customers').select('id, name, company, email, phone, country, city, notes, created_at, quotations(id, reference, status, created_at)').eq('id', id).single()) as unknown as CDetail, [id]);
  const [notes, setNotes] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !c) return <Loading />;
  if (error || !c) return <Notice kind="bad">Could not load this customer: {error ?? 'not found'}. <a href="#/customers">Back to customers</a></Notice>;
  const current = notes ?? c.notes ?? '';
  const history = [...c.quotations].sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function save() {
    setBusy(true); setMsg(null);
    const { error: e } = await sb.from('customers').update({ notes: current.trim() || null }).eq('id', id);
    setBusy(false);
    if (e) setMsg({ kind: 'bad', text: e.message }); else { setMsg({ kind: 'ok', text: 'Notes saved.' }); setNotes(null); reload(); }
  }

  return (
    <section aria-labelledby="h-cd">
      <p><a href="#/customers" onClick={(e) => { e.preventDefault(); go('/customers'); }}>← All customers</a></p>
      <h1 id="h-cd" tabIndex={-1}>{c.name}</h1>
      <p class="muted">Customer since {fmt(c.created_at)}</p>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div class="admin-grid">
        <div>
          <div class="panel">
            <h2>Details</h2>
            <dl class="kv">
              <dt>Company</dt><dd>{c.company ?? '—'}</dd>
              <dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd>
              <dt>Phone</dt><dd>{c.phone ?? '—'}</dd>
              <dt>Location</dt><dd>{[c.city, c.country].filter(Boolean).join(', ') || '—'}</dd>
            </dl>
          </div>
          <div class="panel">
            <h2>Quotation history</h2>
            {history.length === 0 ? <p class="muted">No quotation requests.</p> : (
              <div class="table-wrap"><table class="data">
                <caption class="sr-only">Quotation history</caption>
                <thead><tr><th scope="col">Reference</th><th scope="col">Status</th><th scope="col">Received</th></tr></thead>
                <tbody>{history.map((q) => (
                  <tr key={q.id}>
                    <th scope="row"><a href={`#/quotations/${q.id}`} onClick={(e) => { e.preventDefault(); go(`/quotations/${q.id}`); }}>{q.reference}</a></th>
                    <td><StatusBadge status={q.status} /></td><td>{fmt(q.created_at)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </div>
        <div class="panel">
          <h2>Internal notes</h2>
          <p class="muted" style="font-size:.9rem;margin-top:0">Only admins can see these.</p>
          <div class="field">
            <label for="cd-notes" class="sr-only">Customer notes</label>
            <textarea id="cd-notes" maxLength={4000} value={current} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
          </div>
          <button class="btn btn-primary btn-sm" type="button" disabled={busy || notes === null} onClick={save}>Save notes</button>
        </div>
      </div>
    </section>
  );
}
