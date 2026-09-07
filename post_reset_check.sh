#!/bin/bash
cd /u01/apps/Metapharsic_MrTracker/web
echo "--- PM2 STATUS ---"
pm2 status trend-mr
echo "--- USER TABLE ROW COUNT ---"
PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -t -A -c "SELECT COUNT(*) FROM \"User\";"
echo "--- ADMIN HASH CHECK ---"
HASH=$(PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -t -A -c "SELECT \"passwordHash\" FROM \"User\" WHERE email='admin@mrtracker.com';")
echo "DB_HASH=$HASH"
node -e "const b=require('bcrypt');b.compare('Oracle#19', process.argv[1]).then(r=>console.log('MATCH:', r))" "$HASH"
echo "--- LIVE API TEST ---"
curl -s -X POST http://localhost:3000/api/auth/login/manager -H "Content-Type: application/json" -d '{"email":"admin@mrtracker.com","password":"Oracle#19"}'
echo ""
