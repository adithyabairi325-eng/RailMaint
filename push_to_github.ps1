Write-Host "Safeguarding secrets..." -ForegroundColor Cyan
git rm --cached backend/.env -f 2>$null
git rm --cached .env -f 2>$null

Write-Host "Staging all changes..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m "Restore native maintenance dashboard UI and connect to MongoDB Atlas backend"

Write-Host "Configuring remote origin..." -ForegroundColor Cyan
git remote set-url origin https://github.com/adithyabairi325-eng/RailMaint.git

Write-Host "Pushing to GitHub (main)..." -ForegroundColor Cyan
git push -u origin main

Write-Host "Push complete!" -ForegroundColor Green
