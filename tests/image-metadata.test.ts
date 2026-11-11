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

test('JPEG: EXIF, XMP, IPTC and comments are metadata; JFIF and ICC are not', () => {
  const segment = (marker: number) => Buffer.from([0xff, marker, 0x00, 0x04, 0x00, 0x00]);
  const jpeg = (...markers: number[]) => Buffer.concat([Buffer.from([0xff, 0xd8]), ...markers.map(segment), Buffer.from([0xff, 0xda, 0x00, 0x02])]);
  assert.deepEqual(imageMetadata('a.jpg', jpeg(0xe0, 0xe2)), []);
  assert.equal(imageMetadata('a.jpg', jpeg(0xe0, 0xe1)).length, 1);
  assert.equal(imageMetadata('a.jpeg', jpeg(0xed)).length, 1);
  assert.equal(imageMetadata('a.jpg', jpeg(0xfe)).length, 1);
});

test('WebP EXIF and XMP chunks, and SVG editor metadata, are found', () => {
  const riff = (type: string) => {
    const body = Buffer.concat([Buffer.from('WEBP'), Buffer.from(type, 'latin1'), Buffer.from([2, 0, 0, 0, 0, 0])]);
    return Buffer.concat([Buffer.from('RIFF'), Buffer.from([body.length, 0, 0, 0]), body]);
  };
  assert.deepEqual(imageMetadata('a.webp', riff('VP8 ')), []);
  assert.deepEqual(imageMetadata('a.webp', riff('EXIF')), ['WebP chunk EXIF']);
  assert.deepEqual(imageMetadata('a.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')), []);
  assert.equal(imageMetadata('a.svg', Buffer.from('<svg><metadata><rdf:RDF/></metadata></svg>')).length, 2);
});

test('an ICO scans its embedded PNG entries; an unknown format and a wrong signature fail closed', () => {
  const embedded = png('IDAT', 'tEXt');
  const dir = Buffer.alloc(22);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(1, 4);
  dir.writeUInt32LE(embedded.length, 14);
  dir.writeUInt32LE(22, 18);
  assert.deepEqual(imageMetadata('a.ico', Buffer.concat([dir, embedded])), ['ICO entry 0: PNG chunk tEXt']);
  assert.equal(imageMetadata('a.avif', Buffer.alloc(4)).length, 1);
  assert.equal(imageMetadata('a.png', Buffer.from('not a png')).length, 1);
});
