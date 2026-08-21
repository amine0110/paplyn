#!/bin/sh
set -e

echo "Pushing database schema..."
node -e "
const { execSync } = require('child_process');
try {
  execSync('npx drizzle-kit push --force', { stdio: 'inherit', cwd: 'packages/web' });
} catch (e) {
  console.log('Schema push skipped or failed, continuing...');
}
" 2>/dev/null || echo "DB init skipped"

exec node packages/web/server.js
