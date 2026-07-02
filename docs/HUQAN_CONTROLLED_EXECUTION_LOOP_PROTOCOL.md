# HUQAN Controlled Execution Loop Protocol

```txt
Version:
v0.4

Status:
CANONICAL_PROTOCOL

Primary use:
HUQAN repo üzerinde çalışan ajanlar
(Claude, Codex, OpenCode, Antigravity, ChatGPT ve tüm implementation/review ajanları)

Secondary future use:
Ayrı spec olarak HUQAN Agent Control Plane'e ilham verir,
ama bu dosyanın parçası değildir. (Bkz. Ek B)
```

Bu dosya repo'daki kanonik ajan çalışma protokolüdür. `AGENTS.md` bu protokolün
tamamlayıcısıdır (dil, rapor formatı, süreç detayları); çelişki durumunda bu
protokol geçerlidir ve çelişki ayrıca insana raporlanır.

---

## 0. Loop Separation Rule

Bu protokol **development loop** protokolüdür. HUQAN ürününün runtime verdict
sistemi ayrı bir spec'tir ve sözlükleri karışmaz:

```txt
Repo loop verdicts:
READY_FOR_REVIEW / BLOCKED / REQUEST_CHANGES / ...

Product runtime verdicts:
ALLOW / DENY / HOLD / ...
```

```txt
READY_FOR_REVIEW ≠ ALLOW
```

Bir dogfood `ALLOW` sonucu, loop verdict'ini otomatik `READY_FOR_REVIEW`
yapmaz; loop verdict'i her zaman bu protokolün kendi kurallarıyla belirlenir.

## 1. Core Doctrine

```txt
HUQAN work is not closed by intention.
HUQAN work is closed only by evidence.
```

Ajan "bitti" dediği için iş bitmez. İş ancak repo-backed evidence, test, diff,
commit, review ve temiz state ile biter.

## 2. Canonical Loop Shape

Generic loop:

```txt
observe → decide → act → verify
```

HUQAN loop:

```txt
observe
→ plan
→ scope-check
→ act
→ verify
→ judge
→ persist evidence
→ exit
```

## 3. Canonical Source Rule

Ajan roadmap'i, PR sırasını veya task kapsamını kafadan belirleyemez.

Canonical sources:

```txt
docs/**
explicit task spec
GitHub PR
GitHub issue
approved checkpoint
test output
git state
```

`agent.memory.json` canonical source değildir.

### 3a. Canonical = Pushed Rule

Origin'e push edilmemiş branch, commit veya evidence **yok hükmündedir**.

```txt
Work that exists only in an agent's local clone or ephemeral container
does not exist.
```

- Plan/checkpoint dokümanları origin'de var olan commit SHA'larına referans verir.
- Bir ajan işini bitirdiğinde push edilmemiş iş "done" sayılamaz.
- Geçici (cloud/container) ortamlarda çalışan ajanlar için push, loop'un
  zorunlu adımıdır; konteyner kapanınca push edilmemiş her şey kaybolur.

## 4. Base Verification Rule

Her loop başlamadan önce base branch / commit doğrulanır. Eksik veya yanlışsa:

```txt
VERDICT: BLOCKED
Reason: WRONG_BASE
```

## 5. Dirty Root Rule

Dirty root varsa ajan çalışmaz.

```bash
git status --short
```

Beklenmeyen değişiklik varsa:

```txt
VERDICT: BLOCKED
Reason: DIRTY_ROOT
```

## 6. Branch Ownership Rule

Her görev ayrı clean branch / worktree ister.

Yanlış:

```txt
Herkes aynı klasörde çalışsın.
```

Doğru:

```txt
Herkes aynı canonical base'den ayrı clean worktree açsın.
Sonuç PR ile birleşsin.
```

## 7. Task Scope Rule

Her task dar olmalı. Task şu alanları içermeli:

```txt
Goal
Base
Target branch
Allowed files
Forbidden files
Acceptance criteria
Tests
Stop conditions
Final report
```

