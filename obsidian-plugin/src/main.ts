import { App, Modal, Notice, Plugin } from 'obsidian';

type ReceiptScope = 'current_note' | 'selection';

interface TrustReceipt {
  scope: ReceiptScope;
  source: string;
  inputPreview: string;
  mode: 'mock-only';
  verdict: 'mock_review';
  status: 'BLOCKED_TODO';
  notes: string[];
}

const MOCK_NOTES = [
  'Local verify endpoint: BLOCKED/TODO for the next PR.',
  'No network calls.',
  'No external integrations.',
  'No note writes.',
  'No graph or memory writes.',
  'Explicit user command required.',
];

function normalizePreview(text: string, limit = 180): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '(empty)';
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1)}…`;
}

class TrustReceiptModal extends Modal {
  constructor(app: App, private readonly receipt: TrustReceipt) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('huqan-trust-panel-modal');

    contentEl.createEl('h2', { text: 'HUQAN Trust Panel' });
    contentEl.createEl('p', { text: 'Mock receipt - no external calls' });

    const details = contentEl.createEl('div', { cls: 'huqan-trust-panel-modal__details' });
    this.addRow(details, 'Scope', this.receipt.scope);
    this.addRow(details, 'Source', this.receipt.source);
    this.addRow(details, 'Mode', this.receipt.mode);
    this.addRow(details, 'Verdict', this.receipt.verdict);
    this.addRow(details, 'Status', this.receipt.status);
    this.addRow(details, 'Input preview', this.receipt.inputPreview);

    const notes = contentEl.createEl('ul', { cls: 'huqan-trust-panel-modal__notes' });
    for (const note of this.receipt.notes) {
      notes.createEl('li', { text: note });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private addRow(container: HTMLElement, label: string, value: string): void {
    const row = container.createEl('p', { cls: 'huqan-trust-panel-modal__row' });
    row.createEl('strong', { text: `${label}: ` });
    row.createSpan({ text: value });
  }
}

export default class HuqanTrustPanelPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: 'huqan-verify-current-note',
      name: 'Verify current note',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice('Open a note first.');
          return;
        }

        const text = await this.app.vault.read(file);
        this.openReceiptModal('current_note', file.path, text);
      },
    });

    this.addCommand({
      id: 'huqan-verify-selected-text',
      name: 'Verify selected text',
      editorCallback: (editor) => {
        const selectedText = editor.getSelection().trim();
        if (!selectedText) {
          new Notice('Select text first.');
          return;
        }

        this.openReceiptModal('selection', 'selected text', selectedText);
      },
    });
  }

  onunload(): void {
    // Intentionally no writes or cleanup that mutates vault state.
  }

  private openReceiptModal(scope: ReceiptScope, source: string, rawInput: string): void {
    const receipt: TrustReceipt = {
      scope,
      source,
      inputPreview: normalizePreview(rawInput),
      mode: 'mock-only',
      verdict: 'mock_review',
      status: 'BLOCKED_TODO',
      notes: MOCK_NOTES,
    };

    new TrustReceiptModal(this.app, receipt).open();
  }
}
