# CLAUDE.md — HUQAN Repo Rules for Claude Code

Bu repo'da çalışan her Claude Code oturumu için bağlayıcı kurallar.

## Kanonik protokol

Çalışma döngüsü **docs/HUQAN_CONTROLLED_EXECUTION_LOOP_PROTOCOL.md** (v0.4)
ile yönetilir. Oturuma başlamadan önce oku ve uygula. `AGENTS.md` dil ve
rapor formatı için geçerlidir; çelişkide protokol kazanır ve çelişki insana
raporlanır.

## Oturum başı zorunlu adımlar (protokol Madde 4-5)

```bash
git status --short        # dirty root → BLOCKED: DIRTY_ROOT
git log --oneline -5      # base doğrula → yanlışsa BLOCKED: WRONG_BASE
```

## Sert kurallar (özet — tam liste protokolde)

- İş niyetle değil kanıtla kapanır: test çıktısı, diff, commit, push (Madde 1).
- Origin'e push edilmemiş iş yok hükmündedir (Madde 3a).
- `git add .` / `git add -A` yasak; dosyalar tek tek stage edilir (Madde 18).
- `agent.memory.json`, `memory.json`, `memory.db`, log ve temp dosyalar asla
  stage/commit edilmez (Madde 14-15).
- Lockfile/manifest beklenmedik değişimi → `BLOCKED: UNEXPECTED_DEPENDENCY_CHANGE` (Madde 12).
- Test fail iken `READY_FOR_REVIEW` verilemez (Madde 22).
- Merge, release tag, branch silme, roadmap/security policy değişikliği için
  insan onayı zorunlu (Madde 27). Auto-merge her zaman kapalı.
- Final rapor protokol Madde 28 formatında ve Türkçe yazılır (AGENTS.md §1).

## Doğrulama profili (varsayılan — protokol Madde 10)

```txt
Runtime: Node.js
Test command: npm test        (node --test --test-concurrency=1)
Required verification level: full-test
Dependency lockfile: package-lock.json
```

Docs-only task'larda protokol Madde 11 profili geçerlidir.

## Evidence

Loop kanıtları `.loop/evidence/<TASK_ID>/` altına yazılır (gitignore'da);
task açıkça istemedikçe commit edilmez (Madde 16).
