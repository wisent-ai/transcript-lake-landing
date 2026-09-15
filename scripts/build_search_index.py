"""Build search and home cards from the canonical HTML documentation."""

import argparse
import json
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
GROUPS = ("Start here", "Understand", "Concepts", "Operate", "Examples")
CARDS_START = "<!-- canonical-documentation-cards:start -->"
CARDS_END = "<!-- canonical-documentation-cards:end -->"


class Article(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonical = None
        self.summary = None
        self.title = []
        self.text = []
        self.category = []
        self.in_category = False
        self.in_article = False
        self.in_title = False
        self.excluded = 0

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")
        if tag == "meta" and attrs.get("name") == "description":
            self.summary = attrs.get("content")
        if tag == "article":
            self.in_article = True
        if self.in_article and tag in {"nav", "script", "style"}:
            self.excluded += 1
        if self.in_article and tag == "h1":
            self.in_title = True
        if self.in_article and tag == "p" and attrs.get("class") == "eyebrow":
            self.in_category = True

    def handle_endtag(self, tag):
        if self.in_article and tag in {"nav", "script", "style"}:
            self.excluded -= 1
        if tag == "p":
            self.in_category = False
        if tag == "h1":
            self.in_title = False
        if tag == "article":
            self.in_article = False

    def handle_data(self, data):
        if self.in_article and not self.excluded:
            self.text.append(data)
            if self.in_title:
                self.title.append(data)
            if self.in_category:
                self.category.append(data)


def build_index():
    manifest = json.loads((ROOT / "docs-manifest.json").read_text())
    entries = []
    groups = {name: [] for name in GROUPS}
    for topic in manifest["topics"]:
        source = (ROOT / topic["source"]).resolve()
        if not source.is_relative_to(ROOT):
            raise ValueError(f"{topic['source']}: source leaves the website checkout")
        article = Article()
        article.feed(source.read_text())
        article.close()
        if article.canonical != topic["url"]:
            raise ValueError(
                f"{topic['source']}: canonical URL {article.canonical!r} "
                f"does not match {topic['url']!r}"
            )
        title = " ".join(" ".join(article.title).split())
        text = " ".join(" ".join(article.text).split())
        if not title or not article.summary or not text:
            raise ValueError(f"{topic['source']}: missing article, title, or description")
        category = " ".join(article.category).split(" / ")[-1].strip()
        group = "Operate" if category == "CLI" else category
        if group not in groups:
            raise ValueError(f"{topic['source']}: unknown documentation category {category!r}")
        entry = {
            "title": title,
            "summary": article.summary,
            "url": urlsplit(topic["url"]).path,
            "text": text,
        }
        entries.append(entry)
        groups[group].append((category, entry))
    return entries, groups


def home_cards(groups):
    sections = []
    for name, entries in groups.items():
        cards = []
        for category, entry in entries:
            title, summary, url = (escape(entry[key], quote=True)
                                   for key in ("title", "summary", "url"))
            cards.append(
                f'<a class="doc-card" href="{url}" data-doc-title="{title}" '
                f'data-doc-summary="{summary}"><span>{escape(category)}</span>'
                f'<h3>{title}</h3><p>{summary}</p><b aria-hidden="true">→</b></a>'
            )
        sections.append(
            '<section class="docs-card-group"><div class="group-title">'
            f'<h2>{escape(name)}</h2><span>{len(entries):02d} topics</span></div>'
            f'<div class="docs-card-grid">{"".join(cards)}</div></section>'
        )
    path = ROOT / "docs/index.html"
    current = path.read_text()
    if current.count(CARDS_START) != 1 or current.count(CARDS_END) != 1:
        raise ValueError("docs/index.html must declare exactly one generated card region")
    before, _, remainder = current.partition(CARDS_START)
    _, _, after = remainder.partition(CARDS_END)
    return before + CARDS_START + "\n" + "\n".join(sections) + "\n" + CARDS_END + after


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="refuse stale search or home cards")
    arguments = parser.parse_args()
    try:
        entries, groups = build_index()
        outputs = {
            ROOT / "search-index.json":
                json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n",
            ROOT / "docs/index.html": home_cards(groups),
        }
        for destination, expected in outputs.items():
            if arguments.check:
                if not destination.exists() or destination.read_text() != expected:
                    raise ValueError(
                        f"{destination.relative_to(ROOT)} is stale; "
                        "run python3 scripts/build_search_index.py"
                    )
            else:
                destination.write_text(expected)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"documentation index: {error}\n")
    print(f"Search and home cards match all {len(entries)} canonical documentation pages")


if __name__ == "__main__":
    main()
