# V4 — Workbench / Trust Runtime
## HUQAN Agent Control Plane — Detaylı Blueprint

**Versiyon:** v0.10 (hedef)  
**Durum:** BAŞLANMADI  
**Tarih:** 2026-06-12  
**Kanonik soru:** *Can humans and teams operate the trust layer?*

---

## 1. Neden V4?

V1 AXIOM'u causal yaptı.  
V2 action boundary kurdu.  
V3 approval runtime'ı hayata geçirdi.  

**V1–V3 makine içindi. V4 insanlar için.**

Şu an AXIOM/HUQAN çalışıyor ama kör çalışıyor. Kararlar veriliyor, receipt'ler üretiliyor, approval queue doluyor — ama hiçbirini bir insan ekranında göremez, müdahale edemez, anlayamaz.

V4'ün cevapladığı soru şu:  
> *Bir güvenlik ekibi veya mühendis, HUQAN'ın ne yaptığını gerçek zamanlı görebilir mi? Müdahale edebilir mi? Denetleyebilir mi?*

Cevap şu an: **Hayır.**  
V4 sonrası: **Evet.**

---

## 2. Temel Prensipler (V4 boyunca değişmez)

| Prensip | Açıklama |
|---|---|
| **Read-heavy, write-careful** | Dashboard okuma ağırlıklı. Yazma (approve/reject) güvenlik kontrollü |
| **No auto-merge** | Workbench üzerinden hiçbir approval otomatik merge etmez |
| **Local-first** | UI local çalışır. Cloud sync V5'e kalır |
| **Trust Receipt = kaynak** | Ekranda gösterilen her şeyin kaynağı mevcut audit log / receipt |
| **Codex-compatible** | Her bileşen Codex'in okuyup implement edebileceği contract'a sahip |
| **No new runtime behavior** | V4 yeni yargılama mantığı eklemez; V1–V3 altyapısını gösterir |

---

## 3. V4 Bileşenleri (Detaylı)

### 3.1 Approval Workbench

**Ne yapar:**  
Pending approval queue'yu gerçek zamanlı listeler. Yetkili kullanıcı her item için `approve` veya `reject` verebilir.

**Ekran:**
```
┌─────────────────────────────────────────────────────────────┐
│  HUQAN Approval Workbench                      [v0.10.0]    │
├─────────────────────────────────────────────────────────────┤
│  Pending: 3   Approved today: 12   Rejected today: 2        │
├──────────────────────────────────────────────────────────────┤
│  #  │ Tool         │ Risk  │ Reason             │ Age │ Act │
│─────┼──────────────┼───────┼────────────────────┼─────┼─────│
│  1  │ axiom.learn  │  MED  │ mutating_requires  │ 2m  │ [✓][✗]│
│  2  │ file.write   │  HIGH │ destructive_action │ 5m  │ [✓][✗]│
│  3  │ axiom.agent  │  HIGH │ agent_loop_review  │ 8m  │ [✓][✗]│
└─────────────────────────────────────────────────────────────┘
```

**Contract:**
```js
// Input
GET /api/v1/approvals/pending?workspaceId=...&limit=50

// Output
{
  ok: true,
  pending: [
    {
      approvalId: "uuid",
      toolName: "axiom.learn",
      riskLevel: "medium",
      reason: "mutating_requires_review",
      requestedAt: "ISO8601",
      payload: { ... },
      workspaceId: "...",
      requestorId: "..."
    }
  ],
  total: 3
}

// Approve
POST /api/v1/approvals/:approvalId/approve
{ reviewer: "human@team", note: "optional" }

// Reject
POST /api/v1/approvals/:approvalId/reject
{ reviewer: "human@team", reason: "..." }
```

**Trust Receipt entegrasyonu:**  
Her approve/reject, mevcut Trust Receipt sistemine yeni bir `APPROVAL_DECISION` event olarak eklenir.

**PR:** `PR-V4-1`

---

### 3.2 Trust Dashboard

**Ne yapar:**  
HUQAN'ın genel sağlığını ve güven metriklerini gösterir. Gerçek zamanlı.

**Paneller:**

