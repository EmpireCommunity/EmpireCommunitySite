// Fails when a committed image under public/ or src/assets carries metadata (EXIF, XMP, IPTC, PNG text chunks).
// Usage: node scripts/check-image-metadata.ts [dir...]   (default: public src/assets)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { imageMetadata, isImageFile } from './lib/image-metadata.ts';

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

const roots = process.argv.length > 2 ? process.argv.slice(2) : ['public', 'src/assets'];
let checked = 0;
let problems = 0;
for (const root of roots) {
  for (const path of walk(root)) {
    if (!isImageFile(path)) continue;
    checked += 1;
    for (const finding of imageMetadata(path, readFileSync(path))) {
      problems += 1;
      console.log(`::error file=${path}::image metadata: ${finding}. Strip it before committing (for example with exiftool -all= or re-export).`);
    }
  }
}
console.log(`check-image-metadata: ${checked} image(s) checked, ${problems} problem(s).`);
process.exit(problems > 0 ? 1 : 0);
