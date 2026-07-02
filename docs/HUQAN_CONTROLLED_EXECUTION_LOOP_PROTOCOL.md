# HUQAN Controlled Execution Loop Protocol v0.4

```txt
Status:
CANONICAL_PROTOCOL

Primary use:
HUQAN repo uzerinde calisan ajanlar

Secondary future use:
Ayrı bir HUQAN Agent Control Plane spec'ine ilham verir; bu dosyanin parcasi degildir.
```

## 0. Layer Separation Rule

Bu protokol once HUQAN reposunda calisan implementation/review ajanlari icindir.

Repo governance loop ile urun runtime loop'u karistirilmaz.

```txt
Repo loop:
READY_FOR_REVIEW / BLOCKED / REQUEST_CHANGES

Product runtime:
ALLOW / DENY / HOLD
```

`READY_FOR_REVIEW` repo review durumudur. `ALLOW` degildir.

HUQAN Agent Control Plane icin dis ajan verdict sistemi ayrica tanimlanacaktir.

---

## 1. Core Doctrine

```txt
HUQAN work is not closed by intention.
HUQAN work is closed only by evidence.
```

Ajan "bitti" dedigi icin is bitmez.
Is ancak repo-backed evidence, test, diff, commit, review ve temiz state ile biter.

---

## 2. Canonical Loop Shape

Generic loop:

```txt
observe -> decide -> act -> verify
```

HUQAN loop:

```txt
observe
-> plan
-> scope-check
-> act
-> verify
-> judge
-> persist evidence
-> exit
```

---

## 3. Canonical Source Rule

Ajan roadmap'i, PR sirasini veya task kapsamını kafadan belirleyemez.

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

`agent.memory.json` canonical source degildir.

---

## 4. Base Verification Rule

Her loop baslamadan once base branch / commit dogrulanir.

Eksik veya yanlissa:

```txt
VERDICT:
BLOCKED

Reason:
WRONG_BASE
```

---

## 5. Dirty Root Rule

Dirty root varsa ajan calismaz.

```bash
git status --short
```

Beklenmeyen degisiklik varsa:

```txt
VERDICT:
BLOCKED

Reason:
DIRTY_ROOT
```

---

## 6. Branch Ownership Rule

Her gorev ayri clean branch / worktree ister.

Yanlis:

```txt
Herkes ayni klasorde calissin.
```

Dogru:

```txt
Herkes ayni canonical base'den ayri clean worktree acsin.
Sonuc PR ile birlessin.
```

---

## 7. Task Scope Rule

Her task dar olmali.

Task su alanlari icermeli:

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

---

## 8. Negative Scope Rule

Her task ne yapilmayacagini acikca soylemeli.

Ornek:

```txt
Do not touch package files.
Do not touch mcpServer.js.
Do not touch server.js.
Do not touch UI/viewer.
Do not use git add .
```

Negative scope bos olamaz.

---

## 9. Verification Profile Rule

Her loop verification profile tanimlamak zorunda.

Eksikse:

```txt
VERDICT:
BLOCKED

Reason:
MISSING_VERIFICATION_PROFILE
```

Profile formati:

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

---

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

---

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

Docs-only PR'da test kosulmamasi kabul edilebilir, ama scope disi dosya degisemez.

---

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

Beklenmeyen degisiklik varsa:

```txt
VERDICT:
BLOCKED

Reason:
UNEXPECTED_DEPENDENCY_CHANGE
```

---

## 13. Package Change Rule

Package / dependency degisimi ancak acik task kapsamiysa yapilir.

Allowed reasons:

```txt
adding dependency
removing dependency
upgrading dependency
security fix
approved lockfile regeneration
```

---

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

---

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

---

## 16. Loop Persistence Rule

Loop evidence runtime memory'ye yazilmaz.

Preferred evidence path:

```txt
.loop/evidence/<TASK_ID>/report.md
.loop/evidence/<TASK_ID>/commands.log
.loop/evidence/<TASK_ID>/diff-stat.txt
.loop/evidence/<TASK_ID>/test-output.txt
.loop/evidence/<TASK_ID>/huqan-verdict.json
```

