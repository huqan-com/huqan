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
var LOCAL_VERIFY_ENDPOINT = "http://127.0.0.1:3000/v2/verify";
var VERIFY_TIMEOUT_MS = 5e3;
var MAX_CLAIM_LENGTH = 2e3;
function normalizePreview(text, limit = 180) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "(empty)";
  }
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1)}\u2026`;
}
function isAllowedLocalEndpoint(rawEndpoint) {
  try {
    const url = new URL(rawEndpoint);
    if (url.protocol !== "http:") {
      return false;
    }
    if (url.username || url.password) {
      return false;
    }
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch (e) {
    return false;
  }
}
function stringifySafeJson(value) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return String(value);
  }
}
var ClaimInputModal = class extends import_obsidian.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("huqan-trust-panel-modal");
    contentEl.createEl("h2", { text: "Verify with local HUQAN" });
    contentEl.createEl("p", {
      text: "Enter a claim to send only to the local verify endpoint."
    });
    this.textarea = contentEl.createEl("textarea", {
      cls: "huqan-trust-panel-modal__input",
      attr: {
        rows: "8",
        placeholder: "Enter claim text here..."
      }
    });
    this.textarea.focus();
    const actions = contentEl.createDiv({ cls: "huqan-trust-panel-modal__actions" });
    const verifyButton = actions.createEl("button", { text: "Verify" });
    verifyButton.addEventListener("click", () => {
      const claim = this.textarea.value.trim();
      if (!claim) {
        new import_obsidian.Notice("Empty input.");
        return;
      }
      this.close();
      this.onSubmit(claim);
    });
    const cancelButton = actions.createEl("button", { text: "Cancel" });
    cancelButton.addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
};
var VerifyResultModal = class extends import_obsidian.Modal {
  constructor(app, viewModel, summary) {
    super(app);
    this.viewModel = viewModel;
    this.summary = summary;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("huqan-trust-panel-modal");
    contentEl.createEl("h2", { text: "HUQAN Trust Panel" });
    contentEl.createEl("p", { text: this.summary });
    const details = contentEl.createDiv({ cls: "huqan-trust-panel-modal__details" });
    this.addRow(details, "Scope", this.viewModel.trigger);
    this.addRow(details, "Endpoint", this.viewModel.endpoint);
    this.addRow(details, "Claim preview", this.viewModel.claimPreview);
    this.addRow(details, "Status", this.viewModel.statusLabel);
    this.addRow(details, "Response kind", this.viewModel.responseKind);
    const response = contentEl.createEl("pre", { cls: "huqan-trust-panel-modal__response" });
    response.setText(this.viewModel.responseText);
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
      id: "huqan-verify-selected-text",
      name: "Verify selected text",
      editorCallback: (editor) => {
        const selectedText = editor.getSelection().trim();
        if (!selectedText) {
          new import_obsidian.Notice("Select text first.");
          return;
        }
        void this.verifyClaim(selectedText, "selection");
      }
    });
    this.addCommand({
      id: "huqan-verify-with-local-huqan",
      name: "Verify with local HUQAN",
      callback: () => {
        new ClaimInputModal(this.app, (claim) => {
          void this.verifyClaim(claim, "manual");
        }).open();
      }
    });
  }
  onunload() {
  }
  async verifyClaim(claim, trigger) {
    var _a;
    const trimmedClaim = claim.trim();
    if (!trimmedClaim) {
      new import_obsidian.Notice("Empty input.");
      return;
    }
    if (trimmedClaim.length > MAX_CLAIM_LENGTH) {
      new VerifyResultModal(
        this.app,
        {
          endpoint: LOCAL_VERIFY_ENDPOINT,
          trigger,
          claimPreview: normalizePreview(trimmedClaim),
          statusLabel: "Blocked",
          responseKind: "text",
          responseText: "Input too long. Maximum length is 2000 characters."
        },
        "Local verify blocked."
      ).open();
      return;
    }
    if (!isAllowedLocalEndpoint(LOCAL_VERIFY_ENDPOINT)) {
      new VerifyResultModal(
        this.app,
        {
          endpoint: LOCAL_VERIFY_ENDPOINT,
          trigger,
          claimPreview: normalizePreview(trimmedClaim),
          statusLabel: "Blocked",
          responseKind: "text",
          responseText: "Non-local endpoint blocked."
        },
        "Local verify blocked."
      ).open();
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
      const payload = {
        claim: trimmedClaim,
        source: "obsidian-plugin",
        mode: "verify"
      };
      const response = await fetch(LOCAL_VERIFY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const responseText = await response.text();
      const contentType = (_a = response.headers.get("content-type")) != null ? _a : "";
      const responseKind = contentType.includes("application/json") ? "json" : "text";
      let safeResponseText = responseText.trim();
      if (responseKind === "json") {
        try {
          safeResponseText = stringifySafeJson(JSON.parse(responseText));
        } catch (e) {
          new VerifyResultModal(
            this.app,
            {
              endpoint: LOCAL_VERIFY_ENDPOINT,
              trigger,
              claimPreview: normalizePreview(trimmedClaim),
              statusLabel: `HTTP ${response.status}`,
              responseKind: "text",
              responseText: "Invalid response."
            },
            "Local verify returned invalid JSON."
          ).open();
          return;
        }
      }
      if (!safeResponseText) {
        safeResponseText = "(empty response)";
      }
      const statusLabel = response.ok ? `HTTP ${response.status}` : `HTTP ${response.status} (not ok)`;
      new VerifyResultModal(
        this.app,
        {
          endpoint: LOCAL_VERIFY_ENDPOINT,
          trigger,
          claimPreview: normalizePreview(trimmedClaim),
          statusLabel,
          responseKind,
          responseText: safeResponseText
        },
        response.ok ? "Local verify completed." : "Local server returned an error."
      ).open();
    } catch (error) {
      const isAbortError = error instanceof DOMException && error.name === "AbortError";
      new VerifyResultModal(
        this.app,
        {
          endpoint: LOCAL_VERIFY_ENDPOINT,
          trigger,
          claimPreview: normalizePreview(trimmedClaim),
          statusLabel: isAbortError ? "Timeout" : "Unavailable",
          responseKind: "text",
          responseText: isAbortError ? `Local verify timed out after ${Math.round(VERIFY_TIMEOUT_MS / 1e3)} seconds.` : "Local server unavailable."
        },
        isAbortError ? "Local verify timed out." : "Local server unavailable."
      ).open();
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
};
