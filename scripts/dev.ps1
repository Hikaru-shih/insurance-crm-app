param([ValidateSet('dev','api','db:seed','web','start','typecheck','test','test:browser','build:web')][string]$Task = 'dev')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $portableNode = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $portableNode) { throw 'Install Node.js 24 LTS before running this command.' }
    $env:PATH = $portableNode.FullName + ';' + $env:PATH
}
$env:npm_config_cache = Join-Path $projectRoot '.tools/npm-cache'
$env:EXPO_NO_TELEMETRY = '1'
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/expo'))) { throw 'Run npm ci to install project dependencies first.' }
& npm.cmd run $Task
exit $LASTEXITCODE
