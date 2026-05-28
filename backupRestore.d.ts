export interface BackupFileInfo {
  name: string;
  size: number;
}

export interface BackupResult {
  ok: true;
  backupId: string;
  backupDir: string;
  copied: BackupFileInfo[];
  skipped: string[];
  pruned: string[];
  manifest: Record<string, unknown>;
}

export interface RestoreResult {
  ok: true;
  sourceDir: string;
  restored: string[];
  skipped: string[];
  safetyBackupDir: string;
}

export function resolveRuntimePaths(opts?: Record<string, unknown>): { rootDir: string; backupBaseDir: string; files: string[] };
export function createBackup(opts?: Record<string, unknown>): BackupResult;
export function listBackups(opts?: Record<string, unknown>): string[];
export function restoreBackup(opts?: Record<string, unknown>): RestoreResult;
export function timestamp(date?: Date): string;
