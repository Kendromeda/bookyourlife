import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Type } from '@/constants/theme';

import { Folio, PhotoSlot, RibbonMark, RunHead, TextFrame } from './BookAtoms';
import type { SpreadDescriptor } from './mapSpreads';
import type { BookViewerStyle } from './style';

const IMPRINT = 'Book My Life Editions';

type BookPageProps = {
  side: 'verso' | 'recto';
  style: BookViewerStyle;
  width: number;
  height: number;
  children: ReactNode;
  /** When true, omit the paper background — for full-bleed plate pages. */
  plate?: boolean;
};

/**
 * One physical page. Inner box-shadow on the gutter side fakes the
 * binding curve. The paper background and ink color come from the
 * resolved style so a paper/type tweak swaps every page at once.
 */
function BookPage({ side, style, width, height, children, plate }: BookPageProps) {
  const innerShadow: ViewStyle =
    side === 'verso'
      ? { shadowOffset: { width: -10, height: 0 }, shadowRadius: 18, shadowOpacity: 0.18 }
      : { shadowOffset: { width: 10, height: 0 }, shadowRadius: 18, shadowOpacity: 0.18 };
  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: plate ? 'transparent' : style.paper,
          overflow: 'hidden',
          shadowColor: '#000',
          ...innerShadow,
        },
      ]}
    >
      {children}
    </View>
  );
}

type RenderInputs = {
  descriptor: SpreadDescriptor;
  style: BookViewerStyle;
  pageW: number;
  pageH: number;
  /** Maps a slot id to its resolved public photo URL (or null if empty). */
  resolveSlot: (slotId: string) => string | null;
  /** Per-slot upload-in-progress flag. */
  isSlotBusy: (slotId: string) => boolean;
  onPickSlot: (slotId: string) => void;
  onClearSlot: (slotId: string) => void;
};

/**
 * The single dispatching component the viewer renders. Switches on the
 * descriptor kind and lays out a verso/recto pair — the spread itself
 * is the user-facing unit.
 */
export function BookSpread(props: RenderInputs) {
  const { descriptor, style, pageW, pageH } = props;

  switch (descriptor.kind) {
    case 'cover':
      return renderCover(props, descriptor);
    case 'copyright':
      return renderCopyright(props, descriptor);
    case 'contents':
      return renderContents(props, descriptor);
    case 'chapter-opener':
      return renderChapterOpener(props, descriptor);
    case 'body':
      return renderBody(props, descriptor);
    case 'pullquote':
      return renderPullQuote(props, descriptor);
    case 'plate':
      return renderPlate(props, descriptor);
    case 'mediaList':
      return renderMediaList(props, descriptor);
    case 'colophon':
      return renderColophon(props, descriptor);
    default: {
      // Exhaustiveness check — TS will flag if a new kind is added.
      const _exhaustive: never = descriptor;
      return (
        <View style={{ width: pageW * 2, height: pageH, backgroundColor: style.paper }}>
          <Text>{String(_exhaustive)}</Text>
        </View>
      );
    }
  }
}

// ── Spread 1: Frontispiece (verso) + Title (recto) ──────────────────
function renderCover(
  { style, pageW, pageH, resolveSlot, isSlotBusy, onPickSlot, onClearSlot }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'cover' }>,
) {
  const frontispieceId = 'bml-frontispiece';
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        {style.illustrationsEnabled && (
          <View style={{ position: 'absolute', top: 56, left: 38, right: 38, bottom: 80 }}>
            <PhotoSlot
              id={frontispieceId}
              placeholder="Drop a self-portrait"
              filledUrl={resolveSlot(frontispieceId)}
              busy={isSlotBusy(frontispieceId)}
              onPick={onPickSlot}
              onClear={onClearSlot}
              styleTokens={style}
            />
          </View>
        )}
        <View style={{ position: 'absolute', bottom: 36, left: 38, right: 38 }}>
          <Text
            style={{
              fontFamily: Type.mono,
              fontSize: 8.5,
              letterSpacing: 1.6,
              color: style.faint,
              textTransform: 'uppercase',
            }}
          >
            Frontispiece — the author, {d.year}
          </Text>
        </View>
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 38,
            paddingTop: 70,
            paddingBottom: 56,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ alignItems: 'center', gap: 18 }}>
            <RibbonMark size={26} ink={style.ink} ribbon={style.ribbon} />
            <Text
              style={{
                fontFamily: Type.mono,
                fontSize: 9,
                letterSpacing: 2,
                color: style.faint,
                textTransform: 'uppercase',
              }}
            >
              Volume One
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: style.display,
                fontStyle: 'italic',
                fontSize: 30,
                lineHeight: 34,
                color: style.ink,
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              {d.title}
            </Text>
            <View style={{ width: 36, height: 1, backgroundColor: style.ribbon, marginBottom: 16 }} />
            <Text
              style={{
                fontFamily: style.serif,
                fontSize: 12,
                letterSpacing: 2,
                color: style.soft,
              }}
            >
              {d.author.toUpperCase()}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: Type.mono,
              fontSize: 8.5,
              letterSpacing: 1.6,
              color: style.faint,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {IMPRINT}
          </Text>
        </View>
      </BookPage>
    </Spread>
  );
}

