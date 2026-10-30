import { useState } from 'preact/hooks';
import { sb } from './client';
import { Notice, Loading, useLoad, must } from './ui';
import { orderedSpecs } from '../lib/specs';

type P = {
  id: string; name: string; slug: string; category: string; short_description: string | null; specs: Record<string, unknown>;
  unit: string | null; price_note: string | null; image_url: string | null; is_active: boolean; is_sample: boolean;
};
type SpecRow = { k: string; v: string };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
const nz = (s: string) => (s.trim() ? s.trim() : null);

export function ProductList({ go }: { go: (to: string) => void }) {
  const [term, setTerm] = useState('');
  const [show, setShow] = useState<'active' | 'inactive' | 'all'>('all');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const { data, loading, error, reload } = useLoad(async () =>
    must(await sb.from('products').select('id, name, slug, category, is_active, is_sample, updated_at').order('category').order('name')) as unknown as Pick<P, 'id' | 'name' | 'slug' | 'category' | 'is_active' | 'is_sample'>[], []);

  const rows = (data ?? []).filter((p) => (show === 'all' || (show === 'active') === p.is_active) &&
    (!term || `${p.name} ${p.slug} ${p.category}`.toLowerCase().includes(term.toLowerCase())));

  async function setActive(p: { id: string; name: string }, active: boolean) {
    if (!active && !confirm(`Deactivate "${p.name}"? It disappears from the public site but is kept, and can be reactivated.`)) return;
    const { error: e } = await sb.from('products').update({ is_active: active }).eq('id', p.id);
    if (e) setMsg({ kind: 'bad', text: e.message }); else { setMsg({ kind: 'ok', text: `${p.name} ${active ? 'reactivated' : 'deactivated'}.` }); reload(); }
  }

  return (
    <section aria-labelledby="h-p">
      <div class="head-row">
        <h1 id="h-p" tabIndex={-1}>Products</h1>
        <button class="btn btn-primary btn-sm" type="button" onClick={() => go('/products/new')}>+ Add product</button>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div class="toolbar">
        <div class="field" style="min-width:160px">
          <label for="p-show">Show</label>
          <select id="p-show" value={show} onChange={(e) => setShow((e.target as HTMLSelectElement).value as typeof show)}>
            <option value="all">All</option><option value="active">Active only</option><option value="inactive">Inactive only</option>
          </select>
        </div>
        <div class="field" style="flex:1;min-width:200px">
          <label for="p-search">Search</label>
          <input id="p-search" type="search" placeholder="Name, slug or category" value={term} onInput={(e) => setTerm((e.target as HTMLInputElement).value)} />
        </div>
      </div>
      {loading && <Loading />}
      {error && <Notice kind="bad">Could not load products: {error}</Notice>}
      {!loading && !error && rows.length === 0 && <Notice kind="info">No products match.</Notice>}
      {rows.length > 0 && (
        <div class="table-wrap"><table class="data">
          <caption class="sr-only">Products</caption>
          <thead><tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id} class={p.is_active ? '' : 'off'}>
              <th scope="row">{p.name}<span class="sub">{p.slug}</span></th>
              <td>{p.category}</td>
              <td>
                {p.is_active ? <span class="badge s-won">Active</span> : <span class="badge s-closed">Inactive</span>}
                {p.is_sample && <span class="badge s-in_review" title="Imported sample data; replace with verified data">Sample</span>}
              </td>
              <td class="actions">
                <button class="btn btn-sm" type="button" onClick={() => go(`/products/${p.id}`)}>Edit</button>
                {p.is_active
                  ? <button class="btn btn-sm" type="button" onClick={() => setActive(p, false)}>Deactivate</button>
                  : <button class="btn btn-sm" type="button" onClick={() => setActive(p, true)}>Reactivate</button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

export function ProductForm({ id, go }: { id: string; go: (to: string) => void }) {
  const isNew = id === 'new';
  const { data: existing, loading, error } = useLoad(async () =>
    isNew ? null : (must(await sb.from('products').select('*').eq('id', id).single()) as unknown as P), [id]);
  const { data: cats } = useLoad(async () => [...new Set((must(await sb.from('products').select('category')) as { category: string }[]).map((r) => r.category))].sort(), []);

  if (loading) return <Loading />;
  if (error || (!isNew && !existing)) return <Notice kind="bad">Could not load this product: {error ?? 'not found'}. <a href="#/products">Back to products</a></Notice>;
  return <Editor key={id} existing={existing} categories={cats ?? []} go={go} />;
}

function Editor({ existing, categories, go }: { existing: P | null | undefined; categories: string[]; go: (to: string) => void }) {
  const [f, setF] = useState({
    name: existing?.name ?? '', slug: existing?.slug ?? '', category: existing?.category ?? '', description: existing?.short_description ?? '',
    unit: existing?.unit ?? '', price: existing?.price_note ?? '', image: existing?.image_url ?? '',
    active: existing?.is_active ?? true, sample: existing?.is_sample ?? false,
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));
  const [rows, setRows] = useState<SpecRow[]>(existing ? orderedSpecs({ category: existing.category, specs: existing.specs }).map(([k, v]) => ({ k, v })) : [{ k: '', v: '' }]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const setRow = (i: number, patch: Partial<SpecRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save(e: Event) {
    e.preventDefault();
    setErr('');
    const specs: Record<string, string> = {};
    for (const r of rows) {
      const k = r.k.trim(); const v = r.v.trim();
      if (!k && !v) continue;
      if (!k) { setErr('Every spec row needs a name.'); return; }
      if (k in specs) { setErr(`The spec "${k}" appears twice.`); return; }
      specs[k] = v;
    }
    const slug = f.slug.trim();
    if (!f.name.trim()) { setErr('Name is required.'); return; }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { setErr('Slug may only contain lowercase letters, numbers and single hyphens.'); return; }
    if (!f.category.trim()) { setErr('Category is required.'); return; }
    const payload = {
      name: f.name.trim(), slug, category: f.category.trim(), short_description: nz(f.description), specs, unit: nz(f.unit),
      price_note: nz(f.price), image_url: nz(f.image), is_active: f.active, is_sample: f.sample,
    };
    setBusy(true);
    const res = existing ? await sb.from('products').update(payload).eq('id', existing.id) : await sb.from('products').insert(payload);
    setBusy(false);
    if (res.error) setErr(res.error.code === '23505' ? 'That slug is already used by another product.' : res.error.message);
    else go('/products');
  }

  return (
    <section aria-labelledby="h-pf">
      <p><a href="#/products" onClick={(e) => { e.preventDefault(); go('/products'); }}>← All products</a></p>
      <h1 id="h-pf" tabIndex={-1}>{existing ? `Edit ${existing.name}` : 'Add product'}</h1>
      <form class="panel enquiry" onSubmit={save} noValidate>
        {err && <Notice kind="bad">{err}</Notice>}
        <div class="row">
          <div class="field"><label for="pf-name">Name <span class="req">*</span></label>
            <input id="pf-name" required maxLength={200} value={f.name} onInput={(e) => { const v = (e.target as HTMLInputElement).value; set('name', v); if (!slugTouched) set('slug', slugify(v)); }} /></div>
          <div class="field"><label for="pf-slug">Slug <span class="req">*</span> <span class="hint">(used in the web address)</span></label>
            <input id="pf-slug" required maxLength={120} value={f.slug} onInput={(e) => { setSlugTouched(true); set('slug', (e.target as HTMLInputElement).value); }} /></div>
        </div>
        <div class="row">
          <div class="field"><label for="pf-cat">Category <span class="req">*</span></label>
            <input id="pf-cat" list="pf-cats" required maxLength={80} value={f.category} onInput={(e) => set('category', (e.target as HTMLInputElement).value)} />
            <datalist id="pf-cats">{categories.map((c) => <option value={c} />)}</datalist></div>
          <div class="field"><label for="pf-unit">Unit <span class="hint">(optional, e.g. MT)</span></label>
            <input id="pf-unit" maxLength={30} value={f.unit} onInput={(e) => set('unit', (e.target as HTMLInputElement).value)} /></div>
        </div>
        <div class="field"><label for="pf-desc">Short description</label>
          <textarea id="pf-desc" maxLength={600} value={f.description} onInput={(e) => set('description', (e.target as HTMLTextAreaElement).value)} /></div>
        <div class="row">
          <div class="field"><label for="pf-price">Price note <span class="hint">(optional; only real prices)</span></label>
            <input id="pf-price" maxLength={200} value={f.price} onInput={(e) => set('price', (e.target as HTMLInputElement).value)} /></div>
          <div class="field"><label for="pf-img">Image URL or path</label>
            <input id="pf-img" maxLength={500} placeholder="img/products/example.webp or https://…" value={f.image} onInput={(e) => set('image', (e.target as HTMLInputElement).value)} /></div>
        </div>

        <fieldset class="specs">
          <legend>Specification sheet</legend>
          <p class="muted" style="margin:0 0 10px;font-size:.9rem">Name and value pairs shown as the spec table, e.g. “Pack size” and “25 Kg, 50 Kg”.</p>
          {rows.map((r, i) => (
            <div class="spec-row" key={i}>
              <div class="field"><label class="sr-only" for={`sk-${i}`}>Spec name {i + 1}</label>
                <input id={`sk-${i}`} placeholder="Name" maxLength={80} value={r.k} onInput={(e) => setRow(i, { k: (e.target as HTMLInputElement).value })} /></div>
              <div class="field"><label class="sr-only" for={`sv-${i}`}>Spec value {i + 1}</label>
                <input id={`sv-${i}`} placeholder="Value" maxLength={400} value={r.v} onInput={(e) => setRow(i, { v: (e.target as HTMLInputElement).value })} /></div>
              <button type="button" class="btn btn-sm" aria-label={`Remove spec row ${i + 1}`} onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [{ k: '', v: '' }]))}>Remove</button>
            </div>
          ))}
          <button type="button" class="btn btn-sm" onClick={() => setRows((x) => [...x, { k: '', v: '' }])}>+ Add spec</button>
        </fieldset>

        <div class="checks">
          <label><input type="checkbox" checked={f.active} onChange={(e) => set('active', (e.target as HTMLInputElement).checked)} /> Active (visible on the public site)</label>
          <label><input type="checkbox" checked={f.sample} onChange={(e) => set('sample', (e.target as HTMLInputElement).checked)} /> Sample data (untick once the details are verified; ticked rows are removed by the sample cleanup script)</label>
        </div>
        <div class="cta-row" style="margin-top:6px">
          <button class="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
          <button class="btn" type="button" onClick={() => go('/products')}>Cancel</button>
        </div>
      </form>
    </section>
  );
}
