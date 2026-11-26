export type AiBlock = { kind: 'heading'; level: number; text: string } | { kind: 'paragraph' | 'quote' | 'code'; text: string } | { kind: 'list'; ordered: boolean; items: string[] } | { kind: 'table'; headers: string[]; rows: string[][] } | { kind: 'rule' };

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'));
}
const separator = (line: string) => line.includes('|') && cells(line).every(s => /^:?-{3,}:?$/.test(s));
const tableLine = (line: string) => line.includes('|') && cells(line).length > 1;
const listLine = (line: string) => /^\s*(?:[-+*]|\d+[.)])\s+/.test(line);

/** Small, plain-text Markdown subset. Never interprets HTML, scripts or links. */
export function parseAiMarkdown(text: string): AiBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: AiBlock[] = [];
  const boundary = (i: number) => /^\s*(?:#{1,6}\s|```|>|(?:[-*_]\s*){3,}$)/.test(lines[i] ?? '') || listLine(lines[i] ?? '') || (tableLine(lines[i] ?? '') && separator(lines[i+1] ?? ''));
  for (let i=0; i<lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*```/.test(line)) {
      const code: string[] = []; i++;
      while (i<lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i<lines.length) i++;
      blocks.push({kind:'code',text:code.join('\n')}); continue;
    }
    const heading = /^\s*(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { blocks.push({kind:'heading',level:heading[1].length,text:heading[2]}); i++; continue; }
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { blocks.push({kind:'rule'}); i++; continue; }
    if (tableLine(line) && separator(lines[i+1] ?? '')) {
      const headers = cells(line); const rows: string[][] = []; i+=2;
      while (i<lines.length && tableLine(lines[i]) && !separator(lines[i])) {
        const row = cells(lines[i++]);
        rows.push(headers.map((_,j)=>row[j] ?? ''));
      }
      blocks.push({kind:'table',headers,rows}); continue;
    }
    if (listLine(line)) {
      const ordered = /^\s*\d+[.)]/.test(line); const items: string[] = [];
      while (i<lines.length && listLine(lines[i]) && /^\s*\d+[.)]/.test(lines[i])===ordered) items.push(lines[i++].replace(/^\s*(?:[-+*]|\d+[.)])\s+/,''));
      blocks.push({kind:'list',ordered,items}); continue;
    }
    if (/^\s*>/.test(line)) { const quote: string[]=[];while(i<lines.length && /^\s*>/.test(lines[i]))quote.push(lines[i++].replace(/^\s*>\s?/,''));blocks.push({kind:'quote',text:quote.join('\n')});continue; }
    const paragraph=[line]; i++;
    while(i<lines.length && lines[i].trim() && !boundary(i)) paragraph.push(lines[i++]);
    blocks.push({kind:'paragraph',text:paragraph.join('\n')});
  }
  return blocks;
}
