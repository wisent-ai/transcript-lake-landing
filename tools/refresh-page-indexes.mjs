// Rebuild discovery text from canonical manifest pages; never create or delete topics.
// Encoding and regex helpers come from the existing command-page generator.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function required(html, pattern, field, source) {
  const match = pattern.exec(html);
  if (!match?.groups?.value) throw new Error(`${source}: missing ${field}; no indexes were written`);
  return match.groups.value;
}

export function refresh(root, { decode, encode, escape }) {
  const plain = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const manifest = JSON.parse(readFileSync(join(root, "docs-manifest.json"), "utf8"));
  let home = readFileSync(join(root, "docs/index.html"), "utf8");
  let cli = readFileSync(join(root, "docs/cli/index.html"), "utf8");
  const search = [];
  for (const topic of manifest.topics) {
    const html = readFileSync(join(root, topic.source), "utf8");
    const title = plain(required(html, /<h1[^>]*>(?<value>[\s\S]*?)<\/h1>/, "h1", topic.source));
    const summary = decode(required(html, /<meta name="description" content="(?<value>[^"]*)"/, "description", topic.source));
    const article = required(html, /<article\b[^>]*>(?<value>[\s\S]*?)<\/article>/, "article", topic.source);
    const url = new URL(topic.url).pathname;
    search.push({ title, summary, url, text: plain(article) });
    const card = new RegExp(`<a class="doc-card" href="${escape(url)}"[^>]*>[\\s\\S]*?<\\/a>`, "g");
    home = home.replace(card, (old) => old
      .replace(/data-doc-title="[^"]*"/, () => `data-doc-title="${encode(title)}"`)
      .replace(/data-doc-summary="[^"]*"/, () => `data-doc-summary="${encode(summary)}"`)
      .replace(/<h3>[\s\S]*?<\/h3>/, () => `<h3>${encode(title)}</h3>`)
      .replace(/<p>[\s\S]*?<\/p>/, () => `<p>${encode(summary)}</p>`));
    if (url.startsWith("/docs/cli/") && url !== "/docs/cli/") {
      const invocation = plain(required(html, /<pre><code>(?<value>[\s\S]*?)<\/code><\/pre>/, "command invocation", topic.source));
      const item = new RegExp(`<li><a href="${escape(url)}">[\\s\\S]*?<\\/li>`, "g");
      cli = cli.replace(item, (old) => old
        .replace(/<span>[\s\S]*?<\/span>/, () => `<span>${encode(summary)}</span>`)
        .replace(/<small>[\s\S]*?<\/small>/, () => `<small>${encode(invocation)}</small>`));
    }
  }
  const cliEntry = search.find((entry) => entry.url === "/docs/cli/");
  if (!cliEntry) throw new Error("docs-manifest.json: missing CLI index topic; no indexes were written");
  cliEntry.text = plain(required(cli, /<article\b[^>]*>(?<value>[\s\S]*?)<\/article>/, "article", "docs/cli/index.html"));
  writeFileSync(join(root, "docs/index.html"), home);
  writeFileSync(join(root, "docs/cli/index.html"), cli);
  writeFileSync(join(root, "search-index.json"), JSON.stringify(search));
  console.log(`Refreshed discovery text for ${search.length} canonical topics; no source pages were removed.`);
}
