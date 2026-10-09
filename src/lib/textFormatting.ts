/**
 * textFormatting — Lightweight markdown-like text renderer.
 *
 * Role: Parses *bold*, _italic_, and [text](url) patterns in block notes and
 *       material fields and returns React nodes. Used in BlockPreview to render
 *       rich text without a full markdown library.
 *
 *       Also exposes a small toolkit of pure helpers
 *       (`findFormatRegions`, `findActiveRegions`, `findActiveRegionOfKind`,
 *       `mapRenderedRangeToRaw`, `expandToWordRun`) used by the inline editor
 *       to translate selections between the formatted DOM (what the user sees)
 *       and the raw value (what the textarea contains).
 *
 * Nesting
 * --------
 * The regex (`FORMATTING_REGEX`) uses lazy matching, so the content of a
 * match cannot contain its OWN opener (e.g. bold content has no `*`).
 * Cross-kind nesting is therefore the only case to support, and it
 * terminates naturally: bold can only nest italic or link, italic only
 * bold or link, link-text only bold or italic. The tokenizer, renderer,
 * and region walks are all recursive — when a match's content contains
 * further format matches we recurse into it, threading the stack of
 * enclosing kinds through so nested tokens can carry their `styles` and
 * `findActiveRegions` can return the whole chain at once.
 */
import { ReactNode, createElement } from 'react';

// Exported so the inline editor (previewSelection → mapRenderedRangeToRaw →
// findActiveRegions) can reuse the exact same regex and URL-validation rules
// as parseFormatting / tokenizeFormatting. URL validity here MUST match
// parseFormatting: a link whose URL fails `new URL(...)` or whose protocol
// is not http/https renders as raw text, not as an anchor.
export const FORMATTING_REGEX = /(\*(.+?)\*)|(_(.+?)_)|(\[(.+?)\]\((.+?)\))/g;

const isValidHttpUrl = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/** True iff `text` contains any match of `FORMATTING_REGEX`. Used by the
 *  tokenizer / renderer to decide whether to recurse into a match's content
 *  or emit a flat leaf token / element. */
const hasFormatMatch = (text: string): boolean => {
  const regex = new RegExp(FORMATTING_REGEX);
  return regex.test(text);
};

/**
 * Parses simple markdown-like formatting: *bold*, _italic_, [text](url).
 * Cross-kind nesting is supported: a bold match containing an italic match
 * renders as `<strong><em>…</em></strong>`, etc. Used in BlockPreview to
 * render notes and material fields.
 */
export const parseFormatting = (text: string): ReactNode[] =>
  parseFormattingInner(text, [], { key: 0 });

interface ParseKeyRef {
  key: number;
}

