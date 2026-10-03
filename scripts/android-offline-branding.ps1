# Shared by the archive audit and its isolated regression; never emits page data.
function Test-AndroidOfflineBranding {
  param([string]$Html, [string]$ApprovedImage)
  if (-not $ApprovedImage.StartsWith('data:image/png;base64,')) { return $false }
  $images = [regex]::Matches($Html, '<img\b[^>]*>', 'IgnoreCase')
  if ($images.Count -ne 1) { return $false }
  $sources = [regex]::Matches($images[0].Value, '\bsrc\s*=\s*(?:"([^"]*)"|''([^'']*)''|([^\s>]+))', 'IgnoreCase')
  if ($sources.Count -ne 1) { return $false }
  $imageSource = @($sources[0].Groups[1].Value, $sources[0].Groups[2].Value, $sources[0].Groups[3].Value) | Where-Object { $_ -ne '' } | Select-Object -First 1
  if ($imageSource -cne $ApprovedImage) { return $false }
  # Exact approved image bytes may coincidentally contain ADB in their base64.
  # Secret scanning still inspects every archive entry before this copy-only check.
  $copy = $Html.Replace($ApprovedImage, 'approved-image')
  return $copy -notmatch 'localhost:3000|ADB|Connect the reviewed preview|reverse port' -and
    $copy -notmatch '<(?:script|link)\b[^>]+(?:src|href)\s*='
}
