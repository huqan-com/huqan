# V5 — Ecosystem / Shared Trust Layer
## HUQAN Agent Control Plane — Detaylı Blueprint

**Versiyon:** v1.0 (hedef)  
**Durum:** BAŞLANMADI  
**Tarih:** 2026-06-12  
**Kanonik soru:** *Can multiple agents/systems share trust?*

---

## 1. Neden V5?

V1 AXIOM'u causal yaptı.  
V2 aksiyonları sınırladı.  
V3 approval runtime kurdu.  
V4 insanların görmesini sağladı.  

**Ama hepsi tek bir ortamda, tek bir kernel ile çalıştı.**

V5'in cevapladığı soru:  
> *İki farklı sistem, iki farklı agent, iki farklı organizasyon — birbirinin güven kararına nasıl güvenir? Ortak bir "güven dili" olabilir mi?*

Şu an: Her HUQAN instance izole çalışır.  
V5 sonrası: Farklı HUQAN node'ları birbirinin Trust Receipt'ini **doğrulayabilir** ve **kabul edebilir**.

Bu bir protokoldür. Bir ekosistemdir. Bir standarttır.

---

## 2. Temel Prensipler (V5 boyunca değişmez)

| Prensip | Açıklama |
|---|---|
| **Trust is not transferred — it is re-verified** | Başka node'dan gelen receipt, kör kabul edilmez; lokal doğrulanır |
| **Local-first hâlâ geçerli** | Remote trust exchange, local kernel'ı bypass edemez |
| **HTP = wire format, ATP = local contract** | ATP (AXIOM Trust Protocol) lokal; HTP (HUQAN Trust Protocol) inter-node |
| **Conformance önce, ecosystem sonra** | Badge / marketplace, conformance suite olmadan açılmaz |
| **No central authority** | HUQAN merkezi bir trust authority kurmaz; peer verification |
| **Open protocol, closed kernel** | HTP spesifikasyonu open; AXIOM kernel implementasyon detayı |

---

## 3. V5 Bileşenleri (Detaylı)

### 3.1 A2A Trust Exchange

**Ne yapar:**  
Agent-to-Agent (A2A) senaryosunda bir agent'ın ürettiği Trust Receipt'i başka bir agent veya sistem kabul edebilir hale getirir.

**Problem:**  
```
Agent A (Codex) → HUQAN-A → Trust Receipt (rcpt-001)
Agent B (başka sistem) bu receipt'e güvenmeli mi?
```

**Çözüm:**  
```
Agent A → HUQAN-A → Trust Receipt (rcpt-001, signed)
                              ↓
                    HUQAN-B alır → lokal re-verify eder
                              ↓
                    ACCEPT (rcpt-001 trusted) veya
                    REJECT (re-verify failed) veya
                    PARTIAL (trusted with caveats)
```

**A2A Exchange Protocol:**

```
POST /api/v1/trust/exchange
{
  fromNode: "huqan-node-a",
  toNode: "huqan-node-b",
  receipt: {
    receiptId: "rcpt-001",
    verdict: "ALLOW",
    claim: "...",
    evidence: [...],
    signature: "sha256:...",
    issuedAt: "ISO8601",
    issuerNode: "huqan-node-a"
  },
  requestType: "verify_and_accept"
}

// Response
{
  ok: true,
  exchangeId: "exch-uuid",
  localVerdict: "ACCEPT",
  trustLevel: "high",
  caveats: [],
  localReceiptId: "rcpt-local-002",
  crossNodeProvenance: {
    originalReceiptId: "rcpt-001",
    originalNode: "huqan-node-a",
    acceptedAt: "ISO8601",
    localVerification: "passed"
  }
}
```

**Trust Downgrade kuralı:**  
Remote'dan gelen receipt her zaman lokal'dan bir adım düşük başlar.  
`ALLOW (remote)` → lokal'da `REVIEW` olarak işlenir, insan veya lokal verify geçince `ALLOW`'a yükselir.