const parseFormattingInner = (text: string, enclosing: FormatKind[], keyRef: ParseKeyRef): ReactNode[] => {
  const parts: ReactNode[] = [];
  let currentIndex = 0;
  const regex = new RegExp(FORMATTING_REGEX);
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }

    if (match[1]) {
      const content = match[2];
      parts.push(
        createElement(
          'strong',
          { key: keyRef.key++ },
          hasFormatMatch(content) ? parseFormattingInner(content, [...enclosing, 'bold'], keyRef) : content,
        ),
      );
    } else if (match[3]) {
      const content = match[4];
      parts.push(
        createElement(
          'em',
          { key: keyRef.key++ },
          hasFormatMatch(content) ? parseFormattingInner(content, [...enclosing, 'italic'], keyRef) : content,
        ),
      );
    } else if (match[5]) {
      if (!isValidHttpUrl(match[7])) {
        parts.push(match[0]);
        currentIndex = match.index + match[0].length;
        continue;
      }

      const linkText = match[6];
      parts.push(
        createElement(
          'a',
          {
            key: keyRef.key++,
            href: match[7],
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-primary hover:underline',
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
          },
          hasFormatMatch(linkText) ? parseFormattingInner(linkText, [...enclosing, 'link'], keyRef) : linkText,
        ),
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

export type FormatKind = 'bold' | 'italic' | 'link';

/**
 * A flat token used by the FormattedTextField backdrop. The optional
 * `styles` field carries the kinds of all ENCLOSING matches (so a nested
 * italic inside a bold carries `styles: ['bold']`). The top-level tokens
 * (no enclosing matches) and the structural tokens (`marker`, `link-url`)
 * have no `styles` field — that keeps the non-nested token stream
 * byte-identical to the pre-nesting implementation.
 */
export type FormatToken =
  | { kind: 'plain'; text: string; styles?: FormatKind[] }
  | { kind: 'marker'; text: string }
  | { kind: 'bold'; text: string; styles?: FormatKind[] }
  | { kind: 'italic'; text: string; styles?: FormatKind[] }
  | { kind: 'link-text'; text: string; styles?: FormatKind[] }
  | { kind: 'link-url'; text: string };

/**
 * Splits text into styling tokens for live-formatting overlays (e.g.
 * FormattedTextField). Concatenating every token's `text` reproduces the
 * original string exactly, which keeps a styled backdrop pixel-aligned with
 * the plain textarea it sits behind. Cross-kind nesting is handled by
 * recursing into a match's content with the enclosing kind appended to
 * `enclosing` — nested plain tokens carry `styles: enclosing` so the
 * backdrop can apply every active style.
 */
export const tokenizeFormatting = (text: string): FormatToken[] =>
  tokenizeFormattingInner(text, []);

const tokenizeFormattingInner = (text: string, enclosing: FormatKind[]): FormatToken[] => {
  const tokens: FormatToken[] = [];
  let cursor = 0;
  const regex = new RegExp(FORMATTING_REGEX);
  let match;

  // Plain run inside `text`. With `enclosing.length === 0` we emit the leaf
  // token (no `styles` field) — preserves the pre-nesting byte layout. With
  // a non-empty `enclosing` we thread the enclosing stack onto the token so
  // the backdrop can apply every active kind.
  const pushPlain = (rawText: string) => {
    if (!rawText) return;
    const token: FormatToken = { kind: 'plain', text: rawText };
    if (enclosing.length > 0) token.styles = [...enclosing];
    tokens.push(token);
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) pushPlain(text.substring(cursor, match.index));

    if (match[1]) {
      tokens.push({ kind: 'marker', text: '*' });
      const content = match[2];
      if (hasFormatMatch(content)) {
        tokens.push(...tokenizeFormattingInner(content, [...enclosing, 'bold']));
      } else {
        // Nested bold content (no further matches): thread the enclosing
        // stack onto the token so the backdrop can apply every active
        // style. Top-level bold (enclosing.length === 0) keeps the
        // styles-less shape so non-nested token streams stay byte-identical.
        const token: FormatToken = { kind: 'bold', text: content };
        if (enclosing.length > 0) token.styles = [...enclosing];
        tokens.push(token);
      }
      tokens.push({ kind: 'marker', text: '*' });
    } else if (match[3]) {
      tokens.push({ kind: 'marker', text: '_' });
      const content = match[4];
      if (hasFormatMatch(content)) {
        tokens.push(...tokenizeFormattingInner(content, [...enclosing, 'italic']));
      } else {
        const token: FormatToken = { kind: 'italic', text: content };
        if (enclosing.length > 0) token.styles = [...enclosing];
        tokens.push(token);
      }
      tokens.push({ kind: 'marker', text: '_' });
    } else if (match[5]) {
      if (!isValidHttpUrl(match[7])) {
        // Renders as raw text (mirrors parseFormatting). pushPlain threads
        // the enclosing kinds so nested raw links stay styled like their
        // surrounding format in the backdrop.
        pushPlain(match[0]);
        cursor = match.index + match[0].length;
        continue;
      }

      tokens.push({ kind: 'marker', text: '[' });
      const linkText = match[6];
      if (hasFormatMatch(linkText)) {
        tokens.push(...tokenizeFormattingInner(linkText, [...enclosing, 'link']));
      } else {
        const token: FormatToken = { kind: 'link-text', text: linkText };
        if (enclosing.length > 0) token.styles = [...enclosing];
        tokens.push(token);
      }
      tokens.push({ kind: 'marker', text: '](' });
      tokens.push({ kind: 'link-url', text: match[7] });
      tokens.push({ kind: 'marker', text: ')' });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) pushPlain(text.substring(cursor));

  return tokens;
};

// ── Selection-mapping toolkit ──────────────────────────────────────────────
//
// The inline editor opens from a preview that renders FORMATTED text (markers
// are not visible: `*foo*` displays as <strong>foo</strong>). When the user
// makes a selection in the preview we need to translate those DOM offsets
// (rendered space) back to offsets in the RAW value (which contains the
// `*`/`_`/`[`/`]`/`(`/`)` syntax) so the editor opens with the SAME text
// selected. Outward snapping means a partial overlap with a formatted run
// grows to include the opening/closing syntax so the user can immediately
// remove or extend the formatting.

export interface FormatRegion {
  kind: FormatKind;
  /** Raw index of the FIRST syntax char (`*`, `_`, or `[`). */
  regionStart: number;
  /** Raw index AFTER the last syntax char (the closing `*`, `_`, or `)`). */
  regionEnd: number;
  /** Raw index of the first content char (inside the markers). */
  contentStart: number;
  /** Raw index AFTER the last content char. */
  contentEnd: number;
  /** The rendered content text (no syntax). */
  content: string;
}

/**
 * Walks `FORMATTING_REGEX` and returns every formatted region in the value
 * — including nested ones, in pre-order (outer region before its inner
 * ones). Invalid-URL link matches produce NO region (they render as raw
 * text in parseFormatting, so they have nothing to select in the raw space
 * either).
 */
export const findFormatRegions = (text: string): FormatRegion[] =>
  findFormatRegionsInner(text, 0);

const findFormatRegionsInner = (text: string, baseOffset: number): FormatRegion[] => {
  const regions: FormatRegion[] = [];
  const regex = new RegExp(FORMATTING_REGEX);
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      const content = match[2];
      const regionStart = baseOffset + match.index;
      const contentStart = regionStart + 1;
      const contentEnd = contentStart + content.length;
      const regionEnd = regionStart + match[0].length;
      regions.push({ kind: 'bold', regionStart, contentStart, contentEnd, regionEnd, content });
      regions.push(...findFormatRegionsInner(content, contentStart));
    } else if (match[3]) {
      const content = match[4];
      const regionStart = baseOffset + match.index;
      const contentStart = regionStart + 1;
      const contentEnd = contentStart + content.length;
      const regionEnd = regionStart + match[0].length;
      regions.push({ kind: 'italic', regionStart, contentStart, contentEnd, regionEnd, content });
      regions.push(...findFormatRegionsInner(content, contentStart));
    } else if (match[5]) {
      if (!isValidHttpUrl(match[7])) continue;
      const content = match[6];
      const regionStart = baseOffset + match.index;
      const contentStart = regionStart + 1;
      const contentEnd = contentStart + content.length;
      const regionEnd = regionStart + match[0].length;
      regions.push({ kind: 'link', regionStart, contentStart, contentEnd, regionEnd, content });
      regions.push(...findFormatRegionsInner(content, contentStart));
    }
  }

  return regions;
};

