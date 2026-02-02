# Chainlink GitHub to X Watcher

Automated GitHub Actions workflow that monitors the public
smartcontractkit/chainlink repository and posts concise updates to X
based on new releases and newly merged pull requests. The workflow is
designed to focus on signal over noise by filtering for relevant changes
and by maintaining state to avoid duplicates.

## Features

- Monitors the latest GitHub release and posts an update when it changes
- Scans recently merged pull requests and posts only those that match
  relevance filters (keywords and labels)
- Prevents duplicate posts using local state tracking in state.json
- Produces short, clean summaries with a link to the source
- Fully automated via GitHub Actions on a 15-minute schedule
- No external infrastructure required

## How It Works

1. A GitHub Action runs every 15 minutes (or manually via workflow dispatch).
2. The script checks the most recent release for the repository.
3. If the release is new, it posts an update and stores the release ID.
4. If there is no new release, it scans recently merged pull requests.
5. Only pull requests matching relevance filters are posted.
6. The most recent processed merge time is stored to prevent repeats.

## Tweet Format

Release updates:

Chainlink release: <tag>
- <highlight 1>
- <highlight 2>
link

Pull request updates:

Chainlink dev signal (merged)
- <summary>
link

## Tech Stack

- GitHub Actions
- Node.js 20 (ESM, native fetch)
- GitHub REST API
- X API v2 (OAuth 1.0a)

## Required Secrets

Configure the following repository secrets:

- X_API_KEY
- X_API_SECRET
- X_ACCESS_TOKEN
- X_ACCESS_SECRET

Optionally, provide the default GitHub token as GH_TOKEN for higher API
rate limits. The workflow already maps secrets.GITHUB_TOKEN to GH_TOKEN.

## Files

- watch-and-tweet.mjs
- state.json
- .github/workflows/chainlink-watch.yml

## Running the Workflow

Automatic execution:
- Runs every 15 minutes via cron schedule

Manual execution:
1. Open Actions in GitHub
2. Select the workflow
3. Click Run workflow

## Configuration

Environment variables:

- GH_REPO: GitHub repository in owner/name format
- GH_TOKEN: GitHub token for API access
- GH_API_BASE: Optional GitHub API base URL
- INCLUDE_PRERELEASES: Set to any value to allow prereleases
- INCLUDE_DRAFTS: Set to any value to allow draft releases

## Notes

- The script treats duplicate X responses as a non-fatal outcome to avoid
  repeated failures when the same content is posted.
- State is stored in state.json and committed back to the repository by
  the workflow.

## License

MIT