```
┌──────────────────────────────────────────────────────────────┐
│  HUQAN Trust Dashboard              Last refresh: 12s ago    │
├────────────────┬─────────────────────┬────────────────────── │
│  TRUST SCORE   │  ACTION GATE        │  MEMORY INTEGRITY     │
│  ──────────    │  ──────────────     │  ──────────────────   │
│  87/100        │  allow:   142       │  Active:    1,204     │
│  ▲ +2 today    │  review:   18       │  Superseded:   87     │
│                │  block:     4       │  Tombstoned:   12     │
│                │  dry_run:   7       │  Contradicted: 23     │
├────────────────┴─────────────────────┴────────────────────── │
│  RECENT VERDICTS (last 10)                                    │
│  ✔ dogrulandi  "HUQAN is local-first"          2s ago        │
│  ✗ celiski     "No security policy exists"    15s ago        │
│  ? bilinmiyor  "Agent has no history"          1m ago        │
│  🚫 BLOCK      axiom.agent (dry_run_only)      3m ago        │
│  ✔ dogrulandi  "Repo has SECURITY.md"          5m ago        │
└──────────────────────────────────────────────────────────────┘
```

**Veri kaynakları:**
- Audit log (mevcut `lib/audit-log.js`)
- Approval queue count (mevcut V3 schema)
- Memory store stats (mevcut `lib/memory-store.js`)
- Verify verdicts (mevcut `lib/verify.js`)

**API contract:**
```js
GET /api/v1/dashboard/summary?workspaceId=...

// Response
{
  ok: true,
  trustScore: 87,
  trustScoreDelta: +2,
  actionGate: { allow: 142, review: 18, block: 4, dryRun: 7 },
  memory: { active: 1204, superseded: 87, tombstoned: 12, contradicted: 23 },
  recentVerdicts: [ /* last 10 verify results */ ],
  pendingApprovals: 3,
  generatedAt: "ISO8601"
}
```

**Trust Score hesaplama (deterministik):**
```
trustScore = 100
  - (contradictions * 2)
  - (blocks * 1)
  - (pendingApprovals * 0.5)
  + (dogrulandi_ratio * 10)
  Clamp: [0, 100]
```

Bu basit formül V4'te başlangıç. V5'te model bazlı kalibrasyon gelebilir.

**PR:** `PR-V4-2`

---

### 3.3 Trust Receipt Explorer

**Ne yapar:**  
Geçmiş Trust Receipt'lerini listeler, filtreler, detayını gösterir. Her kararın "neden" sorusunu cevaplar.

**Görünüm:**
```
┌──────────────────────────────────────────────────────────────┐
│  Trust Receipt Explorer                                       │
│  Filter: [All] [ALLOW] [BLOCK] [REVIEW] [RECEIPT]           │
│  Search: [________________________]  Date: [last 7 days ▼]  │
├──────────────────────────────────────────────────────────────┤
│  Receipt ID        │ Verdict  │ Tool/Claim     │ Time        │
│────────────────────┼──────────┼────────────────┼─────────────│
│  rcpt-8f2a...      │ ✗ BLOCK  │ file.delete    │ 14:22:01    │
│  rcpt-3c91...      │ ✔ ALLOW  │ axiom.verify   │ 14:21:44    │
│  rcpt-7e0b...      │ ? REVIEW │ axiom.learn    │ 14:20:13    │
│  rcpt-1a4d...      │ ✔ ALLOW  │ axiom.ask      │ 14:18:55    │
└──────────────────────────────────────────────────────────────┘
│  Selected: rcpt-8f2a...                                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Tool: file.delete                                    │    │
│  │ Verdict: BLOCK                                       │    │
│  │ Reason: destructive_action                           │    │
│  │ Risk: HIGH                                           │    │
│  │ Evidence: SECURITY.md exists (provenance: commit#a4) │    │
│  │ Contradiction: "no security policy" ← CELISKI        │    │
│  │ Trace: [ claim_decomp → risk_eval → gate_decision ]  │    │
│  │ Receipt Hash: sha256:8f2a...                         │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**API contract:**
```js
GET /api/v1/receipts?workspaceId=...&verdict=BLOCK&limit=20&offset=0

// Response
{
  ok: true,
  receipts: [
    {
      receiptId: "rcpt-8f2a...",
      verdict: "BLOCK",
      toolName: "file.delete",
      reason: "destructive_action",
      riskLevel: "high",
      evidence: [ ... ],
      contradictions: [ ... ],
      reasoningTrace: [ ... ],
      receiptHash: "sha256:...",
      createdAt: "ISO8601",
      workspaceId: "..."
    }
  ],
  total: 47,
  filtered: 12
}

