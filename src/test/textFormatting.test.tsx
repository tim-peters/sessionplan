import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { parseFormatting, autoLinkUrls } from '@/lib/textFormatting';

describe('parseFormatting', () => {
  it('returns plain text when no formatting is present', () => {
    const result = parseFormatting('hello world');
    expect(result).toHaveLength(1);
    const { container } = render(<>{result}</>);
    expect(container.textContent).toBe('hello world');
  });

  it('renders *bold* as <strong>', () => {
    const { container } = render(<>{parseFormatting('a *bold* word')}</>);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('bold');
    expect(container.textContent).toBe('a bold word');
  });

  it('renders _italic_ as <em>', () => {
    const { container } = render(<>{parseFormatting('an _italic_ word')}</>);
    const em = container.querySelector('em');
    expect(em).not.toBeNull();
    expect(em?.textContent).toBe('italic');
  });

  it('renders [text](url) as an anchor with target=_blank', () => {
    const { container } = render(<>{parseFormatting('see [docs](https://example.com) here')}</>);
    const a = container.querySelector('a');
    expect(a).not.toBeNull();
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a?.textContent).toBe('docs');
  });

  it('handles mixed formatting in a single string', () => {
    const { container } = render(
      <>{parseFormatting('*bold* and _italic_ and [link](https://x.test)')}</>,
    );
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelector('a')?.textContent).toBe('link');
  });
});

describe('autoLinkUrls', () => {
  it('wraps bare URLs in markdown link syntax', () => {
    expect(autoLinkUrls('visit https://example.com today')).toBe(
      'visit [https://example.com](https://example.com) today',
    );
  });

  it('does not re-wrap URLs that are already markdown links', () => {
    const input = '[click here](https://example.com)';
    expect(autoLinkUrls(input)).toBe(input);
  });

  it('preserves trailing punctuation outside the link', () => {
    const result = autoLinkUrls('see https://example.com.');
    expect(result).toBe('see [https://example.com](https://example.com).');
  });

  it('leaves text without URLs unchanged', () => {
    expect(autoLinkUrls('plain text only')).toBe('plain text only');
  });
});
