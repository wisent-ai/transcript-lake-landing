#!/usr/bin/env node
// When the product replaces one or more commands with another, this site has
// to say so everywhere at once: the command pages, the CLI index, the
// documentation home cards, the manifest, the sitemap, the search index and
// every prose mention. This tool does that from the new page, which is
// written first by hand under docs/cli/<slug>/index.html.
//
//   node tools/replace-command-pages.mjs --new <slug> --old <slug> [--old <slug> ...] \
//     [--mention "<old text>=<new text>" ...]
//
//   node tools/replace-command-pages.mjs --refresh
//
// --refresh only updates discovery text (home cards, CLI index, search index)
// from canonical manifest pages. It never retires pages or changes topic counts.
// Missing required page fields refuse the refresh before any index is written.
//
// --old names a page directory under docs/cli to retire; every link to it is
// pointed at the new page and its index, card, manifest, sitemap and search
// entries are replaced by the new page's. --mention rewrites a command as it
// is written in prose and invocations, outside example URLs (`<old text>` is
// matched as a whole word). Exit 0 when the site was rewritten, 1 when the
// new page is missing or an old page does not exist, 2 for a wrong invocation.

import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refresh } from "./refresh-page-indexes.mjs";

const decode = (text) => text
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
  .replace(/&#(x[\da-f]+|\d+);/gi, (_entity, code) => String.fromCodePoint(Number(code.replace(/^x/i, "0x"))))
  .replace(/&amp;/g, "&");
const encode = (text) => text
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
if (argv.join(" ") === "--refresh") {
  refresh(root, { decode, encode, escape });
  process.exit();
}
let newSlug = null;
const oldSlugs = [];
const mentions = [];
for (let index = 0; index < argv.length; index += 1) {
  const word = argv[index];
  const value = argv[index + 1];
  if (word === "--new" && value !== undefined) {
    newSlug = value;
    index += 1;
  } else if (word === "--old" && value !== undefined) {
    oldSlugs.push(value);
    index += 1;
  } else if (word === "--mention" && value !== undefined) {
    const separator = value.indexOf("=");
    if (separator <= 0) {
      console.error(`replace-command-pages: --mention takes "<old text>=<new text>", got ${value}`);
      process.exit(2);
    }
    mentions.push([value.slice(0, separator), value.slice(separator + 1)]);
    index += 1;
  } else {
    console.error(`replace-command-pages: unknown argument ${word}`);
    process.exit(2);
  }
}
if (!newSlug || oldSlugs.length === 0) {
  console.error("replace-command-pages: --new <slug> and at least one --old <slug> are required");
  process.exit(2);
}

const pagePath = (slug) => join(root, "docs", "cli", slug, "index.html");
if (!existsSync(pagePath(newSlug))) {
  console.error(`replace-command-pages: write the new page first: ${relative(root, pagePath(newSlug))}`);
  process.exit(1);
}
for (const slug of oldSlugs) {
  if (!existsSync(pagePath(slug))) {
    console.error(`replace-command-pages: no page to retire at ${relative(root, pagePath(slug))}`);
    process.exit(1);
  }
}

// --- what the new page says about itself --------------------------------------

const newPage = readFileSync(pagePath(newSlug), "utf8");
const title = decode(newPage.match(/<h1>([^<]*)<\/h1>/)[1]);
const summary = decode(newPage.match(/<meta name="description" content="([^"]*)">/)[1]);
const invocation = decode(newPage.match(/<pre><code>([^<]*)<\/code><\/pre>/)[1]);
const article = newPage.slice(newPage.indexOf("<article"), newPage.indexOf("</article>"));
const text = decode(article.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const newUrl = `/docs/cli/${newSlug}/`;
const site = "https://transcript-lake.wisent.com";

// --- every page: links and mentions -------------------------------------------

const pages = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (entry === "index.html") pages.push(path);
  }
};
walk(join(root, "docs"));
pages.push(join(root, "index.html"));

const rewriteText = (content) => {
  let out = content;
  for (const slug of oldSlugs) {
    out = out.split(`/docs/cli/${slug}/`).join(newUrl);
  }
  for (const [from, to] of mentions) {
    // Not inside an example URL, which may carry the old name as its path.
    out = out.replace(new RegExp(`(?<!\\/examples\\/[^"\\s<]*)(?<![\\w-])${escape(from)}(?![\\w-])`, "g"), to);
  }
  return out;
};

