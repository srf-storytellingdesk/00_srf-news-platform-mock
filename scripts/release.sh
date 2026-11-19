#!/usr/bin/env bash
# Regenerate all mocks, commit, tag with today's date and push.
#   pnpm release              scrape + screenshot, commit, tag, push
#   pnpm release --tag-only   tag and push current HEAD (e.g. integration/ change)
set -euo pipefail

cd "$(dirname "$0")/.."

tag_only=false
[[ "${1:-}" == "--tag-only" ]] && tag_only=true

branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "main" ]]; then
  echo "Not on main (on $branch)." >&2
  exit 1
fi

# Pick up tags pushed from elsewhere so the counter doesn't collide.
git fetch --tags --quiet origin

if ! $tag_only; then
  pnpm mock:all
  git add mocks screenshots
  if git diff --cached --quiet; then
    echo "Regeneration produced no changes; nothing to tag." >&2
    exit 1
  fi
  git commit -m "regenerate mocks"
fi

# One tag per push: YYYY-MM-DD, then YYYY-MM-DD.2, .3, ...
today=$(date +%F)
tag=$today
n=2
while git rev-parse -q --verify "refs/tags/$tag" >/dev/null; do
  tag="$today.$n"
  n=$((n + 1))
done

git tag "$tag"
git push origin main "$tag"
echo "Pushed $tag"
