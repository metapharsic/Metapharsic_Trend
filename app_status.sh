#!/bin/bash
echo "--- PM2 STATUS ---"
pm2 status trend-mr
echo "--- HTTP CHECK (local) ---"
curl -s -o /dev/null -w "HTTP_CODE: %{http_code}\n" http://localhost:3000/login
echo "--- HTTP CHECK (public, via nginx) ---"
curl -s -o /dev/null -w "HTTP_CODE: %{http_code}\n" -k https://localhost/login 2>&1 || curl -s -o /dev/null -w "HTTP_CODE: %{http_code}\n" http://localhost/login
