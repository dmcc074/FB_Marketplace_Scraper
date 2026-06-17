import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SEEN_FILE = path.join(DATA_DIR, 'seen.json');

export async function loadSeen() {
  try {
    const raw = await fs.readFile(SEEN_FILE, 'utf8');
    const ids = JSON.parse(raw);
    return new Set(ids);
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
}

export async function saveSeen(seenSet) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SEEN_FILE, JSON.stringify([...seenSet], null, 2), 'utf8');
}
