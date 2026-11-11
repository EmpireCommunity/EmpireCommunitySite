// Metadata scan of committed images (AGENTS.md: images are stripped of metadata before their first commit). Pure: it
// takes the bytes and returns what is embedded, so the rule is testable without files. Only the formats the repository
// ships are parsed (PNG, ICO, SVG). Every other image format fails closed: a parser for it must be written, with
// fixtures, in the same PR that commits the first such file.
import { extname } from 'node:path';

// PNG chunks that describe pixels or rendering. Anything else (tEXt, zTXt, iTXt, eXIf, tIME, unknown) is metadata.
const PNG_ALLOWED = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'hIST', 'pHYs', 'sPLT', 'cICP', 'mDCv', 'cLLi', 'acTL', 'fcTL', 'fdAT']);
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

// Metadata is recognised by local name and by namespace URI, never by prefix: `<m:metadata>` and
// `xmlns:anything="http://purl.org/dc/elements/1.1/"` are found whatever the author called the prefix.
const SVG_METADATA_ELEMENT = /<(?:[\w.-]+:)?metadata[\s>/]/i;
const SVG_METADATA_NAMESPACES = [
  'http://purl.org/dc/', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'http://creativecommons.org/ns#', 'http://web.resource.org/cc/',
  'http://www.inkscape.org/namespaces/inkscape', 'http://sodipodi.sourceforge.net/DTD/sodipodi', 'http://ns.adobe.com/', 'http://ns.serif.com/',
];

function svgMetadata(data: Buffer): MetadataFinding[] {
  const text = data.toString('utf8');
  const found: MetadataFinding[] = [];
  if (SVG_METADATA_ELEMENT.test(text)) found.push('SVG metadata element');
  const declared = [...text.matchAll(/\bxmlns(?::[\w.-]+)?\s*=\s*(["'])(.*?)\1/gis)].map((match) => (match[2] ?? '').trim());
  for (const namespace of SVG_METADATA_NAMESPACES) {
    if (declared.some((uri) => uri.toLowerCase().startsWith(namespace.toLowerCase()))) found.push(`SVG metadata namespace ${namespace}`);
  }
  if (/<\?xpacket/i.test(text)) found.push('SVG XMP packet');
  return found;
}

const READERS: Record<string, (data: Buffer) => MetadataFinding[]> = { '.png': pngMetadata, '.ico': icoMetadata, '.svg': svgMetadata };
export const IMAGE_EXTENSIONS: readonly string[] = [...Object.keys(READERS), '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.tif', '.tiff', '.heic'];

export function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.includes(extname(path).toLowerCase());
}

/** Metadata found in an image, or a single "unsupported format" finding when the format cannot be inspected. */
export function imageMetadata(path: string, data: Buffer): MetadataFinding[] {
  const reader = READERS[extname(path).toLowerCase()];
  if (reader === undefined) return [`format ${extname(path)} has no metadata parser: add one (with fixtures) to scripts/lib/image-metadata.ts in the PR that commits the first such file, or use PNG or SVG`];
  return reader(data);
}