Bu dosyalar sadece task acikca istiyorsa commitlenir.

---

## 17. Scope Diff Rule

Commit oncesi:

```bash
git diff --name-only
git diff --stat
git status --short
```

Diff allowed files ile uyusmuyorsa:

```txt
VERDICT:
BLOCKED

Reason:
SCOPE_DRIFT
```

---

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

---

## 19. No Broad Refactor Rule

Refactor ayri PR'dir.

Feature PR icinde refactor yasak.

Refactor PR sartlari:

```txt
no behavior change
public API unchanged
tests before/after same
small mechanical split
```

---

## 20. Act Rule

Ajan sadece izinli isi yapar.

Yasak:

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

---

## 21. Retry / Repair Limit Rule

Varsayilan:

```txt
max repair attempts: 3
max major steps: 20
max wall-clock: 45 minutes
```

Limit asilirsa:

```txt
VERDICT:
BLOCKED

Reason:
RETRY_LIMIT
```

---

## 21a. Rollback Rule

`BLOCKED` verdict'i uretilen her durumda ajan once evidence report uretir.

Rollback sirasi:

1. Evidence report yazilir.
2. `git diff --name-only`, `git diff --stat`, `git status --short` ciktisi evidence'a eklenir.
3. Sonra commit edilmemis task degisiklikleri discard edilir.
4. Runtime artifact / temp dosyalar temizlenir.
5. `.loop/evidence/<TASK_ID>/` korunur.
6. Rollback sadece ajanin kendi isolated worktree'sinde yapilir.
7. Base branch veya baska ajan worktree'sine dokunulmaz.

Onerilen guvenli komutlar:

```bash
git restore --worktree --staged .
git clean -fd -- ':! .loop/evidence'
```

Eger shell bu exclude syntax'ini desteklemiyorsa, ajan destructive clean yapmadan once durur ve raporlar:

```txt
VERDICT:
BLOCKED

Reason:
ROLLBACK_REQUIRES_HUMAN_CONFIRMATION
```

---

## 22. Test Failure Rule

Test fail ise sonuc `READY_FOR_REVIEW` olamaz.

```txt
HUQAN_DOGFOOD ALLOW bile failed tests ustunu ortemez.
```

---

## 23. Judge Mode Rule

Her task judge mode tanimlar.

Modes:

```txt
SELF_CHECK
PEER_AGENT_REVIEW
HUQAN_DOGFOOD
HUMAN_REVIEW
```

---

## 23a. Risk Level to Judge Mode Rule

Judge mode keyfi secilmez; risk seviyesine baglanir.

```txt
Trivial:
SELF_CHECK + HUMAN_REVIEW before merge

Low:
SELF_CHECK + PEER_AGENT_REVIEW before merge

Medium:
SELF_CHECK + PEER_AGENT_REVIEW + HUMAN_REVIEW before merge

High:
SELF_CHECK + PEER_AGENT_REVIEW + HUQAN_DOGFOOD + HUMAN_REVIEW before merge

Critical:
SELF_CHECK + PEER_AGENT_REVIEW + HUQAN_DOGFOOD + SECURITY_REVIEW + HUMAN_REVIEW before merge
```

Docs-only trivial degisikliklerde runtime test gerekmez; merge yine insan onayi ister.

---

## 24. Self Check Rule

SELF_CHECK sunlar icin yeterli olabilir:

```txt
docs-only draft
no-op verification
local report
```

Ama merge icin yetmez.

---

## 25. Peer Agent Review Rule

Code PR, security PR, audit PR veya onemli runtime degisiminde ikinci ajan review yapar.

Peer agent:

```txt
diff okur
test output okur
scope kontrol eder
claim dogrulugunu kontrol eder
```

Ayni isi rewrite etmez.

---

## 25a. Peer Review Timeout Rule

Peer review timeout sessizce SELF_CHECK'e dusmez.

Peer review zorunluysa ve zamaninda tamamlanamazsa:

```txt
VERDICT:
BLOCKED

Reason:
PEER_REVIEW_TIMEOUT
```