**PR:** `PR-V5-1`

---

### 3.2 HTP — HUQAN Trust Protocol

**Ne yapar:**  
HUQAN node'ları arasında Trust Receipt paylaşımı için standart wire format ve protocol tanımlar.

**HTP v0.1 Spec:**

```
Protocol: HTP/0.1
Transport: HTTPS (lokal-first), gRPC (ileride)
Format: JSON (v0.1), MessagePack (v1.0 ileride)
Auth: Ed25519 node key pair (her node kendi key'ini üretir)
```

**HTP Message Types:**

```
RECEIPT_OFFER    — "Bu receipt'i kabul eder misin?"
RECEIPT_ACCEPT   — "Kabul ettim, lokal ID şu"
RECEIPT_REJECT   — "Reddettim, sebep şu"
VERIFY_REQUEST   — "Bu claim'i senin knowledgenden doğrular mısın?"
VERIFY_RESPONSE  — "dogrulandi / celiski / bilinmiyor"
NODE_HANDSHAKE   — "Ben kimim, capability'lerim neler"
NODE_PING        — "Hâlâ aktif misin?"
```

**HTP Mesaj Yapısı:**

```json
{
  "htp": "0.1",
  "messageId": "uuid",
  "type": "RECEIPT_OFFER",
  "from": {
    "nodeId": "huqan-node-a",
    "publicKey": "ed25519:...",
    "version": "0.10.0"
  },
  "to": {
    "nodeId": "huqan-node-b"
  },
  "payload": {
    "receiptId": "rcpt-001",
    "verdict": "ALLOW",
    "claim": "SECURITY.md exists in repository",
    "evidence": [
      {
        "type": "file_exists",
        "ref": "SECURITY.md",
        "hash": "sha256:...",
        "provenanceId": "prov-uuid"
      }
    ],
    "riskLevel": "low",
    "issuedAt": "2026-06-12T21:00:00Z",
    "expiresAt": "2026-06-13T21:00:00Z"
  },
  "signature": "ed25519:...",
  "timestamp": "2026-06-12T21:00:01Z"
}
```

**Receipt Expiry:**  
Her receipt HTP üzerinden gönderildiğinde TTL taşır.  
Varsayılan: 24 saat. Configurable.

**PR:** `PR-V5-2`

---

### 3.3 ACS-style Checkpoint Adapter

**Ne yapar:**  
Microsoft Azure Container Apps' ACS (Agent Checkpoint System) benzeri checkpoint semantiğini HUQAN üzerine adapter olarak kurar.

**Neden önemli:**  
Microsoft ACS = kategori doğrulaması / büyük oyuncu tehdidi. Eğer HUQAN ACS uyumlu davranabilirse, enterprise sistemlerle entegrasyon kolaylaşır.

**ACS Uyumluluk Seviyeleri:**

```
Level 0 — HUQAN kendi native Trust Receipt üretir
Level 1 — HUQAN ACS-style checkpoint response üretebilir
Level 2 — HUQAN ACS event'lerini consume edebilir
Level 3 — Tam çift yönlü ACS bridge (V5+ veya RFC)
```

V5 hedefi: **Level 1 + Level 2**

**ACS Checkpoint Adapter Contract:**

```js
// ACS-style checkpoint request gelir
POST /api/v1/acs/checkpoint
{
  checkpointId: "acs-uuid",
  agentId: "codex-agent-01",
  action: {
    type: "memory_write",
    payload: { content: "..." }
  },
  context: { ... }
}

// HUQAN lokal gate'i çalıştırır
// ACS-style response döner
{
  checkpointId: "acs-uuid",
  status: "approved" | "rejected" | "review_required",
  huqanVerdict: "ALLOW" | "BLOCK" | "REVIEW",
  trustReceipt: { ... },
  acs: {
    continuationToken: "...",
    expiresAt: "ISO8601"
  }
}
```

**PR:** `PR-V5-3`

---

### 3.4 Conformance Suite Expansion

