# AXIOM v0.9.1 Genel Review Raporu

**Tarih:** 4 Haziran 2026
**Hazırlayan:** Codex / AGENTS.md §10
**Branch:** `docs/canonical-general-review-report`
**Base:** `origin/main`
**HEAD (kanonik referans):** `05d9c43`
**Yöntem:** Read-only review + canonical report cleanup, kod değişikliği yok

---

## 1. Özet

| Metrik | Değer |
|--------|-------|
| Kritik bulgu | 0 |
| Yüksek bulgu | 3 |
| Orta bulgu | 6 |
| Düşük bulgu | 5 |
| Health check | PASS (yeşil) |
| Test sayısı | 691 toplam, 675 PASS, 0 FAIL, 16 SKIPPED |

**Karar seviyesi net:**
- Bu rapor **dokümandır**, kod değişikliği içermez.
- Tüm aksiyon önerileri ayrı PR'lara ayrılır.
- Fix PR'ları için `önce onay al, sonra branch aç` akışı uygulanır (AGENTS.md §2-§4).

---

## 2. Repo Durumu (Kanonik Referans)

- **origin/main HEAD:** `05d9c43` — "Merge branch 'chore/add-agent-rules'"
- **AGENTS.md** (219 satır): main'de, bağlayıcı kural dosyası
- **GEMINI.md** (13 satır): main'de, AGENTS.md'ye yönlendirir
- **Aktif branch (review için):** `docs/canonical-general-review-report` (main'den türetildi)
- **Untracked dosyalar (12):** rapor kapsamında değerlendirildi, bu PR'da dokunulmuyor

**Untracked envanteri (sadece rapor):**
| Dosya | Durum | Bu PR |
|-------|-------|-------|
| `PROJECT_BRIEF.md` | untracked, stale test sayısı (497) | DOKUNMA |
| `PROJECT_BRIEF_STRATEGIC_PATHS.md` | untracked, strateji belgesi | DOKUNMA |
| `docs/PR_TRUST_RECEIPT_TEMPLATE.md` | untracked, auto-pr template | DOKUNMA |
| `SANDBOX_TEST_REPORT.md` | untracked | DOKUNMA |
| `self-learning-test-report.md` | untracked | DOKUNMA |
| `ANTIGRAVITY_RULES.md` | untracked | DOKUNMA |
| `AXIOM Teknik Analiz Raporu.md` | untracked, eski v0.7 | DOKUNMA |
| `AXIOM-v0.8-Review-Bug-Raporu.md` | untracked, arşiv | DOKUNMA |
| `AXIOM-v0.8-Master-Bug-Raporu.md` | untracked, arşiv | DOKUNMA |
| `AXIOM-v0.8-Blocker-Triage.md` | untracked, arşiv | DOKUNMA |
| `AXIOM-v0.9.1-General-Review-Raporu.md` (root) | untracked, ham versiyon | DOKUNMA |
| `tmp.json` | untracked, başka agent artifact | DOKUNMA |

---

## 3. Health Check (05d9c43 Sonrası)

| Kontrol | Sonuç |
|---------|-------|
| `npm ci` | PASS |
| `npm test` (full suite) | PASS (691/675/0/16) |
| Targeted Memory Core tests | PASS |
| `/health` smoke | PASS |
| `/v2-status` smoke | PASS |
| `/graph-data` smoke | PASS |

**Test sayısı notu (AGENTS.md §7):**
- Workspace koşumu: 691 test, 675 PASS, 0 FAIL, 16 SKIPPED (87 suite, ~13.5s)
- Clean clone veya review koşumlarında test discovery sayıları farklılık gösterebilir.
- Kanonik referans: bu PR'da kullanılan `npm test` çıktısıdır.
- 16 SKIPPED bilinçli capability gate'lerdir (temporal, companyMode, evidenceRanking); bug değildir.

---

## 4. Bulgular (Karar Seviyesi Net)

### 4.1 Kritik
- **YOK**

### 4.2 Yüksek (3)

| ID | Dosya | Bulgu |
|----|-------|-------|
| **GUV-1** | `requestGuards.js:56-57` | API key ayarlanmamışsa tüm endpoint'ler bypass (`if (!apiKey) return { ok: true }`). Production'da yanlışlıkla unsecure deployment riski. Fail-closed olmalı. |
| **TUT-1..6** | `docs/CONCURRENCY_MODEL.md` | Belgede `kernel._acquireLock`, `_lockAcquired`, `_lockQueue`, `beginReadTransaction`, `_findPathWithTimeout`, `nodeStorageKey(id, workspaceId)` API'leri anlatılıyor — `lib/memory-store.js`'de hiçbiri yok. Belge yanıltıcı/stale. |
| **TUT-7** | `docs/CONCURRENCY_MODEL.md` | `concurrent-race.test.js` RC-001..RC-006 anlatılıyor — dosya mevcut değil. Belge gerçeklikle tutarsız. |

### 4.3 Orta (6)

| ID | Dosya | Bulgu |
|----|-------|-------|
| **MEM-1** | `lib/memory-store.js` | 1501 satır monolitik dosya (tüm PR-M2..M7 birikmiş). Refactor önerilir. |
| **MEM-2** | `lib/memory-store.js:_findMemory` | `workspaceId` undefined ise tüm workspace'leri tarar (perf cost + internal helper risk). Public API wid zorunlu olmalı. |
| **MEM-3** | `lib/memory-store.js:382, 535, 622+` | Redundant try/catch blokları, throw err aynı hatayı fırlatır (bilgi kaybı). |
| **MEM-4** | `lib/memory-store.js:_initDB` | SQLite WAL mode yok; yazarken okuma bloke olabilir. |
| **SHD-1** | `lib/shield.js:80` | LLM cevabı 300 char'a kırpılıyor (`slice(0, 300)`). Graph context kaybı, çok kısa. |
| **SHD-2** | `lib/shield.js:100-108` | Otomatik öğrenme hatası silent (try/catch yok, learnResult null kalabilir). |

### 4.4 Düşük (5)

| ID | Dosya | Bulgu |
|----|-------|-------|
| **GUV-2** | `requestGuards.js:checkRateLimit` | Map sınırsız büyüyebilir (memory leak, uzun vadede). |
| **ING-1** | `lib/ingest.js:hashText` | SHA-1 (16 char slice). Idempotency için yeterli ama collision risk. |
| **ING-2** | `lib/ingest.js:normalizeSourceType` | Türkçe mapping (`'manuel'→'manual'`, `'karar'→'decision'`) eksik dokümante. |
| **DOC-1** | `PROJECT_BRIEF.md` | "497 tests" yazıyor, gerçek 691 (stale). %92 coverage da doğrulanmalı. |
| **DOC-2** | `docs/PR_TRUST_RECEIPT_TEMPLATE.md` | Template `auto-pr.js`'i referans ediyor; `auto-pr.js` varlığı doğrulanmadı. |

---

## 5. Önerilen Karar Tablosu (Onay Bekliyor)

| # | Aksiyon | Öncelik | Onay Durumu | Önerilen Branch |
|---|---------|---------|-------------|-----------------|
| 1 | GUV-1 fix (API key misconfig → 500) | Yüksek | **Onay bekliyor** | `v0.9.1/pr-fix-guv1-api-key-misconfig` |
| 2 | CONCURRENCY_MODEL.md temizliği (sil veya DEPRECATED) | Yüksek | **Onay bekliyor** | `docs/pr-doc0-stale-docs-cleanup` |
| 3 | PROJECT_BRIEF.md test sayısı güncelle (497→691) | Düşük | **Onay bekliyor** | aynı PR-2'de birleştirilebilir |
| 4 | untracked docs toplu temizlik (12 dosya envanteri) | Düşük | **Onay bekliyor** | aynı PR-2'de birleştirilebilir |
| 5 | SHD-1 (300→1000 char), SHD-2 (try/catch) | Orta | **Onay bekliyor** | `v0.9.1/pr-s1-shield-hardening` |
| 6 | MEM-2 (wid zorunlu), MEM-3 (try/catch cleanup) | Orta | **Onay bekliyor** | aynı PR-5'te birleştirilebilir |
| 7 | MEM-1 refactor (memory-store 4-5 dosyaya böl) | Orta | **Onay bekliyor** | `v0.9.1/pr-s2-memory-store-refactor` |
| 8 | MEM-4 (SQLite WAL mode) | Orta | **Onay bekliyor** | aynı PR-7'de birleştirilebilir |
| 9 | v0.9.0 Semantic Trust Gate full review | Yüksek | **Onay bekliyor** | review-only, branch gerekmez |
| 10 | Self-Healer readiness/design | — | **AGENTS.md §9** gereği yasak (onay gerekli) | — |

**Notlar:**
- "Onay bekliyor" = henüz kullanıcı onayı alınmadı.
- Her aksiyon için **ayrı PR** (AGENTS.md §8 scope discipline).
- "öneri" statüsünde; gerçek onay verilmiş gibi yorumlanmamalı.
- Bu PR hiçbir fix uygulamaz, sadece dokümandır.

---

## 6. Önerilen Sonraki Adımlar (Sıra)

### 6.1 PR-DOC0 — Stale/Untracked Docs Cleanup
- **Kapsam:** Untracked dosya envanteri temizlik (12 dosya).
- **Aksiyonlar:**
  - `docs/CONCURRENCY_MODEL.md` → sil veya `DEPRECATED` notu ekle (karar verilmeli)
  - `PROJECT_BRIEF.md` → "497 tests" → "691 tests" güncelle, coverage doğrula
  - Eski review raporları (`AXIOM-v0.8-*.md`, `AXIOM Teknik Analiz Raporu.md`) → arşiv klasörüne taşı veya sil
  - `tmp.json` → sil veya gözden geçir
- **Branch:** `docs/pr-doc0-stale-docs-cleanup`
- **Onay:** **Onay bekliyor**

### 6.2 PR-S0 — GUV-1 API Key Bypass Fix
- **Kapsam:** `requestGuards.js:55-70`, `requestGuards.test.js` (yeni test ekle).
- **Aksiyon:** `if (!apiKey) return { ok: false, status: 500, error: { error: 'Server misconfigured: AXIOM_API_KEY not set' } }`.
- **Etki:** Production'da `AXIOM_API_KEY` env unutulursa endpoint'ler 401 yerine 500 döner (fail-closed).
- **Branch:** `v0.9.1/pr-fix-guv1-api-key-misconfig`
- **Onay:** **Onay bekliyor**

### 6.3 PR-S1 — Shield + Memory Small Hardening
- **Kapsam:** SHD-1, SHD-2, MEM-2, MEM-3, GUV-2.
- **Branch:** `v0.9.1/pr-s1-shield-memory-hardening`
- **Onay:** **Onay bekliyor**

### 6.4 Self-Healer Readiness/Design
- **Kapsam:** Tasarım ve değerlendirme (implementasyon değil).
- **Kısıt:** AGENTS.md §9 "do not start without explicit approval".
- **Onay:** **Onay bekliyor (AGENTS.md §9 zorunlu)**

---

## 7. Kapsam Dışı (Intentionally Not Touched)

Bu PR **yalnızca** `docs/AXIOM-v0.9.1-General-Review-Raporu.md` dosyasını oluşturur.

Aşağıdaki dosyalar **kesinlikle dokunulmaz** (AGENTS.md §8 scope discipline + kullanıcı talimatı):

- Kod: `requestGuards.js`, `server.js`, `public/index.html`, `graph.js`, `kernel.js`, `lib/*`
- Yapılandırma: `package.json`, `package-lock.json`
- Kurallar: `AGENTS.md`, `GEMINI.md`
- Proje belgeleri: `PROJECT_BRIEF.md`
- Mevcut docs: `docs/CONCURRENCY_MODEL.md`, `docs/PR_TRUST_RECEIPT_TEMPLATE.md`
- Tüm untracked dosyalar (12)

---

## 8. Notlar ve Kısıtlar

- Bu rapor `origin/main@05d9c43` durumunu kanonik referans alır.
- `head` (yeni branch HEAD) ve `base` (main HEAD) bu raporda ayrı tutulur.
- Test discovery farkları workspace/clean clone/review koşumları arasında olağandır; kanonik referans en son `npm test` çıktısıdır.
- 16 SKIPPED bilinçlidir (capability gate'ler); bug raporu değildir.
- Bu rapor Türkçe yazılmıştır; kod/branch/commit/test adları İngilizce bırakılmıştır (AGENTS.md §1).
- "Öneri" ve "Onay bekliyor" ibareleri gerçek onay anlamına gelmez; her aksiyon için ayrı kullanıcı onayı gerekir.

---

## 9. Karar Tablosu (Kullanıcı Onayları — Bu Oturum)

| Karar | Seçim | Bu PR'da Uygulandı mı |
|-------|-------|----------------------|
| Master rapor formatı | Yeni dosya: `docs/AXIOM-v0.9.1-General-Review-Raporu.md` | EVET (kanonikleştirildi) |
| GUV-1 fix | Vazgeç, rapor yeterli | HAYIR (PR-S0 önerisi olarak kayıtlı) |
| CONCURRENCY_MODEL.md sil | Sil (onaylı, root review'da) | HAYIR (bu PR'da; ayrı PR-DOC0 önerisi) |
| Kod dosyaları | Dokunulmaz | EVET (dokunulmadı) |
| Untracked dosyalar | Dokunulmaz | EVET (dokunulmadı) |

**Not:** Bu PR, daha önceki root review oturumunda alınmış kararları yansıtır; bu PR kapsamında yeni fix uygulanmaz.

---

## 10. Sonuç

- **Rapor kanonikleştirildi:** bu PR sadece `docs/AXIOM-v0.9.1-General-Review-Raporu.md` dosyasını ekler.
- **Kod değişikliği yok.**
- **Untracked dosyalara dokunulmadı.**
- **Tüm fix önerileri ayrı PR'lara ayrıldı (PR-S0, PR-DOC0, PR-S1, vb.).**
- **Self-Healer AGENTS.md §9 gereği yasak; explicit onay gerekir.**
- **Net hüküm:** Önce rapor kanonikleştirildi, sonra sırayla fix PR'ları.
