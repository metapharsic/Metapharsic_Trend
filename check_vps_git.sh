#!/bin/bash
cd /u01/apps/Metapharsic_MrTracker/web 2>&1 || cd /u01/apps/Metapharsic_MrTracker 2>&1
echo "--- PWD ---"
pwd
echo "--- IS GIT REPO? ---"
git rev-parse --is-inside-work-tree 2>&1
echo "--- REMOTE ---"
git remote -v 2>&1
echo "--- LOG ---"
git log -1 --format="%H %s" 2>&1
echo "--- STATUS ---"
git status --short 2>&1 | head -20
echo "--- FILE EXISTS? ---"
ls -la lib/api-client.ts 2>&1
