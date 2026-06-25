import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * Typography primitive - the type scale from DESIGN.md §4.1. Each variant pins
 * the right family (Hanken 600 for display, Inter 400/500 for body) since React
 * Native can't synthesize weights from one family. Sentence case everywhere
 * (§4.2) - that's a copy convention, enforced by authoring, not by transform.
 */

export type TextVariant =
  | 'ringLg' // ring number, profile header
  | 'ringMd' // ring number, feed card
  | 'title' // screen title
  | 'heading' // section heading ("This week")
  | 'cardName' // person name
  | 'body' // default text
  | 'label' // field labels, secondary
  | 'button' // button text
  | 'caption'; // month label, captions

const VARIANT: Record<TextVariant, string> = {
  ringLg: 'font-display text-[26px] leading-[26px] text-ink',
  ringMd: 'font-display text-[20px] leading-[20px] text-ink',
  title: 'font-display text-[24px] leading-[30px] tracking-[-0.24px] text-ink',
  heading: 'font-display text-[18px] leading-[23px] text-ink',
  cardName: 'font-display text-[15px] leading-[20px] text-ink',
  body: 'font-body text-[15px] leading-[24px] text-ink',
  label: 'font-body-medium text-[13px] leading-[18px] text-ink-secondary',
  button: 'font-body-medium text-[14px] leading-[14px] text-ink',
  caption: 'font-body text-[12px] leading-[16px] text-ink-muted',
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  /** Use tabular figures for counts/ages so they don't jitter (§4.2, §11). */
  tabularNums?: boolean;
  className?: string;
};

export function Text({
  variant = 'body',
  tabularNums,
  className,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      className={cn(VARIANT[variant], className)}
      style={[tabularNums ? { fontVariant: ['tabular-nums'] } : null, style]}
      {...rest}
    />
  );
}
