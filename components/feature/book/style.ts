import {
  BookPaperKey,
  BookPaperPalettes,
  BookRibbonKey,
  BookRibbonPalettes,
  BookSurfaceKey,
  BookSurfacePalettes,
  BookTypeKey,
  BookTypeSets,
} from '@/constants/theme';
import type { BookTweaks } from '@/utils/books';

/** Resolved style tokens used by every spread atom. */
export type BookViewerStyle = {
  paper: string;
  ink: string;
  soft: string;
  faint: string;
  plateA: string;
  plateB: string;
  ribbon: string;
  ribbonDark: string;
  surface: string;
  serif: string;
  display: string;
  illustrationsEnabled: boolean;
};

const DEFAULTS: Required<Pick<BookTweaks, 'paper' | 'type' | 'ribbon' | 'surface' | 'illustrations_enabled'>> = {
  paper: 'cream',
  type: 'newsreader',
  ribbon: 'terracotta',
  surface: 'ink',
  illustrations_enabled: true,
};

export function resolveBookStyle(tweaks: BookTweaks | undefined): BookViewerStyle {
  const merged = { ...DEFAULTS, ...(tweaks ?? {}) };
  const paperKey = (merged.paper as BookPaperKey) in BookPaperPalettes
    ? (merged.paper as BookPaperKey)
    : 'cream';
  const typeKey = (merged.type as BookTypeKey) in BookTypeSets
    ? (merged.type as BookTypeKey)
    : 'newsreader';
  const ribbonKey = (merged.ribbon as BookRibbonKey) in BookRibbonPalettes
    ? (merged.ribbon as BookRibbonKey)
    : 'terracotta';
  const surfaceKey = (merged.surface as BookSurfaceKey) in BookSurfacePalettes
    ? (merged.surface as BookSurfaceKey)
    : 'ink';
  const paper = BookPaperPalettes[paperKey];
  const ribbon = BookRibbonPalettes[ribbonKey];
  const typeset = BookTypeSets[typeKey];
  return {
    paper: paper.paper,
    ink: paper.ink,
    soft: paper.soft,
    faint: paper.faint,
    plateA: paper.plateA,
    plateB: paper.plateB,
    ribbon: ribbon.c,
    ribbonDark: ribbon.d,
    surface: BookSurfacePalettes[surfaceKey],
    serif: typeset.serif,
    display: typeset.display,
    illustrationsEnabled: !!merged.illustrations_enabled,
  };
}
