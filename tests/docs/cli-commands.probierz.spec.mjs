import assert from 'node:assert/strict';
import test from 'node:test';

const origin = new URL('https://transcript-lake.wisent.com');
const commands = [
  ['/docs/cli/paths', 'transcript-lake [--data-dir <path>] paths [--json]'],
  ['/docs/cli/sources', 'transcript-lake [--data-dir <path>] sources [--json]'],
  ['/docs/cli/doctor', 'transcript-lake [--data-dir <path>] doctor [--json]'],
  ['/docs/cli/status', 'transcript-lake [--data-dir <path>] status [--json]'],
  ['/docs/cli/stream', 'transcript-lake [--data-dir <path>] stream [--json]'],
  ['/docs/cli/rebuild', 'transcript-lake [--data-dir <path>] rebuild --to <empty-path> [--source <runtime>]'],
  ['/docs/cli/sessions', 'transcript-lake [--data-dir <path>] sessions [--runtime <r>] [--project <text>] [--interrupted] [--limit <n>] [--json]'],
  ['/docs/cli/events', 'transcript-lake [--data-dir <path>] events [--runtime <r>] [--session <id>] [--type <type>] [--limit <n>] [--json]'],
  ['/docs/cli/search', 'transcript-lake [--data-dir <path>] search <text> [--runtime <r>] [--session <id>] [--type <type>] [--limit <n>] [--json]'],
  ['/docs/cli/show', 'transcript-lake [--data-dir <path>] show <session-id> [--include <types>] [--limit <n>] [--json]'],
  ['/docs/cli/stats', 'transcript-lake [--data-dir <path>] stats [--days <n>] [--runtime <r>] [--json]'],
  ['/docs/cli/hooks', 'transcript-lake [--data-dir <path>] hooks [--decision <value>] [--tool <name>] [--limit <n>] [--json]'],
  ['/docs/cli/signals', 'transcript-lake [--data-dir <path>] signals [--report <frustration|overlap|daily|freshness>] [--limit <n>] [--json]'],
  ['/docs/cli/label', 'transcript-lake [--data-dir <path>] label <add|list|aspects> ...'],
  ['/docs/cli/label/add', 'transcript-lake [--data-dir <path>] label add <session-id> --aspect <name> --value <v> [--note <text>] [--runtime <r>] [--source <name[:detail]>] [--json]'],
  ['/docs/cli/label/list', 'transcript-lake [--data-dir <path>] label list [--session <id>] [--aspect <a>] [--runtime <r>] [--limit <n>] [--json]'],
  ['/docs/cli/label/aspects', 'transcript-lake [--data-dir <path>] label aspects [--json]'],
  ['/docs/cli/goal', 'transcript-lake [--data-dir <path>] goal <title|label> ...'],
  ['/docs/cli/goal/title', 'transcript-lake [--data-dir <path>] goal title (--text <text>|--stdin) [--json]'],
  ['/docs/cli/goal/label', 'transcript-lake [--data-dir <path>] goal label <session-id> [--runtime <r>] [--json]'],
  ['/docs/cli/query', 'transcript-lake [--data-dir <path>] query [--json] "<sql>"'],
  ['/docs/cli/compact', 'transcript-lake [--data-dir <path>] compact [--source <runtime>] [--json]'],
  ['/docs/cli/rebuild-oko', 'transcript-lake [--data-dir <path>] rebuild-oko [--reindex]'],
  ['/docs/cli/oko-refresh', 'transcript-lake [--data-dir <path>] oko-refresh'],
  ['/docs/cli/clean', 'transcript-lake [--data-dir <path>] clean [--target <parquet|oko|all>] [--apply] [--json]'],
  ['/docs/cli/help', 'transcript-lake help [command]'],
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

test('production exposes the complete canonical Transcript Lake CLI tree', async (t) => {
  const indexCanonical = new URL('/docs/cli/', origin).href;
  const indexResponse = await fetch(indexCanonical, { redirect: 'follow' });
  assert.equal(indexResponse.status, 200, `${indexCanonical} must return 200`);
  assert.equal(indexResponse.url, indexCanonical, '/docs/cli must resolve to its canonical URL');
  const indexHtml = await indexResponse.text();
  assert.ok(
    indexHtml.includes(`<link rel="canonical" href="${indexCanonical}">`),
    '/docs/cli must declare its canonical URL',
  );
  assert.ok(
    indexHtml.includes(escapeHtml('transcript-lake [--data-dir <path>] <command> [flags]')),
    '/docs/cli must document the root invocation',
  );

  for (const [route, invocation] of commands) {
    await t.test(route, async () => {
      const requestUrl = new URL(route, origin);
      const canonicalUrl = new URL(`${route}/`, origin).href;
      const response = await fetch(requestUrl, { redirect: 'follow' });
      assert.equal(response.status, 200, `${requestUrl.href} must return 200`);
      assert.equal(response.url, canonicalUrl, `${route} must resolve to its canonical URL`);

      const body = await response.text();
      assert.ok(
        body.includes(`<link rel="canonical" href="${canonicalUrl}">`),
        `${route} must declare ${canonicalUrl} as canonical`,
      );
      assert.ok(
        body.includes(escapeHtml(invocation)),
        `${route} must document the exact invocation: ${invocation}`,
      );
      assert.ok(
        indexHtml.includes(`href="${route}/"`),
        `/docs/cli must link ${route}`,
      );
    });
  }
});
