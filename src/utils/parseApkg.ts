import * as FileSystem from 'expo-file-system';
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