GET /api/v1/receipts/:receiptId
```

**PR:** `PR-V4-3`

---

### 3.4 Memory / Context Integrity View

**Ne yapar:**  
Mevcut memory store'u gösterir. Supersede zincirlerini, tombstone'ları, contradiction bağlantılarını görselleştirir.

**Görünüm:**
```
┌──────────────────────────────────────────────────────────────┐
│  Memory Integrity View              Workspace: default        │
├──────────────────────────────────────────────────────────────┤
│  Total: 1,204  Active: 1,104  Superseded: 87  Deleted: 13    │
├──────────────────────────────────────────────────────────────┤
│  [Show: Active ▼]  [Sort: newest ▼]  Search: [__________]   │
├──────────────────────────────────────────────────────────────┤
│  mem-8a2f  │ "HUQAN is local-first trust layer"              │
│            │ Status: ACTIVE  │ Created: 2h ago               │
│            │ Provenance: axiom-learn / agent:codex            │
│                                                               │
│  mem-3b91  │ "No security policy exists"                     │
│  ├── CONTRADICTED BY mem-7c02                                 │
│  │         │ Status: ACTIVE  │ Created: 45m ago              │
│  │         │ Risk: HIGH (contradiction detected)             │
│  └─ mem-7c02: "SECURITY.md exists in root"  [EVIDENCE]       │
│                                                               │
│  mem-2d44  │ "Agent loop must be dry_run_only"               │
│  └── SUPERSEDED BY mem-9f11 (updated policy)                 │
└──────────────────────────────────────────────────────────────┘
```

**API contract:**
```js
GET /api/v1/memory?workspaceId=...&status=active&limit=50
GET /api/v1/memory/:memoryId
GET /api/v1/memory/:memoryId/chain  // supersede chain
GET /api/v1/memory/:memoryId/links  // contradiction / supersedes links
```

**Kaynaklar:** Mevcut `lib/memory-store.js` (PR-M2'den) + mevcut conflict detector.

**PR:** `PR-V4-4`

---

### 3.5 Causal Impact Preview

**Ne yapar:**  
Bir action verildiğinde, "Bu aksiyonun olası sonuçları nelerdir?" sorusunu causal graph üzerinde simüle eder. Execute etmeden önce gösterir.

**Akış:**
```
[Input: Proposed Action]
       ↓
[HUQAN Causal Graph Traversal]
       ↓
[Simulated Impact Report]
       ↓
[Human reviews → Approve / Reject / Modify]
```

**Örnek:**
```
Proposed Action: "Delete SECURITY.md"

Causal Impact Preview:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Direct effects:
  ✗ Removes security governance documentation
  ✗ Breaks provenance chain for 3 existing memories
  ✗ Contradicts 2 canonical facts: "repo has security policy"

Downstream cascade:
  ⚠ Agent future verify calls on "security policy" → bilinmiyor
  ⚠ Trust Score estimated drop: -8 points
  ⚠ 4 pending receipts reference SECURITY.md provenance

Verdict: HIGH RISK — BLOCK recommended
Trust Receipt would be: BLOCKED / destructive_action
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Preview Only — No execution occurred]
```

**Contract:**
```js
POST /api/v1/causal/preview
{
  actionType: "file.delete",
  target: "SECURITY.md",
  workspaceId: "...",
  context: { ... }
}

