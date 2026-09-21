import type { CardItem, ListItem, NavItem } from "./types";

const CARD_HEIGHT = 168;
const NAV_HEIGHT = 78;
const OVERSCAN = 8;

export interface VirtualListApi {
  setItems: (items: ListItem[], emptyMessage?: string) => void;
  destroy: () => void;
}

function heightOf(item: ListItem): number {
  return item.kind === "nav" ? NAV_HEIGHT : CARD_HEIGHT;
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

  function rebuildOffsets() {
    offsets = new Array(items.length);
    let y = 0;
    for (let i = 0; i < items.length; i++) {
      offsets[i] = y;
      y += heightOf(items[i]) + 10;
    }
    total = y + 14;
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

  function render() {
    if (!items.length) return;

    const viewH = viewport.clientHeight;
    const scrollTop = viewport.scrollTop;
    let start = Math.max(0, indexAt(scrollTop) - OVERSCAN);
    let end = start;
    const bottom = scrollTop + viewH;
    while (end < items.length && offsets[end] < bottom) end++;
    end = Math.min(items.length, end + OVERSCAN);

    spacer.style.height = `${total}px`;
    windowEl.style.transform = `translateY(${offsets[start] ?? 0}px)`;

    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const item = items[i];

      if (item.kind === "nav") {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "nav-row";
        row.dataset.key = item.key;

        const text = document.createElement("div");
        text.className = "nav-row-text";

        const title = document.createElement("span");
        title.className = "nav-row-title";
        title.textContent = item.title;

        text.appendChild(title);
        if (item.subtitle) {
          const sub = document.createElement("span");
          sub.className = "nav-row-sub";
          if (/[\u0600-\u06FF]/.test(item.subtitle)) sub.dir = "rtl";
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

  const onScroll = () => render();
  viewport.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  return {
    setItems(next, emptyMsg = "") {
      items = next;
      viewport.scrollTop = 0;
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
      render();
    },
    destroy() {
      viewport.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    },
  };
}
