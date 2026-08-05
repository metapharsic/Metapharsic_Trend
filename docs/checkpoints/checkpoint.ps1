# Auto-Capture Checkpoint Tool
# Captures a snapshot of the workspace to prevent data loss.

$date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$destination = Join-Path $PSScriptRoot "snapshots\$date"

# Create destination directory
New-Item -ItemType Directory -Force -Path $destination | Out-Null

Write-Host "Creating checkpoint at $destination..."

# Exclude list for Robocopy.
# These are bare names, not absolute paths: robocopy /XD matches a bare name at ANY
# depth, whereas an absolute path only matches that exact location. That distinction
# matters because node_modules lives at web/node_modules, not at the repo root — with
# absolute paths the snapshot silently copied every installed package.
$excludeDirs = @("node_modules", "dist", ".next", "build", ".git", "snapshots", "bin", "obj", "coverage")

# Environment files are excluded so snapshots never accumulate credentials.
# Template files (.env.example / .env.sample) are deliberately NOT matched, so they
# still get captured — they carry variable names, not secrets.
$excludeFiles = @(
    "*.zip", "*.tar.gz", "*.tsbuildinfo",
    ".env", ".env.local", ".env.*.local",
    ".env.development", ".env.test", ".env.production"
)

# Source is the project root (parent of docs/checkpoints)
$source = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$xdArgs = $excludeDirs
$xdArgs += Join-Path $PSScriptRoot "snapshots" # Prevent infinite recursion

& robocopy $source $destination /E /XD $xdArgs /XF $excludeFiles /R:0 /W:0 /NFL /NDL /NJH /NJS | Out-Null

Write-Host "Checkpoint created successfully!"
