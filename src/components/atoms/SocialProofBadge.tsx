/**
 * SocialProofBadge — Compact rating + usage line shown below the hero CTA.
 *
 * Role: Pure presentation of the site-wide figures from site-stats.json. The
 *       same rating is injected into the page's JSON-LD (withAggregateRating),
 *       so badge and structured data can never drift apart.
 *
 * Stars are partially filled (4.8 → 96 % width overlay) and hidden from
 * assistive tech; the visible text carries the full information.
 *
 * The small info button discloses how ratings are collected and that they are
 * not verified, as required by § 5b Abs. 3 UWG for displayed consumer reviews.
 */
import { Info, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/primitives/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/primitives/popover';
import { useLocale } from '@/contexts/LocaleContext';
import type { SiteStats } from '@/types/landingPage';

const STARS = [0, 1, 2, 3, 4];

interface SocialProofBadgeProps {
  stats: SiteStats;
  className?: string;
}

export const SocialProofBadge = ({ stats, className = '' }: SocialProofBadgeProps) => {
  const { t } = useTranslation('common');
  const { locale } = useLocale();
  const { rating, monthlyUsers } = stats;
  if (!rating && !monthlyUsers) return null;

  const formatNumber = (value: number, fractionDigits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);

  const fillPercent = rating ? Math.min(100, Math.max(0, (rating.value / 5) * 100)) : 0;

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${className}`}>
      {rating && (
        <>
          <span className="relative inline-flex" aria-hidden="true">
            <span className="flex">
              {STARS.map((i) => (
                <Star key={i} className="h-4 w-4 text-primary dark:text-white" />
              ))}
            </span>
            <span className="absolute inset-0 flex overflow-hidden" style={{ width: `${fillPercent}%` }}>
              {STARS.map((i) => (
                <Star
                  key={i}
                  className="h-4 w-4 shrink-0 fill-primary text-primary dark:fill-white dark:text-white"
                />
              ))}
            </span>
          </span>
          <span>
            <span className="font-semibold text-foreground">
              {t('emptyState.socialProof.rating', { value: formatNumber(rating.value, 1) })}
            </span>{' '}
            ({t('emptyState.socialProof.ratingCount', { count: rating.count })})
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="plain"
                size="none"
                aria-label={t('emptyState.socialProof.disclosureLabel')}
                // Icon-sized box keeps the line compact; the ::after layer restores a 44px tap target.
                className="relative -ml-1 inline-flex h-4 w-4 !min-h-0 !min-w-0 items-center justify-center rounded-full p-0 text-muted-foreground/70 after:absolute after:-inset-3.5 after:content-[''] hover:bg-transparent hover:text-foreground active:bg-transparent data-[state=open]:text-foreground"
              >
                {/* 1px nudge: the font's glyphs sit below the line box centre. */}
                <Info className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3 text-xs leading-relaxed">
              {t('emptyState.socialProof.disclosure')}
            </PopoverContent>
          </Popover>
        </>
      )}
      {!!monthlyUsers && (
        // Own line: the hero column is narrow, so an inline separator would dangle on wrap.
        <span className="basis-full">{t('emptyState.socialProof.monthlyUsers', { value: formatNumber(monthlyUsers) })}</span>
      )}
    </div>
  );
};
