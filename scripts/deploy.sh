#!/usr/bin/env bash
# One-command deploy to GitHub Pages: validate + build, push source to `main`, publish dist/ to `gh-pages`.
# Requires an authenticated GitHub CLI (`gh auth status`). Override with REPO=owner/name.
set -euo pipefail
cd "$(dirname "$0")/.."
OWNER="$(gh api user -q .login)"
REPO="${REPO:-$OWNER/ai-fomo-radar}"
NAME="${REPO#*/}"
export SITE_URL="${SITE_URL:-https://${OWNER}.github.io/${NAME}/}"

node scripts/build.mjs            # fails (non-zero) on schema / missing source / stale date

# 1) source -> main
if [ ! -d .git ]; then git init -q -b main; fi
git add -A
git -c user.name="AI FOMO Radar" -c user.email="${OWNER}@users.noreply.github.com" commit -qm "Issue update $(date +%F)" || true
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --description "AI FOMO Radar: a daily bilingual AI news front page" --source . --remote origin --push
else
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/${REPO}.git"
  git push -q origin main
fi

# 2) dist -> gh-pages (fresh orphan commit each deploy; history of the site lives in main)
rm -rf .deploy && cp -r dist .deploy
( cd .deploy && git init -q -b gh-pages && git add -A &&
  git -c user.name="AI FOMO Radar" -c user.email="${OWNER}@users.noreply.github.com" commit -qm "Deploy $(date -Iseconds)" &&
  git push -qf "https://github.com/${REPO}.git" gh-pages )
rm -rf .deploy

# 3) make sure Pages serves gh-pages
if ! gh api "repos/${REPO}/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/${REPO}/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null
fi
echo "Deployed → ${SITE_URL}  (GitHub Pages can take ~1 minute to refresh)"
