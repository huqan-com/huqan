import { App, Plugin, PluginSettingTab, Setting, Notice, ItemView, requestUrl } from 'obsidian';

interface HuqanPluginSettings {
  sunucu: string;
  apiKey: string;
  otomatikDogrula: boolean;
}

const DEFAULT_SETTINGS: HuqanPluginSettings = {
  sunucu: 'http://127.0.0.1:3000',
  apiKey: '',
  otomatikDogrula: false,
};

const PANEL_TIPI = 'huqan-sonuc-paneli';

class HuqanPanel extends ItemView {
  getViewType() { return PANEL_TIPI; }
  getDisplayText() { return 'HUQAN Sonuçları'; }
  getIcon() { return 'shield-check'; }

  yaz(baslik: string, satirlar: Array<{ etiket: string; metin: string }>) {
    const el = this.containerEl.children[1];
    el.empty();
    el.createEl('h4', { text: baslik });
    if (!satirlar.length) {
      el.createEl('p', { text: 'Çelişki bulunamadı. ✓' });
      return;
    }
    const ul = el.createEl('ul');
    for (const s of satirlar) {
      const li = ul.createEl('li');
      li.createEl('strong', { text: s.etiket + ' ' });
      li.createSpan({ text: s.metin });
    }
  }
}

export default class HuqanPlugin extends Plugin {
  settings: HuqanPluginSettings;
  durum: HTMLElement;
  _t: number | null = null;

  async onload() {
    await this.loadSettings();

    // Panel kaydı
    this.registerView(PANEL_TIPI, leaf => new HuqanPanel(leaf));

    // Komutlar
    this.addCommand({
      id: 'notu-dogrula',
      name: 'Bu notu HUQAN ile doğrula',
      editorCallback: async editor => this.dogrula(editor.getValue()),
    });

    this.addCommand({
      id: 'secimi-dogrula',
      name: 'Seçili metni doğrula',
      editorCallback: async editor => {
        const secim = editor.getSelection();
        if (!secim) return new Notice('Önce metin seçin.');
        this.dogrula(secim);
      },
    });

    this.addCommand({
      id: 'notu-ogret',
      name: 'Bu notu HUQAN\'a öğret',
      editorCallback: async editor => this.ogret(editor.getValue()),
    });

    this.addSettingTab(new HuqanAyarSekmesi(this.app, this));

    // Durum çubuğu
    this.durum = this.addStatusBarItem();
    this.durum.setText('HUQAN: ?');
    this.saglikKontrol();

    // Otomatik doğrulama
    if (this.settings.otomatikDogrula) {
      this.registerEvent(this.app.vault.on('modify', file => {
        clearTimeout(this._t || undefined);
        this._t = window.setTimeout(async () => {
          const icerik = await this.app.vault.read(file);
          this.dogrula(icerik, true);
        }, 2000);
      }));
    }
  }

  async saglikKontrol() {
    try {
      await requestUrl({ url: this.settings.sunucu + '/health' });
      this.durum.setText('HUQAN: ✓');
    } catch {
      this.durum.setText('HUQAN: bağlantı yok');
    }
  }

  cumleler(metin: string): string[] {
    return String(metin)
      .replace(/^---[\s\S]*?---/, '') // frontmatter'ı at
      .replace(/[#>*`\[\]]/g, ' ')
      .split(/[.!?\n]+/)
      .map(c => c.trim())
      .filter(c => c.length > 12 && /[a-zçğıöşü]/i.test(c));
  }

  async dogrula(metin: string, sessiz = false) {
    const cumleler = this.cumleler(metin).slice(0, 50);
    if (!cumleler.length) return new Notice('Doğrulanacak cümle bulunamadı.');

    const bulgular: Array<{ etiket: string; metin: string }> = [];
    let hata = 0;
    for (const cumle of cumleler) {
      try {
        const yanit = await requestUrl({
          url: this.settings.sunucu + '/verify',
          method: 'POST',
          contentType: 'application/json',
          headers: this.settings.apiKey ? { 'X-API-Key': this.settings.apiKey } : {},
          body: JSON.stringify({ statement: cumle }),
          throw: false,
        });
        const r = yanit.json || {};
        const durum = r.verdict || r.status || r.result || '';
        if (/çeliş|contradict|false|reject/i.test(JSON.stringify(r))) {
          bulgular.push({ etiket: '⚠ ' + durum, metin: cumle });
        }
      } catch {
        hata++;
      }
    }

    if (hata === cumleler.length) {
      return new Notice('HUQAN sunucusuna ulaşılamadı. `npm run server` çalışıyor mu?');
    }
    if (!sessiz || bulgular.length) {
      new Notice(bulgular.length
        ? `HUQAN: ${bulgular.length} çelişki/şüpheli iddia bulundu`
        : 'HUQAN: çelişki yok ✓');
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: PANEL_TIPI, active: true });
    const view = leaf.view;
    if (view instanceof HuqanPanel) {
      view.yaz(`Doğrulama — ${cumleler.length} cümle tarandı`, bulgular);
    }
  }

  async ogret(metin: string) {
    try {
      const yanit = await requestUrl({
        url: this.settings.sunucu + '/learn',
        method: 'POST',
        contentType: 'application/json',
        headers: this.settings.apiKey ? { 'X-API-Key': this.settings.apiKey } : {},
        body: JSON.stringify({ text: metin }),
        throw: false,
      });
      const r = yanit.json || {};
      const learned = r.learned || r.data?.learned || 0;
      const conflicts = r.conflicts?.length || r.data?.conflicts?.length || 0;
      new Notice(`HUQAN: ${learned} önerme öğrenildi, ${conflicts} çelişki tespit edildi`);
    } catch (e) {
      new Notice('HUQAN sunucusuna ulaşılamadı. `npm run server` çalışıyor mu?');
    }
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class HuqanAyarSekmesi extends PluginSettingTab {
  plugin: HuqanPlugin;

  constructor(app: App, plugin: HuqanPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    new Setting(containerEl)
      .setName('HUQAN sunucu adresi')
      .setDesc('Yerel motorun adresi (varsayılan http://127.0.0.1:3000)')
      .addText(t => t.setValue(this.plugin.settings.sunucu).onChange(async v => {
        this.plugin.settings.sunucu = v.trim().replace(/\/$/, '');
        await this.plugin.saveSettings();
        this.plugin.saglikKontrol();
      }));

    new Setting(containerEl)
      .setName('API anahtarı')
      .setDesc('Sunucuda API key etkinse buraya girin (X-API-Key)')
      .addText(t => t.setValue(this.plugin.settings.apiKey).onChange(async v => {
        this.plugin.settings.apiKey = v.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName('Kayıtta otomatik doğrula')
      .setDesc('Not her değiştiğinde (2 sn gecikmeli) arka planda doğrular')
      .addToggle(t => t.setValue(this.plugin.settings.otomatikDogrula).onChange(async v => {
        this.plugin.settings.otomatikDogrula = v;
        await this.plugin.saveSettings();
        new Notice('Değişiklik, eklenti yeniden yüklenince etkin olur.');
      }));
  }
}
