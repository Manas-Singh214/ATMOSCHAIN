@echo off
cd /d "d:\ATMOSCHAIN"
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
cd frontend
call npm run deploy
