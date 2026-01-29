import fs from "fs";

const repo = process.env.GH_REPO;
const token = process.env.X_BEARER_TOKEN;

const state = JSON.parse(fs.readFileSync("state.json", "utf8"));

const res = await fetch(
  `https://api.github.com/repos/${repo}/commits?per_page=1`,
  { headers: { "User-Agent": "chainlink-watcher" } }
);

const [commit] = await res.json();

if (!commit || commit.sha === state.lastSha) {
  console.log("No new commit");
  process.exit(0);
}

const text =
  `🔔 Chainlink update\n` +
  `${commit.commit.message.split("\n")[0]}\n` +
  `${commit.html_url}`;

await fetch("https://api.x.com/2/tweets", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text }),
});

state.lastSha = commit.sha;
fs.writeFileSync("state.json", JSON.stringify(state, null, 2));

