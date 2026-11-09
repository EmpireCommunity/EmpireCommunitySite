import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { headingIds, legalIssues, type LegalDoc } from '../src/lib/legal-rules.ts';
import { assertSingleFounder } from '../src/lib/team-rules.ts';
import { parseEntryList, parseSingleDocument } from '../src/lib/yaml-entries.ts';

describe('YAML data files fail loudly', () => {
  test('a valid list parses; an empty file is an empty list', () => {
    assert.deepEqual(parseEntryList('- id: a\n- id: b\n', 'x.yaml').map((e) => e.id), ['a', 'b']);
    assert.deepEqual(parseEntryList('[]', 'x.yaml'), []);
    assert.deepEqual(parseEntryList('', 'x.yaml'), []);
  });

  const rejected: [string, string][] = [
    ['duplicate id', '- id: a\n- id: a\n'],
    ['malformed YAML', '- id: a\n  bad: [unclosed\n'],
    ['duplicate key in a mapping', '- id: a\n  id: b\n'],
    ['not a list', 'id: a\n'],
    ['entry without id', '- name: x\n'],
    ['non-string id', '- id: 7\n'],
  ];
  for (const [name, text] of rejected) {
    test(`rejects ${name}`, () => assert.throws(() => parseEntryList(text, 'x.yaml')));
  }

  test('the duplicate-id message names the file and the id', () => {
    assert.throws(() => parseEntryList('- id: a\n- id: a\n', 'src/data/projects.yaml'), /projects\.yaml: duplicate id "a"/);
  });

  test('a single document needs a mapping and gets the fixed id', () => {
    assert.deepEqual(parseSingleDocument('a: 1', 'x.yaml', 'site'), [{ a: 1, id: 'site' }]);
    assert.throws(() => parseSingleDocument('- a', 'x.yaml', 'site'));
    assert.throws(() => parseSingleDocument('', 'x.yaml', 'site'));
  });
});

describe('team founder uniqueness (site-data section 9)', () => {
  test('zero or one founder passes, two fail', () => {
    assert.doesNotThrow(() => assertSingleFounder([]));
    assert.doesNotThrow(() => assertSingleFounder([{ isFounder: true }, { isFounder: false }, {}]));
    assert.throws(() => assertSingleFounder([{ isFounder: true }, { isFounder: true }]), /at most one/);
  });
});

describe('legal pages (site-data section 11)', () => {
  const doc = (locale: string, slug: string, over: Partial<LegalDoc> = {}): LegalDoc => ({
    filePath: `src/content/legal/${locale}/${slug}.md`,
    locale,
    slug,
    version: '1.0',
    effectiveDate: '2026-12-01',
    body: '## Controller {#controller}\n\ntext\n\n## Contact {#contact}\n',
    ...over,
  });
  const complete = (): LegalDoc[] =>
    ['terms-of-service', 'privacy-policy'].flatMap((slug) => [doc('pt-br', slug), doc('en-us', slug)]);

  test('nothing authored yet is allowed; a complete matching set passes', () => {
    assert.deepEqual(legalIssues([]), []);
    assert.deepEqual(legalIssues(complete()), []);
  });

  const broken: [string, (docs: LegalDoc[]) => LegalDoc[], RegExp][] = [
    ['a missing translation', (docs) => docs.filter((d) => d.filePath !== 'src/content/legal/en-us/privacy-policy.md'), /en-us\/privacy-policy\.md is missing/],
    ['version drift', (docs) => docs.map((d) => (d.filePath.includes('en-us/terms') ? { ...d, version: '1.1' } : d)), /version differs/],
    ['effective date drift', (docs) => docs.map((d) => (d.filePath.includes('en-us/terms') ? { ...d, effectiveDate: '2026-12-02' } : d)), /effectiveDate differs/],
    ['heading ids that differ', (docs) => docs.map((d) => (d.filePath.includes('en-us/terms') ? { ...d, body: '## Contact {#contact}\n## Controller {#controller}\n' } : d)), /heading ids differ/],
    ['a locale that disagrees with the folder', (docs) => docs.map((d) => (d.filePath.includes('en-us/terms') ? { ...d, locale: 'pt-br' } : d)), /must equal the folder/],
    ['a slug that disagrees with the file name', (docs) => docs.map((d) => (d.filePath.includes('en-us/terms') ? { ...d, slug: 'privacy-policy' } : d)), /must equal the file name/],
    ['a heading without an id', (docs) => docs.map((d) => (d.filePath.includes('pt-br/terms') ? { ...d, body: '## Sem id\n' } : d)), /explicit id/],
  ];
  for (const [name, mutate, message] of broken) {
    test(`flags ${name}`, () => assert.match(legalIssues(mutate(complete())).join('\n'), message));
  }

  test('headings inside code fences are ignored', () => {
    assert.deepEqual(headingIds('## A {#a}\n```\n# comment\n```\n'), ['a']);
  });
});