/**
 * Returns every region "active" for a given raw-value selection.
 *
 *  - Collapsed caret: ALL regions whose content range contains the caret
 *    (`contentStart <= start <= contentEnd`). For nested content like
 *    `*_hello_*` with the caret inside "hello" both the bold and italic
 *    regions are returned — the toolbar shows both pressed and either
 *    can toggle its layer off.
 *  - Non-collapsed selection: gated — at least one region must be
 *    EXACTLY spanned by the selection (syntax-inclusive or
 *    content-exact). When the gate fails, returns `[]` so a partial
 *    selection falls back to the plain wrap flow. When the gate passes,
 *    returns every region that either FULLY CONTAINS the selection or
 *    is FULLY CONTAINED by it — both directions keep `removeFormatting`
 *    clean: removing any one layer keeps the surrounding chain intact.
 */
export const findActiveRegions = (text: string, start: number, end: number): FormatRegion[] => {
  const regions = findFormatRegions(text);
  const collapsed = start === end;

  if (collapsed) {
    return regions.filter((r) => r.contentStart <= start && start <= r.contentEnd);
  }

  // Gate: at least one region must be exactly spanned — keeps the
  // wrap-with-marker behavior for partial selections.
  const gatePassed = regions.some((r) => {
    const fullMatch = start === r.regionStart && end === r.regionEnd;
    const contentMatch = start === r.contentStart && end === r.contentEnd;
    return fullMatch || contentMatch;
  });
  if (!gatePassed) return [];

  return regions.filter((r) => {
    const containsSelection = r.regionStart <= start && end <= r.regionEnd;
    const containedBySelection = start <= r.regionStart && r.regionEnd <= end;
    return containsSelection || containedBySelection;
  });
};