## 8. Negative Scope Rule

Her task ne yapılmayacağını açıkça söylemeli. Örnek:

```txt
Do not touch package files.
Do not touch mcpServer.js.
Do not touch server.js.
Do not touch UI/viewer.
Do not use git add .
```

Negative scope boş olamaz.

## 9. Verification Profile Rule

Her loop verification profile tanımlamak zorunda. Eksikse:

```txt
VERDICT: BLOCKED
Reason: MISSING_VERIFICATION_PROFILE
```

Profile formatı:

```txt
Runtime:
[Node.js / Python / Go / Rust / Docs-only / Mixed]

Test command:
[...]

Lint command:
[...]

Typecheck command:
[...]

Build command:
[...]

Dependency lockfile:
[...]

Required verification level:
[docs-only / targeted-test / full-test / full-test-plus-build]
```

## 10. HUQAN Default Node.js Profile

```txt
Runtime:
Node.js

Test command:
npm test

Lint command:
NONE unless task requires it

Typecheck command:
NONE unless task requires it

Build command:
NONE unless task requires it

Dependency lockfile:
package-lock.json

Required verification level:
full-test
```

## 11. Docs-only Profile

```txt
Runtime:
Docs-only

Test command:
NONE

Lint command:
NONE unless docs lint exists

Typecheck command:
NONE

Build command:
NONE

Dependency lockfile:
NONE

Required verification level:
docs-only
```

Docs-only PR'da test koşulmaması kabul edilebilir, ama scope dışı dosya
değişemez.

## 12. Dependency and Lockfile Rule

Protected dependency / lock / manifest files:

```txt
package-lock.json
yarn.lock
pnpm-lock.yaml
poetry.lock
uv.lock
requirements.txt
Cargo.lock
go.sum
Gemfile.lock
```

Beklenmeyen değişiklik varsa:

```txt
VERDICT: BLOCKED
Reason: UNEXPECTED_DEPENDENCY_CHANGE
```

## 13. Package Change Rule

Package / dependency değişimi ancak açık task kapsamındaysa yapılır.

Allowed reasons:

```txt
adding dependency
removing dependency
upgrading dependency
security fix
approved lockfile regeneration
```

## 14. Agent Memory Access Policy

`agent.memory.json` protected runtime state'tir.

Default:

```txt
Read: DISALLOWED
Write: DISALLOWED
Stage: DISALLOWED
Commit: DISALLOWED
Delete: DISALLOWED
Use as roadmap source: DISALLOWED
```

## 15. Runtime Artifact Rule

Stage / commit yasak:

```txt
agent.memory.json
memory.json
memory.db
logs
temp files
screenshots
output folders
.playwright-cli
coverage artifacts
```

## 16. Loop Persistence Rule

Loop evidence runtime memory'ye yazılmaz.

Preferred evidence path:

```txt
.loop/evidence/<TASK_ID>/report.md
.loop/evidence/<TASK_ID>/commands.log
.loop/evidence/<TASK_ID>/diff-stat.txt
.loop/evidence/<TASK_ID>/test-output.txt
.loop/evidence/<TASK_ID>/huqan-verdict.json
```

Bu dosyalar sadece task açıkça istiyorsa commitlenir.

## 17. Scope Diff Rule

Commit öncesi:

```bash
git diff --name-only
git diff --stat
git status --short
```

Diff allowed files ile uyuşmuyorsa:

```txt
VERDICT: BLOCKED
Reason: SCOPE_DRIFT
```

## 18. No Broad Stage Rule

Yasak:

```bash
git add .
git add -A
```

Allowed:

```bash
git add path/to/explicit-file
```

## 19. No Broad Refactor Rule

Refactor ayrı PR'dır. Feature PR içinde refactor yasak.

Refactor PR şartları:

```txt
no behavior change
public API unchanged
tests before/after same
small mechanical split
```

Bkz. `docs`teki Big File Refactor Gate.

## 20. Act Rule

Ajan sadece izinli işi yapar. Yasak:

