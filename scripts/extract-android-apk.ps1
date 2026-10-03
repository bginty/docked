param(
  [string]$Apk = 'android/app/build/outputs/apk/preview/Docked-Preview-S24-v2.apk',
  [string]$Report = 'docs/qa/android-https-preview/apk-extraction.json'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Android's optimized resource paths are case-sensitive, unlike Windows.
# Every entry receives a unique numeric filename; no entry is overwritten or omitted.
$destination = Join-Path (Resolve-Path -LiteralPath 'private-data').Path ('android-https-preview-extracted-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $destination | Out-Null
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Apk))
$entries = 0
$files = 0
$bytes = [long]0
try {
  foreach ($entry in $archive.Entries) {
    $entries++
    if ($entry.FullName.EndsWith('/')) { continue }
    $suffix = [IO.Path]::GetExtension($entry.FullName)
    if ($suffix -notmatch '^\.[A-Za-z0-9_-]{1,20}$') { $suffix = '.bin' }
    $target = Join-Path $destination ($entries.ToString('D6') + $suffix)
    $inputStream = $entry.Open()
    $outputStream = [IO.File]::Open($target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
    try { $inputStream.CopyTo($outputStream) }
    finally { $inputStream.Dispose(); $outputStream.Dispose() }
    $length = (Get-Item -LiteralPath $target).Length
    if ($length -ne $entry.Length) { throw 'APK entry extraction was incomplete.' }
    $files++
    $bytes += $length
  }
} finally { $archive.Dispose() }
if ($files -eq 0) { throw 'APK extraction produced no files.' }
$record = [ordered]@{
  recordedAt = [DateTime]::UtcNow.ToString('o')
  apkSha256 = (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash.ToLowerInvariant()
  archiveEntries = $entries
  filesExtracted = $files
  uncompressedBytes = $bytes
  status = 'PASS'
  method = 'Every file entry extracted to a distinct indexed filename, preserving its extension and verifying its uncompressed length. No Windows case collision can overwrite an entry.'
}
$record | ConvertTo-Json | Set-Content -LiteralPath $Report -Encoding utf8
# Only this public path is returned; it contains no extracted data or credentials.
Write-Output $destination
