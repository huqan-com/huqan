import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';

type ReceiptScope = 'current_note' | 'selection';

interface MockReceipt {
  title: string;
  label: string;
  status: string;
  scope: ReceiptScope;
  checks: {
    unsupported_claims: boolean;
    contradictions: boolean;
    risky_action_language: boolean;
    provenance_missing: boolean;
  };
  note: string;
  preview: string;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function takePreview(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '(empty)';
  }
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function buildMockReceipt(scope: ReceiptScope, sourceText: string): MockReceipt {
  const normalized = normalizeText(sourceText);
  const lowered = normalized.toLowerCase();

  const riskyActionLanguage = /\b(delete|drop|wipe|remove|publish|merge|deploy|send|pay)\b/.test(lowered);
  const contradictionHints = /\b(but|however|yet|although|not)\b/.test(lowered);
  const provenanceMissing = !(/\b(source|provenance|receipt|citation|ref)\b/.test(lowered));
  const unsupportedClaims = normalized.length > 0 && !(normalized.includes('supported') || normalized.includes('verified'));

  return {
    title: 'HUQAN Trust Panel',
    label: 'Mock receipt - no external calls',
    status: 'mock_review',
    scope,
    checks: {
      unsupported_claims: unsupportedClaims,
      contradictions: contradictionHints,
      risky_action_language: riskyActionLanguage,
      provenance_missing: provenanceMissing,
    },
    note: 'Local AXIOM verification is not connected yet.',
    preview: takePreview(sourceText),
  };
}

class MockReceiptModal extends Modal {
  private readonly receipt: MockReceipt;

  constructor(app: App, receipt: MockReceipt) {
    super(app);
    this.receipt = receipt;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('huqan-trust-panel-modal');

    const shell = contentEl.createDiv({ cls: 'huqan-trust-panel' });
    const header = shell.createDiv({ cls: 'huqan-trust-panel__header' });
    header.createEl('div', { cls: 'huqan-trust-panel__eyebrow', text: this.receipt.label });
    header.createEl('h2', { text: this.receipt.title });
    header.createEl('div', { cls: 'huqan-trust-panel__status', text: this.receipt.status });

    const summary = shell.createDiv({ cls: 'huqan-trust-panel__summary' });
    summary.createEl('div', { text: `Scope: ${this.receipt.scope}` });
    summary.createEl('div', { text: `Preview: ${this.receipt.preview}` });

    const checks = shell.createDiv({ cls: 'huqan-trust-panel__checks' });
    checks.createEl('h3', { text: 'Checks' });

    const list = checks.createEl('ul');
    Object.entries(this.receipt.checks).forEach(([key, value]) => {
      const item = list.createEl('li');
      item.createSpan({ cls: 'huqan-trust-panel__check-key', text: key });
      item.createSpan({ cls: value ? 'huqan-trust-panel__check-value is-flagged' : 'huqan-trust-panel__check-value', text: value ? 'flagged' : 'clear' });
    });

    shell.createDiv({ cls: 'huqan-trust-panel__note', text: this.receipt.note });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export default class HuqanTrustPanelPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'huqan-verify-current-note',
      name: 'HUQAN: Verify current note',
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
          new Notice('Open a markdown note first');
          return;
        }

        const receipt = buildMockReceipt('current_note', view.editor.getValue());
        new MockReceiptModal(this.app, receipt).open();
      },
    });

    this.addCommand({
      id: 'huqan-verify-selected-text',
      name: 'HUQAN: Verify selected text',
      editorCallback: (editor: Editor) => {
        const selection = editor.getSelection();
        if (!selection.trim()) {
          new Notice('Select text first');
          return;
        }

        const receipt = buildMockReceipt('selection', selection);
        new MockReceiptModal(this.app, receipt).open();
      },
    });
  }
}
