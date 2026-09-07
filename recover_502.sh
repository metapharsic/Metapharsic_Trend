#!/bin/bash
cd /u01/apps/Metapharsic_MrTracker/web
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
  echo "BUILD FAILED -- not restarting, need to see the error above."
fi
