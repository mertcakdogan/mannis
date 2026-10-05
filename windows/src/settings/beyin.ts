import { Bridge } from "../core/bridge";
import type { Settings } from "../core/state";
import { clear, h } from "../views/dom";

export function beyinSection(
  getSettings: () => Settings,
  saveSettings: (settings: Settings) => Promise<void>,
): HTMLElement {
  const vault = h("input", {
    type: "text", id: "beyin-vault", placeholder: "C:\Notes\Beyin",
    value: getSettings().beyinVault, style: "flex:1",
  }) as HTMLInputElement;
  const status = h("div", { class: "hint", role: "status" });
  const results = h("ul", { class: "recap" });

  const fail = (error: unknown) => {
    status.textContent = String(error instanceof Error ? error.message : error).replace(/^Error:\s*/, "");
  };

  vault.addEventListener("change", async () => {
    clear(results);
    try {
      await saveSettings({ ...getSettings(), beyinVault: vault.value.trim() });
      status.textContent = vault.value.trim() ? "Saved." : "Beyin link is off.";
    } catch (error) {
      fail(error);
    }
  });

  const chat = h("input", { type: "checkbox", id: "beyin-chat" }) as HTMLInputElement;
  chat.checked = getSettings().beyinChat;
  const audience = h("select", { id: "beyin-audience" }) as HTMLSelectElement;
  audience.append(
    h("option", { value: "public", text: "Public notes only" }),
    h("option", { value: "internal", text: "Public and internal notes" }),
  );
  audience.value = getSettings().beyinAudience;
  const saveChat = async () => {
    try {
      await saveSettings({
        ...getSettings(), beyinChat: chat.checked,
        beyinAudience: audience.value as Settings["beyinAudience"],
      });
      status.textContent = "Saved.";
    } catch (error) {
      fail(error);
    }
  };
  chat.addEventListener("change", () => void saveChat());
  audience.addEventListener("change", () => void saveChat());

  const show = h("button", { text: "Show last 7 days" });
  show.addEventListener("click", async () => {
    clear(results);
    status.textContent = "Asking Beyin…";
    try {
      const items = await Bridge.beyinRecap(7);
      status.textContent = items.length ? "" : "Nothing recorded in the last 7 days.";
      for (const item of items) {
        results.append(h("li", {}, h("span", { class: "hint", text: item.created_at.slice(0, 10) }), ` ${item.summary}`));
      }
    } catch (error) {
      fail(error);
    }
  });

  const noteTitle = h("input", { type: "text", id: "beyin-note-title", placeholder: "Title", maxlength: "80" }) as HTMLInputElement;
  const noteText = h("textarea", { id: "beyin-note-text", rows: "3", placeholder: "Something worth remembering" }) as HTMLTextAreaElement;
  const save = h("button", { text: "Save to Beyin" });
  save.addEventListener("click", async () => {
    status.textContent = "Saving…";
    try {
      const source = await Bridge.beyinSaveNote(noteTitle.value, noteText.value);
      noteTitle.value = "";
      noteText.value = "";
      status.textContent = `Saved as ${source}`;
    } catch (error) {
      fail(error);
    }
  });

  return h("section", { class: "beyin-section" },
    h("h2", {}, h("span", { text: "Beyin" })),
    h("div", { class: "row" }, h("label", { text: "Vault folder" }), vault),
    h("div", { class: "row" }, show, h("span", { class: "hint", text: "Read-only. Runs beyin.py in your vault; nothing is sent anywhere." })),
    h("div", { class: "row" },
      h("label", { for: "beyin-chat", text: "Use in chat" }), chat,
      h("span", { class: "hint", text: "Sends matching notes to your chat provider with each question." }),
    ),
    h("div", { class: "row" }, h("label", { for: "beyin-audience", text: "Share" }), audience),
    h("div", { class: "row" }, h("label", { for: "beyin-note-title", text: "New note" }), noteTitle),
    h("div", { class: "row" }, noteText),
    h("div", { class: "row" }, save, h("span", { class: "hint", text: "Written into your vault's knowledge folder; existing notes are never overwritten." })),
    status,
    results,
  );
}
