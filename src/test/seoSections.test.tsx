/**
 * SeoSection — dispatcher and section component smoke tests.
 *
 * Verifies that the SEO module dispatcher renders the right component for each
 * `type` value, the CTA section wires `data-add-block="true"` to the
 * `onAddBlock` handler, prose sections fall through when `type` is omitted,
 * and that each section renders as a full-bleed <section> with generous
 * vertical padding (no card boxes).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SeoSection } from '@/components/landingcontent/SeoSection';
import type { SeoSection as SeoSectionType } from '@/types/landingPage';

describe('SeoSection dispatcher', () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it('renders prose when type is omitted (backwards compat)', () => {
    const section = { title: 'Hello', content: '<p>World</p>' } as SeoSectionType;
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
    // Section is full-bleed (no max-w-* on the <section>), no card classes
    const sectionEl = container.querySelector('section')!;
    expect(sectionEl.className).toContain('py-16');
    expect(sectionEl.className).not.toContain('rounded-2xl');
    expect(sectionEl.className).not.toContain('bg-card');
  });

  it('renders features in a full-bleed muted panel with subtle tile cards', () => {
    const section: SeoSectionType = {
      type: 'features',
      title: 'Features',
      items: [
        { icon: 'Mic', title: 'Mic tile', description: 'mic desc' },
        { icon: 'Play', title: 'Play tile' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Features' })).toBeInTheDocument();
    expect(screen.getByText('Mic tile')).toBeInTheDocument();
    expect(screen.getByText('Play tile')).toBeInTheDocument();
    const sectionEl = container.querySelector('section')!;
    expect(sectionEl.className).toContain('bg-muted/30');
    // Each tile keeps a subtle card style
    const tiles = container.querySelectorAll('li');
    expect(tiles[0].className).toContain('rounded-2xl');
    expect(tiles[0].className).toContain('bg-card');
  });

  it('renders features with columns: 2 capped at two columns', () => {
    const section: SeoSectionType = {
      type: 'features',
      title: 'Tinted Features',
      tint: 'info',
      columns: 2,
      items: [
        { icon: 'Mic', title: 'A' },
        { icon: 'Play', title: 'B' },
        { icon: 'Star', title: 'C' },
        { icon: 'Heart', title: 'D' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    const sectionEl = container.querySelector('section')!;
    // Tinted background, light + dark variants
    expect(sectionEl.className).toContain('bg-blue-50');
    expect(sectionEl.className).toContain('dark:bg-blue-950/40');
    expect(sectionEl.className).not.toContain('bg-muted/30');
    // columns: 2 is honored — no 3-col expansion on large screens
    const grid = container.querySelector('ul')!;
    expect(grid.className).toContain('sm:grid-cols-2');
    expect(grid.className).not.toContain('lg:grid-cols-3');
    // Tiles keep the card style so they pop on the tinted background
    const tiles = container.querySelectorAll('li');
    expect(tiles[0].className).toContain('bg-card');
  });

  it('renders features with columns: 3 expanded to three columns on large screens', () => {
    const section: SeoSectionType = {
      type: 'features',
      title: '3-col Features',
      columns: 3,
      items: [
        { icon: 'Mic', title: 'A' },
        { icon: 'Play', title: 'B' },
        { icon: 'Star', title: 'C' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    const grid = container.querySelector('ul')!;
    expect(grid.className).toContain('sm:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-3');
  });

  it('renders features with columns: 1 laid out as a single column', () => {
    const section: SeoSectionType = {
      type: 'features',
      title: '1-col Features',
      columns: 1,
      items: [
        { icon: 'Mic', title: 'A' },
        { icon: 'Play', title: 'B' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    const grid = container.querySelector('ul')!;
    // No multi-col classes when columns: 1
    expect(grid.className).not.toContain('sm:grid-cols-2');
    expect(grid.className).not.toContain('lg:grid-cols-3');
  });

  it('treats tint and columns as independent axes for features', () => {
    // Same tint, different columns → different grid only, same section background
    const twoCol: SeoSectionType = {
      type: 'features',
      title: '2-col',
      tint: 'info',
      columns: 2,
      items: [{ icon: 'Mic', title: 'A' }, { icon: 'Play', title: 'B' }],
    };
    const threeCol: SeoSectionType = {
      type: 'features',
      title: '3-col',
      tint: 'info',
      columns: 3,
      items: [{ icon: 'Mic', title: 'A' }, { icon: 'Play', title: 'B' }, { icon: 'Star', title: 'C' }],
    };
    const { container: c1 } = render(<SeoSection section={twoCol} onAddBlock={vi.fn()} />);
    const { container: c2 } = render(<SeoSection section={threeCol} onAddBlock={vi.fn()} />);
    const g1 = c1.querySelector('ul')!;
    const g2 = c2.querySelector('ul')!;
    // Both share the info tint background
    expect(c1.querySelector('section')!.className).toContain('bg-blue-50');
    expect(c2.querySelector('section')!.className).toContain('bg-blue-50');
    // But grids differ
    expect(g1.className).not.toContain('lg:grid-cols-3');
    expect(g2.className).toContain('lg:grid-cols-3');
  });

  it('renders checklist items with checkmark icons on a muted panel', () => {
    const section: SeoSectionType = {
      type: 'checklist',
      title: 'Vorteile',
      items: [
        { label: 'Free', description: 'no cost' },
        { label: 'Open', description: 'no signup' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('no cost')).toBeInTheDocument();
    const sectionEl = container.querySelector('section')!;
    expect(sectionEl.className).toContain('bg-muted/30');
  });

  it('renders steps with numbered circles and an ordered list', () => {
    const section: SeoSectionType = {
      type: 'steps',
      title: 'Plan',
      items: [
        { title: 'Briefing', description: 'define goals' },
        { title: 'Outline', description: 'structure' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    expect(screen.getByText('Briefing')).toBeInTheDocument();
    expect(container.querySelector('ol')).toBeInTheDocument();
  });

  it('renders faq as an accordion with all questions as triggers', () => {
    const section: SeoSectionType = {
      type: 'faq',
      title: 'FAQ',
      items: [
        { question: 'Q1?', answer: '<p>A1</p>' },
        { question: 'Q2?', answer: '<p>A2</p>' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    expect(screen.getByText('Q1?')).toBeInTheDocument();
    expect(screen.getByText('Q2?')).toBeInTheDocument();
    // No card wrapping the section
    const sectionEl = container.querySelector('section')!;
    expect(sectionEl.className).not.toContain('rounded-2xl');
    expect(sectionEl.className).not.toContain('bg-card');
  });

  it('renders cta as a full-bleed primary section with an inverse button that calls onAddBlock', () => {
    const onAddBlock = vi.fn();
    const section: SeoSectionType = {
      type: 'cta',
      title: 'Loslegen',
      description: 'Jetzt starten',
      buttonText: 'Plan erstellen',
      buttonNote: 'Kostenlos',
    };
    const { container } = render(<SeoSection section={section} onAddBlock={onAddBlock} />);
    const sectionEl = container.querySelector('section')!;
    expect(sectionEl.className).toContain('bg-primary');
    expect(sectionEl.className).toContain('text-primary-foreground');
    expect(sectionEl.className).toContain('py-20');
    const button = screen.getByRole('button', { name: /Plan erstellen/ });
    expect(button).toHaveAttribute('data-add-block', 'true');
    expect(button.className).toContain('bg-primary-foreground');
    expect(button.className).toContain('text-primary');
    fireEvent.click(button);
    expect(onAddBlock).toHaveBeenCalledTimes(1);
  });

  // Regression: a typed section without items must not crash. This protects
  // against the dnd-session-planen.json case where the backend saved a `type`
  // without the required `items` / `buttonText` fields.
  it('does not crash when a typed section has missing items / buttonText', () => {
    const cases: SeoSectionType[] = [
      { type: 'features', title: 'F', items: undefined as never },
      { type: 'faq', title: 'F', items: undefined as never },
      { type: 'checklist', title: 'C', items: undefined as never },
      { type: 'steps', title: 'S', items: undefined as never },
      { type: 'cta', title: 'C', buttonText: '' as never },
    ];
    for (const section of cases) {
      const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
      expect(container.querySelector('section')).toBeInTheDocument();
    }
  });

  it('renders callout as a single tinted card that fits the page flow', () => {
    const section: SeoSectionType = {
      type: 'callout',
      title: 'Pro-Tipp: Vorlage als Startpunkt',
      description: 'Kopiere eine <a href="/templates">bestehende Vorlage</a> und passe sie an.',
      icon: 'Lightbulb',
      tint: 'info',
      items: [
        { title: 'Wiederverwenden', description: 'Aus der Block-Bibliothek.' },
        { title: 'Mit dem Team teilen', description: 'Per Link oder JSON.' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    expect(screen.getByText('Pro-Tipp: Vorlage als Startpunkt')).toBeInTheDocument();
    expect(screen.getByText('Wiederverwenden')).toBeInTheDocument();
    expect(screen.getByText('Aus der Block-Bibliothek.')).toBeInTheDocument();
    const inner = container.querySelector('section > div')!;
    expect(inner.className).toContain('max-w-4xl');
  });

  it('renders callout with both light- and dark-mode tint classes', () => {
    const section: SeoSectionType = {
      type: 'callout',
      title: 'Hinweis',
      icon: 'Info',
      tint: 'info',
      description: 'Erfolg',
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    // Card uses .rounded-xl; the icon plate inside also has .rounded-xl but
    // it lives later in document order — querySelector picks the card first.
    const card = container.querySelector('.rounded-xl')!;
    // light + dark classes should both be present so the class works in
    // either mode under `darkMode: ['class']`.
    expect(card.className).toContain('bg-blue-50');
    expect(card.className).toContain('dark:bg-blue-950/40');
    expect(card.className).toContain('border-blue-200');
    expect(card.className).toContain('dark:border-blue-800/60');
    // Icon plate uses the design-system surface token (works in both modes)
    const iconPlate = container.querySelector('.bg-card')!;
    expect(iconPlate).toBeInTheDocument();
  });

  it('renders stats as a row of 2–4 number tiles with labels', () => {
    const section: SeoSectionType = {
      type: 'stats',
      title: 'Sessionplan in Zahlen',
      items: [
        { value: '10k+', label: 'Sessions geplant' },
        { value: '100%', label: 'Kostenlos' },
        { value: '0', label: 'Werbe-Tracker' },
        { value: '∞', label: 'Vorlagen' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    expect(screen.getByText('Sessions geplant')).toBeInTheDocument();
    expect(screen.getByText('10k+')).toBeInTheDocument();
    expect(screen.getByText('∞')).toBeInTheDocument();
    const list = container.querySelector('dl')!;
    expect(list).toBeInTheDocument();
  });

  // Regression: checklist, cta, and stats must render description as HTML
  // (matching prose, features, faq, callout, steps) so that inline tags like
  // <code>, <a>, <strong> show as formatted HTML rather than escaped text.
  it('renders checklist description as HTML (inline tags preserved)', () => {
    const section: SeoSectionType = {
      type: 'checklist',
      title: 'Checklist',
      items: [
        { label: 'Foo', description: 'Use <code>cmd</code> + <strong>K</strong>.' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    expect(container.querySelector('code')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeInTheDocument();
  });

  it('renders cta description and buttonNote as HTML', () => {
    const onAddBlock = vi.fn();
    const section: SeoSectionType = {
      type: 'cta',
      title: 'Loslegen',
      content: 'Siehe <a href="/blog">Blog</a> für Details.',
      buttonText: 'Starten',
      buttonNote: '<em>kostenlos</em>',
    };
    const { container } = render(<SeoSection section={section} onAddBlock={onAddBlock} />);
    expect(container.querySelector('a[href="/blog"]')).toBeInTheDocument();
    expect(container.querySelector('em')).toBeInTheDocument();
  });

  it('renders stats section and item descriptions as HTML', () => {
    const section: SeoSectionType = {
      type: 'stats',
      title: 'Stats',
      content: 'Verwende <code>value</code> und <code>label</code>.',
      items: [
        { value: '1', label: 'Eins', description: 'Siehe <a href="/x">x</a>.' },
      ],
    };
    const { container } = render(<SeoSection section={section} onAddBlock={vi.fn()} />);
    const codes = container.querySelectorAll('code');
    expect(codes.length).toBe(2);
    expect(container.querySelector('a[href="/x"]')).toBeInTheDocument();
  });
});
