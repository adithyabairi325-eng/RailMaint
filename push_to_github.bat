@echo off
echo Safeguarding secrets...
git rm --cached backend/.env -f >nul 2>&1
git rm --cached .env -f >nul 2>&1

echo Staging all changes...
git add .

echo Committing changes...
git commit -m "Audit and fix backend validation, role authorization, calendar dates, and duplicate ID handling across assets and maintenance requests"

echo Configuring remote origin...
git remote set-url origin https://github.com/adithyabairi325-eng/RailMaint.git

echo Pushing to GitHub (main)...
git push -u origin main

echo Done!
pause
