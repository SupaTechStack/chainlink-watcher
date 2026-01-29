import fs from "fs";

const repo = process.env.GH_REPO;
const token = process.env.X_BEARER_TOKEN;

if (!repo) {
  console.error("Missing env GH_REPO");
  process.exit(1);
}
if (!token) {
  console.error("Missing env X_BEARER_TOKEN (check GitHub Secret name!)");
  process.exit(1);
}

console.log("Repo:", repo);
console.log("Has X token:", Boolean(token));

let state = { lastSha: "" };
try {
  state = JSON.parse(fs.readFileSync("state.json", "utf8"));
} catch (e) {
  console.log("state.json missing/invalid, creating new.");
}

const res = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
  headers: {
    "User-Agent": "chainlink-watcher",
    "Accept": "application/vnd.github+json"
  }
});

if (!res.ok) {
  const t = await res.text();
  console.error("GitHub API error:", res.status, t);
  process.exit(1);
}

const [commit] = await res.json();

if (!commit?.sha) {
  console.log("No commit found");
  process.exit(0);
}

if (commit.sha === state.lastSha) {
  console.log("No new commit");
  process.exit(0);
}

const text =
  `🔔 Chainlink update\n` +
  `${commit.commit.message.split("\n")[0]}\n` +
  `${commit.html_url}`;

console.log("Tweet text:", text);

const tweetRes = await fetch("https://api.x.com/2/tweets", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ text })
});

const tweetBody = await tweetRes.text();
console.log("X status:", tweetRes.status);
console.log("X response:", tweetBody);

if (!tweetRes.ok) {
  throw new Error(`X API failed: ${tweetRes.status} ${tweetBody}`);
}

state.lastSha = commit.sha;
fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
console.log("Updated state.json lastSha:", state.lastSha);
