// Escape text for safe use inside HTML built from strings. Everything that comes from the database goes through this.
export const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]!));

/** Show one of: loading | empty | error | none, in an aria-live region, with an optional retry button. */
export function setState(el: HTMLElement, kind: 'loading' | 'empty' | 'error' | 'none', message = '', onRetry?: () => void) {
  el.className = `loadstate ${kind}`;
  el.hidden = kind === 'none';
  el.replaceChildren();
  if (kind === 'none') return;
  const p = document.createElement('p');
  p.textContent = message;
  el.append(p);
  if (kind === 'loading') el.setAttribute('aria-busy', 'true');
  else el.removeAttribute('aria-busy');
  if (kind === 'error' && onRetry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-sm';
    b.textContent = 'Try again';
    b.addEventListener('click', onRetry);
    el.append(b);
  }
}
