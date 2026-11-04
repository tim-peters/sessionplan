import { describe, it, expect, vi } from 'vitest';
import { buildWorkshopCsv, downloadWorkshopCsv, type CsvColumnLabels } from '@/lib/workshop-csv';
import { makeBlock, makeBreakout, makeGroup, makeWorkshop } from './test-helpers';
import type { WorkshopData, WorkshopItem } from '@/types/workshop';

const LABELS_DE: CsvColumnLabels = {
  nr: 'Nr.',
  from: 'Von',
  to: 'Bis',
  duration: 'Dauer (Min.)',
  type: 'Typ',
  title: 'Titel',
  breakoutGroup: 'Breakout-Gruppe',
  people: 'Personen',
  material: 'Material',
  notes: 'Notizen',
  total: 'Gesamt: {{count}} Min.',
  dayTotal: 'Summe: {{count}} Min.',
  day: (index) => `Tag ${index}`,
  group: 'Gruppe',
  breakout: 'Breakout',
  block: 'Block',
  all: 'alle',
};

const LABELS_EN: CsvColumnLabels = {
  nr: 'No.',
  from: 'From',
  to: 'To',
  duration: 'Duration (min)',
  type: 'Type',
  title: 'Title',
  breakoutGroup: 'Breakout group',
  people: 'Persons',
  material: 'Material',
  notes: 'Notes',
  total: 'Total: {{count}} min',
  dayTotal: 'Subtotal: {{count}} min',
  day: (index) => `Day ${index}`,
  group: 'Group',
  breakout: 'Breakout',
  block: 'Block',
  all: 'all',
};

/** Strip the leading BOM and split on CRLF into physical lines. */
const splitLines = (csv: string): string[] => {
  const stripped = csv.startsWith('\uFEFF') ? csv.slice(1) : csv;
  return stripped.split('\r\n');
};

describe('buildWorkshopCsv — framing', () => {
  it('starts with a UTF-8 BOM and uses CRLF line endings', () => {
    const csv = buildWorkshopCsv(makeWorkshop(), LABELS_DE, 'de');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    // No bare LF in the body except the CRLF pairs.
    expect(csv.includes('\n')).toBe(true);
    expect(csv.split('\r\n').length).toBeGreaterThan(1);
  });

  it('uses ";" as delimiter for "de" and "," for "en"', () => {
    const de = buildWorkshopCsv(makeWorkshop(), LABELS_DE, 'de');
    const en = buildWorkshopCsv(makeWorkshop(), LABELS_EN, 'en');
    // Header line contains the labels separated by the delimiter.
    const deHeader = splitLines(de).find((l) => l.includes('Nr.'));
    const enHeader = splitLines(en).find((l) => l.includes('No.'));
    expect(deHeader).toBeDefined();
    expect(enHeader).toBeDefined();
    expect(deHeader!.split(';').length).toBeGreaterThan(deHeader!.split(',').length);
    expect(enHeader!.split(',').length).toBeGreaterThan(enHeader!.split(';').length);
  });

  it('emits a valid title+header+footer file when items are empty', () => {
    const data = makeWorkshop({ workshop: { ...makeWorkshop().workshop, title: 'Leere Session' } });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv);
    expect(lines[0]).toBe('Leere Session');
    // Header line includes "Nr." but no actual data rows.
    expect(csv).toContain('Nr.');
    expect(csv).toContain('Gesamt: 0 Min.');
  });
});

