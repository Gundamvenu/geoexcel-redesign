import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

export const STATUSES = ['new', 'in_review', 'quoted', 'won', 'lost', 'closed'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = { new: 'New', in_review: 'In review', quoted: 'Quoted', won: 'Won', lost: 'Lost', closed: 'Closed' };

export const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';

/** Hash routing so the admin works on any static host: #/quotations, #/quotations/<id>, #/customers, #/products ... */
export function useRoute(): [string[], (to: string) => void] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState<string[]>(read());
  useEffect(() => {
    const on = () => setParts(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [parts, (to) => { location.hash = to; }];
}

export function StatusBadge({ status }: { status: Status }) {
  return <span class={`badge s-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Notice({ kind, children }: { kind: 'ok' | 'bad' | 'info'; children: ComponentChildren }) {
  return <div class={`status ${kind}`} role={kind === 'bad' ? 'alert' : 'status'}>{children}</div>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div class="loadstate loading" role="status"><p>{label}</p></div>;
}

/** Load something once per `deps` change, with loading and error state. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (e: unknown) => live && setState({ loading: false, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => { live = false; };
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

/** Throw a readable error if a Supabase call failed. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
