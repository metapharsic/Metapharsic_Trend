$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$key = 'C:\Trend_MR\vps_key.ppk'
$vps = 'root@187.127.169.217'
$dest = '/u01/apps/Metapharsic_MrTracker/web'

Write-Host "1. Transferring logo assets..."
& $pscp -batch -i $key 'c:\Trend_MR\web\public\uploads\company\logo.png' "$($vps):$($dest)/public/uploads/company/logo.png"
& $pscp -batch -i $key 'c:\Trend_MR\web\public\logo.png' "$($vps):$($dest)/public/logo.png"
& $pscp -batch -i $key 'c:\Trend_MR\web\public\metapharsic-logo.png' "$($vps):$($dest)/public/metapharsic-logo.png"

Write-Host "2. Transferring libraries and components..."
& $pscp -batch -i $key 'c:\Trend_MR\web\lib\excel-export.ts' "$($vps):$($dest)/lib/excel-export.ts"
& $pscp -batch -i $key 'c:\Trend_MR\web\lib\system-health.ts' "$($vps):$($dest)/lib/system-health.ts"
& $pscp -batch -i $key 'c:\Trend_MR\web\lib\api-client.ts' "$($vps):$($dest)/lib/api-client.ts"
& $pscp -batch -i $key 'c:\Trend_MR\web\components\dashboard-shell.tsx' "$($vps):$($dest)/components/dashboard-shell.tsx"
& $pscp -batch -i $key 'c:\Trend_MR\web\components\system-diagnostics-modal.tsx' "$($vps):$($dest)/components/system-diagnostics-modal.tsx"

Write-Host "3. Transferring API routes..."
& $pscp -batch -i $key 'c:\Trend_MR\web\app\api\admin\diagnostics\route.ts' "$($vps):$($dest)/app/api/admin/diagnostics/route.ts"
& $pscp -batch -i $key 'c:\Trend_MR\web\app\api\finance\accounts-jotter\route.ts' "$($vps):$($dest)/app/api/finance/accounts-jotter/route.ts"
& $pscp -batch -i $key 'c:\Trend_MR\web\app\api\reports\mr-daily-calls\route.ts' "$($vps):$($dest)/app/api/reports/mr-daily-calls/route.ts"

Write-Host "4. Transferring dashboard pages..."
& $pscp -batch -i $key 'c:\Trend_MR\web\app\(dashboard)\admin\accounts-jotter\page.tsx' "$($vps):$($dest)/app/(dashboard)/admin/accounts-jotter/page.tsx"
& $pscp -batch -i $key 'c:\Trend_MR\web\app\(dashboard)\admin\diagnostics\page.tsx' "$($vps):$($dest)/app/(dashboard)/admin/diagnostics/page.tsx"
& $pscp -batch -i $key 'c:\Trend_MR\web\app\(dashboard)\reports\mr-daily-calls\page.tsx' "$($vps):$($dest)/app/(dashboard)/reports/mr-daily-calls/page.tsx"

Write-Host "5. Transferring apply-company-logo script..."
& $pscp -batch -i $key 'c:\Trend_MR\web\scripts\apply-company-logo.ts' "$($vps):$($dest)/scripts/apply-company-logo.ts"

Write-Host "All files transferred to VPS host successfully!"
