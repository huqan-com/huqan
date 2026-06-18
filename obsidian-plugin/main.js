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
function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}
function takePreview(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "(empty)";
  }
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}
function buildMockReceipt(scope, sourceText) {
  const normalized = normalizeText(sourceText);
  const lowered = normalized.toLowerCase();
  const riskyActionLanguage = /\b(delete|drop|wipe|remove|publish|merge|deploy|send|pay)\b/.test(lowered);
  const contradictionHints = /\b(but|however|yet|although|not)\b/.test(lowered);
  const provenanceMissing = !/\b(source|provenance|receipt|citation|ref)\b/.test(lowered);
  const unsupportedClaims = normalized.length > 0 && !(normalized.includes("supported") || normalized.includes("verified"));
  return {
    title: "HUQAN Trust Panel",
    label: "Mock receipt - no external calls",
    status: "mock_review",
    scope,
    checks: {
      unsupported_claims: unsupportedClaims,
      contradictions: contradictionHints,
      risky_action_language: riskyActionLanguage,
      provenance_missing: provenanceMissing
    },
    note: "Local AXIOM verification is not connected yet.",
    preview: takePreview(sourceText)
  };
}
var MockReceiptModal = class extends import_obsidian.Modal {
  constructor(app, receipt) {
    super(app);
    this.receipt = receipt;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("huqan-trust-panel-modal");
    const shell = contentEl.createDiv({ cls: "huqan-trust-panel" });
    const header = shell.createDiv({ cls: "huqan-trust-panel__header" });
    header.createEl("div", { cls: "huqan-trust-panel__eyebrow", text: this.receipt.label });
    header.createEl("h2", { text: this.receipt.title });
    header.createEl("div", { cls: "huqan-trust-panel__status", text: this.receipt.status });
    const summary = shell.createDiv({ cls: "huqan-trust-panel__summary" });
    summary.createEl("div", { text: `Scope: ${this.receipt.scope}` });
    summary.createEl("div", { text: `Preview: ${this.receipt.preview}` });
    const checks = shell.createDiv({ cls: "huqan-trust-panel__checks" });
    checks.createEl("h3", { text: "Checks" });
    const list = checks.createEl("ul");
    Object.entries(this.receipt.checks).forEach(([key, value]) => {
      const item = list.createEl("li");
      item.createSpan({ cls: "huqan-trust-panel__check-key", text: key });
      item.createSpan({ cls: value ? "huqan-trust-panel__check-value is-flagged" : "huqan-trust-panel__check-value", text: value ? "flagged" : "clear" });
    });
    shell.createDiv({ cls: "huqan-trust-panel__note", text: this.receipt.note });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var HuqanTrustPanelPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.addCommand({
      id: "huqan-verify-current-note",
      name: "HUQAN: Verify current note",
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
        if (!view) {
          new import_obsidian.Notice("Open a markdown note first");
          return;
        }
        const receipt = buildMockReceipt("current_note", view.editor.getValue());
        new MockReceiptModal(this.app, receipt).open();
      }
    });
    this.addCommand({
      id: "huqan-verify-selected-text",
      name: "HUQAN: Verify selected text",
      editorCallback: (editor) => {
        const selection = editor.getSelection();
        if (!selection.trim()) {
          new import_obsidian.Notice("Select text first");
          return;
        }
        const receipt = buildMockReceipt("selection", selection);
        new MockReceiptModal(this.app, receipt).open();
      }
    });
  }
};
