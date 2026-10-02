#!/usr/bin/env node
// Every command `transcript-lake` dispatches has a page on this site, or
// this refuses. The commands are read from the dispatcher in the Transcript
// Lake checkout (src/main.rs: each `"<name>" =>` arm of `fn dispatch`), the
// pages from the directories under docs/cli, each holding an index.html.
//
//   node tools/check-command-coverage.mjs [--lake-root DIR]
//
// Exit 0 when every command has a page, 1 with the missing ones named, 2 for
// a wrong invocation or an unreadable dispatcher.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
let lakeRoot = resolve(root, "..", "transcript-lake");
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === "--lake-root" && index + 1 < argv.length) {
    index += 1;
    lakeRoot = resolve(argv[index]);
    continue;
  }
  console.error(`check-command-coverage: unknown argument ${argv[index]}`);
  process.exit(2);
}

const dispatcherPath = resolve(lakeRoot, "src/main.rs");
let dispatcher;
try {
  dispatcher = readFileSync(dispatcherPath, "utf8");
} catch (error) {
  console.error(`check-command-coverage: ${dispatcherPath} cannot be read (${error.message}); name the Transcript Lake checkout with --lake-root`);
  process.exit(2);
}
const start = dispatcher.indexOf("fn dispatch(");
if (start < 0) {
  console.error(`check-command-coverage: ${dispatcherPath} has no dispatch function`);
  process.exit(2);
}
const dispatched = new Set();
for (const arm of dispatcher.slice(start).matchAll(/^\s*"([a-z][a-z-]*)" =>/gm)) {
  dispatched.add(arm[1]);
}

const missing = [...dispatched]
  .filter((command) => !existsSync(resolve(root, "docs/cli", command, "index.html")))
  .sort();
if (missing.length) {
  console.error(
    `check-command-coverage: ${missing.length} dispatched command(s) have no page: ${missing.join(", ")}; add docs/cli/<command>/index.html and register it in docs/cli/index.html, sitemap.xml and docs-manifest.json`,
  );
  process.exit(1);
}
console.log(`check-command-coverage: every one of ${dispatched.size} dispatched commands has a page`);
