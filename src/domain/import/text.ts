import type { Cell } from './values';

/** טבלה גולמית: שורות של תאים. */
export type Table = Cell[][];

/** גיליון אחד מקובץ (בקובץ CSV או HTML יש גיליון אחד). */
export interface Sheet {
  name: string;
  rows: Table;
}

/** מפרק טקסט CSV (פסיק, נקודה-פסיק או טאב; שדות במרכאות; מרכאות כפולות בתוך שדה). */
export function parseCsv(text: string): Table {
  const src = text.replace(/^\ufeff/, '');
  const firstLines = src.split(/\r?\n/).slice(0, 10).join('\n');
  const count = (ch: string) => firstLines.split(ch).length - 1;
  const delimiter = count('\t') > count(';') && count('\t') > count(',') ? '\t' : count(';') > count(',') ? ';' : ',';

  const rows: Table = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]!.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** האם הטקסט הוא HTML (בנקים שומרים לפעמים "אקסל" שהוא בעצם טבלת HTML). */
export function looksLikeHtml(text: string): boolean {
  return /^\s*(<!doctype html|<html|<table|<\?xml|<meta|<head|<body)/i.test(text.replace(/^\ufeff/, ''));
}

/** כל טבלאות ה-HTML בטקסט, כגיליונות. */
export function parseHtmlTables(html: string): Sheet[] {
  const sheets: Sheet[] = [];
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  tables.forEach((table, index) => {
    const rows: Table = [];
    for (const tr of table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells: string[] = [];
      for (const td of tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []) {
        const inner = td.replace(/^<t[dh][^>]*>/i, '').replace(/<\/t[dh]>$/i, '');
        cells.push(decodeEntities(inner.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
      }
      if (cells.some((x) => x !== '')) rows.push(cells);
    }
    if (rows.length) sheets.push({ name: `טבלה ${index + 1}`, rows });
  });
  return sheets;
}
