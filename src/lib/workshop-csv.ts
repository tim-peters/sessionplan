/**
 * workshop-csv — Build a CSV (RFC 4180) of the current workshop plan.
 *
 * Pure utility: no React, no DOM, no i18next, no analytics. Labels are
 * injected from the caller so the function is straightforward to unit test.
 * The caller wires up the download via `downloadWorkshopCsv`.
 *
 * CSV contract:
 *  - UTF-8 with BOM (`\uFEFF`) so Excel auto-detects encoding.
 *  - CRLF line endings (RFC 4180).
 *  - Delimiter is dynamic: `;` for `de`, `,` otherwise.
 *  - One row per visible element. Groups/breakouts emit a summary row
 *    followed by their children. Breakout children are emitted lane-major.
 *  - When `metadata.startTime` is set, columns `Von` and `Bis` carry absolute
 *    `HH:MM` strings (computed against the session start). When not set,
 *    those columns are dropped entirely.
 *  - Field escaping follows RFC 4180.
 *  - A multi-day plan lists its days one below the other, each with its own
 *    heading, column header and total. All days share the same columns.
 */
import { WorkshopData, WorkshopItem } from '@/types/workshop';
import { timeToMinutes } from '@/lib/playModeUtils';
import { formatMinAsHHMM } from '@/lib/clock-time';
import { getDays } from '@/lib/workshop-days';

export interface CsvColumnLabels {
  nr: string;
  from: string;
  to: string;
  duration: string;
  type: string;
  title: string;
  breakoutGroup: string;
  people: string;
  material: string;
  notes: string;
  /** Footer label that already includes the count placeholder, e.g. "Gesamt: {{count}} Min." */
  total: string;
  /** Total below one day of a multi-day plan, e.g. "Summe: {{count}} Min." */
  dayTotal: string;
  /** Heading of an untitled day, by its 1-based number. */
  day: (index: number) => string;
  group: string;
  breakout: string;
  block: string;
  all: string;
}

type Language = 'de' | 'en';

