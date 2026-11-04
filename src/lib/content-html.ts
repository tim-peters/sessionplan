/** Keep wide content tables scrollable without making the whole page scroll. */
export const wrapContentTables = (html: string): string =>
  html.replace(/<table\b[^>]*>[\s\S]*?<\/table\s*>/gi,
    (table) => `<div class="content-table" tabindex="0">${table}</div>`);