describe('buildWorkshopCsv — header layout', () => {
  it('joins Title — Date — StartTime on a single line; description on the next line', () => {
    const data = makeWorkshop({
      workshop: {
        ...makeWorkshop().workshop,
        title: 'My Workshop',
        date: '2026-04-12',
        startTime: '09:00',
        description: 'A great session',
      },
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv);
    expect(lines[0]).toBe('My Workshop — 2026-04-12 — 09:00');
    expect(lines[1]).toBe('A great session');
  });

  it('omits date/startTime/description when all are empty (only title remains)', () => {
    const data = makeWorkshop({
      workshop: { ...makeWorkshop().workshop, title: 'Only Title', date: null, startTime: null, description: '' },
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv);
    expect(lines[0]).toBe('Only Title');
  });

  it('still emits a row when only date+startTime are set (no title)', () => {
    const data = makeWorkshop({
      workshop: {
        ...makeWorkshop().workshop,
        title: '',
        date: '2026-04-12',
        startTime: '09:00',
        description: 'desc',
      },
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv);
    // First line keeps at least one of title/date/startTime, joined em-dash.
    expect(lines[0]).toBe('2026-04-12 — 09:00');
    expect(lines[1]).toBe('desc');
  });
});

describe('buildWorkshopCsv — dropping fully-empty columns', () => {
  it('drops all four optional columns when no breakout/notes/material/persons are used', () => {
    const data = makeWorkshop({
      workshop: { ...makeWorkshop().workshop, startTime: '10:00' },
      items: [makeBlock({ id: 'b1', title: 'Solo', duration: 30 })],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv);
    const header = lines.find((l) => l.startsWith('Nr.'));
    expect(header).toBe('Nr.;Von;Bis;Dauer (Min.);Typ;Titel');
    expect(csv).not.toContain('Breakout-Gruppe');
    expect(csv).not.toContain('Personen');
    expect(csv).not.toContain('Material');
    expect(csv).not.toContain('Notizen');
  });

  it('keeps only the Notizen column when blocks have notes but nothing else', () => {
    const data = makeWorkshop({
      items: [
        makeBlock({ id: 'b1', title: 'A', duration: 5, notes: 'bring laptop' }),
        makeBlock({ id: 'b2', title: 'B', duration: 5, notes: 'wifi password' }),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv);
    const header = lines.find((l) => l.startsWith('Nr.'));
    expect(header).toBe('Nr.;Dauer (Min.);Typ;Titel;Notizen');
    // Data rows end with the note text and no trailing extra cells.
    expect(csv).toMatch(/(^|\r\n)1;5;Block;A;bring laptop\r?$/m);
    expect(csv).toMatch(/(^|\r\n)2;5;Block;B;wifi password\r?$/m);
  });

  it('keeps Breakout-Gruppe (but not Personen/Material/Notizen) when breakouts have no persons', () => {
    const data = makeWorkshop({
      items: [
        makeBreakout(
          [
            makeBlock({ id: 'l1', duration: 5, laneIndex: 0 }),
            makeBlock({ id: 'l2', duration: 5, laneIndex: 1 }),
          ],
          { id: 'bo', lanes: 2, sameInAllBreakouts: false },
        ),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv);
    const header = lines.find((l) => l.startsWith('Nr.'));
    expect(header).toBe('Nr.;Dauer (Min.);Typ;Titel;Breakout-Gruppe');
    expect(csv).toMatch(/(^|\r\n)1\.1;5;Block;Test Block;1\r?$/m);
    expect(csv).toMatch(/(^|\r\n)1\.2;5;Block;Test Block;2\r?$/m);
    // Personen/Material/Notizen dropped (no notes/material and no personIds).
    expect(csv).not.toContain('Personen');
    expect(csv).not.toContain('Material');
    expect(csv).not.toContain('Notizen');
  });
});

describe('buildWorkshopCsv — escaping (RFC 4180)', () => {
  it('quotes a field that contains the delimiter', () => {
    const data = makeWorkshop({
      items: [makeBlock({ id: 'b1', title: 'A;B', duration: 5 })],
    });
    const de = buildWorkshopCsv(data, LABELS_DE, 'de');
    expect(de).toContain('"A;B"');
  });

  it('doubles internal quotes and wraps the field', () => {
    const data = makeWorkshop({
      items: [makeBlock({ id: 'b1', title: 'She said "hi"', duration: 5 })],
    });
    const csv = buildWorkshopCsv(data, LABELS_EN, 'en');
    expect(csv).toContain('"She said ""hi"""');
  });

  it('preserves a multi-line note in a single quoted cell', () => {
    const data = makeWorkshop({
      items: [makeBlock({ id: 'b1', title: 'Note', notes: 'line1\nline2', duration: 5 })],
    });
    const csv = buildWorkshopCsv(data, LABELS_EN, 'en');
    expect(csv).toContain('"line1\nline2"');
    // The whole file still uses CRLF, so the only LF is inside the note.
    const stripped = csv.startsWith('\uFEFF') ? csv.slice(1) : csv;
    const lfCount = (stripped.match(/\n/g) || []).length;
    const crlfCount = (stripped.match(/\r\n/g) || []).length;
    expect(lfCount).toBe(crlfCount + 1);
  });
});

describe('buildWorkshopCsv — time columns', () => {
  it('drops Von/Bis columns when no startTime is set', () => {
    const data = makeWorkshop({
      items: [makeBlock({ id: 'b1', title: 'No clock', duration: 5 })],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    expect(csv).not.toContain('Von');
    expect(csv).not.toContain('Bis');
  });

  it('emits Von/Bis columns when startTime is set, computing against it', () => {
    const data = makeWorkshop({
      workshop: { ...makeWorkshop().workshop, startTime: '10:00' },
      items: [
        makeBlock({ id: 'b1', title: 'A', duration: 15 }),
        makeBlock({ id: 'b2', title: 'B', duration: 5 }),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    expect(csv).toContain('Von');
    expect(csv).toContain('Bis');
    // A starts at 10:00 ends at 10:15; B starts at 10:15 ends at 10:20.
    expect(csv).toContain('10:00');
    expect(csv).toContain('10:15');
    expect(csv).toContain('10:20');
  });
});

describe('buildWorkshopCsv — group semantics', () => {
  it('uses sum of children for group duration when not durationLocked', () => {
    const data = makeWorkshop({
      items: [
        makeGroup([
          makeBlock({ id: 'b1', duration: 10 }),
          makeBlock({ id: 'b2', duration: 5 }),
        ], { id: 'g1', title: 'G' }),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    // No startTime → no Von/Bis; no persons/notes/material/breakouts → no droppable
    // columns. Row: Nr=1; Duration=15; Type=Gruppe; Title=G.
    expect(csv).toMatch(/(^|\r\n)1;15;Gruppe;G\r?$/m);
  });

  it('uses the locked duration when durationLocked is true', () => {
    const data = makeWorkshop({
      items: [
        makeGroup(
          [makeBlock({ id: 'b1', duration: 10 }), makeBlock({ id: 'b2', duration: 5 })],
          { id: 'g1', title: 'Locked', duration: 99, durationLocked: true },
        ),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    expect(csv).toContain(';99;');
  });
});

describe('buildWorkshopCsv — breakouts', () => {
  it('breakout duration is the per-lane max', () => {
    const data = makeWorkshop({
      items: [
        makeBreakout([
          makeBlock({ id: 'l0', duration: 5, laneIndex: 0 }),
          makeBlock({ id: 'l0b', duration: 3, laneIndex: 0 }),
          makeBlock({ id: 'l1', duration: 10, laneIndex: 1 }),
        ], { id: 'bo', lanes: 2 }),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    // Lane 0 sums to 8, lane 1 sums to 10 → max is 10.
    // No startTime → no Von/Bis. Breakout-Gruppe is kept (children have lane
    // cells). No Personen/Material/Notizen. Row: Nr=1; Duration=10; Type=Breakout;
    // Title=Test Breakout; Breakout-Gruppe=.
    expect(csv).toMatch(/(^|\r\n)1;10;Breakout;Test Breakout;$/m);
  });

  it('emits a single "alle" row per child when sameInAllBreakouts is true', () => {
    const data = makeWorkshop({
      items: [
        makeBreakout(
          [
            makeBlock({ id: 'a', duration: 5, laneIndex: 0 }),
            makeBlock({ id: 'b', duration: 5, laneIndex: 1 }),
          ],
          { id: 'bo', lanes: 2, sameInAllBreakouts: true },
        ),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv);
    // 1 summary row + exactly 2 child rows (no N× duplication).
    const dataRows = lines.filter((l) => /^\d/.test(l) || /^\d+\.\d/.test(l));
    const childRows = dataRows.filter((l) => /^\d+\.\d/.test(l));
    expect(childRows.length).toBe(2);
    // Breakout-Gruppe is the last column (no Personen/Material/Notizen → dropped).
    for (const row of childRows) expect(row.endsWith(';alle')).toBe(true);
  });

  it('numbers breakout child rows continuously across lanes (1.1, 1.2, …)', () => {
    const data = makeWorkshop({
      items: [
        makeBreakout(
          [
            makeBlock({ id: 'a', duration: 5, laneIndex: 1 }),
            makeBlock({ id: 'b', duration: 5, laneIndex: 0 }),
          ],
          { id: 'bo', lanes: 2, sameInAllBreakouts: false },
        ),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    expect(csv).toMatch(/(^|\r\n)1\.1;/);
    expect(csv).toMatch(/(^|\r\n)1\.2;/);
  });

  it('supports up to 10 lanes (lane index 0…9 → cell "1"…"10")', () => {
    const children: WorkshopItem[] = Array.from({ length: 10 }, (_, i) =>
      makeBlock({ id: `b${i}`, duration: 5, laneIndex: i }),
    );
    const data = makeWorkshop({
      items: [makeBreakout(children, { id: 'bo', lanes: 10, sameInAllBreakouts: false })],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    // Breakout-Gruppe is the last remaining column. Each lane label appears
    // either as `;i;` (not last) or `;i$` (last) depending on row position.
    for (let i = 1; i <= 10; i++) {
      expect(csv).toMatch(new RegExp(`;${i}(;|$)`, 'm'));
    }
  });

  it('emits a "1: A; 2: B" lane-persons override under sameInAllBreakouts', () => {
    const data: WorkshopData = makeWorkshop({
      persons: [
        { id: 'p1', name: 'Anna', color: '#000' },
        { id: 'p2', name: 'Ben', color: '#000' },
      ],
      items: [
        makeBreakout(
          [makeBlock({ id: 'a', duration: 5, laneIndex: 0 })],
          {
            id: 'bo',
            lanes: 2,
            sameInAllBreakouts: true,
            lanePersons: { 0: ['p1'], 1: ['p2'] },
          },
        ),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    expect(csv).toContain('1: Anna; 2: Ben');
  });
});

describe('buildWorkshopCsv — numbering', () => {
  it('numbers top-level items 1, 2, 3', () => {
    const data = makeWorkshop({
      items: [
        makeBlock({ id: 'b1', title: 'A', duration: 5 }),
        makeBlock({ id: 'b2', title: 'B', duration: 5 }),
        makeBlock({ id: 'b3', title: 'C', duration: 5 }),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    const lines = splitLines(csv).filter((l) => /^[123];/.test(l));
    expect(lines.length).toBe(3);
    expect(lines[0].startsWith('1;')).toBe(true);
    expect(lines[1].startsWith('2;')).toBe(true);
    expect(lines[2].startsWith('3;')).toBe(true);
  });

  it('numbers group children 2.1, 2.2, …', () => {
    const data = makeWorkshop({
      items: [
        makeBlock({ id: 'b1', duration: 5 }),
        makeGroup(
          [
            makeBlock({ id: 'b2', duration: 5 }),
            makeBlock({ id: 'b3', duration: 5 }),
          ],
          { id: 'g', title: 'G' },
        ),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    expect(csv).toMatch(/(^|\r\n)2\.1;/);
    expect(csv).toMatch(/(^|\r\n)2\.2;/);
  });
});

describe('buildWorkshopCsv — footer total counts top-level once', () => {
  it('sums a top-level block (15) + a top-level group (60) = 75, not double-counting children', () => {
    const data = makeWorkshop({
      items: [
        makeBlock({ id: 'b1', title: 'Solo', duration: 15 }),
        makeGroup(
          [
            makeBlock({ id: 'g1', duration: 30 }),
            makeBlock({ id: 'g2', duration: 30 }),
          ],
          { id: 'g', title: 'My Group' },
        ),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    expect(csv).toContain('Gesamt: 75 Min.');
  });

  it('counts group totals once for an all-groups plan (no top-level blocks)', () => {
    const data = makeWorkshop({
      items: [
        makeGroup(
          [makeBlock({ id: 'a', duration: 10 }), makeBlock({ id: 'b', duration: 20 })],
          { id: 'g1', title: 'G1' },
        ),
        makeGroup(
          [makeBlock({ id: 'c', duration: 15 }), makeBlock({ id: 'd', duration: 25 })],
          { id: 'g2', title: 'G2' },
        ),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    // G1 = 30, G2 = 40 → total 70, not 0.
    expect(csv).toContain('Gesamt: 70 Min.');
  });
});

describe('buildWorkshopCsv — timing semantics', () => {
  it('two top-level parallel blocks share the same Von', () => {
    const data = makeWorkshop({
      workshop: { ...makeWorkshop().workshop, startTime: '10:00' },
      items: [
        makeBlock({ id: 'a', title: 'A', duration: 5, parallel: true }),
        makeBlock({ id: 'b', title: 'B', duration: 7, parallel: true }),
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    // Both share the start "10:00". Their Bis cells reflect each block's own
    // duration (5 and 7 min after 10:00), so 10:05 and 10:07.
    expect(csv).toMatch(/(^|\r\n)1;10:00;10:05;/);
    expect(csv).toMatch(/(^|\r\n)2;10:00;10:07;/);
  });

  it('honors fixedStartTime: a block after a fixed-time block shows the gap', () => {
    const data = makeWorkshop({
      workshop: { ...makeWorkshop().workshop, startTime: '09:00' },
      items: [
        makeBlock({ id: 'a', title: 'A', duration: 10 }),                                  // 09:00–09:10
        makeBlock({ id: 'b', title: 'B', duration: 5, fixedStartTime: '11:00' }),          // 11:00–11:05
        makeBlock({ id: 'c', title: 'C', duration: 5 }),                                    // 11:05–11:10
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    // The fixedStartTime snaps B to 11:00, leaving a 09:10–11:00 gap.
    expect(csv).toMatch(/(^|\r\n)1;09:00;09:10;/);
    expect(csv).toMatch(/(^|\r\n)2;11:00;11:05;/);
    expect(csv).toMatch(/(^|\r\n)3;11:05;11:10;/);
  });
});

describe('buildWorkshopCsv — robustness against undefined template fields', () => {
  // Templates can produce items where notes/material/title are missing, or
  // metadata that lacks description/date. The CSV builder must not crash.
  // We type-cast the bad fields to `unknown` first to bypass TypeScript's
  // "required" assertions; the spec is about runtime defensiveness.

  it('item with missing notes/material + metadata with no description/date still exports', () => {
    const data = makeWorkshop({
      workshop: { ...makeWorkshop().workshop, date: null, startTime: null, description: '' },
    });
    // Strip optional string fields to simulate a sparse template.
    const sparse: WorkshopItem = {
      id: 'sparse',
      type: 'block',
      blockTypeId: null,
      title: 'Sparse',
      duration: 5,
      notes: undefined as unknown as string,
      material: undefined as unknown as string,
    };
    data.items = [sparse];
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    // All droppable columns (Breakout-Gruppe, Personen, Material, Notizen) are
    // empty across all data rows, so they are dropped. Header + data row
    // contain only the mandatory columns.
    const lines = splitLines(csv);
    const dataLine = lines.find((l) => /^1;/.test(l));
    expect(dataLine).toBeDefined();
    expect(dataLine).toBe('1;5;Block;Sparse');
    // Header is the line just before the data row.
    const headerIdx = lines.indexOf(dataLine!) - 1;
    expect(lines[headerIdx]).toBe('Nr.;Dauer (Min.);Typ;Titel');
    // No date/description in the sub-line — only the title remains.
    expect(csv).not.toContain(' — ');
  });

  it('person/blockType lookup miss leaves the cell empty instead of "undefined"', () => {
    const data: WorkshopData = makeWorkshop({
      blockTypes: [
        { id: 'present', name: 'Vortrag', color: '#000' },
        // Simulate a blockType entry with a missing name (template quirk).
        { id: 'ghost', name: undefined as unknown as string, color: '#000' },
      ],
      persons: [
        { id: 'p1', name: 'Anna', color: '#000' },
        { id: 'p2', name: undefined as unknown as string, color: '#000' },
      ],
      items: [
        {
          id: 'a',
          type: 'block',
          blockTypeId: 'present',
          title: 'Known',
          duration: 5,
          notes: '',
          material: '',
          personIds: ['p1'],
        },
        {
          id: 'b',
          type: 'block',
          blockTypeId: 'ghost',
          title: 'Ghost type',
          duration: 5,
          notes: '',
          material: '',
          personIds: ['p2'],
        },
        {
          id: 'c',
          type: 'block',
          blockTypeId: 'missing-id',
          title: 'Orphan type',
          duration: 5,
          notes: '',
          material: '',
        },
      ],
    });
    const csv = buildWorkshopCsv(data, LABELS_DE, 'de');
    // Personen column is kept (p1 = "Anna" is non-empty on row 1). All other
    // droppable columns are empty across all rows and therefore dropped.
    // Header: Nr.;Dauer (Min.);Typ;Titel;Personen
    expect(csv).toContain('1;5;Vortrag;Known;Anna');
    // "Ghost type" (blockTypeId is set but name is missing) → empty Typ cell.
    // "Orphan type" (blockTypeId is not in the map) → fallback localized "Block".
    // Their person cell is empty (not "undefined").
    expect(csv).toContain('2;5;;Ghost type;');
    expect(csv).toContain('3;5;Block;Orphan type;');
    expect(csv).not.toContain('undefined');
  });
});

describe('downloadWorkshopCsv', () => {
  it('triggers a download with a sanitized filename', () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob: Blob | null = null;
    let capturedFileName: string | null = null;

    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:fake';
    });
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      capturedFileName = this.download;
    };

    try {
      downloadWorkshopCsv('My Workshop!! 2026', 'x;y');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    }

    expect(blob).not.toBeNull();
    expect(capturedFileName).toBe('My_Workshop___2026_workshop.csv');
  });
});

describe('buildWorkshopCsv — multiple days', () => {
  const twoDays = (): WorkshopData => {
    const data = makeWorkshop({ items: [makeBlock({ id: 'a', title: 'Auftakt', duration: 30 })] });
    return {
      ...data,
      workshop: { ...data.workshop, title: 'Retreat', description: 'Ankommen', date: '2026-10-12', startTime: '09:00' },
      days: [
        { id: 'd1', title: 'Montag' },
        {
          id: 'd2',
          description: 'Abschluss',
          date: '2026-10-13',
          startTime: '14:00',
          items: [
            makeBlock({ id: 'b', title: 'Bauen', duration: 45 }),
            makeBlock({ id: 'c', title: 'Zeigen', duration: 15, notes: 'Kurz' }),
          ],
        },
      ],
    };
  };

  it('lists the days below each other with headings and totals', () => {
    const lines = splitLines(buildWorkshopCsv(twoDays(), LABELS_DE, 'de'));

    expect(lines[0]).toBe('Retreat');
    expect(lines[2]).toBe('Montag — 2026-10-12 — 09:00');
    expect(lines[3]).toBe('Ankommen');
    expect(lines).toContain('Tag 2 — 2026-10-13 — 14:00');
    expect(lines).toContain('Abschluss');
    expect(lines).toContain('Summe: 30 Min.');
    expect(lines).toContain('Summe: 60 Min.');
    expect(lines[lines.length - 1]).toBe('Gesamt: 90 Min.');
  });

  it('computes times from the start of each day and numbers each day from 1', () => {
    const lines = splitLines(buildWorkshopCsv(twoDays(), LABELS_DE, 'de'));

    expect(lines.find((line) => line.includes('Auftakt'))?.startsWith('1;09:00;09:30;30;')).toBe(true);
    expect(lines.find((line) => line.includes('Bauen'))?.startsWith('1;14:00;14:45;45;')).toBe(true);
    expect(lines.find((line) => line.includes('Zeigen'))?.startsWith('2;14:45;15:00;15;')).toBe(true);
  });

  it('keeps the same columns on every day', () => {
    const lines = splitLines(buildWorkshopCsv(twoDays(), LABELS_DE, 'de'));
    const headers = lines.filter((line) => line.startsWith('Nr.;'));

    expect(headers).toHaveLength(2);
    expect(headers[0]).toBe(headers[1]);
    expect(headers[0]).toContain('Notizen');
    // A note on the second day keeps the column, so the first day has an empty cell there.
    expect(lines.find((line) => line.includes('Auftakt'))?.split(';')).toHaveLength(headers[0].split(';').length);
  });

  it('leaves the times empty on a day without a start time', () => {
    const data = twoDays();
    data.days![1].startTime = null;
    const lines = splitLines(buildWorkshopCsv(data, LABELS_DE, 'de'));

    expect(lines.find((line) => line.includes('Auftakt'))?.startsWith('1;09:00;09:30;')).toBe(true);
    expect(lines.find((line) => line.includes('Bauen'))?.startsWith('1;;;45;')).toBe(true);
  });

  it('still lists an empty day', () => {
    const data = twoDays();
    data.days![1] = { id: 'd2', title: 'Puffer' };
    const lines = splitLines(buildWorkshopCsv(data, LABELS_DE, 'de'));

    expect(lines).toContain('Puffer');
    expect(lines).toContain('Summe: 0 Min.');
    expect(lines[lines.length - 1]).toBe('Gesamt: 30 Min.');
  });

  it('leaves a single-day plan without day headings or subtotal', () => {
    const data = twoDays();
    delete data.days;
    const lines = splitLines(buildWorkshopCsv(data, LABELS_DE, 'de'));

    expect(lines[0]).toBe('Retreat — 2026-10-12 — 09:00');
    expect(lines[1]).toBe('Ankommen');
    expect(lines[2]).toBe('');
    expect(lines[lines.length - 1]).toBe('Gesamt: 30 Min.');
    expect(lines.some((line) => line.startsWith('Summe'))).toBe(false);
  });
});
