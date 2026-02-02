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
  console.error("Missing GH_REPO");
  process.exit(1);
}
if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
  console.error("Missing X OAuth secrets");
  process.exit(1);
}

function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(/[!*()']/g, c => `%${c.charCodeAt(0).toString(16)}`);
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

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync("state.json", "utf8"));
    return {
      lastReleaseId: Number(s?.lastReleaseId || 0),
      lastPrMergedAt: String(s?.lastPrMergedAt || "")
    };
  } catch {
    return { lastReleaseId: 0, lastPrMergedAt: "" };
  }
}

function writeState(state) {
  fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
}

function cleanLine(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function cleanSummary(input, maxLen = 120) {
  let s = String(input || "").trim();
  s = s.split("\n")[0].trim();
  s = s.replace(/^(feat|fix|chore|refactor|docs|test|perf|build|ci|style|revert)(\([^)]+\))?\s*:\s*/i, "");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) s = "New update";
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + "…";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

function extractHighlightsFromReleaseBody(body, maxItems = 2) {
  const text = String(body || "");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const picks = [];
  const preferred = lines.filter(l =>
    /^[-*]\s+/.test(l) &&
    /(added|add|support|ccip|lane|onramp|offramp|ramp|token|router|ocr|chain|l2|mainnet|release)/i.test(l)
  );
  const fallback = lines.filter(l => /^[-*]\s+/.test(l));
  const source = preferred.length ? preferred : fallback;

  for (const l of source) {
    const cleaned = cleanLine(l.replace(/^[-*]\s+/, ""));
    if (!cleaned) continue;
    if (picks.includes(cleaned)) continue;
    picks.push(cleaned);
    if (picks.length >= maxItems) break;
  }
  return picks;
}

function buildTweet({ header, lines, link }, maxLen = 275) {
  const parts = [header.trim()];
  if (lines && lines.length) {
    parts.push("", ...lines.map(x => cleanLine(x)));
  }
  if (link) {
    parts.push("", `🔗 ${link}`);
  }
  let text = parts.join("\n").trim();
  if (text.length <= maxLen) return text;

  const safeLines = [];
  let base = `${header.trim()}\n\n`;
  for (const l of (lines || [])) {
    const candidate = (safeLines.length ? safeLines.join("\n") + "\n" : "") + l;
    const candidateText = (base + candidate + `\n\n🔗 ${link}`).trim();
    if (candidateText.length <= maxLen) {
      safeLines.push(l);
    } else {
      break;
    }
  }
  if (!safeLines.length && lines && lines.length) {
    const single = cleanLine(lines[0]);
    const room = maxLen - (base.length + (`\n\n🔗 ${link}`).length) - 1;
    const truncated = single.length > room ? single.slice(0, Math.max(0, room - 1)).trimEnd() + "…" : single;
    safeLines.push(truncated);
  }
  text = buildTweet({ header, lines: safeLines, link }, maxLen);
  return text;
}

async function ghFetch(path) {
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}${path}`, {
    headers: {
      "User-Agent": "chainlink-watcher",
      "Accept": "application/vnd.github+json"
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}

function isInterestingPR(pr) {
  const title = String(pr?.title || "");
  const labelNames = (pr?.labels || []).map(l => String(l?.name || "").toLowerCase());
  const hay = `${title} ${labelNames.join(" ")}`.toLowerCase();

  const keywords = [
    "ccip", "lane", "onramp", "offramp", "ramp", "router", "token pool", "ocr",
    "support", "integrate", "mainnet", "release", "zksync", "zk", "aptos", "solana",
    "arbitrum", "optimism", "base", "polygon", "avalanche"
  ];

  const labelHints = ["area/ccip", "ccip", "enhancement", "feature", "breaking", "release"];

  const kwHit = keywords.some(k => hay.includes(k));
  const labelHit = labelHints.some(l => labelNames.includes(l));
  return kwHit || labelHit;
}

async function postTweet(text) {
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
}

const state = readState();

let tweeted = false;

const releases = await ghFetch("/releases?per_page=1");
const latestRelease = Array.isArray(releases) ? releases[0] : null;

if (latestRelease && Number(latestRelease.id) && Number(latestRelease.id) !== Number(state.lastReleaseId)) {
  const tag = cleanLine(latestRelease.tag_name || latestRelease.name || "New release");
  const highlights = extractHighlightsFromReleaseBody(latestRelease.body, 2);
  const header = `🚀 Chainlink release: ${tag}`;
  const lines = highlights.length ? highlights.map(h => `• ${h}`) : [cleanSummary(latestRelease.name || "New release", 140)];
  const link = latestRelease.html_url;

  const text = buildTweet({ header, lines, link });
  await postTweet(text);

  state.lastReleaseId = Number(latestRelease.id);
  if (latestRelease.published_at) {
    const t = new Date(latestRelease.published_at).toISOString();
    if (!state.lastPrMergedAt) state.lastPrMergedAt = t;
  }

  writeState(state);
  tweeted = true;
}

if (!tweeted) {
  const prs = await ghFetch("/pulls?state=closed&sort=updated&direction=desc&per_page=20");
  const lastTs = state.lastPrMergedAt ? Date.parse(state.lastPrMergedAt) : 0;

  const merged = (Array.isArray(prs) ? prs : [])
    .filter(pr => pr && pr.merged_at)
    .map(pr => ({ pr, t: Date.parse(pr.merged_at) }))
    .filter(x => Number.isFinite(x.t) && x.t > lastTs)
    .sort((a, b) => b.t - a.t);

  const interesting = merged.filter(x => isInterestingPR(x.pr));

  if (!merged.length) {
    console.log("No new merged PRs");
    process.exit(0);
  }

  const newestMergedAt = new Date(merged[0].t).toISOString();

  if (!interesting.length) {
    state.lastPrMergedAt = newestMergedAt;
    writeState(state);
    console.log("New PR merges but none matched filters");
    process.exit(0);
  }

  if (interesting.length === 1) {
    const pr = interesting[0].pr;
    const title = cleanSummary(pr.title, 140);
    const header = "🧠 Chainlink dev signal (merged)";
    const lines = [`• ${title}`];
    const link = pr.html_url;

    const text = buildTweet({ header, lines, link });
    await postTweet(text);

    state.lastPrMergedAt = newestMergedAt;
    writeState(state);
    process.exit(0);
  }

  const top = interesting.slice(0, 3).map(x => `• ${cleanSummary(x.pr.title, 120)}`);
  const header = `🧠 Chainlink dev signals (merged): ${interesting.length}`;
  const link = "https://github.com/smartcontractkit/chainlink/pulls?q=is%3Apr+is%3Amerged+sort%3Aupdated-desc";

  const text = buildTweet({ header, lines: top, link });
  await postTweet(text);

  state.lastPrMergedAt = newestMergedAt;
  writeState(state);
}
