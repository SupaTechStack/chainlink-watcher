# Chainlink GitHub → X Auto Watcher

An automated GitHub Actions workflow that monitors the public  
https://github.com/smartcontractkit/chainlink repository  
and posts a clean update to X (Twitter) whenever a new commit is published.

The project focuses on **signal over noise** by converting raw GitHub commit activity into short, readable updates.

---

## Features

- Monitors a public GitHub repository for new commits
- Posts exactly one tweet per new commit
- Prevents duplicate tweets using state tracking
- Generates clean English summaries (technical prefixes removed)
- Includes a direct link to the original GitHub commit
- Fully automated using GitHub Actions
- No server, database, or external infrastructure required
- Free-tier friendly

---

## How It Works

1. A GitHub Action runs every 15 minutes or manually via workflow dispatch
2. The latest commit is fetched from the GitHub API
3. The commit SHA is compared against a locally stored state (`state.json`)
4. If the commit is new:
   - A clean English summary is generated
   - A tweet is posted via the official X API
   - The commit SHA is saved to prevent duplicate tweets
5. If there is no new commit, nothing is posted

---

## Tweet Format

Example tweet:

🔔 Chainlink update

Improved OCR gas estimation logic
🔗 https://github.com/smartcontractkit/chainlink/commit/abc123


Tweet characteristics:
- English
- Short and readable
- No hashtags
- No mentions
- One tweet per commit

---

## ⚙️ Tech Stack

- **GitHub Actions** – automation and scheduling
- **Node.js 20** – runtime (ESM, native `fetch`)
- **GitHub REST API** – commit data
- **X API v2** – posting tweets (OAuth 1.0a)

---

## 🔐 Required Secrets

The following secrets must be configured in  
**GitHub → Repository → Settings → Actions → Secrets**:

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_SECRET`

These credentials are required to authenticate with the X API using OAuth 1.0a.

---

## 📁 Repository Structure

.
├── watch-and-tweet.mjs
├── state.json
└── .github
└── workflows
└── chainlink-watch.yml


---

## 🚀 Running the Workflow

### Automatic Execution
- Runs every **15 minutes** via cron schedule

### Manual Execution
1. Go to **Actions**
2. Select **Watch Chainlink and Tweet**
3. Click **Run workflow**
4. Choose branch `main`

---

## 🛡️ Safety & Compliance

- Uses only **public GitHub data**
- Uses official GitHub and X APIs
- Posts original, auto-generated summaries
- Does not copy or redistribute source code
- No aggressive posting or spam behavior

This setup is compliant with GitHub and X platform rules.

---

## 🔁 Reusability

This project can easily be adapted for:
- Other GitHub repositories
- Multiple repositories
- Release-based monitoring instead of commits
- Daily or weekly summaries
- Other social platforms with supported APIs

---

## 📜 License

MIT License

---

## 👤 Author

Built by **SupaTechStack**

Automated monitoring of real developer activity,  
focused on clarity, relevance, and reliability.