**Ne yapar:**  
V4'e kadar biriken tüm davranış kurallarını (ATP, HTP, ACS adapter) test eden genişletilmiş conformance test suite'i.

**Mevcut conformance (V1–V3):**
- ATP v0.1 conformance (mevcut `lib/atp-conformance.js`)
- MCP matrix (V3.1 certified)

**V5 eklemeleri:**

```
HTP Conformance:
  ✓ RECEIPT_OFFER / ACCEPT / REJECT akışı
  ✓ Node signature doğrulama
  ✓ TTL / expiry enforcement
  ✓ Trust downgrade kuralı (remote → lokal seviye düşürme)
  ✓ Replay attack direnci
  ✓ Malformed message rejection

A2A Conformance:
  ✓ Cross-node verify akışı
  ✓ Circular trust rejection (A → B → A döngüsü bloklama)
  ✓ Partial trust acceptance

ACS Adapter Conformance:
  ✓ Level 1: ACS-style response format
  ✓ Level 2: ACS event consumption
  ✓ Error mapping (HUQAN → ACS error codes)

Ecosystem Conformance:
  ✓ Node handshake protocol
  ✓ Capability negotiation
  ✓ Backward compatibility (HTP/0.1 → HTP/0.2 ileride)
```

**Badge sistemine bağlı:**  
Bir node tüm conformance testleri geçmeden badge alamaz.

**PR:** `PR-V5-4`

---

### 3.5 Certified Node / Trust Badge

**Ne yapar:**  
HUQAN conformance suite'ini geçen sistemlere verilebilecek "HUQAN Certified Node" statüsü ve badge mekanizması.

**Sertifikasyon seviyeleri:**

```
🟢 HUQAN Certified — Core
   Gereklilik: V1+V2+V3 conformance geçti
   Anlam: Local trust judgment, action gate, approval runtime

🔵 HUQAN Certified — Workbench
   Gereklilik: Core + V4 UI conformance
   Anlam: Human-operable trust layer

🟣 HUQAN Certified — Ecosystem Node
   Gereklilik: Workbench + HTP v0.1 + ACS Level 1
   Anlam: A2A trust exchange yapabilir

⭐ HUQAN Verified Implementer
   Gereklilik: Ecosystem Node + Conformance suite %100
   Anlam: Ekosisteme güvenli node olarak katılabilir
```

**Badge nasıl üretilir:**

```js
// Conformance suite tamamlandıktan sonra
POST /api/v1/certification/issue
{
  nodeId: "huqan-node-xyz",
  conformanceReportId: "conf-uuid",
  level: "ecosystem_node"
}

// Response
{
  ok: true,
  badge: {
    badgeId: "badge-uuid",
    nodeId: "huqan-node-xyz",
    level: "ecosystem_node",
    issuedAt: "ISO8601",
    expiresAt: "2027-06-12T...",
    signature: "ed25519:...",
    verifyUrl: "https://huqan.io/verify/badge-uuid"
  }
}
```

**Önemli not:**  
Badge merkezi bir authority tarafından değil, **kendi conformance suite sonucu** üretilir.  
`verifyUrl` sadece public key ve imzayı doğrular. Herhangi biri bağımsız doğrulayabilir.

**PR:** `PR-V5-5`

---

### 3.6 TrustBench

**Ne yapar:**  
Farklı HUQAN implementasyonlarını (veya rakip sistemleri) ortak senaryolar üzerinde karşılaştıran benchmark + test ortamı.

**TrustBench senaryoları:**

```
Scenario 1 — Contradiction Speed
  Input: 1000 contradictory claim pairs
  Measure: Time to detect, % detected, false positives

Scenario 2 — Provenance Chain Depth
  Input: 50-level provenance chain
  Measure: Traversal correctness, latency

Scenario 3 — Action Gate Throughput
  Input: 10,000 action requests/minute
  Measure: Correct verdicts/min, error rate

Scenario 4 — Memory Mutation Safety
  Input: 500 concurrent memory writes, 50 contradictory
  Measure: Immutability violations, tombstone correctness

Scenario 5 — Receipt Replay Resistance
  Input: 100 replayed old receipts
  Measure: % correctly rejected

Scenario 6 — Cross-Node Trust Latency
  Input: A2A exchange with 3-hop chain
  Measure: End-to-end verify latency, accuracy
```

