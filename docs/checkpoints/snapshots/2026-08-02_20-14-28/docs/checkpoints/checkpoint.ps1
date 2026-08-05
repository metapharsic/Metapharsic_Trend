# Auto-Capture Checkpoint Tool
# Captures a snapshot of the workspace to prevent data loss.

$date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$destination = Join-Path $PSScriptRoot "snapshots\$date"

# Create destination directory
New-Item -ItemType Directory -Force -Path $destination | Out-Null

Write-Host "Creating checkpoint at $destination..."

# Exclude list for Robocopy
$excludeDirs = @("node_modules", "dist", ".next", "build", ".git", "snapshots", "bin", "obj")
$excludeFiles = @("*.zip", "*.tar.gz")

# Source is the project root (parent of docs/checkpoints)
$source = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$xdArgs = $excludeDirs | ForEach-Object { Join-Path $source $_ }
$xdArgs += Join-Path $PSScriptRoot "snapshots" # Prevent infinite recursion

& robocopy $source $destination /E /XD $xdArgs /XF $excludeFiles /R:0 /W:0 /NFL /NDL /NJH /NJS | Out-Null

Write-Host "Checkpoint created successfully!"