// ── Spread 2: Copyright (verso) + Dedication (recto) ────────────────
function renderCopyright(
  { style, pageW, pageH }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'copyright' }>,
) {
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        <View style={{ position: 'absolute', bottom: 60, left: 38, right: 38 }}>
          {[
            `First edition, ${d.year}.`,
            `Printed and bound by ${IMPRINT},\non archival cream stock,\nwith linen cover and gilt ribbon.`,
            `Compiled from ${d.entryCount} entries.`,
            `© ${d.year}. All rights reserved.`,
          ].map((line, i) => (
            <Text
              key={i}
              style={{
                fontFamily: Type.mono,
                fontSize: 9,
                lineHeight: 16,
                color: i === 3 ? style.faint : style.soft,
                marginBottom: 12,
              }}
            >
              {line}
            </Text>
          ))}
        </View>
        <Folio side="verso" n="ii" style={style} />
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <View style={{ position: 'absolute', top: 110, left: 40, right: 40 }}>
          <Text
            style={{
              fontFamily: Type.mono,
              fontSize: 9,
              letterSpacing: 2,
              color: style.faint,
              textTransform: 'uppercase',
              textAlign: 'right',
              marginBottom: 14,
            }}
          >
            For —
          </Text>
          <Text
            style={{
              fontFamily: style.display,
              fontStyle: 'italic',
              fontSize: 18,
              lineHeight: 26,
              color: style.ink,
              textAlign: 'right',
            }}
          >
            the year that taught me{`\n`}to keep the cup, not the saucer.
          </Text>
        </View>
        <Folio side="recto" n="iii" style={style} />
      </BookPage>
    </Spread>
  );
}

// ── Spread 3: Contents (verso) + Part opener (recto) ────────────────
function renderContents(
  { style, pageW, pageH }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'contents' }>,
) {
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        <RunHead side="verso" style={style}>Contents</RunHead>
        <View style={{ position: 'absolute', top: 70, left: 38, right: 28, bottom: 60 }}>
          <Text
            style={{
              fontFamily: style.display,
              fontStyle: 'italic',
              fontSize: 24,
              color: style.ink,
              marginBottom: 18,
            }}
          >
            Contents
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            <Text
              style={{
                fontFamily: Type.mono,
                fontSize: 9,
                letterSpacing: 2,
                color: style.ribbonDark,
                textTransform: 'uppercase',
              }}
            >
              Part I
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: style.ribbon, opacity: 0.5 }} />
            <Text
              style={{
                fontFamily: Type.mono,
                fontSize: 9,
                letterSpacing: 1,
                color: style.soft,
                textTransform: 'uppercase',
              }}
            >
              {d.partTitle}
            </Text>
          </View>
          {d.chapters.map((ch, idx) => (
            <View
              key={ch.title + idx}
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                paddingVertical: 4,
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: style.display,
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: style.soft,
                  width: 32,
                }}
              >
                {romanish(idx + 1)}.
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: style.serif,
                  fontSize: 11.5,
                  color: style.ink,
                }}
                numberOfLines={2}
              >
                {ch.title}
              </Text>
            </View>
          ))}
        </View>
        <Folio side="verso" n="iv" style={style} />
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 40,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <Text
            style={{
              fontFamily: style.display,
              fontStyle: 'italic',
              fontSize: 60,
              color: style.ribbon,
              lineHeight: 60,
            }}
          >
            I
          </Text>
          <Text
            style={{
              fontFamily: Type.mono,
              fontSize: 9,
              letterSpacing: 2.4,
              color: style.faint,
              textTransform: 'uppercase',
            }}
          >
            Part One
          </Text>
          <Text
            style={{
              fontFamily: style.display,
              fontStyle: 'italic',
              fontSize: 24,
              color: style.ink,
              textAlign: 'center',
            }}
          >
            {d.partTitle}
          </Text>
        </View>
      </BookPage>
    </Spread>
  );
}