**TrustBench output:**

```
TrustBench v0.1 — HUQAN v0.10.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scenario 1 — Contradiction Speed
  Detected: 978/1000 (97.8%)
  False Positives: 3
  Avg latency: 12ms

Scenario 2 — Provenance Chain Depth
  Traversal correct: 50/50
  Max latency: 34ms

Scenario 3 — Action Gate Throughput
  Correct verdicts: 9,987/10,000 (99.87%)
  Error rate: 0.13%

Overall TrustBench Score: 94.2 / 100
Badge eligibility: ✅ ELIGIBLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**PR:** `PR-V5-6`

---

### 3.7 GitHub App — Streaming Trust

**Ne yapar:**  
GitHub repository'lerine kurulabilen, her PR/commit'i gerçek zamanlı HUQAN'dan geçiren uygulama.

**Akış:**

```
GitHub Event (PR opened / push)
       ↓
HUQAN GitHub App webhook alır
       ↓
Diff analizi → Action Gate
       ↓
Trust Receipt üretilir
       ↓
PR'a comment / status check eklenir:

  HUQAN Trust Gate: ✅ PASSED
  ─────────────────────────────
  Files checked: 12
  Contradictions: 0
  Risk: LOW
  Receipt: rcpt-gh-pr42-pass
  
  veya:
  
  HUQAN Trust Gate: 🚫 BLOCKED
  ─────────────────────────────
  Files checked: 8
  Contradictions: 3 (SECURITY.md removed)
  Risk: CRITICAL
  Receipt: rcpt-gh-pr42-block
  Details: [View Trust Receipt]
```

**GitHub App contract:**

```js
// Webhook handler
POST /webhooks/github
{
  event: "pull_request",
  action: "opened",
  repository: { ... },
  pull_request: {
    number: 42,
    diff_url: "...",
    files: [ ... ]
  }
}

// HUQAN işler, GitHub API'ye yazar
POST /repos/:owner/:repo/check-runs
{
  name: "HUQAN Trust Gate",
  status: "completed",
  conclusion: "success" | "failure",
  output: {
    title: "Trust Receipt: PASSED / BLOCKED",
    summary: "...",
    text: "Full trust report..."
  }
}
```

**PR:** `PR-V5-7`

---

### 3.8 Streaming Trust (Real-time Event Feed)

**Ne yapar:**  
HUQAN kararlarını gerçek zamanlı dışarıya stream eder. Başka sistemler (SIEM, Slack, PagerDuty, vb.) bu stream'i dinleyebilir.

**Event format:**

```json
{
  "stream": "huqan-trust-events/v1",
  "eventId": "evt-uuid",
  "type": "VERDICT_ISSUED",
  "timestamp": "2026-06-12T21:00:00Z",
  "nodeId": "huqan-node-a",
  "workspaceId": "default",
  "payload": {
    "verdict": "BLOCK",
    "toolName": "file.delete",
    "reason": "destructive_action",
    "riskLevel": "high",
    "receiptId": "rcpt-001",
    "affectedMemories": ["mem-7c02"],
    "trustScoreDelta": -8
  }
}
```

**Transport seçenekleri (V5):**

| Kanal | Durum |
|---|---|
| Server-Sent Events (SSE) | V5 default |
| WebSocket | V5 |
| Webhook (POST) | V5 |
| Kafka topic | V5+ (enterprise) |
| NATS | V5+ (high-throughput) |

**PR:** `PR-V5-8`

---

### 3.9 External Ecosystem / Marketplace

**Ne yapar:**  
Üçüncü taraf HUQAN uyumlu plugin'lerin, adapter'ların ve certified node'ların listelendiği merkezi olmayan direktori.

**Yapı:**

```
HUQAN Ecosystem Registry (open, self-hosted)
├── plugins/
│   ├── huqan-slack-alert/         # Slack'e trust event gönder
│   ├── huqan-jira-gate/           # Jira issue'ya trust receipt ekle
│   ├── huqan-sonarqube-adapter/   # SonarQube bulguları HUQAN'a besle
│   └── huqan-datadog-stream/      # Datadog'a trust metrik aktar
├── adapters/
│   ├── acs-adapter/               # Microsoft ACS uyumluluk
│   ├── langchain-gate/            # LangChain agent gate
│   └── crewai-trust-layer/        # CrewAI multi-agent trust
└── certified-nodes/
    ├── node-example-001/          # Badge + conformance raporu
    └── node-example-002/
