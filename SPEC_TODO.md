# SPEC Todo List - AXIOM v0.3 Personal Thought Judge

Durum anahtari:
- [x] tamamlandi
- [ ] eksik veya kismi

## Requirement 1 - Kernel Capability System
- [x] Kernel default capability seti var (`graph`, `llm`, `contradictionDetection`, `temporal`, `pluginCapabilities`, `evidenceRanking`, `agentApi`, `companyMode`, `discoveryLoop`)
- [x] `hasCapability(name)` boolean donuyor
- [ ] `enableCapability(name)` bilinmeyen capability icin Error firlatmali
- [ ] `enableCapability(name)` `capability:enabled` eventi yayinlamali
- [ ] `kernel.capabilities` dogrudan yazimi desteklenmemeli (yalnizca `enableCapability`)

## Requirement 2 - Evidence Ranker
- [x] `evidence-ranker.js` var (`WEIGHTS`, `rankEvidence`, `adjustedConfidence`)
- [x] Bilinmeyen evidence type icin fallback 0.25
- [x] `adjustedConfidence(base,type)` var ve 0..1 clamp uyguluyor
- [ ] Kernel `_rankEvidence()` helper'i kullanmali
- [ ] `evidenceRanking` aktifken edge'e `evidenceType` ve `adjustedConfidence` yazilmali

## Requirement 3 - Temporal Metadata v1
- [ ] Node `created_at` / `last_seen` ISO 8601 string olmalı
- [ ] Node guncellemesinde sadece `last_seen` degismeli
- [ ] Edge `created_at`, `updated_at`, `source_ref`, `session_id`, `confidence_history` alanlari olmali (ISO 8601)
- [ ] Confidence degisince eski deger `confidence_history`'ye eklenmeli
- [ ] `temporal` capability acikken `learn()` bu metadata'yi doldurmali
- [ ] Mevcut `KernelV2` temporal davranisi ile uyum korunmali

## Requirement 4 - Plugin Contract v1
- [x] Plugin formatinda `requires`, `optional`, `capabilities`, `run()` destekleniyor
- [x] `requires` eksikse plugin yukleme engelleniyor
- [ ] `optional` eksikse warning log + yuklemeye devam davranisi net uygulanmali
- [x] Plugin capability listeleme var (`listCapabilities`, `getCapability`, `runCapability`)
- [ ] `kernel.runCapability()` uzerinden ve `pluginCapabilities` gate'i ile calismali
- [ ] `pluginCapabilities` kapaliyken capability cagrisi Error vermeli

## Requirement 5 - Idea MRI Plugin
- [x] `plugins/idea-mri.js` var
- [ ] Cikti anahtari `missingEvidence` olmali (`evidenceGaps` degil)
- [ ] Her bolumde `source: graph|llm|parsed` etiketi olmali
- [ ] Graph/LLM/yok fallback davranislari spec ile birebir olmali
- [x] `requires=[]`, `optional=["llm","graph","evidenceRanking"]` benzeri calisiyor

## Requirement 6 - Devil Advocate Plugin
- [x] `plugins/devil-advocate.js` var
- [x] Graph path / LLM fallback / no-data soru listesi davranisi var
- [x] `source` ayrimi var (`graph`, `llm`, `questions` modu)
- [ ] `evidenceRanking` acikken argumanlara `evidenceType` + `adjustedConfidence` eklenmeli
- [x] `requires=["graph"]`, `optional=["llm","evidenceRanking"]`

## Requirement 7 - Contradiction Alert Plugin
- [ ] `plugins/contradiction-alert.js` yok
- [ ] `requires=["graph","temporal"]`, `optional=["llm","evidenceRanking"]` uygulanmadi
- [ ] Cikti: `newThought`, `conflictingThoughts`, `conflictType`, `evidenceQuality` uygulanmadi
- [ ] Temporal aktifse `created_at` fark analizi uygulanmadi
- [ ] Catisma yoksa bos dizi + `conflictType: null` uygulanmadi

## Requirement 8 - Graph Reliability Regresyon
- [x] `hasAnyEdge(nodeA,nodeB)` var
- [x] `getEdgesBetween(nodeA,nodeB)` var
- [ ] Dream duplicate hypothesis engelleme testi eksik
- [x] `getEdgesBetween(A,B)` ile yon ayrimi testi var
- [ ] Tum testler + yeni testler ile v0.3 tam regresyon henuz gecilmedi

## Design / Tasks Bolumu (SPEC icindeki gorev listesi)
### P0 Graph Reliability
- [ ] Duplicate hypothesis test genisletmesi
- [ ] Reverse edge / relation-specific regresyonlarin tamamlama teyidi

### P0.5 Capability System
- [ ] `enableCapability` unknown capability Error
- [ ] `capability:enabled` event
- [ ] capability testleri (ayri dosya)

### P2.5 Evidence Ranker
- [x] `evidence-ranker.js`
- [x] `evidence-ranker.test.js`
- [ ] kernel entegrasyonu

### P1B Temporal
- [ ] ISO 8601 gecisi
- [ ] node/edge temporal alan davranisi
- [ ] temporal test dosyasi

### P2 Plugin Contract
- [ ] optional dependency warning davranisi
- [ ] `kernel.runCapability` + gate
- [ ] plugin-contract testleri

### P1A Product Plugins
- [ ] idea-mri output schema/spec hizasi
- [ ] devil-advocate evidence ranking hizasi
- [ ] contradiction-alert plugin + test

### P3 Full Regression
- [ ] tum testler (yeni + mevcut) tek seferde yesil
- [ ] README/package version/changelog hizasi (spec kapsaminda kalanlar)
