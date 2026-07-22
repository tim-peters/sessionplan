/**
 * textFormatting — Lightweight markdown-like text renderer.
 *
 * Role: Parses *bold*, _italic_, and [text](url) patterns in block notes and
 *       material fields and returns React nodes. Used in BlockPreview to render
 *       rich text without a full markdown library.
 */
import { ReactNode, createElement } from 'react';

/**
 * Parses simple markdown-like formatting: *bold*, _italic_, [text](url).
 * Used in BlockPreview to render notes and material fields.
 */
export const parseFormatting = (text: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  const regex = /(\*(.+?)\*)|(_(.+?)_)|(\[(.+?)\]\((.+?)\))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }

    if (match[1]) {
      parts.push(createElement('strong', { key: key++ }, match[2]));
    } else if (match[3]) {
      parts.push(createElement('em', { key: key++ }, match[4]));
    } else if (match[5]) {
      parts.push(
        createElement('a', {
          key: key++,
          href: match[7],
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-primary hover:underline',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        }, match[6])
      );
    }

    currentIndex = match.index + match[0].length;
  }

  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? parts : [text];
};

/**
 * Converts bare URLs in text to markdown link format [url](url).
 * URLs already wrapped in markdown links are left untouched.
 */
export const autoLinkUrls = (value: string): string => {
  const urlRegex = /(?<!\]\()https?:\/\/[^\s<]+[^<.,:;"')\]\s]/g;
  return value.replace(urlRegex, (url) => `[${url}](${url})`);
};