```

**Registry format (her plugin için `manifest.json`):**

```json
{
  "name": "huqan-slack-alert",
  "version": "1.0.0",
  "author": "community",
  "description": "Stream HUQAN trust events to Slack",
  "huqanCompatibility": ">=0.10.0",
  "conformanceLevel": "core",
  "tags": ["notification", "slack", "streaming"],
  "installUrl": "https://...",
  "badgeVerifyUrl": "https://..."
}
```

**PR:** `PR-V5-9`

---

## 4. HTP RFC Taslağı

V5 ile birlikte HTP bir RFC olarak yayınlanır.

```
RFC-HUQAN-0001: HUQAN Trust Protocol (HTP) v0.1

Status: DRAFT
Date: 2026-06-12
Authors: HUQAN Project

Abstract:
  This document defines the HUQAN Trust Protocol (HTP), a
  lightweight protocol for exchanging Trust Receipts between
  independent HUQAN-compatible nodes. HTP enables agent-to-agent
  (A2A) trust verification without requiring a central authority.

1. Introduction
2. Terminology
3. Node Identity and Key Management
4. Message Format (JSON/0.1)
5. Message Types
   5.1 RECEIPT_OFFER
   5.2 RECEIPT_ACCEPT / RECEIPT_REJECT
   5.3 VERIFY_REQUEST / VERIFY_RESPONSE
   5.4 NODE_HANDSHAKE / NODE_PING