const escapeCsvField = (value: string | null | undefined, delimiter: string): string => {
  const raw = value == null ? '' : String(value);
  if (raw === '') return '';
  if (
    raw.includes(delimiter) ||
    raw.includes('"') ||
    raw.includes('\n') ||
    raw.includes('\r') ||
    raw.startsWith(' ') ||
    raw.endsWith(' ')
  ) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const joinNames = (ids: string[] | undefined, byId: Map<string, string>): string => {
  if (!ids || ids.length === 0) return '';
  return ids.map((id) => byId.get(id) ?? '').filter(Boolean).join(', ');
};

const formatLanePersons = (
  lanePersons: Record<number, string[]>,
  byId: Map<string, string>,
): string => {
  const keys = Object.keys(lanePersons)
    .map((k) => Number(k))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return keys
    .map((lane) => {
      const names = (lanePersons[lane] ?? [])
        .map((id) => byId.get(id) ?? '')
        .filter(Boolean)
        .join(', ');
      return `${lane + 1}: ${names}`;
    })
    .join('; ');
};

const resolveTypeName = (
  item: WorkshopItem,
  blockTypeNameById: Map<string, string>,
  labels: CsvColumnLabels,
): string => {
  if (item.blockTypeId && blockTypeNameById.has(item.blockTypeId)) {
    return blockTypeNameById.get(item.blockTypeId) ?? '';
  }
  if (item.type === 'group') return labels.group;
  if (item.type === 'breakout') return labels.breakout;
  return labels.block;
};

const groupDuration = (group: WorkshopItem): number => {
  if (group.durationLocked) return group.duration;
  return (group.children ?? []).reduce((sum, c) => sum + c.duration, 0);
};

const breakoutDuration = (breakout: WorkshopItem): number => {
  if (breakout.durationLocked) return breakout.duration;
  const kids = breakout.children ?? [];
  if (kids.length === 0) return breakout.duration;
  const byLane = new Map<number, number>();
  for (const c of kids) {
    const lane = c.laneIndex ?? 0;
    byLane.set(lane, (byLane.get(lane) ?? 0) + c.duration);
  }
  let max = 0;
  for (const v of byLane.values()) if (v > max) max = v;
  return max;
};

interface CsvRow {
  nr: string;
  from: string;
  to: string;
  duration: number;
  type: string;
  title: string;
  breakoutGroup: string;
  people: string;
  material: string;
  notes: string;
  /** True for top-level (non-nested) rows; the footer total sums only these. */
  countsTowardTotal: boolean;
}

interface BuildContext {
  labels: CsvColumnLabels;
  blockTypeNameById: Map<string, string>;
  personNameById: Map<string, string>;
  sessionStartMinutes: number | null;
  includeTimes: boolean;
}

const mkRow = (
  ctx: BuildContext,
  nr: string,
  startMin: number,
  endMin: number,
  duration: number,
  item: WorkshopItem,
  breakoutGroup: string,
  people: string,
  countsTowardTotal: boolean,
): CsvRow => {
  const abs =
    ctx.includeTimes && ctx.sessionStartMinutes !== null
      ? (m: number): string => formatMinAsHHMM(m + ctx.sessionStartMinutes!)
      : (): string => '';
  return {
    nr,
    from: abs(startMin),
    to: abs(endMin),
    duration,
    type: resolveTypeName(item, ctx.blockTypeNameById, ctx.labels),
    title: item.title ?? '',
    breakoutGroup,
    people,
    material: item.material ?? '',
    notes: item.notes ?? '',
    countsTowardTotal,
  };
};

const walkGroup = (
  ctx: BuildContext,
  group: WorkshopItem,
  parentNumber: string,
  groupStartMin: number,
  out: CsvRow[],
  isTopLevel: boolean,
): void => {
  const dur = groupDuration(group);
  out.push(
    mkRow(
      ctx,
      parentNumber,
      groupStartMin,
      groupStartMin + dur,
      dur,
      group,
      '',
      joinNames(group.personIds, ctx.personNameById),
      isTopLevel,
    ),
  );
  let cursor = groupStartMin;
  (group.children ?? []).forEach((child, i) => {
    if (child.fixedStartTime && ctx.sessionStartMinutes !== null) {
      cursor = timeToMinutes(child.fixedStartTime) - ctx.sessionStartMinutes;
    }
    const childStart = cursor;
    const childEnd = childStart + child.duration;
    const childNumber = `${parentNumber}.${i + 1}`;
    if (child.type === 'group') {
      walkGroup(ctx, child, childNumber, childStart, out, false);
    } else if (child.type === 'breakout') {
      walkBreakout(ctx, child, childNumber, childStart, out, false);
    } else {
      out.push(
        mkRow(
          ctx,
          childNumber,
          childStart,
          childEnd,
          child.duration,
          child,
          '',
          joinNames(child.personIds, ctx.personNameById),
          false,
        ),
      );
    }
    cursor = childEnd;
  });
};

const walkBreakout = (
  ctx: BuildContext,
  breakout: WorkshopItem,
  parentNumber: string,
  breakoutStartMin: number,
  out: CsvRow[],
  isTopLevel: boolean,
): void => {
  const dur = breakoutDuration(breakout);
  out.push(
    mkRow(
      ctx,
      parentNumber,
      breakoutStartMin,
      breakoutStartMin + dur,
      dur,
      breakout,
      '',
      joinNames(breakout.personIds, ctx.personNameById),
      isTopLevel,
    ),
  );
  const children = breakout.children ?? [];
  if (children.length === 0) return;
  const sameAll = breakout.sameInAllBreakouts === true;
  const lp = breakout.lanePersons;

  // Build child blocks with their absolute spans.
  const childrenWithSpans = children.map((child) => {
    let start = breakoutStartMin;
    if (child.fixedStartTime && ctx.sessionStartMinutes !== null) {
      start = timeToMinutes(child.fixedStartTime) - ctx.sessionStartMinutes;
    }
    return { child, start, end: start + child.duration, lane: child.laneIndex ?? 0 };
  });

  // Lane-major order; sameInAllBreakouts emits one row per child (no N× duplication).
  const ordered = sameAll
    ? childrenWithSpans
    : [...childrenWithSpans].sort((a, b) => a.lane - b.lane || a.start - b.start);

  ordered.forEach((c, i) => {
    let people: string;
    if (sameAll) {
      people =
        lp && Object.keys(lp).length > 0
          ? formatLanePersons(lp, ctx.personNameById)
          : joinNames(c.child.personIds, ctx.personNameById);
    } else {
      const laneOverride = lp?.[c.lane];
      people = laneOverride
        ? joinNames(laneOverride, ctx.personNameById)
        : joinNames(c.child.personIds, ctx.personNameById);
    }
    out.push(
      mkRow(
        ctx,
        `${parentNumber}.${i + 1}`,
        c.start,
        c.end,
        c.child.duration,
        c.child,
        sameAll ? ctx.labels.all : `${c.lane + 1}`,
        people,
        false,
      ),
    );
  });
};

/**
 * Walk top-level items. `parallel: true` means siblings share a start
 * (no offset advance), and the cursor resumes from the longest parallel.
 */
const buildRows = (ctx: BuildContext, items: WorkshopItem[]): CsvRow[] => {
  const { sessionStartMinutes, personNameById } = ctx;
  const rows: CsvRow[] = [];
  let cursor = 0;
  let parallelStart: number | null = null;
  let topIndex = 0;
  items.forEach((item) => {
    if (item.fixedStartTime && sessionStartMinutes !== null) {
      cursor = timeToMinutes(item.fixedStartTime) - sessionStartMinutes;
    }
    const isParallel = item.parallel === true;
    if (isParallel && parallelStart === null) parallelStart = cursor;
    const itemStart = isParallel ? (parallelStart ?? cursor) : cursor;
    const number = `${++topIndex}`;

    let end: number;
    if (item.type === 'group') {
      walkGroup(ctx, item, number, itemStart, rows, true);
      end = itemStart + groupDuration(item);
    } else if (item.type === 'breakout') {
      walkBreakout(ctx, item, number, itemStart, rows, true);
      end = itemStart + breakoutDuration(item);
    } else {
      end = itemStart + item.duration;
      rows.push(
        mkRow(
          ctx,
          number,
          itemStart,
          end,
          item.duration,
          item,
          '',
          joinNames(item.personIds, personNameById),
          true,
        ),
      );
    }
    if (isParallel) {
      cursor = Math.max(cursor, end);
    } else {
      cursor = end;
      parallelStart = null;
    }
  });
  return rows;
};

const sumTotal = (rows: CsvRow[]): number =>
  rows.reduce((sum, r) => sum + (r.countsTowardTotal ? r.duration : 0), 0);

/**
 * Build a CSV (RFC 4180) string for the given workshop. The returned string
 * starts with the UTF-8 BOM and uses CRLF line endings.
 */
export const buildWorkshopCsv = (
  data: WorkshopData,
  labels: CsvColumnLabels,
  language: Language,
): string => {
  const delimiter = language === 'de' ? ';' : ',';
  const blockTypeNameById = new Map(data.blockTypes.map((bt) => [bt.id, bt.name ?? '']));
  const personNameById = new Map(data.persons.map((p) => [p.id, p.name ?? '']));

  const days = getDays(data);
  const multiDay = days.length > 1;
  const includeTimes = days.some((day) => day.startTime);

  const sections = days.map((day, index) => {
    const sessionStartMinutes = day.startTime ? timeToMinutes(day.startTime) : null;
    const rows = buildRows(
      {
        labels,
        blockTypeNameById,
        personNameById,
        sessionStartMinutes,
        includeTimes: sessionStartMinutes !== null,
      },
      day.items,
    );
    // Row 1: `Title[ — Date[ — StartTime]]` — em-dash joined, omit missing.
    // Row 2: description alone (only when non-empty).
    // If title, date, and startTime are all missing, the row is omitted entirely.
    const heading = multiDay ? day.title || labels.day(index + 1) : data.workshop.title;
    const titleLine = [heading, day.date, day.startTime].filter(Boolean).join(' — ');
    return { rows, titleLine, description: day.description };
  });
  const allRows = sections.flatMap((section) => section.rows);

  // ── Column model ───────────────────────────────────────────────────────
  // `droppable` columns are omitted from both the header and every data row
  // when their cells are empty across the whole session.
  const allColumns: { header: string; cell: (r: CsvRow) => string; droppable: boolean }[] = [
    { header: labels.nr, cell: (r) => r.nr, droppable: false },
  ];
  if (includeTimes) {
    allColumns.push(
      { header: labels.from, cell: (r) => r.from, droppable: false },
      { header: labels.to, cell: (r) => r.to, droppable: false },
    );
  }
  allColumns.push(
    { header: labels.duration, cell: (r) => String(r.duration), droppable: false },
    { header: labels.type, cell: (r) => r.type, droppable: false },
    { header: labels.title, cell: (r) => r.title, droppable: false },
    { header: labels.breakoutGroup, cell: (r) => r.breakoutGroup, droppable: true },
    { header: labels.people, cell: (r) => r.people, droppable: true },
    { header: labels.material, cell: (r) => r.material, droppable: true },
    { header: labels.notes, cell: (r) => r.notes, droppable: true },
  );
  const keptColumns = allColumns.filter(
    (column) => !column.droppable || allRows.some((row) => column.cell(row) !== ''),
  );
  const toLine = (cells: string[]): string =>
    cells.map((cell) => escapeCsvField(cell, delimiter)).join(delimiter);

  const lines: string[] = [];
  if (multiDay && data.workshop.title) lines.push(data.workshop.title, '');

  sections.forEach(({ rows, titleLine, description }) => {
    // ── Header lines ──────────────────────────────────────────────────────
    if (titleLine) lines.push(titleLine);
    if (description) lines.push(description);
    lines.push(''); // visual gap before the column header
    lines.push(toLine(keptColumns.map((column) => column.header)));

    // ── Data rows ─────────────────────────────────────────────────────────
    for (const row of rows) {
      lines.push(toLine(keptColumns.map((column) => column.cell(row))));
    }

    // ── Footer ────────────────────────────────────────────────────────────
    lines.push('');
    lines.push((multiDay ? labels.dayTotal : labels.total).replace('{{count}}', String(sumTotal(rows))));
    if (multiDay) lines.push('');
  });
  if (multiDay) lines.push(labels.total.replace('{{count}}', String(sumTotal(allRows))));

  return '\uFEFF' + lines.join('\r\n');
};

/** Trigger a browser download of the given CSV string. */
export const downloadWorkshopCsv = (title: string, csv: string): void => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_workshop.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