```txt
unrelated cleanup
opportunistic fix
roadmap change
V4/V5 drift
UI change
package change
secret handling change
auto-merge
```

## 21. Retry / Repair Limit Rule

Varsayılan:

```txt
max repair attempts: 3
max major steps: 20
max wall-clock: 45 minutes
```

Limit aşılırsa:

```txt
VERDICT: BLOCKED
Reason: RETRY_LIMIT
```

### 21a. Rollback Rule (BLOCKED sonrası temizlik)

`BLOCKED` verdict'i üretilen her durumda ajan önce evidence report üretir.

Rollback sırası:

1. Evidence report yazılır.
2. `git diff --name-only`, `git diff --stat`, `git status --short` çıktısı
   evidence'a eklenir.
3. Sonra commit edilmemiş task değişiklikleri discard edilir.
4. Runtime artifact / temp dosyalar temizlenir.
5. `.loop/evidence/<TASK_ID>/` korunur.
6. Rollback sadece ajanın kendi isolated worktree'sinde yapılır.
7. Base branch veya başka ajan worktree'sine dokunulmaz.

Önerilen güvenli komutlar:

```bash
git restore --worktree --staged .
git clean -fd -- ':!.loop/evidence'
```

Eğer shell bu exclude syntax'ı desteklemiyorsa, ajan destructive clean
yapmadan önce durur ve raporlar:

```txt
VERDICT: BLOCKED
Reason: ROLLBACK_REQUIRES_HUMAN_CONFIRMATION
```

## 22. Test Failure Rule

Test fail ise sonuç `READY_FOR_REVIEW` olamaz.

```txt
HUQAN_DOGFOOD ALLOW bile failed tests üstünü örtemez.
```

## 23. Judge Mode Rule

Her task judge mode tanımlar. Modes:

```txt
SELF_CHECK
PEER_AGENT_REVIEW
HUQAN_DOGFOOD
HUMAN_REVIEW
```

### 23a. Risk → Judge Mode Mapping Rule

Judge mode keyfi seçilemez; task'ın risk seviyesine bağlıdır:

```txt
Risk: Trivial (docs-only, no-op)      → minimum SELF_CHECK (+ merge için HUMAN_REVIEW)
Risk: Low (küçük scoped kod)          → minimum SELF_CHECK + HUQAN_DOGFOOD
Risk: Medium (runtime davranış)       → minimum PEER_AGENT_REVIEW + HUQAN_DOGFOOD
Risk: High (security / gate / release) → PEER_AGENT_REVIEW + HUQAN_DOGFOOD + HUMAN_REVIEW
```

Task spec'i risk seviyesini belirtmek zorundadır. Belirsizse ajan bir üst
risk seviyesini varsayar.

## 24. Self Check Rule

SELF_CHECK şunlar için yeterli olabilir:

```txt
docs-only draft
no-op verification
local report
```

Ama merge için yetmez.

## 25. Peer Agent Review Rule

Code PR, security PR, audit PR veya önemli runtime değişiminde ikinci ajan
review yapar.

Peer agent:

```txt
diff okur
test output okur
scope kontrol eder
claim doğruluğunu kontrol eder
```

Aynı işi rewrite etmez.

### 25a. Peer Review Timeout Rule

Peer review zamanında gelmezse süreç sessizce `SELF_CHECK`e düşmez.

```txt
Peer review timeout →
VERDICT: BLOCKED
Reason: PEER_REVIEW_TIMEOUT
```

İnsan, review'ı bekletmeye veya judge mode'u açıkça düşürmeye karar verir;
ajan bu kararı kendi veremez.

## 26. HUQAN Dogfood Rule

HUQAN dogfood evidence report claim'lerini kontrol eder.

Örnek checked claims:

```txt
tests_passed
test_command
changed_paths
auto_merge_false
protected_state_untouched
secret_check_passed
dependency_change_false
```

Verdict:

```txt
ALLOW
REVIEW
BLOCK
```

Kural:

```txt
ALLOW = review-ready
ALLOW ≠ merge
```