// Response
{
  ok: true,
  preview: {
    directEffects: [ ... ],
    downstreamCascade: [ ... ],
    affectedMemories: ["mem-7c02", "mem-3b91"],
    affectedReceipts: 4,
    estimatedTrustScoreDelta: -8,
    recommendedVerdict: "BLOCK",
    reason: "destructive_action",
    confidence: 0.91
  },
  previewId: "prev-uuid",
  generatedAt: "ISO8601"
}
```

**Önemli not:**  
Bu **sadece preview/simulation**. Gerçek execute etmez. Sonuç garantisi vermez.  
Cümle: *"HUQAN does not only block risky actions. It simulates their likely consequences before they happen."*

**PR:** `PR-V4-5`

---

### 3.6 Local Agent Execution Demo

**Ne yapar:**  
Bir agent'ın HUQAN'dan geçerek nasıl çalıştığını demonstrasyonlu olarak gösterir. Codex gibi bir agent'ın her adımı HUQAN Action Gate'ten geçer, her karar ekranda görünür.

**Demo senaryosu:**
```
[Agent: Codex]
  Step 1: axiom.ask("Does repo have security policy?")
          → HUQAN: ALLOW / responds
          → Verdict: dogrulandi / Evidence: SECURITY.md
  
  Step 2: axiom.verify("no security policy exists")
          → HUQAN: ALLOW / responds
          → Verdict: celiski / Contradicts canonical fact
  
  Step 3: axiom.learn("no security policy exists")  ← Agent yanlış öğretmeye çalışıyor
          → HUQAN: REVIEW / mutating_requires_review
          → Blocked pending human approval
          → Trust Receipt: REVIEW_REQUIRED
  
  Step 4: file.delete("SECURITY.md")  ← Riskli aksiyon
          → HUQAN: BLOCK / destructive_action
          → Trust Receipt: BLOCKED
          → Causal Impact: -8 trust score, 3 memories orphaned

RESULT: Agent stopped. 1 REVIEW pending. 1 BLOCK issued.
Trust Receipt Bundle: [rcpt-001, rcpt-002, rcpt-003, rcpt-004]
```

**Bu demo DEMO1 hikayesini yaşatır:**  
*"Codex writes code. HUQAN judges whether the change is trustworthy enough to execute or merge."*

**PR:** `PR-V4-6` (bağlı: PR-DEMO1-4 + PR-DEMO1-5)

---

### 3.7 Repo Trust Gate Demo

**Ne yapar:**  
HUQAN'ın bir GitHub reposunu nasıl izlediğini ve tehlikeli commit/PR'ları nasıl yakaladığını gösterir.

**Senaryo:**
```
Repo: axiom-test-repo
Event: PR #42 — "Remove security governance"

HUQAN Repo Trust Gate:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scanning PR diff...

Files modified:
  ✗ DELETED: SECURITY.md
  ✗ MODIFIED: .github/CODEOWNERS (security team removed)
  ? MODIFIED: README.md (security references removed)

Trust Gate Analysis:
  Contradictions found: 3
  Risk level: CRITICAL
  Provenance break: SECURITY.md has 8 memory references

Verdict: BLOCK
Reason: security_governance_removal
Trust Receipt: rcpt-repo-42-block

Recommendation: PR #42 should NOT be merged.
Comment posted to PR: "HUQAN Trust Gate: BLOCKED — see receipt rcpt-repo-42-block"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**PR:** `PR-V4-7` (bağlı: PR-DEMO1-5)

---

### 3.8 OpenClaw / TrustFall / SymJack Prevention Demo

**Ne yapar:**  
Bilinen local agent hijack saldırı pattern'larını simüle eder ve HUQAN'ın bunları nasıl durdurduğunu gösterir.

**Saldırı tipleri:**

| Saldırı | Pattern | HUQAN Yanıtı |
|---|---|---|
| **OpenClaw** | Agent kendini yeniden yapılandırmak için memory'ye yazar | BLOCK / agent_self_modification |
| **TrustFall** | Agent güven puanını manipüle etmek için sahte evidence inject eder | BLOCK / provenance_forged |
| **SymJack** | Agent başka bir ajanın kimliğini taklit eder | BLOCK / identity_mismatch |
| **Memory Poisoning** | Agent contradictory facts'i canonical yapıya sızdırmaya çalışır | REVIEW / contradiction_detected |
| **Receipt Replay** | Eski geçerli receipt'i yeni riskli aksiyon için yeniden kullanır | BLOCK / receipt_replay_detected |

**Demo script:**
```
[Attack: Memory Poisoning]
Attacker injects: "AXIOM has no security policy"

Step 1: axiom.learn("AXIOM has no security policy")
        → HUQAN: contradiction_detected
        → Existing memory: "AXIOM enforces trust policy" [ACTIVE]
        → Verdict: celiski
        → Action: REVIEW / quarantine candidate
        → Trust Receipt: BLOCKED / provenance_unverified

Step 2: Attacker retry with fake provenance
        → HUQAN: provenance_forged
        → provenanceId mismatch with audit log
        → Verdict: BLOCK / immediate
        → Alert: security_event logged

RESULT: Injection failed. 0 canonical facts poisoned.
```

