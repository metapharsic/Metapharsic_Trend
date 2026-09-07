#!/bin/bash
echo "--- PM2 STATUS ---"
pm2 status
echo "--- ERROR LOG (last 60) ---"
pm2 logs trend-mr --lines 60 --nostream --err
echo "--- .next BUILD_ID ---"
cd /u01/apps/Metapharsic_MrTracker/web
ls -la .next/BUILD_ID 2>&1
