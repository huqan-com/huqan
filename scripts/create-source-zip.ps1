[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$Sha256Path
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  $output = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }

  return $output
}

function Test-ExcludedPath {
  param([string]$RelativePath)

  $normalized = $RelativePath.Replace('\', '/')
  $fileName = [System.IO.Path]::GetFileName($normalized)
  $excludedFileNames = @(
    'memory.json',
    'memory.db',
    'memory.db-shm',
    'memory.db-wal',
    'memory.embeddings.json',
    'agent.memory.json',
    'test_memory.db',
    '.env'
  )

  if ($excludedFileNames -contains $fileName) {
    return $true
  }

  if ($fileName.EndsWith('.log', [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }

  foreach ($segment in $normalized.Split('/')) {
    if ($segment -in @('.git', 'node_modules', 'backups')) {
      return $true
    }
  }

  return $false
}

$repoRoot = (Invoke-Git rev-parse --show-toplevel | Select-Object -First 1).Trim()
$headSha = (Invoke-Git -C $repoRoot rev-parse HEAD | Select-Object -First 1).Trim()
$treeSha = (Invoke-Git -C $repoRoot rev-parse 'HEAD^{tree}' | Select-Object -First 1).Trim()
$status = @(Invoke-Git -C $repoRoot status --porcelain --untracked-files=all)

if ($status.Count -gt 0) {
  throw 'Source archive requires a clean worktree.'
}

$outputFullPath = [System.IO.Path]::GetFullPath($OutputPath)
$repoPrefix = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar

if ($outputFullPath.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'OutputPath must be outside the repository.'
}

if ([string]::IsNullOrWhiteSpace($Sha256Path)) {
  $sha256FullPath = "$outputFullPath.sha256"
} else {
  $sha256FullPath = [System.IO.Path]::GetFullPath($Sha256Path)
}

$outputDirectory = [System.IO.Path]::GetDirectoryName($outputFullPath)
$sha256Directory = [System.IO.Path]::GetDirectoryName($sha256FullPath)
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
[System.IO.Directory]::CreateDirectory($sha256Directory) | Out-Null

$trackedFiles = @(Invoke-Git -C $repoRoot ls-files)
$archiveFiles = @($trackedFiles | Where-Object { -not (Test-ExcludedPath $_) })
[System.Array]::Sort($archiveFiles, [System.StringComparer]::Ordinal)

if ($archiveFiles.Count -eq 0) {
  throw 'No tracked source files were selected for the archive.'
}

$fixedTimestamp = [System.DateTimeOffset]::Parse('1980-01-01T00:00:00Z')
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$manifest = [ordered]@{
  formatVersion = 1
  project = 'HUQAN'
  commitSha = $headSha
  treeSha = $treeSha
  sourceSelection = 'git ls-files'
  fileCount = $archiveFiles.Count
  archiveRoot = 'HUQAN/'
  pathSeparator = '/'
  timestampPolicy = 'fixed:1980-01-01T00:00:00Z'
  exclusions = @(
    '.git/',
    'node_modules/',
    'backups/',
    '.env',
    '*.log',
    'memory.json',
    'memory.db',
    'memory.db-shm',
    'memory.db-wal',
    'memory.embeddings.json',
    'agent.memory.json',
    'test_memory.db'
  )
}
$manifestJson = (($manifest | ConvertTo-Json -Depth 5) -replace "`r`n", "`n") + "`n"

if ([System.IO.File]::Exists($outputFullPath)) {
  [System.IO.File]::Delete($outputFullPath)
}

$fileStream = [System.IO.File]::Open(
  $outputFullPath,
  [System.IO.FileMode]::CreateNew,
  [System.IO.FileAccess]::ReadWrite,
  [System.IO.FileShare]::None
)

try {
  $archive = New-Object System.IO.Compression.ZipArchive(
    $fileStream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $true
  )

  try {
    foreach ($relativePath in $archiveFiles) {
      $normalizedPath = $relativePath.Replace('\', '/')
      if (
        $normalizedPath.StartsWith('/') -or
        $normalizedPath.Contains('../') -or
        $normalizedPath.Contains('/..')
      ) {
        throw "Unsafe archive path: $relativePath"
      }

      $sourcePath = Join-Path $repoRoot $relativePath
      if (-not [System.IO.File]::Exists($sourcePath)) {
        throw "Tracked source file is missing: $relativePath"
      }

      $entry = $archive.CreateEntry(
        "HUQAN/$normalizedPath",
        [System.IO.Compression.CompressionLevel]::Optimal
      )
      $entry.LastWriteTime = $fixedTimestamp

      $sourceStream = [System.IO.File]::OpenRead($sourcePath)
      $entryStream = $entry.Open()
      try {
        $sourceStream.CopyTo($entryStream)
      } finally {
        $entryStream.Dispose()
        $sourceStream.Dispose()
      }
    }

    $manifestEntry = $archive.CreateEntry(
      'HUQAN/SOURCE-MANIFEST.json',
      [System.IO.Compression.CompressionLevel]::Optimal
    )
    $manifestEntry.LastWriteTime = $fixedTimestamp
    $manifestStream = $manifestEntry.Open()
    $manifestWriter = New-Object System.IO.StreamWriter($manifestStream, $utf8NoBom)
    try {
      $manifestWriter.Write($manifestJson)
    } finally {
      $manifestWriter.Dispose()
    }
  } finally {
    $archive.Dispose()
  }
} finally {
  $fileStream.Dispose()
}

$hash = (Get-FileHash -LiteralPath $outputFullPath -Algorithm SHA256).Hash.ToLowerInvariant()
$sidecar = "$hash  $([System.IO.Path]::GetFileName($outputFullPath))`n"
[System.IO.File]::WriteAllText($sha256FullPath, $sidecar, $utf8NoBom)

[pscustomobject]@{
  archive = $outputFullPath
  sha256 = $hash
  sha256File = $sha256FullPath
  commitSha = $headSha
  treeSha = $treeSha
  trackedFiles = $archiveFiles.Count
  archiveEntries = $archiveFiles.Count + 1
}
