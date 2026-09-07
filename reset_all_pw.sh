#!/bin/bash
set -e
cd /u01/apps/Metapharsic_MrTracker/web
MR_HASH=$(node -e "require('bcrypt').hash('mr1234',10).then(h=>console.log(h))")
MALIK_HASH=$(node -e "require('bcrypt').hash('mr12345',10).then(h=>console.log(h))")
ADMIN_HASH=$(node -e "require('bcrypt').hash('Oracle#19',10).then(h=>console.log(h))")

echo "MR_HASH=$MR_HASH"
echo "MALIK_HASH=$MALIK_HASH"
echo "ADMIN_HASH=$ADMIN_HASH"

PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -c "UPDATE \"User\" SET \"passwordHash\"='$MR_HASH', \"deviceUuid\"=NULL WHERE email IN ('abdulmannan@mrtracker.com','abdulmubeen@mrtracker.com');"
PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -c "UPDATE \"User\" SET \"passwordHash\"='$MALIK_HASH', \"deviceUuid\"=NULL WHERE email='abdulmalik@metapharsic.com';"
PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -c "UPDATE \"User\" SET \"passwordHash\"='$ADMIN_HASH' WHERE email='admin@mrtracker.com';"

echo "--- VERIFY ---"
curl -s -X POST http://localhost:3000/api/auth/login/manager -H "Content-Type: application/json" -d '{"email":"admin@mrtracker.com","password":"Oracle#19"}'
echo ""
