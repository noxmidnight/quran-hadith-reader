import type { CardItem } from "./types";

export interface CopyPanelApi {
  open: (item: CardItem) => void;
  close: () => void;
}

export function createCopyPanel(toast: (msg: string) => void): CopyPanelApi {
  const overlay = document.querySelector<HTMLElement>("#copy-overlay")!;
  const closeBtn = document.querySelector<HTMLButtonElement>("#copy-close")!;
  const refEl = document.querySelector<HTMLElement>("#copy-ref")!;
  const arEl = document.querySelector<HTMLElement>("#copy-arabic")!;
  const trEl = document.querySelector<HTMLElement>("#copy-translation")!;
  const arCb = document.querySelector<HTMLInputElement>("#copy-ar-cb")!;
  const trCb = document.querySelector<HTMLInputElement>("#copy-tr-cb")!;
  const arLabel = document.querySelector<HTMLElement>("#copy-ar-label")!;
  const trLabel = document.querySelector<HTMLElement>("#copy-tr-label")!;
  const copyBtn = document.querySelector<HTMLButtonElement>("#copy-btn")!;

  let current: CardItem | null = null;

  function close() {
    overlay.classList.add("hidden");
    current = null;
  }

  function open(item: CardItem) {
    current = item;
    refEl.textContent = item.ref;
    arEl.textContent = item.arabic;
    trEl.textContent = item.translation;
    arLabel.textContent = "Arabic";
    trLabel.textContent = item.translationLabel || "Translation";
    arCb.checked = true;
    trCb.checked = true;
    overlay.classList.remove("hidden");
    copyBtn.focus();
  }

  async function writeClipboard(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      toast("Select Arabic and/or translation");
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
      toast("Copied");
      close();
    } catch {
      const ta = document.createElement("textarea");
      ta.value = trimmed;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Copied");
      close();
    }
  }

  function build() {
    if (!current) return "";
    const parts: string[] = [];
    if (arCb.checked) parts.push(current.arabic);
    if (trCb.checked) parts.push(current.translation);
    return parts.join("\n\n");
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) close();
    if (e.key === "Enter" && !overlay.classList.contains("hidden") && document.activeElement !== closeBtn) {
      e.preventDefault();
      void writeClipboard(build());
    }
  });

  copyBtn.addEventListener("click", () => {
    void writeClipboard(build());
  });

  return { open, close };
}
