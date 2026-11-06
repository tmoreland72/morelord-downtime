# Run with: pwsh -File test/resolve-release-version.test.ps1
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$resolver = Join-Path $ProjectRoot 'tools/resolve-release-version.ps1'
$releaseScript = Join-Path $ProjectRoot 'release.ps1'
$parseErrors = $null
$releaseAst = [System.Management.Automation.Language.Parser]::ParseFile($releaseScript, [ref]$null, [ref]$parseErrors)
if ($parseErrors) { throw ($parseErrors | Out-String) }
$parameterNames = @($releaseAst.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
foreach ($name in @('Version', 'WebsiteOnly', 'FoundryOnly', 'SkipWebsitePublish', 'SkipFoundryPublish')) {
    if ($parameterNames -notcontains $name) { throw "release.ps1 is missing -$name." }
}

$fixture = Join-Path (Join-Path $ProjectRoot 'tmp') ('resolve-version-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
try {
    $manifest = Join-Path $fixture 'module.json'
    '{"version":"0.3.0"}' | Set-Content -LiteralPath $manifest
    function Invoke-Resolver {
        param([hashtable]$ResolverArgs)
        $output = & $resolver @ResolverArgs
        return ($output | Select-Object -Last 1).ToString().Trim()
    }
    if ((Invoke-Resolver @{ ModuleManifest = $manifest; Bump = 'patch' }) -ne '0.3.1') { throw 'patch bump failed.' }
    if ((Invoke-Resolver @{ ModuleManifest = $manifest; Bump = 'minor' }) -ne '0.4.0') { throw 'minor bump failed.' }
    if ((Invoke-Resolver @{ ModuleManifest = $manifest; Bump = 'major' }) -ne '1.0.0') { throw 'major bump failed.' }
    if ((Invoke-Resolver @{ ModuleManifest = $manifest; Bump = 'major'; Version = '1.2.3' }) -ne '1.2.3') { throw 'explicit version failed.' }
    if ((Invoke-Resolver @{ ModuleManifest = $manifest; PublishOnly = $true }) -ne '0.3.0') { throw 'publish_only current version failed.' }
    if ((Invoke-Resolver @{ ModuleManifest = $manifest; Version = '2.0.0'; PublishOnly = $true }) -ne '2.0.0') { throw 'publish_only explicit version failed.' }
    $rejected = $false
    try { Invoke-Resolver @{ ModuleManifest = $manifest; Version = '1.2' } | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw 'A non x.y.z version must be rejected.' }
    Write-Host 'resolve-release-version tests passed'
}
finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
}