// ── Spread 4: Chapter opener (verso photo + recto title + lead) ─────
function renderChapterOpener(
  { style, pageW, pageH, resolveSlot, isSlotBusy, onPickSlot, onClearSlot }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'chapter-opener' }>,
) {
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        {style.illustrationsEnabled && (
          <View style={{ position: 'absolute', top: 80, left: 38, width: 160, height: 200 }}>
            <PhotoSlot
              id={d.slotId}
              placeholder={d.slotPlaceholder}
              filledUrl={resolveSlot(d.slotId)}
              busy={isSlotBusy(d.slotId)}
              onPick={onPickSlot}
              onClear={onClearSlot}
              styleTokens={style}
            />
          </View>
        )}
        <Folio side="verso" n={10} style={style} />
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <View style={{ position: 'absolute', top: 70, left: 38, right: 38 }}>
          <Text
            style={{
              fontFamily: Type.mono,
              fontSize: 9,
              letterSpacing: 2.4,
              color: style.faint,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Chapter {d.chapterNumberLabel}
          </Text>
          <Text
            style={{
              fontFamily: style.display,
              fontStyle: 'italic',
              fontSize: 28,
              lineHeight: 32,
              color: style.ink,
              marginBottom: 14,
            }}
          >
            {d.title}
          </Text>
          <View style={{ width: 38, height: 1, backgroundColor: style.ribbon, marginTop: 8 }} />
        </View>
        <View style={{ position: 'absolute', top: 220, left: 38, right: 38, bottom: 60 }}>
          <Text
            style={{
              fontFamily: style.serif,
              fontSize: 12.5,
              lineHeight: 19,
              color: style.ink,
            }}
          >
            {d.lead}
          </Text>
        </View>
        <Folio side="recto" n={11} style={style} />
      </BookPage>
    </Spread>
  );
}

// ── Spread 5: Body (running text on both pages) ─────────────────────
function renderBody(
  { style, pageW, pageH }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'body' }>,
) {
  // Short chapters produce only a verso half — render recto as a quiet
  // asterism instead of a blank page so the spread doesn't read "missing".
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        <RunHead side="verso" style={style}>{d.chapterTitle}</RunHead>
        <TextFrame style={style}>{d.verso}</TextFrame>
        <Folio side="verso" n={d.pageStart} style={style} />
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <RunHead side="recto" style={style}>{d.bookTitle}</RunHead>
        {d.recto ? (
          <TextFrame style={style}>{d.recto}</TextFrame>
        ) : (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: style.serif,
                fontSize: 14,
                letterSpacing: 8,
                color: style.ribbon,
              }}
            >
              * * *
            </Text>
          </View>
        )}
        <Folio side="recto" n={d.pageStart + 1} style={style} />
      </BookPage>
    </Spread>
  );
}

// ── Spread 6: Pull-quote (verso) + (blank recto for breathing) ──────
function renderPullQuote(
  { style, pageW, pageH }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'pullquote' }>,
) {
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        <RunHead side="verso" style={style}>{d.chapterTitle}</RunHead>
        <View
          style={{
            position: 'absolute',
            top: '40%',
            left: 38,
            right: 38,
          }}
        >
          <Text
            style={{
              fontFamily: style.display,
              fontStyle: 'italic',
              fontSize: 22,
              lineHeight: 30,
              color: style.ink,
              borderLeftWidth: 2,
              borderLeftColor: style.ribbon,
              paddingLeft: 14,
            }}
          >
            “{d.quote}”
          </Text>
          <Text
            style={{
              marginTop: 12,
              paddingLeft: 16,
              fontFamily: Type.mono,
              fontSize: 9,
              letterSpacing: 2,
              color: style.faint,
              textTransform: 'uppercase',
            }}
          >
            From “{d.chapterTitle}”
          </Text>
        </View>
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <RunHead side="recto" style={style}>{d.bookTitle}</RunHead>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: style.serif,
              fontSize: 14,
              letterSpacing: 8,
              color: style.ribbon,
            }}
          >
            * * *
          </Text>
        </View>
      </BookPage>
    </Spread>
  );
}

