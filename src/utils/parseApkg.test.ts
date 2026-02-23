import { stripHtml, splitFields } from './parseApkg';

describe('stripHtml', () => {
  it('removes simple tags', () => {
    expect(stripHtml('<b>hello</b>')).toBe('hello');
  });
  it('removes br tags', () => {
    expect(stripHtml('line1<br>line2')).toBe('line1line2');
  });
  it('trims whitespace', () => {
    expect(stripHtml('  <span>word</span>  ')).toBe('word');
  });
  it('returns plain text unchanged', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });
});

describe('splitFields', () => {
  it('splits on unit separator', () => {
    expect(splitFields('front\x1fback')).toEqual(['front', 'back']);
  });
  it('handles three fields', () => {
    expect(splitFields('a\x1fb\x1fc')).toEqual(['a', 'b', 'c']);
  });
  it('handles single field', () => {
    expect(splitFields('only')).toEqual(['only']);
  });
});