6. Trust Level Mapping
7. Downgrade Rules
8. Replay Attack Prevention
9. TTL and Expiry
10. Error Codes
11. Conformance Requirements
12. Security Considerations
13. IANA Considerations (none for v0.1)
14. References
```

**PR:** `PR-V5-RFC-0`

---

## 5. V5 PR Sırası

```
PR-V5-0      — V5 ADR / Blueprint (this document, docs-only)
PR-V5-RFC-0  — HTP RFC v0.1 draft
PR-V5-1      — A2A Trust Exchange API
PR-V5-2      — HTP wire format + node key management
PR-V5-3      — ACS-style Checkpoint Adapter (Level 1 + 2)
PR-V5-4      — Conformance Suite Expansion (HTP + ACS + A2A)
PR-V5-5      — Certified Node / Trust Badge
PR-V5-6      — TrustBench
PR-V5-7      — GitHub App / Streaming Trust (SSE + Webhook)
PR-V5-8      — Streaming Trust (WebSocket)
PR-V5-9      — Ecosystem Registry format
PR-V5-10     — v1.0 Release prep + CHANGELOG
```

---

## 6. Güvenlik Modeli

V5 yeni saldırı yüzeyleri açar. Bunlar önceden tanımlanmalı:

| Tehdit | Açıklama | HUQAN Yanıtı |
|---|---|---|
| **Sybil Attack** | Sahte node'lar güven ağını dolduruyor | Konformans zorunlu; imzasız node reddedilir |
| **Receipt Replay** | Eski geçerli receipt yeni riskli aksiyon için kullanılıyor | TTL + nonce; replay cache |
| **Circular Trust** | A→B→A döngüsüyle trust amplification | Max hop: 3; döngü dedektör |
| **Downgrade Attack** | Yüksek trust seviyesini manipüle etme | Remote receipt her zaman lokal'dan 1 seviye düşük başlar |
| **Eclipse Attack** | Bir node sadece kötü node'larla konuşmaya zorlanıyor | Trust diversity check; minimum 2 bağımsız kaynak |
| **Receipt Forgery** | Ed25519 imzası taklit girişimi | Signature verification mandatory |

---

## 7. Acceptance Criteria (V5 tamamlandı sayılır)

- [ ] İki farklı HUQAN node A2A Trust Exchange yapabiliyor
- [ ] HTP v0.1 tam implement, conformance geçiyor
- [ ] ACS Adapter Level 1 + Level 2 çalışıyor
- [ ] Conformance suite tüm yeni sceneryoları kapsıyor
- [ ] Certified Node badge üretilebilir ve doğrulanabilir
- [ ] TrustBench 6 scenario çalışıyor, score üretiyor
- [ ] GitHub App en az 1 repo'da PR check çalışıyor
- [ ] SSE stream en az 1 harici tüketime açılıyor
- [ ] Circular trust dedektörü çalışıyor
- [ ] Receipt replay reddediliyor
- [ ] `npm test` yeşil
- [ ] Dirty root'a dokunulmadı
- [ ] Runtime artifact commit edilmedi

---

## 8. V5 Konumlandırma

**Kötü:**
> "HUQAN now works with other tools."

**İyi:**
> "Any AI agent, any framework, any cloud — if it speaks HTP, HUQAN can judge it. The trust layer is now a protocol, not a product."

**Investor cümlesi:**
> "The governance war in AI won't be won by one system. It will be won by the system that becomes the standard. HTP is HUQAN's play for that standard — open protocol, local kernel, ecosystem lock-in without platform lock-in."

**Regülasyon argümanı:**
> "EU AI Act, NIST AI RMF, SOC 2 — they all ask: can you prove what your agent did and why? V5 makes that proof portable, cross-system, and auditable by anyone with a public key."

---

## 9. Pazar Hizalaması

| Rakip/Trend | HUQAN V5 Yanıtı |
|---|---|
| Microsoft ACS | ACS Level 1+2 adapter; uyumlu ama bağımlı değil |
| OpenAI Agents | HTP adapter yazılabilir; HUQAN agnostic |
| LangChain | `huqan-langchain-gate` plugin; PR-V5-9 |
| Rippletide | Onlar decision/authorization; biz evidence/receipt; HTP'de çakışmaz |
| Regülasyon (EU AI Act) | Trust Receipt = audit evidence; V5 cross-org taşıyor |
| Web3 / DID | Ed25519 node key = decentralized identity uyumlu |

---

## 10. V1–V5 Final Kanon

```
V1: AXIOM causal yaptı
    "Is this claim safe to believe?"

V2: AXIOM action-safe yaptı
    "Is this action safe to perform?"

V3: AXIOM approval-runtime kurdu
    "What happens when an action requires review?"

V4: HUQAN human-operable yaptı
    "Can humans and teams operate the trust layer?"

V5: HUQAN ecosystem-ready yaptı
    "Can multiple agents/systems share trust?"
```

**Final kanonik cümle:**
> *Models generate. Agents act. Memory stores. HUQAN judges.*  
> *And with V5 — the judgment travels.*

---

## 11. V5 Dışında Kalanlar (Out of Scope)

- Merkezi trust authority (asla)
- Blockchain entegrasyonu (araştırılabilir, scope dışı)
- Mobile SDK (isteğe bağlı ekosistem plugin'i olabilir)
- Ücretli marketplace (açık ekosistem kalır)
- ML tabanlı trust scoring (plugin olabilir, kernel değil)
- Real-time collaboration (V5+)

---

*Bu doküman PR-V5-0 olarak `docs/v5-ecosystem-blueprint.md` konumuna alınacak.*  
*Runtime dokunulmaz. Drift dokunulmaz. Docs-only PR.*
