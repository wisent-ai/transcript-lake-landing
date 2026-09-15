"""Build the search index from the canonical HTML pages in docs-manifest.json."""

import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


class Article(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonical = None
        self.summary = None
        self.title = []
        self.text = []
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

    def handle_endtag(self, tag):
        if self.in_article and tag in {"nav", "script", "style"}:
            self.excluded -= 1
        if tag == "h1":
            self.in_title = False
        if tag == "article":
            self.in_article = False

    def handle_data(self, data):
        if self.in_article and not self.excluded:
            self.text.append(data)
            if self.in_title:
                self.title.append(data)


def build_index():
    manifest = json.loads((ROOT / "docs-manifest.json").read_text())
    entries = []
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
        entries.append({
            "title": title,
            "summary": article.summary,
            "url": urlsplit(topic["url"]).path,
            "text": text,
        })
    return json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="refuse a stale search index")
    arguments = parser.parse_args()
    destination = ROOT / "search-index.json"
    try:
        expected = build_index()
        if arguments.check:
            if not destination.exists() or destination.read_text() != expected:
                raise ValueError("search-index.json is stale; run python3 scripts/build_search_index.py")
        else:
            destination.write_text(expected)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"documentation index: {error}\n")
    print("search-index.json matches the canonical documentation")


if __name__ == "__main__":
    main()
