@echo off
cd /d "%~dp0.."
vercel env run -e production -- npx tsx scripts/check-attendance-date.ts %1 %2
