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
  default: () => HuqanPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  sunucu: "http://127.0.0.1:3000",
  apiKey: "",
  otomatikDogrula: false
};
var PANEL_TIPI = "huqan-sonuc-paneli";
var HuqanPanel = class extends import_obsidian.ItemView {
  getViewType() {
    return PANEL_TIPI;
  }
  getDisplayText() {
    return "HUQAN Sonu\xE7lar\u0131";
  }
  getIcon() {
    return "shield-check";
  }
  yaz(baslik, satirlar) {
    const el = this.containerEl.children[1];
    el.empty();
    el.createEl("h4", { text: baslik });
    if (!satirlar.length) {
      el.createEl("p", { text: "\xC7eli\u015Fki bulunamad\u0131. \u2713" });
      return;
    }
    const ul = el.createEl("ul");
    for (const s of satirlar) {
      const li = ul.createEl("li");
      li.createEl("strong", { text: s.etiket + " " });
      li.createSpan({ text: s.metin });
    }
  }
};
var HuqanPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this._t = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(PANEL_TIPI, (leaf) => new HuqanPanel(leaf));
    this.addCommand({
      id: "notu-dogrula",
      name: "Bu notu HUQAN ile do\u011Frula",
      editorCallback: async (editor) => this.dogrula(editor.getValue())
    });
    this.addCommand({
      id: "secimi-dogrula",
      name: "Se\xE7ili metni do\u011Frula",
      editorCallback: async (editor) => {
        const secim = editor.getSelection();
        if (!secim)
          return new import_obsidian.Notice("\xD6nce metin se\xE7in.");
        this.dogrula(secim);
      }
    });
    this.addCommand({
      id: "notu-ogret",
      name: "Bu notu HUQAN'a \xF6\u011Fret",
      editorCallback: async (editor) => this.ogret(editor.getValue())
    });
    this.addSettingTab(new HuqanAyarSekmesi(this.app, this));
    this.durum = this.addStatusBarItem();
    this.durum.setText("HUQAN: ?");
    this.saglikKontrol();
    if (this.settings.otomatikDogrula) {
      this.registerEvent(this.app.vault.on("modify", (file) => {
        clearTimeout(this._t || void 0);
        this._t = window.setTimeout(async () => {
          const icerik = await this.app.vault.read(file);
          this.dogrula(icerik, true);
        }, 2e3);
      }));
    }
  }
  async saglikKontrol() {
    try {
      await (0, import_obsidian.requestUrl)({ url: this.settings.sunucu + "/health" });
      this.durum.setText("HUQAN: \u2713");
    } catch (e) {
      this.durum.setText("HUQAN: ba\u011Flant\u0131 yok");
    }
  }
  cumleler(metin) {
    return String(metin).replace(/^---[\s\S]*?---/, "").replace(/[#>*`\[\]]/g, " ").split(/[.!?\n]+/).map((c) => c.trim()).filter((c) => c.length > 12 && /[a-zçğıöşü]/i.test(c));
  }
  async dogrula(metin, sessiz = false) {
    const cumleler = this.cumleler(metin).slice(0, 50);
    if (!cumleler.length)
      return new import_obsidian.Notice("Do\u011Frulanacak c\xFCmle bulunamad\u0131.");
    const bulgular = [];
    let hata = 0;
    for (const cumle of cumleler) {
      try {
        const yanit = await (0, import_obsidian.requestUrl)({
          url: this.settings.sunucu + "/verify",
          method: "POST",
          contentType: "application/json",
          headers: this.settings.apiKey ? { "X-API-Key": this.settings.apiKey } : {},
          body: JSON.stringify({ statement: cumle }),
          throw: false
        });
        const r = yanit.json || {};
        const durum = r.verdict || r.status || r.result || "";
        if (/çeliş|contradict|false|reject/i.test(JSON.stringify(r))) {
          bulgular.push({ etiket: "\u26A0 " + durum, metin: cumle });
        }
      } catch (e) {
        hata++;
      }
    }
    if (hata === cumleler.length) {
      return new import_obsidian.Notice("HUQAN sunucusuna ula\u015F\u0131lamad\u0131. `npm run server` \xE7al\u0131\u015F\u0131yor mu?");
    }
    if (!sessiz || bulgular.length) {
      new import_obsidian.Notice(bulgular.length ? `HUQAN: ${bulgular.length} \xE7eli\u015Fki/\u015F\xFCpheli iddia bulundu` : "HUQAN: \xE7eli\u015Fki yok \u2713");
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: PANEL_TIPI, active: true });
    const view = leaf.view;
    if (view instanceof HuqanPanel) {
      view.yaz(`Do\u011Frulama \u2014 ${cumleler.length} c\xFCmle tarand\u0131`, bulgular);
    }
  }
  async ogret(metin) {
    var _a, _b, _c, _d;
    try {
      const yanit = await (0, import_obsidian.requestUrl)({
        url: this.settings.sunucu + "/learn",
        method: "POST",
        contentType: "application/json",
        headers: this.settings.apiKey ? { "X-API-Key": this.settings.apiKey } : {},
        body: JSON.stringify({ text: metin }),
        throw: false
      });
      const r = yanit.json || {};
      const learned = r.learned || ((_a = r.data) == null ? void 0 : _a.learned) || 0;
      const conflicts = ((_b = r.conflicts) == null ? void 0 : _b.length) || ((_d = (_c = r.data) == null ? void 0 : _c.conflicts) == null ? void 0 : _d.length) || 0;
      new import_obsidian.Notice(`HUQAN: ${learned} \xF6nerme \xF6\u011Frenildi, ${conflicts} \xE7eli\u015Fki tespit edildi`);
    } catch (e) {
      new import_obsidian.Notice("HUQAN sunucusuna ula\u015F\u0131lamad\u0131. `npm run server` \xE7al\u0131\u015F\u0131yor mu?");
    }
  }
  onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var HuqanAyarSekmesi = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("HUQAN sunucu adresi").setDesc("Yerel motorun adresi (varsay\u0131lan http://127.0.0.1:3000)").addText((t) => t.setValue(this.plugin.settings.sunucu).onChange(async (v) => {
      this.plugin.settings.sunucu = v.trim().replace(/\/$/, "");
      await this.plugin.saveSettings();
      this.plugin.saglikKontrol();
    }));
    new import_obsidian.Setting(containerEl).setName("API anahtar\u0131").setDesc("Sunucuda API key etkinse buraya girin (X-API-Key)").addText((t) => t.setValue(this.plugin.settings.apiKey).onChange(async (v) => {
      this.plugin.settings.apiKey = v.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Kay\u0131tta otomatik do\u011Frula").setDesc("Not her de\u011Fi\u015Fti\u011Finde (2 sn gecikmeli) arka planda do\u011Frular").addToggle((t) => t.setValue(this.plugin.settings.otomatikDogrula).onChange(async (v) => {
      this.plugin.settings.otomatikDogrula = v;
      await this.plugin.saveSettings();
      new import_obsidian.Notice("De\u011Fi\u015Fiklik, eklenti yeniden y\xFCklenince etkin olur.");
    }));
  }
};
