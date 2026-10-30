import { useState } from 'preact/hooks';
import { sb } from './client';
import { STATUSES, STATUS_LABEL, StatusBadge, Notice, Loading, fmt, useLoad, must, type Status } from './ui';

type Cust = { id: string; name: string; company: string | null; email: string; phone: string | null; country: string | null; city: string | null };
type Row = {
  id: string; reference: string; status: Status; created_at: string; notified_at: string | null; notify_error: string | null;
  customers: Pick<Cust, 'name' | 'company' | 'email'>; quotation_items: { id: string }[];
};
type Detail = Omit<Row, 'customers' | 'quotation_items'> & {
  message: string | null; internal_notes: string | null; customers: Cust;
  quotation_items: { id: string; product_id: string | null; product_name: string | null; quantity: number | null; note: string | null; products: { name: string } | null }[];
};

export function QuotationList({ go }: { go: (to: string) => void }) {
  const [status, setStatus] = useState<'all' | Status>('all');
  const [term, setTerm] = useState('');
  const { data, loading, error, reload } = useLoad(async () =>
    must(await sb.from('quotations').select('id, reference, status, created_at, notified_at, notify_error, customers(name, company, email), quotation_items(id)').order('created_at', { ascending: false }).limit(500)) as unknown as Row[], []);

  const rows = (data ?? []).filter((r) => (status === 'all' || r.status === status) &&
    (!term || `${r.reference} ${r.customers.name} ${r.customers.company ?? ''} ${r.customers.email}`.toLowerCase().includes(term.toLowerCase())));
  const counts = (data ?? []).reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});

  return (
    <section aria-labelledby="h-q">
      <h1 id="h-q" tabIndex={-1}>Quotation requests</h1>
      <div class="toolbar">
        <div class="field" style="min-width:180px">
          <label for="q-status">Status</label>
          <select id="q-status" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value as 'all' | Status)}>
            <option value="all">All ({data?.length ?? 0})</option>
            {STATUSES.map((s) => <option value={s}>{STATUS_LABEL[s]} ({counts[s] ?? 0})</option>)}
          </select>
        </div>
        <div class="field" style="flex:1;min-width:200px">
          <label for="q-search">Search</label>
          <input id="q-search" type="search" placeholder="Reference, name, company or email" value={term} onInput={(e) => setTerm((e.target as HTMLInputElement).value)} />
        </div>
        <button class="btn btn-sm" type="button" onClick={reload}>Refresh</button>
      </div>
      {loading && <Loading />}
      {error && <Notice kind="bad">Could not load quotations: {error}</Notice>}
      {!loading && !error && rows.length === 0 && <Notice kind="info">{data?.length ? 'No quotations match this filter.' : 'No quotation requests yet.'}</Notice>}
      {rows.length > 0 && (
        <div class="table-wrap">
          <table class="data">
            <caption class="sr-only">Quotation requests</caption>
            <thead><tr><th scope="col">Reference</th><th scope="col">Customer</th><th scope="col">Items</th><th scope="col">Status</th><th scope="col">Received</th><th scope="col">Email</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row"><a href={`#/quotations/${r.id}`} onClick={(e) => { e.preventDefault(); go(`/quotations/${r.id}`); }}>{r.reference}</a></th>
                  <td>{r.customers.name}<span class="sub">{r.customers.company ?? ''}</span></td>
                  <td>{r.quotation_items.length}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{fmt(r.created_at)}</td>
                  <td>{r.notify_error ? <span class="badge s-lost" title={r.notify_error}>Failed</span> : r.notified_at ? <span class="badge s-won">Sent</span> : <span class="badge s-closed">Pending</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function QuotationDetail({ id, go }: { id: string; go: (to: string) => void }) {
  const { data: q, loading, error, reload } = useLoad(async () =>
    must(await sb.from('quotations').select('id, reference, status, message, internal_notes, created_at, notified_at, notify_error, customers(id, name, company, email, phone, country, city), quotation_items(id, product_id, product_name, quantity, note, products(name))').eq('id', id).single()) as unknown as Detail, [id]);
  const [notes, setNotes] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function update(patch: Record<string, unknown>, okText: string) {
    setBusy(true); setMsg(null);
    const { error: e } = await sb.from('quotations').update(patch).eq('id', id);
    setBusy(false);
    if (e) setMsg({ kind: 'bad', text: e.message }); else { setMsg({ kind: 'ok', text: okText }); reload(); }
  }

  if (loading && !q) return <Loading />;
  if (error || !q) return <Notice kind="bad">Could not load this quotation: {error ?? 'not found'}. <a href="#/quotations">Back to inbox</a></Notice>;
  const c = q.customers;
  const current = notes ?? q.internal_notes ?? '';

  return (
    <section aria-labelledby="h-qd">
      <p><a href="#/quotations" onClick={(e) => { e.preventDefault(); go('/quotations'); }}>← All quotations</a></p>
      <h1 id="h-qd" tabIndex={-1}>{q.reference} <StatusBadge status={q.status} /></h1>
      <p class="muted">Received {fmt(q.created_at)}</p>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div class="admin-grid">
        <div>
          <div class="panel">
            <h2>Customer</h2>
            <dl class="kv">
              <dt>Name</dt><dd>{c.name}</dd>
              <dt>Company</dt><dd>{c.company ?? '—'}</dd>
              <dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd>
              <dt>Phone</dt><dd>{c.phone ?? '—'}</dd>
              <dt>Destination</dt><dd>{[c.city, c.country].filter(Boolean).join(', ') || '—'}</dd>
            </dl>
            <p><a href={`#/customers/${c.id}`} onClick={(e) => { e.preventDefault(); go(`/customers/${c.id}`); }}>Open customer record and history</a></p>
          </div>
          <div class="panel">
            <h2>Requested products</h2>
            {q.quotation_items.length === 0 ? <p class="muted">No specific products; see the message.</p> : (
              <div class="table-wrap"><table class="data">
                <caption class="sr-only">Requested products</caption>
                <thead><tr><th scope="col">Product</th><th scope="col">Qty</th><th scope="col">Details</th></tr></thead>
                <tbody>{q.quotation_items.map((i) => (
                  <tr key={i.id}><th scope="row">{i.products?.name ?? i.product_name ?? 'Not specified'}</th><td>{i.quantity ?? ''}</td><td>{i.note ?? ''}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
          {q.message && <div class="panel"><h2>Message</h2><p class="pre">{q.message}</p></div>}
        </div>

        <div>
          <div class="panel">
            <h2>Status</h2>
            <div class="field">
              <label for="qd-status">Change status</label>
              <select id="qd-status" value={q.status} disabled={busy} onChange={(e) => update({ status: (e.target as HTMLSelectElement).value }, 'Status updated.')}>
                {STATUSES.map((s) => <option value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <p class="muted" style="font-size:.9rem;margin:10px 0 0">
              Notification email: {q.notify_error ? <strong>failed</strong> : q.notified_at ? <>sent {fmt(q.notified_at)}</> : 'not sent yet'}
              {q.notify_error ? <span class="sub">{q.notify_error}</span> : null}
            </p>
          </div>
          <div class="panel">
            <h2>Internal notes</h2>
            <p class="muted" style="font-size:.9rem;margin-top:0">Only admins can see these.</p>
            <div class="field">
              <label for="qd-notes" class="sr-only">Internal notes</label>
              <textarea id="qd-notes" maxLength={4000} value={current} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
            </div>
            <button class="btn btn-primary btn-sm" type="button" disabled={busy || notes === null} onClick={() => update({ internal_notes: current.trim() || null }, 'Notes saved.')}>Save notes</button>
          </div>
        </div>
      </div>
    </section>
  );
}