// ── Spread 7: Photo plate (verso, full bleed) + body (recto) ────────
function renderPlate(
  { style, pageW, pageH, resolveSlot, isSlotBusy, onPickSlot, onClearSlot }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'plate' }>,
) {
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        <View style={{ position: 'absolute', top: 56, left: 36, right: 24, bottom: 80 }}>
          {style.illustrationsEnabled ? (
            <PhotoSlot
              id={d.slotId}
              placeholder="Drop a photo for this plate"
              filledUrl={resolveSlot(d.slotId)}
              busy={isSlotBusy(d.slotId)}
              onPick={onPickSlot}
              onClear={onClearSlot}
              styleTokens={style}
            />
          ) : (
            <View style={{ flex: 1, borderWidth: 1, borderColor: style.faint }} />
          )}
        </View>
        <View style={{ position: 'absolute', bottom: 50, left: 36, right: 24 }}>
          <Text
            style={{
              fontFamily: style.serif,
              fontStyle: 'italic',
              fontSize: 11,
              color: style.soft,
              textAlign: 'center',
            }}
          >
            {d.caption}
          </Text>
        </View>
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <RunHead side="recto" style={style}>{d.bookTitle}</RunHead>
        <TextFrame style={style}>{d.body}</TextFrame>
      </BookPage>
    </Spread>
  );
}

// ── Media memories ──────────────────────────────────────────────────
function renderMediaList(
  { style, pageW, pageH }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'mediaList' }>,
) {
  // One chunk of voice notes + videos. mapPreviewToSpreads creates as
  // many mediaList spreads as needed so rows do not clip inside the page.
  // Verso is audio, recto is video, so each medium gets its own tone.
  const audios = d.items.filter((m) => m.type === 'audio');
  const videos = d.items.filter((m) => m.type === 'video');
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        <RunHead side="verso" style={style}>Media memories</RunHead>
        <View style={{ position: 'absolute', top: 70, left: 38, right: 38, bottom: 60 }}>
          <Text
            style={{
              fontFamily: style.display,
              fontStyle: 'italic',
              fontSize: 24,
              color: style.ink,
              marginBottom: 16,
            }}
          >
            Voice
          </Text>
          {audios.length === 0 ? (
            <Text style={{ fontFamily: style.serif, fontSize: 12.5, color: style.faint, fontStyle: 'italic' }}>
              No voice notes captured.
            </Text>
          ) : (
            audios.map((m, i) => <MediaRow key={`a-${i}`} item={m} index={i + 1} style={style} />)
          )}
        </View>
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <RunHead side="recto" style={style}>{d.bookTitle}</RunHead>
        <View style={{ position: 'absolute', top: 70, left: 38, right: 38, bottom: 60 }}>
          <Text
            style={{
              fontFamily: style.display,
              fontStyle: 'italic',
              fontSize: 24,
              color: style.ink,
              marginBottom: 16,
            }}
          >
            Moving image
          </Text>
          {videos.length === 0 ? (
            <Text style={{ fontFamily: style.serif, fontSize: 12.5, color: style.faint, fontStyle: 'italic' }}>
              No video memories captured.
            </Text>
          ) : (
            videos.map((m, i) => <MediaRow key={`v-${i}`} item={m} index={i + 1} style={style} />)
          )}
        </View>
      </BookPage>
    </Spread>
  );
}

