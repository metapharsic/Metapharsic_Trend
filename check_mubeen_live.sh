#!/bin/bash
PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -c "UPDATE \"User\" SET \"deviceUuid\"=NULL WHERE email='abdulmubeen@mrtracker.com';"
echo "--- deviceUuid right before test ---"
PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -t -A -c "SELECT \"deviceUuid\" FROM \"User\" WHERE email='abdulmubeen@mrtracker.com';"
echo "--- LIVE API TEST (fresh uuid) ---"
curl -s -X POST http://localhost:3000/api/auth/login/mr -H "Content-Type: application/json" -d '{"email":"abdulmubeen@mrtracker.com","password":"mr1234","deviceUuid":"proof-test-uuid-999"}'
echo ""
echo "--- deviceUuid AFTER test ---"
PGPASSWORD=TrendMr2026Secure psql -h localhost -U trend_mr_user -d trend_mr -t -A -c "SELECT \"deviceUuid\" FROM \"User\" WHERE email='abdulmubeen@mrtracker.com';"