## 27. Human Review Rule

Şunlar için insan onayı zorunlu:

```txt
merge
release tag
production deployment
branch deletion
roadmap change
security policy change
public positioning change
funding / investor-facing final material
```

## 28. Evidence Report Rule

Her loop finalinde evidence report gerekir. Format:

```txt
VERDICT:
READY_FOR_REVIEW / BLOCKED / REQUEST_CHANGES

Project:
HUQAN

Task:
[...]

Branch:
[...]

Base:
[...]

Commit:
[...]

Changed files:
[...]

Tests run:
[...]

Test result:
[...]

Dependency changes:
[...]

Memory policy result:
[...]

Forbidden files:
[...]

Secret check:
[...]

Git status:
[...]

Judge mode:
[...]

Auto-merge:
false

Known gaps:
[...]

Next:
[...]
```

## 29. PR-FINISH MODE

Varsayılan çalışma modu:

```txt
1. clean worktree aç
2. base doğrula
3. branch aç
4. değişikliği uygula
5. targeted test çalıştır
6. required verification çalıştır
7. diff scope kontrol et
8. forbidden file kontrol et
9. dependency diff kontrol et
10. secret/runtime artifact kontrol et
11. commit at
12. push yap
13. PR aç / update et
14. merge için rapor ver
15. blocker varsa dur
```

Merge default kapalıdır.

## 30. Final Verdict Rule

Allowed final verdicts:

```txt
READY_FOR_REVIEW
BLOCKED
REQUEST_CHANGES
APPROVED_FOR_MERGE
MERGED_BASELINE_GREEN
DOCS_ONLY_READY
NO_OP_VERIFIED
DROP_DIFF
NEEDS_CANONICALIZATION
```

Yasak verdicts:

```txt
done
probably done
looks good
should work
tests likely pass
ready maybe
```

`BLOCKED` tek verdict'tir; alt sebep her zaman Ek A'daki Reason code ile
verilir.

---

## Ek A — BLOCKED Reason Code Sözlüğü

```txt
WRONG_BASE                              (Madde 4)
DIRTY_ROOT                              (Madde 5)
MISSING_VERIFICATION_PROFILE            (Madde 9)
UNEXPECTED_DEPENDENCY_CHANGE            (Madde 12)
SCOPE_DRIFT                             (Madde 17)
RETRY_LIMIT                             (Madde 21)
ROLLBACK_REQUIRES_HUMAN_CONFIRMATION    (Madde 21a)
TEST_FAILURE                            (Madde 22)
PEER_REVIEW_TIMEOUT                     (Madde 25a)
FORBIDDEN_FILE_TOUCHED                  (Madde 8 / 17)
PROTECTED_STATE_TOUCHED                 (Madde 14 / 15)
SECRET_DETECTED                         (Madde 28 secret check)
NOT_PUSHED                              (Madde 3a)
```

Yeni reason code eklemek docs-only PR ister; ajan kendi kafasından code
üretemez.

## Ek B — Repo Loop ve Agent Control Plane Ayrımı

İki katman vardır ve bu dosya sadece birincisidir:

```txt
1. İç kullanım (BU DOSYA):
HUQAN'ı geliştiren ajanların çalışma protokolü.
Verdicts: READY_FOR_REVIEW / BLOCKED / REQUEST_CHANGES / ...

2. Ürünleşmiş kullanım (AYRI SPEC, henüz yazılmadı):
HUQAN'ın kontrol ettiği dış ajanların güvenli çalışma loop'u.
Verdicts: ALLOW / DENY / HOLD / ...
```

İleride ürün tarafı şu şekle evrilir:

```txt
AI agent wants to act
→ HUQAN observes
→ checks scope
→ checks memory/provenance
→ checks action risk
→ asks approval if needed
→ emits Trust Receipt
→ allows / reviews / blocks
```

Bu dosya o spec'e ilham verir ama onu tanımlamaz. Ürün spec'i kendi dosyası
ve kendi PR'ı ile gelir.
