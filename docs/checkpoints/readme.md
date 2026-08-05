# Checkpoints System

Use this folder to manage backups of your code and documentation during vibe coding sessions.

## Quick Start

### 1. Run Checkpoint Script
To manually save the current state before making major code modifications, run the following PowerShell command in your terminal:
```powershell
powershell -ExecutionPolicy Bypass -File .\docs\checkpoints\checkpoint.ps1
```

### 2. Snapshots Folder
The script automatically copies your code (excluding dependencies like `node_modules` or `.git`) and saves it under:
`docs/checkpoints/snapshots/YYYY-MM-DD_HH-MM-SS/`

### 3. Restoration
If a coding generation goes wrong, you can manually compare or copy files from the latest snapshot directory back into the project root.