function MediaRow({
  item,
  index,
  style,
}: {
  item: import('./mapSpreads').MediaListItem;
  index: number;
  style: BookViewerStyle;
}) {
  return (
    <View style={{ marginBottom: 14, gap: 4 }}>
      <Text
        style={{
          fontFamily: Type.mono,
          fontSize: 9,
          letterSpacing: 1.6,
          color: style.ribbonDark,
          textTransform: 'uppercase',
        }}
      >
        {item.type === 'audio' ? 'Voice note' : 'Video'} · {String(index).padStart(2, '0')}
      </Text>
      <Text
        style={{
          fontFamily: style.serif,
          fontSize: 13,
          color: style.ink,
          lineHeight: 19,
        }}
        numberOfLines={3}
      >
        {item.caption || (item.transcript ? `“${item.transcript}”` : 'Untitled')}
      </Text>
      {item.caption && item.transcript ? (
        <Text
          style={{
            fontFamily: style.serif,
            fontStyle: 'italic',
            fontSize: 12,
            color: style.soft,
            lineHeight: 17,
          }}
          numberOfLines={2}
        >
          “{item.transcript}”
        </Text>
      ) : null}
    </View>
  );
}

// ── Spread 8: Colophon ──────────────────────────────────────────────
function renderColophon(
  { style, pageW, pageH, resolveSlot, isSlotBusy, onPickSlot, onClearSlot }: RenderInputs,
  d: Extract<SpreadDescriptor, { kind: 'colophon' }>,
) {
  const portraitId = 'bml-author-portrait';
  return (
    <Spread style={style} pageW={pageW} pageH={pageH}>
      <BookPage side="verso" style={style} width={pageW} height={pageH}>
        <TextFrame style={style} top={90}>
          On the last day I came back to the small ledger and read it from the beginning.
          I half-recognised some of who I had been. Some of who I was now sounded, finally,
          like someone I would want to know.
        </TextFrame>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 110,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: style.serif,
              fontSize: 14,
              letterSpacing: 8,
              color: style.ribbon,
            }}
          >
            * * *
          </Text>
        </View>
      </BookPage>
      <BookPage side="recto" style={style} width={pageW} height={pageH}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 40,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          {style.illustrationsEnabled ? (
            <View style={{ width: 88, height: 88, marginBottom: 6 }}>
              <PhotoSlot
                id={portraitId}
                placeholder="Author photo"
                filledUrl={resolveSlot(portraitId)}
                busy={isSlotBusy(portraitId)}
                onPick={onPickSlot}
                onClear={onClearSlot}
                shape="circle"
                framed={false}
                styleTokens={style}
              />
            </View>
          ) : (
            <RibbonMark size={26} ink={style.ink} ribbon={style.ribbon} />
          )}
          <Text style={{ fontFamily: style.display, fontStyle: 'italic', fontSize: 18, color: style.ink }}>
            {d.author}
          </Text>
          <Text
            style={{
              fontFamily: Type.mono,
              fontSize: 9,
              letterSpacing: 2.2,
              color: style.faint,
              textTransform: 'uppercase',
            }}
          >
            Colophon
          </Text>
          <View style={{ width: 30, height: 1, backgroundColor: style.ribbon, marginVertical: 4 }} />
          <Text
            style={{
              fontFamily: Type.mono,
              fontSize: 8.5,
              lineHeight: 16,
              letterSpacing: 1.8,
              color: style.faint,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {d.entryCount} entries · {Math.round(d.wordCount / 100) * 100}+ words{'\n'}
            Volume one of an ongoing series{'\n'}
            {d.author} · {d.year}
          </Text>
        </View>
      </BookPage>
    </Spread>
  );
}

// ── Spread shell — verso+recto with shared gutter ───────────────────
function Spread({
  style,
  pageW,
  pageH,
  children,
}: {
  style: BookViewerStyle;
  pageW: number;
  pageH: number;
  children: ReactNode;
}) {
  return (
    <View style={[styles.spread, { width: pageW * 2, height: pageH }]}>
      {children}
      {/* Gutter darkening overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: pageW - 7,
          width: 14,
          backgroundColor: 'transparent',
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }}
        pointerEvents="none"
      />
    </View>
  );
}

function romanish(n: number): string {
  // The contents page uses lowercase italic numerals — we roman-ish for ≤8.
  const map = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return map[n - 1] ?? String(n);
}

const styles = StyleSheet.create({
  spread: {
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
});
