# Offline acceptance only. The restore driver creates a private tmpfs PGDATA and makes all restored roles NOLOGIN.
# Login is enabled only for the original two restricted roles inside this unpublished network namespace.
$ErrorActionPreference = 'Stop'
$restoreTarget = 'docked-commercial-restore-20261120g-attempt-2'
$driverDir = (Resolve-Path -LiteralPath 'private-data/google-refund-repair-20261120/driver').Path
if (@(Get-ChildItem -LiteralPath $driverDir -File).Count -ne 3) { throw 'Unexpected fixture input' }
$descriptor = docker inspect $restoreTarget | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $descriptor.Name -ne "/$restoreTarget" -or $descriptor.HostConfig.NetworkMode -ne 'none' -or @($descriptor.Mounts | Where-Object Type -ne 'tmpfs').Count -ne 0 -or ($descriptor.NetworkSettings.Ports.PSObject.Properties | Measure-Object).Count -ne 0) {throw 'Isolated restored target required'}
$targetEvidence = Get-Content -Raw -LiteralPath docs/qa/v31-prelaunch-execution-20261111/database/restore-20261120g/restore-only.json | ConvertFrom-Json
if ($targetEvidence.restoreTarget -ne $restoreTarget -or $targetEvidence.archiveSha256 -ne '1953e19a15fa758335af1c0bff2fe77b2ccb4b720a5227acf734b6d82f8e6688' -or $targetEvidence.protectedTables -ne 576 -or !$targetEvidence.protectedRecordsUnchanged) { throw 'Restore evidence mismatch' }
docker exec $restoreTarget psql -X -h /restore -U postgres -d postgres -v ON_ERROR_STOP=1 -c "alter role docked_commercial_runtime login; alter role docked_app login; alter database postgres set docked.refund_fixture = 'refund-repair-20261120';"
if ($LASTEXITCODE -ne 0) {throw 'Local target marker failed'}
try {
 docker run --pull never --rm --memory 220m --network "container:$restoreTarget" --mount "type=bind,source=$driverDir,target=/fixture,readonly" node:22-alpine node /fixture/test.cjs
 if ($LASTEXITCODE -ne 0) {throw 'Full restored database scenario failed'}
} finally {
 docker stop $restoreTarget
 if ($LASTEXITCODE -ne 0) {throw 'Check local restore closure'}
}
