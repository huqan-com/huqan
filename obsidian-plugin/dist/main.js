var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HuqanTrustPanelPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var MOCK_NOTES = [
  "Local verify endpoint: BLOCKED/TODO for the next PR.",
  "No network calls.",
  "No external integrations.",
  "No note writes.",
  "No graph or memory writes.",
  "Explicit user command required."
];
function normalizePreview(text, limit = 180) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact)
    return "(empty)";
  if (compact.length <= limit)
    return compact;
  return `${compact.slice(0, limit - 1)}\u2026`;
}
var TrustReceiptModal = class extends import_obsidian.Modal {
  constructor(app, receipt) {
    super(app);
    this.receipt = receipt;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("huqan-trust-panel-modal");
    contentEl.createEl("h2", { text: "HUQAN Trust Panel" });
    contentEl.createEl("p", { text: "Mock receipt - no external calls" });
    const details = contentEl.createEl("div", { cls: "huqan-trust-panel-modal__details" });
    this.addRow(details, "Scope", this.receipt.scope);
    this.addRow(details, "Source", this.receipt.source);
    this.addRow(details, "Mode", this.receipt.mode);
    this.addRow(details, "Verdict", this.receipt.verdict);
    this.addRow(details, "Status", this.receipt.status);
    this.addRow(details, "Input preview", this.receipt.inputPreview);
    const notes = contentEl.createEl("ul", { cls: "huqan-trust-panel-modal__notes" });
    for (const note of this.receipt.notes) {
      notes.createEl("li", { text: note });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
  addRow(container, label, value) {
    const row = container.createEl("p", { cls: "huqan-trust-panel-modal__row" });
    row.createEl("strong", { text: `${label}: ` });
    row.createSpan({ text: value });
  }
};
var HuqanTrustPanelPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.addCommand({
      id: "huqan-verify-current-note",
      name: "Verify current note",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new import_obsidian.Notice("Open a note first.");
          return;
        }
        const text = await this.app.vault.read(file);
        this.openReceiptModal("current_note", file.path, text);
      }
    });
    this.addCommand({
      id: "huqan-verify-selected-text",
      name: "Verify selected text",
      editorCallback: (editor) => {
        const selectedText = editor.getSelection().trim();
        if (!selectedText) {
          new import_obsidian.Notice("Select text first.");
          return;
        }
        this.openReceiptModal("selection", "selected text", selectedText);
      }
    });
  }
  onunload() {
  }
  openReceiptModal(scope, source, rawInput) {
    const receipt = {
      scope,
      source,
      inputPreview: normalizePreview(rawInput),
      mode: "mock-only",
      verdict: "mock_review",
      status: "BLOCKED_TODO",
      notes: MOCK_NOTES
    };
    new TrustReceiptModal(this.app, receipt).open();
  }
};
