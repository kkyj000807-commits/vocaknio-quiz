$ErrorActionPreference = 'Stop'
$osInfo = Get-CimInstance Win32_OperatingSystem
$memory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$metadata = @{}
Get-CimInstance Win32_Process | ForEach-Object { $metadata[[int]$_.ProcessId] = $_ }
$rows = @(Get-Process | ForEach-Object {
    $proc = $_
    $meta = $metadata[[int]$proc.Id]
    # Inspect command lines only to classify; never emit arguments, paths or env.
    $role = if ($proc.ProcessName -match '^(node|bun)$') {
        switch -Regex ($meta.CommandLine) {
            'verify-project|build-production-web|run-tests|start-metro' { 'finetune-orchestrator'; break }
            'vitest|tinypool' { 'vitest'; break }
            'typescript.*tsc|tsc.*noEmit' { 'typescript'; break }
            'metro|expo.*export|expo.*start|expo.*cli' { 'expo-metro'; break }
            default { 'node-other' }
        }
    } elseif ($proc.ProcessName -match 'chrome|msedge|firefox') { 'browser' }
    elseif ($proc.ProcessName -match 'Codex|ChatGPT') { 'codex' }
    else { 'other' }
    [pscustomobject]@{ pid=$proc.Id; parentPid=$meta.ParentProcessId; name=$proc.ProcessName; role=$role; workingSetBytes=$proc.WorkingSet64; privateBytes=$proc.PrivateMemorySize64 }
})
[pscustomobject]@{
    measuredAt=(Get-Date).ToString('o')
    provider='Windows CIM PerfOS Memory / Get-Process'
    physicalTotalBytes=[double]$osInfo.TotalVisibleMemorySize * 1024
    physicalAvailableBytes=[double]$memory.AvailableBytes
    commitUsedBytes=[double]$memory.CommittedBytes
    commitLimitBytes=[double]$memory.CommitLimit
    commitAvailableBytes=[double]($memory.CommitLimit - $memory.CommittedBytes)
    logicalCPUs=[Environment]::ProcessorCount
    topPrivate=@($rows | Sort-Object privateBytes -Descending | Select-Object -First 10)
    development=@($rows | Where-Object { $_.name -match '^(node|bun|esbuild)$' })
    byRole=@($rows | Group-Object role | ForEach-Object {
        [pscustomobject]@{ role=$_.Name; count=$_.Count; privateBytes=($_.Group | Measure-Object privateBytes -Sum).Sum; workingSetBytes=($_.Group | Measure-Object workingSetBytes -Sum).Sum }
    })
} | ConvertTo-Json -Depth 5 -Compress
