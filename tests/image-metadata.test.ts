import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageMetadata } from '../scripts/lib/image-metadata.ts';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const chunk = (type: string, body = Buffer.alloc(0)) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body, Buffer.alloc(4)]);
};
const png = (...types: string[]) => Buffer.concat([SIGNATURE, chunk('IHDR', Buffer.alloc(13)), ...types.map((t) => chunk(t, Buffer.from('xx'))), chunk('IEND')]);

test('a PNG with only rendering chunks is clean; text, EXIF and time chunks are metadata', () => {
  assert.deepEqual(imageMetadata('a.png', png('IDAT', 'sRGB', 'pHYs')), []);
  for (const type of ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'prVt']) {
    assert.deepEqual(imageMetadata('a.png', png('IDAT', type)), [`PNG chunk ${type}`], type);
  }
});

test('formats without a parser (JPEG, GIF, WebP, AVIF) are rejected outright, whatever their content', () => {
  for (const name of ['a.jpg', 'a.jpeg', 'a.gif', 'a.webp', 'a.avif']) {
    const findings = imageMetadata(name, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    assert.equal(findings.length, 1, name);
    assert.match(findings[0] ?? '', /no metadata parser/);
  }
});

test('SVG metadata is found by local name and by namespace URI, whatever the prefix', () => {
  const svg = (body: string, attrs = '') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"${attrs}>${body}</svg>`);
  assert.deepEqual(imageMetadata('a.svg', svg('<path d="M0 0"/>')), []);
  assert.deepEqual(imageMetadata('a.svg', svg('<metadata/>')), ['SVG metadata element']);
  assert.deepEqual(imageMetadata('a.svg', svg('<x:metadata><x:a/></x:metadata>', ' xmlns:x="urn:other"')), ['SVG metadata element']);
  assert.deepEqual(imageMetadata('a.svg', svg('', ' xmlns:zz="http://purl.org/dc/elements/1.1/"')), ['SVG metadata namespace http://purl.org/dc/']);
  assert.deepEqual(imageMetadata('a.svg', svg('', " xmlns:q='http://www.inkscape.org/namespaces/inkscape'")), ['SVG metadata namespace http://www.inkscape.org/namespaces/inkscape']);
  assert.deepEqual(imageMetadata('a.svg', svg('', ' xmlns:r="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')), ['SVG metadata namespace http://www.w3.org/1999/02/22-rdf-syntax-ns#']);
});

test('an ICO scans its embedded PNG entries; an unknown format and a wrong signature fail closed', () => {
  const embedded = png('IDAT', 'tEXt');
  const dir = Buffer.alloc(22);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(1, 4);
  dir.writeUInt32LE(embedded.length, 14);
  dir.writeUInt32LE(22, 18);
  assert.deepEqual(imageMetadata('a.ico', Buffer.concat([dir, embedded])), ['ICO entry 0: PNG chunk tEXt']);
  assert.equal(imageMetadata('a.png', Buffer.from('not a png')).length, 1);
});

test('SVG namespace values hidden by XML references are still found (fail closed)', () => {
  const svg = (attrs: string, head = '') => Buffer.from(`${head}<svg xmlns="http://www.w3.org/2000/svg"${attrs}></svg>`);
  const cases: Array<[string, Buffer, string[]]> = [
    ['decimal reference', svg(' xmlns:d="http://purl.org/d&#99;/elements/1.1/"'), ['SVG metadata namespace http://purl.org/dc/']],
    ['hex reference', svg(' xmlns:d="http://purl.org/d&#x63;/elements/1.1/"'), ['SVG metadata namespace http://purl.org/dc/']],
    ['undecodable value', svg(' xmlns:d="http://purl.org/&unknown;/"'), ['SVG namespace value cannot be decoded']],
    ['DOCTYPE with entity', svg(' xmlns:d="&dc;"', '<!DOCTYPE svg [<!ENTITY dc "http://purl.org/dc/">]>'), ['SVG DOCTYPE or ENTITY declaration', 'SVG namespace value cannot be decoded']],
  ];
  for (const [name, data, expected] of cases) assert.deepEqual(imageMetadata('a.svg', data), expected, name);
});
