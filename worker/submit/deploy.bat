@echo off
setlocal
cd /d "%~dp0" || goto failed

call npm install || goto failed
call npx wrangler whoami --json -c ../../wrangler.submit.jsonc >nul 2>&1 || call npx wrangler login -c ../../wrangler.submit.jsonc || goto failed

echo Enter the admin password:
call npx wrangler secret put ADMIN_KEY -c ../../wrangler.submit.jsonc || goto failed
echo Enter the GitHub token:
call npx wrangler secret put GITHUB_TOKEN -c ../../wrangler.submit.jsonc || goto failed

call npm run deploy || goto failed
echo Deployment complete: https://api.catrix.net
pause
exit /b 0

:failed
echo Deployment failed. See the error above.
pause
exit /b 1
