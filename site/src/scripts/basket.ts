// Enquiry basket: product ids kept in localStorage so a buyer can collect products across pages and send one enquiry.
const KEY = 'geoexcel-enquiry';

export const getBasket = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

// If storage is blocked the basket still works for the life of the page.
let memory: string[] | null = null;
const read = () => memory ?? getBasket();
const save = (ids: string[]) => {
  memory = [...new Set(ids)];
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* storage blocked */ }
  document.dispatchEvent(new CustomEvent('basket:change'));
};

export const has = (id: string) => read().includes(id);
export const add = (id: string) => save([...read(), id]);
export const remove = (id: string) => save(read().filter((x) => x !== id));
export const toggle = (id: string) => (has(id) ? remove(id) : add(id));
export const clear = () => save([]);

export function paint() {
  const ids = read();
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    el.textContent = String(ids.length);
    el.hidden = ids.length === 0;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => {
    const on = ids.includes(b.dataset.add!);
    b.setAttribute('aria-pressed', String(on));
    const l = b.querySelector('.lbl');
    if (l) l.textContent = on ? 'Added to enquiry' : 'Add to enquiry';
  });
}

export function init() {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-add]');
    if (b) toggle(b.dataset.add!);
  });
  document.addEventListener('basket:change', paint);
  window.addEventListener('storage', paint);
  paint();
}
