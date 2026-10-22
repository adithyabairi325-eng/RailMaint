@echo off
echo Staging all changes...
git add .

echo Committing changes...
git commit -m "Update maintenance requests actions, dynamic delayed/completed status, and schedule synchronization"

echo Configuring remote origin...
git remote set-url origin https://github.com/adithyabairi325-eng/RailMaint.git

echo Pushing to GitHub (main)...
git push -u origin main

echo Done!
pause
