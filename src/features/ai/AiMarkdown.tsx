import { Fragment, type ReactNode } from 'react';
import { parseAiMarkdown } from './parseAiMarkdown';

function inline(text: string): ReactNode[] {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  const out: ReactNode[] = []; let at=0;
  for (const match of text.matchAll(pattern)) {
    const index=match.index; const token=match[0];
    if(index>at)out.push(text.slice(at,index));
    if(token.startsWith('`'))out.push(<code translate="no" key={index}>{token.slice(1,-1)}</code>);
    else if(token.startsWith('**')||token.startsWith('__'))out.push(<strong translate="no" key={index}>{token.slice(2,-2)}</strong>);
    else out.push(<em translate="no" key={index}>{token.slice(1,-1)}</em>);
    at=index+token.length;
  }
  if(at<text.length)out.push(text.slice(at));
  return out;
}

export function AiMarkdown({message}:{message:{text:string}}) {
  const {text} = message;
  return <div className="ai-markdown" translate="no" dir="auto">{parseAiMarkdown(text).map((block,i)=>{
    switch(block.kind){
      case 'heading': return <h3 key={i} className={`ai-md-heading ai-md-h${block.level}`} translate="no">{inline(block.text)}</h3>;
      case 'paragraph': return <p key={i} translate="no">{inline(block.text)}</p>;
      case 'quote': return <blockquote key={i} translate="no">{inline(block.text)}</blockquote>;
      case 'code': return <pre key={i} translate="no"><code translate="no">{block.text}</code></pre>;
      case 'rule': return <hr key={i}/>;
      case 'list': { const Tag=block.ordered?'ol':'ul';return <Tag key={i}>{block.items.map((item,j)=><li key={j} translate="no">{inline(item)}</li>)}</Tag>; }
      case 'table': return <div key={i} className="ai-md-table-scroll" tabIndex={0} role="region" aria-label="טבלת נתונים"><table><thead><tr>{block.headers.map((cell,j)=><th key={j} scope="col" translate="no">{inline(cell)}</th>)}</tr></thead><tbody>{block.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k} translate="no">{inline(cell)}</td>)}</tr>)}</tbody></table></div>;
      default: return <Fragment key={i}/>;
    }
  })}</div>;
}
