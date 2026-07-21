// Downloads the "Nylon and Steel Guitars-4U" soundfont (Soundfonts4U,
// CC BY-NC-SA 4.0 — https://huggingface.co/datasets/projectlosangeles/soundfonts4u)
// used by the Tab Player lab for realistic guitar tones, and rebanks its
// presets from bank 0 to bank 1 so they can't collide with the base GM
// soundfont's bank-0 piano programs when both are loaded together.
//
// This file is ~37MB, too large to commit to the repo — it's gitignored
// under public/instruments/, and this script re-creates it on a fresh clone.
//
// Usage: npm run setup:soundfont

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://huggingface.co/datasets/projectlosangeles/soundfonts4u/resolve/main/Nylon%20and%20Steeel%20Guitars-4U-v2.sf2';
const TARGET_BANK = 1;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'instruments');
const outPath = join(outDir, 'soundfonts4u-nylon-steel-guitars-bank1.sf2');

function readChunkId(buf, offset) {
  return buf.toString('ascii', offset, offset + 4);
}

function findSubchunk(buf, start, end, targetListType) {
  let offset = start;
  while (offset < end) {
    const id = readChunkId(buf, offset);
    const size = buf.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;
    if (id === 'LIST') {
      const listType = buf.toString('ascii', bodyStart, bodyStart + 4);
      if (listType === targetListType) return { start: bodyStart + 4, end: bodyStart + size };
    }
    offset = bodyStart + size + (size % 2);
  }
  return null;
}

function findChunk(buf, start, end, targetId) {
  let offset = start;
  while (offset < end) {
    const id = readChunkId(buf, offset);
    const size = buf.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;
    if (id === targetId) return { start: bodyStart, end: bodyStart + size };
    offset = bodyStart + size + (size % 2);
  }
  return null;
}

function rebankPresets(buf, targetBank) {
  const riffSize = buf.readUInt32LE(4);
  const riffEnd = 8 + riffSize;
  const pdta = findSubchunk(buf, 12, riffEnd, 'pdta');
  if (!pdta) throw new Error('Could not find pdta chunk — unexpected SF2 structure');
  const phdr = findChunk(buf, pdta.start, pdta.end, 'phdr');
  if (!phdr) throw new Error('Could not find phdr chunk — unexpected SF2 structure');

  const RECORD_SIZE = 38;
  const count = (phdr.end - phdr.start) / RECORD_SIZE;
  for (let i = 0; i < count - 1; i++) { // skip the terminal EOP record
    const recOffset = phdr.start + i * RECORD_SIZE;
    buf.writeUInt16LE(targetBank, recOffset + 22);
  }
}

console.log(`Downloading ${SOURCE_URL} ...`);
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
const buf = Buffer.from(await response.arrayBuffer());

console.log(`Rebanking presets to bank ${TARGET_BANK} ...`);
rebankPresets(buf, TARGET_BANK);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, buf);
console.log(`Wrote ${outPath} (${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
