#!/usr/bin/env bash
# Build the site for GitHub Pages and publish it to the gh-pages branch of origin.
# Usage (Git Bash on Windows):  bash tools/deploy-pages.sh
# Requires: Node 22+, git, and a git credential that can push to the repo (e.g. `gh auth login`, then `gh auth setup-git`).
set -euo pipefail
export MSYS_NO_PATHCONV=1   # stop Git Bash rewriting /geoexcel-redesign into a Windows path

OWNER="${OWNER:-Gundamvenu}"
REPO="${REPO:-geoexcel-redesign}"
SITE_URL="${SITE_URL:-https://$(echo "$OWNER" | tr '[:upper:]' '[:lower:]').github.io}"
BASE_PATH="${BASE_PATH:-/$REPO}"

root="$(cd "$(dirname "$0")/.." && pwd)"
# Build inside the project (git-ignored): Astro renames files across the output folder, which fails between drives on Windows.
out="$root/tools/dist-pages"
mkdir -p "$out"
out_node="$out"; command -v cygpath >/dev/null 2>&1 && out_node="$(cygpath -m "$out")"

(cd "$root/site" && SITE_URL="$SITE_URL" BASE_PATH="$BASE_PATH" npx astro build --outDir "$out_node")
touch "$out/.nojekyll"   # Pages must not run Jekyll: it would drop the _astro/ folder

cd "$out"
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="noreply@users.noreply.github.com" commit -q -m "Deploy static build"
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$OWNER/$REPO.git"
git push -f origin gh-pages
echo "Published: $SITE_URL$BASE_PATH/"
