import fs from "fs";
import crypto from "crypto";

const {
  GH_REPO,
  X_API_KEY,
  X_API_SECRET,
  X_ACCESS_TOKEN,
  X_ACCESS_SECRET
} = process.env;

if (!GH_REPO) {
  console.error("❌ Missing GH_REPO");
  process.exit(1);
}
if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
  console.error("❌ Missing X OAuth secrets (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)");
  process.exit(1);
}

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*()']/g, c => `%${c.charCodeAt(0).toString(16)}`);
}

function oauthHeader(method, url) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: "1.0"
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString)
  ].join("&");

  const signingKey = `${percentEncode(X_API_SECRET)}&${percentEncode(X_ACCESS_SECRET)}`;

  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const headerParams = { ...oauthParams, oauth_signature: signature };

  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map(k => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
      .join(", ")
  );
}

/* ---------- state ---------- */
let state = { lastSha: "" };
try {
  state = JSON.parse(fs.readFileSync("state.json", "utf8"));
} catch {}

/* ---------- github latest commit ---------- */
const ghRes = await fetch(
  `https://api.github.com/repos/${GH_REPO}/commits?per_page=1`,
  { headers: { "User-Agent": "chainlink-watcher" } }
);

if (!ghRes.ok) {
  console.error("❌ GitHub API error", ghRes.status, await ghRes.text());
  process.exit(1);
}

const [commit] = await ghRes.json();

if (!commit || commit.sha === state.lastSha) {
  console.log("No new commit");
  process.exit(0);
}

/* ---------- tweet ---------- */
const text =
  `🔔 Chainlink update\n` +
  `${commit.commit.message.split("\n")[0]}\n` +
  `${commit.html_url}`;

const url = "https://api.x.com/2/tweets";
const auth = oauthHeader("POST", url);

const xRes = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: auth,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ text })
});

const xBody = await xRes.text();
console.log("X status:", xRes.status);
console.log(xBody);

if (!xRes.ok) {
  throw new Error("Tweet failed");
}

/* ---------- save ---------- */
state.lastSha = commit.sha;
fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
