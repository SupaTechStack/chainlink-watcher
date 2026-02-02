name: Watch Chainlink and Tweet

on:
  schedule:
    - cron: "*/15 * * * *"
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: chainlink-watch
  cancel-in-progress: true

jobs:
  watch:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          persist-credentials: true
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Run watcher
        env:
          GH_REPO: "smartcontractkit/chainlink"
          X_API_KEY: ${{ secrets.X_API_KEY }}
          X_API_SECRET: ${{ secrets.X_API_SECRET }}
          X_ACCESS_TOKEN: ${{ secrets.X_ACCESS_TOKEN }}
          X_ACCESS_SECRET: ${{ secrets.X_ACCESS_SECRET }}
        run: node watch-and-tweet.mjs

      - name: Commit state if changed
        run: |
          if git diff --quiet; then
            exit 0
          fi

          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          git add state.json
          git commit -m "Update state"
          git pull --rebase origin main
          git push origin main