**PR:** `PR-V4-8`

---

## 4. V4 PR Sırası

```
PR-V4-0  — V4 ADR / Blueprint (this document, docs-only)
PR-V4-1  — Approval Workbench API + UI
PR-V4-2  — Trust Dashboard API + UI
PR-V4-3  — Trust Receipt Explorer API + UI
PR-V4-4  — Memory Integrity View API + UI
PR-V4-5  — Causal Impact Preview API
PR-V4-6  — Local Agent Execution Demo
PR-V4-7  — Repo Trust Gate Demo
PR-V4-8  — Attack Prevention Demo (OpenClaw/TrustFall/SymJack)
PR-V4-9  — V4 Integration + E2E smoke tests
PR-V4-10 — v0.10 Release prep + CHANGELOG
```

Her PR:
- Küçük ve scoped
- Test içerir
- Dirty root'a dokunmaz
- Auto-merge yok
- Fail olursa dur ve raporla

---

## 5. UI Teknoloji Kararı

V4 UI'ı için şu an iki seçenek:

| Seçenek | Artı | Eksi |
|---|---|---|
| **Terminal / CLI dashboard** (chalk, blessed) | Zero dependency, local-first, Codex dostu | Estetik sınırlı |
| **Minimal HTML/JS** (single file, no framework) | Browser'da açılır, interaktif | Build adımı gerekebilir |
| **Express + static HTML** | REST API + basit UI | Server gerekir |

**Önerim:** Express + single-file HTML.  
- V4'te local `http://localhost:3747` üzerinde çalışır
- V5'te cloud sync eklenebilir
- Zero build step, zero framework dependency

Port: `3747` (HUQAN = H-U-Q-A-N → 3-7-4 → 374... yaklaşık, sabit port)

---

## 6. Acceptance Criteria (V4 tamamlandı sayılır)

- [ ] Pending approval queue UI'da görünür ve approve/reject çalışır
- [ ] Trust Dashboard gerçek audit log verisini gösterir
- [ ] Trust Receipt Explorer geçmiş kararları listeler ve detayı gösterir
- [ ] Memory Integrity View mevcut memory store'u gösterir
- [ ] Causal Impact Preview en az 1 riskli aksiyonu simüle eder
- [ ] Local Agent Execution Demo DEMO1 hikayesini çalıştırır
- [ ] Repo Trust Gate Demo en az 1 senaryoyu gösterir
- [ ] Attack Prevention Demo en az 3 saldırı tipini gösterir
- [ ] `npm test` yeşil (tüm PR'larda)
- [ ] Dirty root'a dokunulmadı
- [ ] Runtime artifact (memory.db, log) commit edilmedi

---

## 7. V4 Sonrası Durum

V4 tamamlandığında:

```
V1: AXIOM causal ✅
V2: AXIOM action-safe ✅  
V3: AXIOM approval-runtime ✅
V4: HUQAN human-operable ✅
V5: HUQAN ecosystem-ready ← NEXT
```

Kanonik cümle güncellenir:  
*"V4 made HUQAN human-operable. Agents act. HUQAN judges. Humans oversee."*

---

## 8. V4 Dışında Kalanlar (Out of Scope)

- Cloud sync veya remote dashboard (→ V5)
- Multi-tenant kullanıcı yönetimi (→ V5)
- Mobile UI (→ V5+)
- AI-powered summary/clustering (→ plugin, V5)
- Production SLA / uptime guarantee (→ V5+)
- Automated test result dashboard (→ ayrı tool, opsiyonel)
- A2A Trust Exchange (→ V5)
- HTP/ACS adapter (→ V5)

---

## 9. Kanonik Konumlandırma (V4 Pitch'i için)

**Kötü:**
> "HUQAN has a dashboard."

**İyi:**
> "For the first time, your team can see every AI agent decision, every memory mutation, every trust receipt — in real time, before anything executes."

**Investor cümlesi:**  
> "Every governance framework in AI today is post-hoc. HUQAN's V4 Workbench makes trust pre-execution and visible. Humans stay in the loop without slowing down agents."

---

*Bu doküman PR-V4-0 olarak `docs/v4-workbench-blueprint.md` konumuna alınacak.*  
*Runtime dokunulmaz. Drift dokunulmaz. Docs-only PR.*
