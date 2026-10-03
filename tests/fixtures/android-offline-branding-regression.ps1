$ErrorActionPreference = 'Stop'
. (Join-Path (Get-Location) 'scripts/android-offline-branding.ps1')
$approved = 'data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath 'public/brand/logos/docked-primary-on-dark.png')))
if ($approved -notmatch 'ADB') { throw 'Regression fixture no longer reproduces the original base64 collision.' }
$html = '<html><body><img src="' + $approved + '" alt="Docked"><script>const retryUrl="https://preview.example.test/home";</script></body></html>'
if (-not (Test-AndroidOfflineBranding -Html $html -ApprovedImage $approved)) { throw 'Exact approved embedded PNG was rejected.' }
$rejected = @(
  $html.Replace($approved, 'data:image/png;base64,YWJj'),
  $html.Replace($approved, 'https://example.test/logo.png'),
  $html.Replace('</body>', '<img src="https://example.test/extra.png"></body>'),
  $html.Replace('</body>', '<script src="https://example.test/a.js"></script></body>'),
  $html.Replace('</body>', '<link href="https://example.test/a.css"></body>'),
  $html.Replace('</body>', '<p>Use ADB and reverse port3000</p></body>'),
  '<html><body>No approved image</body></html>'
)
foreach ($candidate in $rejected) {
  if (Test-AndroidOfflineBranding -Html $candidate -ApprovedImage $approved) { throw 'A disallowed offline document passed the guard.' }
}
Write-Output 'Offline APK guard regression PASS: one exact approved PNG accepted; seven invalid documents rejected.'
