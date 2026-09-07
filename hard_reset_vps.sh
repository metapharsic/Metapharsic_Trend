#!/bin/bash
set -e
cd /u01/apps/Metapharsic_MrTracker/web
echo "--- BEFORE: HEAD ---"
git log -1 --format="%H %s"
echo "--- FETCH ---"
git fetch origin main
echo "--- HARD RESET TO origin/main ---"
git reset --hard origin/main
echo "--- AFTER: HEAD ---"
git log -1 --format="%H %s"
echo "--- INSTALL ---"
npm ci 2>&1 | tail -20
echo "--- PRISMA ---"
npx prisma generate 2>&1 | tail -10
npx prisma db push --skip-generate --accept-data-loss=false 2>&1 | tail -10
echo "--- BUILD ---"
npm run build 2>&1 | tail -60
BUILD_STATUS=${PIPESTATUS[0]}
echo "--- BUILD_STATUS: $BUILD_STATUS ---"
if [ "$BUILD_STATUS" = "0" ]; then
  echo "--- RESTART ---"
  pm2 restart trend-mr
  sleep 3
  pm2 status trend-mr
else
  echo "BUILD STILL FAILED -- not restarting."
fi