const listItem = `<li><a href="${newUrl}"><code>${encode(newSlug)}</code></a><span>${encode(summary)}</span><small>${encode(invocation)}</small></li>`;
const card = `<a class="doc-card" href="${newUrl}" data-doc-title="${encode(title)}" data-doc-summary="${encode(summary)}"><span>CLI</span><h3>${encode(title)}</h3><p>${encode(summary)}</p><b aria-hidden="true">→</b></a>`;
const dedupe = (content, pattern, replacement) => {
  // The first element pointing at the new page becomes the new page's own;
  // the later ones (the retired pages' entries, now pointing the same way) go.
  let seen = false;
  return content.replace(pattern, (match) => {
    if (seen) return "";
    seen = true;
    return replacement;
  });
};

const retiredCount = oldSlugs.length - 1;
for (const path of pages) {
  const before = readFileSync(path, "utf8");
  let after = rewriteText(before);
  // Pagination labels name the page's slug, whatever its invocation says.
  for (const [, to] of mentions) {
    after = after.split(`<span>← ${to}</span>`).join(`<span>← ${newSlug}</span>`);
    after = after.split(`<span>${to} →</span>`).join(`<span>${newSlug} →</span>`);
  }
  if (path === join(root, "docs", "cli", "index.html")) {
    after = dedupe(after, new RegExp(`<li><a href="${escape(newUrl)}">[\\s\\S]*?<\\/li>`, "g"), listItem);
  }
  if (path === join(root, "docs", "index.html")) {
    after = dedupe(after, new RegExp(`<a class="doc-card" href="${escape(newUrl)}"[\\s\\S]*?<\\/a>`, "g"), card);
    // The group that holds the CLI cards counts its topics in its heading.
    after = after.replace(/(<h2>Operate<\/h2><span>)(\d+)( topics<\/span>)/, (_, open, count, close) => `${open}${Number(count) - retiredCount}${close}`);
  }
  if (after !== before) writeFileSync(path, after, "utf8");
}

// --- manifest, sitemap, search index ------------------------------------------

// The manifest keeps its own layout (one-line groups, multi-line topics), so
// the retired topics are replaced as text rather than re-serialized.
const manifestPath = join(root, "docs-manifest.json");
let manifest = readFileSync(manifestPath, "utf8");
const topic = (slug) => `    {\n      "source": "docs/cli/${slug}/index.html",\n      "url": "${site}/docs/cli/${slug}/"\n    },\n`;
let topicsRetired = 0;
for (const [index, slug] of oldSlugs.entries()) {
  if (!manifest.includes(topic(slug))) {
    console.error(`replace-command-pages: docs-manifest.json has no topic for docs/cli/${slug}/index.html as this tool writes one`);
    process.exit(1);
  }
  manifest = manifest.replace(topic(slug), index === 0 ? topic(newSlug) : "");
  topicsRetired += 1;
}
manifest = manifest.replace(/"topic_count": (\d+)/, (_, count) => `"topic_count": ${Number(count) - topicsRetired + 1}`);
writeFileSync(manifestPath, manifest, "utf8");

const sitemapPath = join(root, "sitemap.xml");
const retiredLocs = oldSlugs.map((slug) => `  <url><loc>${site}/docs/cli/${slug}/</loc></url>\n`);
let sitemap = readFileSync(sitemapPath, "utf8");
sitemap = sitemap.replace(retiredLocs[0], `  <url><loc>${site}${newUrl}</loc></url>\n`);
for (const loc of retiredLocs.slice(1)) sitemap = sitemap.replace(loc, "");
writeFileSync(sitemapPath, sitemap, "utf8");

const searchPath = join(root, "search-index.json");
const search = JSON.parse(readFileSync(searchPath, "utf8"));
const retiredUrls = new Set(oldSlugs.map((slug) => `/docs/cli/${slug}/`));
let searched = false;
const rewritten = search.flatMap((entry) => {
  if (!retiredUrls.has(entry.url)) {
    return [{ ...entry, title: rewriteText(entry.title), summary: rewriteText(entry.summary), text: rewriteText(entry.text) }];
  }
  if (searched) return [];
  searched = true;
  return [{ title, summary, url: newUrl, text }];
});
writeFileSync(searchPath, JSON.stringify(rewritten), "utf8");

// --- the retired pages ----------------------------------------------------------

for (const slug of oldSlugs) rmSync(join(root, "docs", "cli", slug), { recursive: true });
console.log(`replace-command-pages: ${oldSlugs.join(", ")} retired; ${newUrl} is the page, ${pages.length} pages, the manifest, the sitemap and the search index rewritten`);
