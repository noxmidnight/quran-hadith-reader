import type { CardItem, ListItem, NavItem } from "./types";

const CARD_HEIGHT = 220;
/** Compact tafsir teaser — full text lives in the copy panel only. */
const CARD_HEIGHT_TAFSIR = 268;
const NAV_HEIGHT = 92;
const OVERSCAN = 4;
/** Keep list DOM light; long commentaries belong in the detail/copy panel. */
const TAFSIR_PREVIEW_CHARS = 160;

export interface VirtualListApi {
  setItems: (items: ListItem[], emptyMessage?: string) => void;
  destroy: () => void;
}

function heightOf(item: ListItem): number {
  if (item.kind === "nav") return NAV_HEIGHT;
  return item.tafsir?.trim() ? CARD_HEIGHT_TAFSIR : CARD_HEIGHT;
}

function previewTafsir(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= TAFSIR_PREVIEW_CHARS) return cleaned;
  const cut = cleaned.slice(0, TAFSIR_PREVIEW_CHARS);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 80 ? cut.slice(0, sp) : cut).trim()}…`;
}

function hasArabic(s: string): boolean {
  // Sample only the preview/short prefix — full-string scans are costly on long tafsirs.
  return /[\u0600-\u06FF]/.test(s.slice(0, 80));
}

export function createVirtualList(
  viewport: HTMLElement,
  spacer: HTMLElement,
  windowEl: HTMLElement,
  handlers: {
    onCardClick: (item: CardItem) => void;
    onNavClick: (item: NavItem) => void;
  },
): VirtualListApi {
  let items: ListItem[] = [];
  let offsets: number[] = [];
  let total = 0;
  let lastStart = -1;
  let lastEnd = -1;
  let raf = 0;
  let pending = false;

  function rebuildOffsets() {
    offsets = new Array(items.length);
    let y = 0;
    for (let i = 0; i < items.length; i++) {
      offsets[i] = y;
      y += heightOf(items[i]) + 10;
    }
    total = y + 14;
    lastStart = -1;
    lastEnd = -1;
  }

  function indexAt(scrollTop: number): number {
    let lo = 0;
    let hi = Math.max(0, items.length - 1);
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= scrollTop) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  function render(force = false) {
    if (!items.length) return;

    const viewH = viewport.clientHeight;
    const scrollTop = viewport.scrollTop;
    let start = Math.max(0, indexAt(scrollTop) - OVERSCAN);
    let end = start;
    const bottom = scrollTop + viewH;
    while (end < items.length && offsets[end] < bottom) end++;
    end = Math.min(items.length, end + OVERSCAN);

    spacer.style.height = `${total}px`;
    windowEl.style.transform = `translate3d(0, ${offsets[start] ?? 0}px, 0)`;

    // Same window → only translate the window; skip DOM rebuild.
    if (!force && start === lastStart && end === lastEnd) return;
    lastStart = start;
    lastEnd = end;

    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const item = items[i];

      if (item.kind === "nav") {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "nav-row";
        row.dataset.key = item.key;

        if (item.index) {
          const idx = document.createElement("span");
          idx.className = "nav-row-index";
          idx.textContent = item.index;
          row.appendChild(idx);
        }

        const text = document.createElement("div");
        text.className = "nav-row-text";

        const title = document.createElement("span");
        title.className = "nav-row-title";
        title.textContent = item.title;

        text.appendChild(title);
        if (item.subtitle) {
          const sub = document.createElement("span");
          sub.className = "nav-row-sub";
          if (hasArabic(item.subtitle)) sub.dir = "rtl";
          sub.textContent = item.subtitle;
          text.appendChild(sub);
        }

        row.appendChild(text);

        if (item.badge) {
          const badge = document.createElement("span");
          badge.className = "nav-row-badge";
          badge.textContent = item.badge;
          row.appendChild(badge);
        }

        const chevron = document.createElement("span");
        chevron.className = "nav-row-chevron";
        chevron.setAttribute("aria-hidden", "true");
        chevron.textContent = "›";
        row.appendChild(chevron);

        row.addEventListener("click", () => handlers.onNavClick(item));
        frag.appendChild(row);
        continue;
      }

      const card = document.createElement("article");
      card.className = "card";
      card.tabIndex = 0;
      card.dataset.key = item.key;

      const ref = document.createElement("p");
      ref.className = "card-ref";
      ref.textContent = item.ref;

      const ar = document.createElement("p");
      ar.className = "card-ar";
      ar.dir = "rtl";
      ar.lang = "ar";
      ar.textContent = item.arabic;

      const tr = document.createElement("p");
      tr.className = "card-tr";
      tr.textContent = item.translation;

      card.append(ref, ar, tr);

      if (item.tafsir?.trim()) {
        const tf = document.createElement("div");
        tf.className = "card-tafsir";
        const tfLabel = document.createElement("p");
        tfLabel.className = "card-tafsir-label";
        tfLabel.textContent = item.tafsirLabel || "Tafsir";
        const tfBody = document.createElement("p");
        tfBody.className = "card-tafsir-text";
        const preview = previewTafsir(item.tafsir);
        if (hasArabic(preview)) {
          tfBody.dir = "rtl";
          tfBody.lang = "ar";
        }
        tfBody.textContent = preview;
        tf.append(tfLabel, tfBody);
        card.appendChild(tf);
      }

      card.addEventListener("click", () => handlers.onCardClick(item));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handlers.onCardClick(item);
        }
      });
      frag.appendChild(card);
    }

    windowEl.replaceChildren(frag);
  }

  function scheduleRender() {
    if (pending) return;
    pending = true;
    raf = requestAnimationFrame(() => {
      pending = false;
      render();
    });
  }

  viewport.addEventListener("scroll", scheduleRender, { passive: true });
  window.addEventListener("resize", scheduleRender);

  return {
    setItems(next, emptyMsg = "") {
      items = next;
      viewport.scrollTop = 0;
      lastStart = -1;
      lastEnd = -1;
      if (items.length === 0) {
        spacer.style.height = "auto";
        windowEl.style.transform = "";
        if (emptyMsg) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = emptyMsg;
          windowEl.replaceChildren(empty);
        } else {
          windowEl.replaceChildren();
        }
        return;
      }
      rebuildOffsets();
      render(true);
    },
    destroy() {
      viewport.removeEventListener("scroll", scheduleRender);
      window.removeEventListener("resize", scheduleRender);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
