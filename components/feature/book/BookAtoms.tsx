import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { Type } from '@/constants/theme';

import type { BookViewerStyle } from './style';

/**
 * Editorial atoms shared by every spread. They take a `style` (resolved
 * paper/ink/ribbon/typeset palette) and a `pageW` so a tablet/phone book
 * scales without each spread doing its own math.
 */

export type BookViewerScale = {
  pageW: number;
  pageH: number;
};

// ── Folio: page-number eyebrow in the lower outer corner ──
export function Folio({
  side,
  n,
  style,
}: {
  side: 'verso' | 'recto';
  n: number | string;
  style: BookViewerStyle;
}) {
  const outer = side === 'verso' ? 'left' : 'right';
  return (
    <View style={[styles.folio, { [outer]: 36 } as ViewStyle]}>
      <Text style={[styles.folioText, { color: style.faint, fontFamily: Type.mono }]}>
        {String(n).padStart(3, '0')}
      </Text>
    </View>
  );
}

// ── RunHead: small mono uppercase running header ──
export function RunHead({
  side,
  children,
  style,
}: {
  side: 'verso' | 'recto';
  children: ReactNode;
  style: BookViewerStyle;
}) {
  const outer = side === 'verso' ? 'left' : 'right';
  const align = side === 'verso' ? 'left' : 'right';
  return (
    <View style={[styles.runHead, { [outer]: 30 } as ViewStyle]}>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: Type.mono,
          fontSize: 9,
          letterSpacing: 1.8,
          color: style.faint,
          textAlign: align as 'left' | 'right',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </View>
  );
}

// ── TextFrame: classical body-text frame with serif typography ──
export function TextFrame({
  children,
  top = 70,
  style,
  textStyle,
}: {
  children: ReactNode;
  top?: number;
  style: BookViewerStyle;
  textStyle?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          top,
          bottom: 64,
          left: 38,
          right: 38,
        },
        textStyle,
      ]}
    >
      <Text
        style={{
          fontFamily: style.serif,
          fontSize: 12.5,
          lineHeight: 19,
          color: style.ink,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

// ── PlateBox: hatched engraving placeholder ──
export function PlateBox({
  caption,
  style,
}: {
  caption: string;
  style: BookViewerStyle;
}) {
  return (
    <View
      style={[
        styles.plateBox,
        {
          backgroundColor: style.plateA,
          borderColor: style.faint,
        },
      ]}
    >
      <View
        style={{
          backgroundColor: style.paper,
          borderWidth: 1,
          borderColor: style.faint,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text
          style={{
            fontFamily: Type.mono,
            fontSize: 8.5,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: style.faint,
          }}
        >
          {caption}
        </Text>
      </View>
    </View>
  );
}

// ── PhotoSlot: tap to pick photo, render filled image, long-press to clear ──
type PhotoSlotProps = {
  /** stable id used to persist the image to the backend */
  id: string;
  placeholder: string;
  /** rendered photo URL (from the Book.illustrations dict, resolved to public URL upstream) */
  filledUrl: string | null;
  busy?: boolean;
  shape?: 'rect' | 'circle';
  framed?: boolean;
  onPick: (id: string) => void;
  onClear?: (id: string) => void;
  style?: ViewStyle;
  styleTokens: BookViewerStyle;
};

export function PhotoSlot({
  id,
  placeholder,
  filledUrl,
  busy,
  shape = 'rect',
  framed = true,
  onPick,
  onClear,
  style,
  styleTokens,
}: PhotoSlotProps) {
  const radius = shape === 'circle' ? 9999 : 0;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPick(id)}
      onLongPress={onClear ? () => onClear(id) : undefined}
      style={[
        {
          width: '100%',
          height: '100%',
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: styleTokens.plateB,
          borderWidth: framed ? 1 : 0,
          borderColor: styleTokens.faint,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {filledUrl ? (
        <Image source={{ uri: filledUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View style={styles.photoEmpty}>
          <Text
            style={{
              fontFamily: Type.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: styleTokens.faint,
              textAlign: 'center',
              paddingHorizontal: 16,
            }}
          >
            {placeholder}
          </Text>
        </View>
      )}
      {busy && (
        <View style={styles.photoBusy}>
          <ActivityIndicator color={styleTokens.paper} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── RibbonMark: serif L + bookmark flag, sized to the page ──
export function RibbonMark({
  size = 28,
  ink,
  ribbon,
}: {
  size?: number;
  ink: string;
  ribbon: string;
}) {
  // Pure-RN port using stacked Views — no SVG dependency. Text "L" plus
  // a small notched flag on its upper-right shoulder.
  const flagWidth = Math.round(size * 0.34);
  const flagHeight = Math.round(size * 0.66);
  const halfFlag = flagWidth / 2;
  const notch = Math.max(4, Math.round(flagWidth * 0.5));
  return (
    <View style={{ width: size + flagWidth * 0.4, height: size * 1.06, flexDirection: 'row' }}>
      <Text
        style={{
          fontFamily: Type.italic,
          fontStyle: 'italic',
          fontSize: size,
          color: ink,
          lineHeight: size * 1.02,
          fontWeight: '500',
        }}
      >
        L
      </Text>
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: flagWidth,
          height: flagHeight,
        }}
        pointerEvents="none"
      >
        <View style={{ width: flagWidth, height: flagHeight - notch, backgroundColor: ribbon }} />
        <View style={{ flexDirection: 'row' }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderRightWidth: halfFlag,
              borderTopWidth: notch,
              borderRightColor: 'transparent',
              borderTopColor: ribbon,
            }}
          />
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: halfFlag,
              borderTopWidth: notch,
              borderLeftColor: 'transparent',
              borderTopColor: ribbon,
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  folio: {
    position: 'absolute',
    bottom: 22,
  },
  folioText: {
    fontSize: 9,
    letterSpacing: 1.4,
  },
  runHead: {
    position: 'absolute',
    top: 24,
    maxWidth: '70%',
  },
  plateBox: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
});