/** Convenience: returns the first region of `kind` in
 *  `findActiveRegions(...)`, or `null` if no region of that kind is active
 *  for the selection. Same-kind nesting is impossible (the regex's lazy
 *  matching keeps each opener out of its own content), but same-kind
 *  SIBLINGS can both be active for one selection — e.g. both italics inside
 *  `*a_b_c_d_*` when the whole bold region is selected. The first match
 *  wins; clicking the button unwraps that one layer and the sibling keeps
 *  the button pressed. */
export const findActiveRegionOfKind = (
  text: string,
  start: number,
  end: number,
  kind: FormatKind,
): FormatRegion | null => {
  const regions = findActiveRegions(text, start, end);
  return regions.find((r) => r.kind === kind) ?? null;
};

/**
 * One segment of the formatted preview, carrying both the raw-value range
 * it represents and the rendered-text range it occupies in the visible DOM.
 *
 *  - plain: 1:1 mapping (snap == raw, rendered grows with raw).
 *  - formatted (bold/italic/link): raw covers the CONTENT only, snap
 *    covers the FULL region (syntax included). The rendered range spans
 *    the content's RECURSIVE rendered width — for nested content like
 *    `*_hello_*` the bold segment's rendered width is the visible text
 *    ("hello", 5 chars), not the raw content length (which would include
 *    the nested italic markers).
 *
 * Concatenating every segment's `[renderedStart..renderedEnd]` reproduces
 * the rendered DOM text content exactly. The raw ranges deliberately do NOT
 * tile the whole raw string: formatted segments cover their content only,
 * while the syntax chars (markers, link URL) belong to no segment — their
 * positions are reached via the snap targets instead.
 */
interface RenderedSegment {
  kind: 'plain' | FormatKind;
  rawStart: number;
  rawEnd: number;
  snapStartRaw: number;
  snapEndRaw: number;
  renderedStart: number;
  renderedEnd: number;
}

/** Recursively sums the rendered (visible) width of `text`: plain runs
 *  count by their raw length, each format match's content is counted by
 *  ITS rendered width, markers and link URLs add zero. Invalid-URL links
 *  render as raw text and so add their full match length. */
const computeRenderedWidth = (text: string): number => {
  let width = 0;
  const regex = new RegExp(FORMATTING_REGEX);
  let match;
  let cursor = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) width += match.index - cursor;
    if (match[1]) {
      width += computeRenderedWidth(match[2]);
    } else if (match[3]) {
      width += computeRenderedWidth(match[4]);
    } else if (match[5]) {
      if (!isValidHttpUrl(match[7])) {
        width += match[0].length;
      } else {
        width += computeRenderedWidth(match[6]);
      }
    }
    cursor = match.index + match[0].length;
  }
  width += text.length - cursor;
  return width;
};