SELF_CHECK fallback ancak task spec acikca izin verirse kullanilir.

---

## 26. HUQAN Dogfood Rule

HUQAN dogfood evidence report claim'lerini kontrol eder.

Ornek checked claims:

```txt
tests_passed
test_command
changed_paths
auto_merge_false
protected_state_untouched
secret_check_passed
dependency_change_false
```

Product runtime verdictleri:

```txt
ALLOW
DENY
HOLD
```

Repo loop yorumlari:

```txt
ALLOW = review-ready signal olabilir
ALLOW != merge
```

---

## 27. Human Review Rule

Sunlar icin insan onayi zorunlu:

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

---

## 28. Evidence Report Rule

Her loop finalinde evidence report gerekir.

Format:

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

---

## 29. PR-FINISH MODE

Varsayilan calisma modu:

```txt
1. clean worktree ac
2. base dogrula
3. branch ac
4. degisikligi uygula
5. targeted test calistir
6. required verification calistir
7. diff scope kontrol et
8. forbidden file kontrol et
9. dependency diff kontrol et
10. secret/runtime artifact kontrol et
11. commit at
12. push yap
13. PR ac / update et
14. merge icin rapor ver
15. blocker varsa dur
```

Merge default kapalidir.

---

## 30. Final Verdict Rule

Repo loop final verdict set:

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

`BLOCKED` tek final verdict'tir; alt sebepler Reason code olarak yazilir.

Yasak verdicts:

```txt
done
probably done
looks good
should work
tests likely pass
ready maybe
```

---

# Ek A - BLOCKED Reason Code Dictionary

`BLOCKED` verdict'i tek kalir. Sebep bu sozlukten bir reason code ile yazilir.

```txt
WRONG_BASE
DIRTY_ROOT
MISSING_VERIFICATION_PROFILE
UNEXPECTED_DEPENDENCY_CHANGE
SCOPE_DRIFT
RETRY_LIMIT
TEST_FAILURE
PEER_REVIEW_TIMEOUT
ROLLBACK_REQUIRES_HUMAN_CONFIRMATION
HUMAN_APPROVAL_REQUIRED
AUTHORIZATION_BLOCKED
NETWORK_BLOCKED
MISSING_CANONICAL_SOURCE
NO_REAL_READ_PATH
PACKAGE_CHANGE_NOT_AUTHORIZED
FORBIDDEN_FILE_TOUCHED
SECRET_OR_TOKEN_RISK
ARTIFACT_HYGIENE_FAILED
MERGE_BLOCKED
NEEDS_CANONICALIZATION
```

Reason code acik ve makine-okunabilir olmali; prose aciklama ayrica yazilabilir.

---

# Ek B - Repo Loop vs HUQAN Agent Control Plane

Bu dosya HUQAN reposunda calisan ajanlarin governance protokoludur.

Repo loop:

```txt
READY_FOR_REVIEW
BLOCKED
REQUEST_CHANGES
APPROVED_FOR_MERGE
MERGED_BASELINE_GREEN
```

HUQAN product runtime / future Agent Control Plane:

```txt
ALLOW
DENY
HOLD
```

Bu iki katman karistirilmaz.

Ornek:

```txt
READY_FOR_REVIEW != ALLOW
BLOCKED != DENY
REQUEST_CHANGES != HOLD
```

Repo loop development governance icindir.

Product runtime verdict sistemi dis ajan action governance icindir ve ayri spec gerektirir.

---

# Kullanacak Ajanlar

Bu protokol su ajan siniflari icindir:

```txt
Claude -> implementation
Codex -> review/security gate
OpenCode -> scoped coding
Antigravity -> local agent execution
ChatGPT -> task-pack / review / protocol owner
```

Bu dosya HUQAN'i insa eden ajanlarin calisma anayasasidir.

---

# Final Verdict

```txt
VERDICT:
HUQAN_CONTROLLED_EXECUTION_LOOP_PROTOCOL_V0_4_ACCEPTED

Status:
CANONICAL_PROTOCOL
```
