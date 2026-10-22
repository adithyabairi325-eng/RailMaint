Write-Host "Staging all changes..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m "Update maintenance requests actions, dynamic delayed/completed status, and schedule synchronization"

Write-Host "Configuring remote origin..." -ForegroundColor Cyan
git remote set-url origin https://github.com/adithyabairi325-eng/RailMaint.git

Write-Host "Pushing to GitHub (main)..." -ForegroundColor Cyan
git push -u origin main

Write-Host "Push complete!" -ForegroundColor Green