const buildRenderedSegments = (text: string): RenderedSegment[] => {
  const segments: RenderedSegment[] = [];
  let rawCursor = 0;
  let renderedCursor = 0;
  const regex = new RegExp(FORMATTING_REGEX);
  let match;

  const pushPlain = (rawText: string) => {
    if (!rawText) return;
    segments.push({
      kind: 'plain',
      rawStart: rawCursor,
      rawEnd: rawCursor + rawText.length,
      snapStartRaw: rawCursor,
      snapEndRaw: rawCursor + rawText.length,
      renderedStart: renderedCursor,
      renderedEnd: renderedCursor + rawText.length,
    });
    rawCursor += rawText.length;
    renderedCursor += rawText.length;
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > rawCursor) pushPlain(text.substring(rawCursor, match.index));

    if (match[1] || match[3]) {
      const isBold = !!match[1];
      const content = isBold ? match[2] : match[4];
      const contentStart = match.index + 1;
      const contentEnd = contentStart + content.length;
      const regionStart = match.index;
      const regionEnd = match.index + match[0].length;
      // Recursive content width — the segment's rendered range spans the
      // visible text inside the content (markers stripped), so a nested
      // `*_hello_*` has bold segment rendered width 5, not the raw content
      // length 7.
      const contentRenderedWidth = computeRenderedWidth(content);
      segments.push({
        kind: isBold ? 'bold' : 'italic',
        rawStart: contentStart,
        rawEnd: contentEnd,
        snapStartRaw: regionStart,
        snapEndRaw: regionEnd,
        renderedStart: renderedCursor,
        renderedEnd: renderedCursor + contentRenderedWidth,
      });
      rawCursor = match.index + match[0].length;
      renderedCursor += contentRenderedWidth;
    } else if (match[5]) {
      if (!isValidHttpUrl(match[7])) {
        // Mirrors parseFormatting: an invalid-protocol link renders as raw
        // text, so it contributes a plain segment covering the WHOLE match.
        const rawText = match[0];
        segments.push({
          kind: 'plain',
          rawStart: match.index,
          rawEnd: match.index + rawText.length,
          snapStartRaw: match.index,
          snapEndRaw: match.index + rawText.length,
          renderedStart: renderedCursor,
          renderedEnd: renderedCursor + rawText.length,
        });
        rawCursor = match.index + rawText.length;
        renderedCursor += rawText.length;
      } else {
        const content = match[6];
        const contentStart = match.index + 1;
        const contentEnd = contentStart + content.length;
        const regionStart = match.index;
        const regionEnd = match.index + match[0].length;
        const contentRenderedWidth = computeRenderedWidth(content);
        segments.push({
          kind: 'link',
          rawStart: contentStart,
          rawEnd: contentEnd,
          snapStartRaw: regionStart,
          snapEndRaw: regionEnd,
          renderedStart: renderedCursor,
          renderedEnd: renderedCursor + contentRenderedWidth,
        });
        rawCursor = match.index + match[0].length;
        renderedCursor += contentRenderedWidth;
      }
    }
  }

  if (rawCursor < text.length) pushPlain(text.substring(rawCursor));

  return segments;
};

/**
 * Maps a range in the rendered (preview DOM) text to the corresponding raw
 * value range, snapping OUTWARD to include the syntax of any formatted run
 * the selection partially covers:
 *
 *  - A start at/inside formatted content snaps to the region's opening syntax.
 *  - An end at/inside formatted content snaps to the region's closing syntax.
 *  - Plain runs map 1:1 by offset.
 */
export const mapRenderedRangeToRaw = (
  text: string,
  renderedStart: number,
  renderedEnd: number,
): { start: number; end: number } => {
  const segments = buildRenderedSegments(text);

  let totalRendered = 0;
  for (const segment of segments) {
    totalRendered += segment.renderedEnd - segment.renderedStart;
  }

  const expandStart = (offset: number): number => {
    if (offset <= 0) return 0;
    if (offset >= totalRendered) return text.length;
    for (const segment of segments) {
      if (offset < segment.renderedEnd) {
        if (segment.kind === 'plain') {
          return segment.rawStart + (offset - segment.renderedStart);
        }
        return segment.snapStartRaw;
      }
    }
    return text.length;
  };

  const expandEnd = (offset: number): number => {
    if (offset <= 0) return 0;
    if (offset >= totalRendered) return text.length;
    for (const segment of segments) {
      if (offset <= segment.renderedEnd) {
        if (segment.kind === 'plain') {
          return segment.rawStart + (offset - segment.renderedStart);
        }
        return segment.snapEndRaw;
      }
    }
    return text.length;
  };

  const start = expandStart(renderedStart);
  const end = expandEnd(renderedEnd);
  return { start: Math.min(start, end), end: Math.max(start, end) };
};

/**
 * Word-run expansion for double-click emulation. Returns the contiguous
 * run of non-whitespace characters containing `position`, or a collapsed
 * range at `position` if neither adjacent char is a word char.
 *
 * Because the formatting syntax is made of non-whitespace chars (`*`, `_`,
 * `[`, `]`, `(`, `)`) this naturally grabs the whole `*bold*` or
 * `[text](url)` as one "word" — desired so a dblclick in the preview
 * selects the entire formatted region.
 */
export const expandToWordRun = (text: string, position: number): { start: number; end: number } => {
  const atPos = position < text.length && /\S/.test(text[position]);
  const beforePos = position > 0 && /\S/.test(text[position - 1]);
  if (!atPos && !beforePos) return { start: position, end: position };

  let start = position;
  let end = position;
  while (start > 0 && /\S/.test(text[start - 1])) start -= 1;
  while (end < text.length && /\S/.test(text[end])) end += 1;
  return { start, end };
};
