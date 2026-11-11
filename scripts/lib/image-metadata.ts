// Metadata scan of committed images (AGENTS.md: images are stripped of metadata before their first commit). Pure: it
// takes the bytes and returns what is embedded, so the rule is testable without files. A format this module cannot
// read fails closed instead of passing unchecked.
import { extname } from 'node:path';

// PNG chunks that describe pixels or rendering. Anything else (tEXt, zTXt, iTXt, eXIf, tIME, unknown) is metadata.
const PNG_ALLOWED = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'hIST', 'pHYs', 'sPLT', 'cICP', 'mDCv', 'cLLi', 'acTL', 'fcTL', 'fdAT']);
// JPEG: APP0 (JFIF), APP2 (ICC profile) and APP14 (Adobe colour transform) are rendering data; APP1 (EXIF, XMP), APP13 (IPTC/Photoshop), other APPn and COM are metadata.
const JPEG_ALLOWED_APP = new Set([0xe0, 0xe2, 0xee]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type MetadataFinding = string;

function pngMetadata(data: Buffer): MetadataFinding[] {
  const found: MetadataFinding[] = [];
  if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) return ['not a valid PNG signature'];
  let offset = 8;
  while (offset + 8 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('latin1', offset + 4, offset + 8);
    if (!PNG_ALLOWED.has(type)) found.push(`PNG chunk ${type}`);
    if (type === 'IEND') return found;
    offset += 12 + length;
  }
  return [...found, 'PNG ends without IEND'];
}

function jpegMetadata(data: Buffer): MetadataFinding[] {
  const found: MetadataFinding[] = [];
  if (data[0] !== 0xff || data[1] !== 0xd8) return ['not a valid JPEG signature'];
  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) return [...found, 'malformed JPEG marker'];
    const marker = data[offset + 1] ?? 0;
    if (marker === 0xff) { offset += 1; continue; }
    if (marker === 0xda || marker === 0xd9) return found; // start of scan: no metadata segments after it
    if (marker === 0xfe) found.push('JPEG comment (COM)');
    else if (marker >= 0xe0 && marker <= 0xef && !JPEG_ALLOWED_APP.has(marker)) found.push(`JPEG APP${marker - 0xe0} segment (EXIF, XMP or IPTC)`);
    offset += 2 + data.readUInt16BE(offset + 2);
  }
  return found;
}

function webpMetadata(data: Buffer): MetadataFinding[] {
  const found: MetadataFinding[] = [];
  if (data.toString('latin1', 0, 4) !== 'RIFF' || data.toString('latin1', 8, 12) !== 'WEBP') return ['not a valid WebP signature'];
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = data.toString('latin1', offset, offset + 4);
    if (type === 'EXIF' || type === 'XMP ') found.push(`WebP chunk ${type.trim()}`);
    offset += 8 + data.readUInt32LE(offset + 4) + (data.readUInt32LE(offset + 4) % 2);
  }
  return found;
}

function gifMetadata(data: Buffer): MetadataFinding[] {
  // Comment (0xFE) and application (0xFF) extensions carry text and XMP. Scanning the byte patterns after the header is
  // enough for a fail-closed check: a false positive only asks for a re-export.
  const text = data.toString('latin1');
  if (!text.startsWith('GIF8')) return ['not a valid GIF signature'];
  return text.includes('XMP DataXMP') ? ['GIF XMP extension'] : text.includes('\x21\xfe') ? ['GIF comment extension'] : [];
}

function icoMetadata(data: Buffer): MetadataFinding[] {
  // An ICO is a directory of images: BMP entries hold no metadata, PNG entries are scanned like a PNG file.
  if (data.length < 6 || data.readUInt16LE(0) !== 0 || data.readUInt16LE(2) !== 1) return ['not a valid ICO header'];
  const found: MetadataFinding[] = [];
  for (let index = 0; index < data.readUInt16LE(4); index += 1) {
    const entry = 6 + index * 16;
    if (entry + 16 > data.length) return [...found, 'truncated ICO directory'];
    const start = data.readUInt32LE(entry + 12);
    const size = data.readUInt32LE(entry + 8);
    if (start + size > data.length) return [...found, 'ICO entry outside the file'];
    const image = data.subarray(start, start + size);
    if (image.subarray(0, 8).equals(PNG_SIGNATURE)) found.push(...pngMetadata(image).map((finding) => `ICO entry ${index}: ${finding}`));
  }
  return found;
}

function svgMetadata(data: Buffer): MetadataFinding[] {
  const text = data.toString('utf8');
  const found: MetadataFinding[] = [];
  if (/<metadata[\s>]/i.test(text)) found.push('SVG <metadata> element');
  if (/<rdf:RDF|<dc:|<cc:|xmlns:(?:inkscape|sodipodi|xmp|dc|cc|rdf)=/i.test(text)) found.push('SVG editor or RDF namespace');
  if (/<\?xpacket/i.test(text)) found.push('SVG XMP packet');
  return found;
}

const READERS: Record<string, (data: Buffer) => MetadataFinding[]> = {
  '.png': pngMetadata, '.jpg': jpegMetadata, '.jpeg': jpegMetadata, '.webp': webpMetadata, '.gif': gifMetadata, '.ico': icoMetadata, '.svg': svgMetadata,
};
export const IMAGE_EXTENSIONS: readonly string[] = [...Object.keys(READERS), '.avif', '.bmp', '.tif', '.tiff', '.heic'];

export function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.includes(extname(path).toLowerCase());
}

/** Metadata found in an image, or a single "unsupported format" finding when the format cannot be inspected. */
export function imageMetadata(path: string, data: Buffer): MetadataFinding[] {
  const reader = READERS[extname(path).toLowerCase()];
  if (reader === undefined) return [`format ${extname(path)} is not inspected by this check: convert to PNG, JPEG, WebP or SVG, or extend scripts/lib/image-metadata.ts`];
  return reader(data);
}
