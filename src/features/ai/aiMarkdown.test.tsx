import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiMarkdown } from './AiMarkdown';
import { parseAiMarkdown } from './parseAiMarkdown';
import { visibleAiHeight } from './useAiViewport';
import { translateProps } from '../../i18n/translateProps';
import { setLangForTest } from '../../i18n/lang';

describe('AI reply formatting',()=>{
  const reply='### 1. תקציב\n| קטגוריה | סכום | יעד |\n|---|---|---|\n| **מזון** | ₪420 | ₪500 |\n\n- **חיסכון**\n- סעיף שני';
  it('renders headings, tables, bold and lists rather than raw Markdown',()=>{
    const html=renderToStaticMarkup(<AiMarkdown message={{text:reply}}/>);
    expect(html).toContain('<table>'); expect(html).toContain('<strong translate="no">מזון</strong>');
    expect(html).toContain('<ul>');expect(html).not.toContain('###');expect(html).not.toContain('|---|');
  });
  it('keeps model HTML inert and never creates links or executable HTML',()=>{
    const html=renderToStaticMarkup(<AiMarkdown message={{text:'<img src=x onerror=alert(1)>\n[click](javascript:alert(1))'}}/>);
    expect(html).toContain('&lt;img');expect(html).not.toContain('<img');expect(html).not.toContain('<a ');
  });
  it('handles streamed partial output and escaped pipes without throwing',()=>{
    expect(parseAiMarkdown('| Name | Amount |\n|---|---|\n| a\\|b | 42 |')).toEqual([{kind:'table',headers:['Name','Amount'],rows:[['a|b','42']]}]);
    expect(parseAiMarkdown('### Example\n| A | B |')).toHaveLength(2);
  });
  it('preserves model line breaks in English UI instead of translating the content prop',()=>{
    setLangForTest('en');
    try { expect(translateProps(AiMarkdown,{message:{text:reply}})).toEqual({message:{text:reply}}); }
    finally { setLangForTest('he'); }
  });
});
describe('AI keyboard viewport',()=>{
  it('uses the reduced height when the keyboard covers the layout viewport',()=>{
    expect(visibleAiHeight(320,0,0)).toBe(320);
    expect(visibleAiHeight(320,30,40)).toBe(310);
    expect(visibleAiHeight(650,0,0)).toBe(650);
  });
});
