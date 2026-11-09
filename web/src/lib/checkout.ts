/** What the buyer picked on the product page. Kept for the sign-up step so nothing is lost (blueprint §4.3). */
export interface Selection {
  quantity: number;
  variant: Record<string, string>;
}

const mem: Record<string, Selection> = {};
const key = (slug: string) => `buybridge.checkout.${slug}`;

export function saveSelection(slug: string, selection: Selection) {
  mem[slug] = selection;
  try {
    sessionStorage.setItem(key(slug), JSON.stringify(selection));
  } catch {
    /* in-memory copy still works for this page view */
  }
}

export function loadSelection(slug: string): Selection | null {
  try {
    const raw = sessionStorage.getItem(key(slug));
    if (raw) return JSON.parse(raw) as Selection;
  } catch {
    /* fall through */
  }
  return mem[slug] ?? null;
}
