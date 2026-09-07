#!/bin/bash
PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -c "UPDATE \"User\" SET \"deviceUuid\"=NULL WHERE role='MR';"
echo "--- WHO GOT CLEARED ---"
PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -c "SELECT email, \"deviceUuid\" FROM \"User\" WHERE role='MR';"
