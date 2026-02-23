import { File, Directory, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import JSZip from 'jszip';

export interface AnkiDeck {
  id: number;
  name: string;
  noteCount: number;
}

export interface ApkgCard {
  front: string;
  back: string;
  tags: string;
}

export interface ApkgResult {
  decks: AnkiDeck[];
  notesByDeck: Record<number, ApkgCard[]>;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

export function splitFields(flds: string): string[] {
  return flds.split('\x1f');
}

const TEMP_DB_NAME = 'anki_import_tmp.db';

export async function parseApkg(fileUri: string): Promise<ApkgResult> {
  const sqliteDir = new Directory(Paths.document, 'SQLite');
  const tempDbFile = new File(sqliteDir, TEMP_DB_NAME);
  let db: SQLite.SQLiteDatabase | null = null;

  try {
    // 1. Read file as base64
    const apkgFile = new File(fileUri);
    const base64 = await apkgFile.base64();

    // 2. Unzip and find the collection database
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const entry = zip.file('collection.anki21') ?? zip.file('collection.anki2');
    if (!entry) throw new Error('No collection database found in package');

    // 3. Write SQLite bytes to the app's SQLite directory
    const dbBase64 = await entry.async('base64');
    if (!sqliteDir.exists) {
      sqliteDir.create({ intermediates: true });
    }
    tempDbFile.write(dbBase64, { encoding: 'base64' });

    // 4. Open and query
    db = await SQLite.openDatabaseAsync(TEMP_DB_NAME);

    const colRow = await db.getFirstAsync<{ decks: string }>('SELECT decks FROM col');
    if (!colRow) throw new Error('Could not read deck information');

    const decksJson = JSON.parse(colRow.decks) as Record<
      string,
      { id: number; name: string }
    >;

    // Note counts per deck (one note may have multiple cards; COUNT DISTINCT nid)
    const countRows = await db.getAllAsync<{ did: number; note_count: number }>(
      'SELECT MIN(c.did) as did, COUNT(DISTINCT c.nid) as note_count FROM cards c GROUP BY c.did'
    );
    const countByDeck = new Map(countRows.map((r) => [r.did, r.note_count]));

    // All notes with their deck assignment
    const noteRows = await db.getAllAsync<{
      flds: string;
      tags: string;
      did: number;
    }>(
      'SELECT n.flds, n.tags, MIN(c.did) as did FROM notes n JOIN cards c ON c.nid = n.id GROUP BY n.id'
    );

    await db.closeAsync();
    db = null;

    // 5. Build deck list (only decks that have notes)
    const decks: AnkiDeck[] = Object.values(decksJson)
      .map((d) => ({
        id: d.id,
        name: d.name,
        noteCount: countByDeck.get(d.id) ?? 0,
      }))
      .filter((d) => d.noteCount > 0);

    // 6. Build notesByDeck
    const notesByDeck: Record<number, ApkgCard[]> = {};
    for (const row of noteRows) {
      const fields = splitFields(row.flds);
      const front = stripHtml(fields[0] ?? '');
      const back = stripHtml(fields[1] ?? '');
      if (!front && !back) continue;
      if (!notesByDeck[row.did]) notesByDeck[row.did] = [];
      notesByDeck[row.did].push({ front, back, tags: row.tags.trim() });
    }

    return { decks, notesByDeck };
  } finally {
    // Close DB connection if still open (e.g. error after openDatabaseAsync)
    if (db) {
      await db.closeAsync().catch(() => {});
    }
    // Cleanup temp file — silent failure is fine; file is overwritten next import
    try {
      if (tempDbFile.exists) {
        tempDbFile.delete();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
