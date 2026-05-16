import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Spacing, Type } from '@/constants/theme';
import { useTranslation } from '@/utils/i18n';
import {
  BookPreview,
  BookTweaks,
  updateBookIllustration,
  updateBookTweaks,
} from '@/utils/books';
import { uploadPhoto } from '@/utils/entries';

import { BookSpread } from './BookSpread';
import { mapPreviewToSpreads } from './mapSpreads';
import { resolveBookStyle } from './style';
import { TweaksSheet } from './TweaksSheet';

type Props = {
  preview: BookPreview;
  authorName: string;
  totalEntries: number;
  totalWords: number;
  onClose: () => void;
};

const IMPRINT = 'Book My Life Editions';

/**
 * Hardcover memoir viewer. Renders one spread at a time, swipe / tap
 * arrows to advance, dot indicators below, and a Tweaks sheet for
 * paper/type/ribbon/surface swap. Photo slots are tap-to-pick — the
 * upload + PATCH /illustrations is handled here so the viewer stays in
 * sync via React Query.
 */
export function BookViewer({ preview, authorName, totalEntries, totalWords, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { width: winW, height: winH } = useWindowDimensions();
  const [idx, setIdx] = useState(0);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const style = resolveBookStyle(preview.tweaks);

  // Layout: on narrow widths (phones in portrait) we render one page at a
  // time inside a horizontally paged ScrollView so each page fills the
  // screen — the previous 2-up math left ~90 usable px of text width and
  // produced cropped serif body type. On wider devices (tablets / web)
  // we keep the classic book spread.
  const dims = useMemo(() => {
    const verticalChrome = 240;
    const horizontalPadding = 16;
    const availableH = winH - verticalChrome;
    const availableW = winW - horizontalPadding * 2;
    const isSpread = availableW >= 720; // ~tablet portrait or wider
    const targetH = Math.min(availableH, 720);
    if (isSpread) {
      const targetWFromH = (targetH / 1.4) * 2;
      const pageW = Math.min(availableW, targetWFromH) / 2;
      const pageH = pageW * 1.4;
      return {
        pageW: Math.floor(pageW),
        pageH: Math.floor(pageH),
        isSpread: true as const,
      };
    }
    // Single page mode — page fills the available width.
    const targetWFromH2 = targetH / 1.4;
    const pageW = Math.min(availableW, targetWFromH2);
    const pageH = pageW * 1.4;
    return { pageW: Math.floor(pageW), pageH: Math.floor(pageH), isSpread: false as const };
  }, [winW, winH]);

  const spreads = useMemo(
    () => mapPreviewToSpreads({ preview, authorName, totalEntries, totalWords }),
    [preview, authorName, totalEntries, totalWords],
  );
  const total = spreads.length;
  const current = spreads[Math.min(idx, total - 1)] ?? spreads[0];
  const spreadLabel = useMemo(() => deriveSpreadLabel(current), [current]);

  // Render-time URL comes from the backend-computed public_url field;
  // storage_key remains the bucket-relative key for any future delete /
  // re-upload flow. Tolerate legacy rows that only have storage_key set
  // to a full URL (pre-Phase-2 shape) so older books keep rendering.
  const resolveSlot = (slotId: string): string | null => {
    const entry = preview.illustrations[slotId];
    if (!entry) return null;
    if (entry.public_url) return entry.public_url;
    if (entry.storage_key && entry.storage_key.startsWith('http')) return entry.storage_key;
    return null;
  };

  const tweakMutation = useMutation({
    mutationFn: (next: BookTweaks) => updateBookTweaks(preview.id, next),
    onSuccess: (data) => {
      qc.setQueryData(['book-preview', preview.id], data);
    },
  });

  const illuMutation = useMutation({
    mutationFn: ({ slotId, storageKey }: { slotId: string; storageKey: string | null }) =>
      updateBookIllustration(preview.id, slotId, storageKey),
    onSuccess: (data) => {
      qc.setQueryData(['book-preview', preview.id], data);
    },
  });

  const onPickSlot = async (slotId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setBusySlot(slotId);
    try {
      const uploaded = await uploadPhoto(asset.uri, asset.mimeType ?? 'image/jpeg', 'entry-photo');
      // Persist the raw bucket key — the backend serializes it back to a
      // public URL in the response so the viewer renders correctly.
      await illuMutation.mutateAsync({ slotId, storageKey: uploaded.storage_key });
    } finally {
      setBusySlot(null);
    }
  };

  const onClearSlot = async (slotId: string) => {
    setBusySlot(slotId);
    try {
      await illuMutation.mutateAsync({ slotId, storageKey: null });
    } finally {
      setBusySlot(null);
    }
  };

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(total - 1, i + 1));

  const year = preview.period_start
    ? new Date(preview.period_start).getFullYear().toString()
    : new Date().getFullYear().toString();

  return (
    <View style={[styles.scene, { backgroundColor: style.surface }]}>
      {/* Top bar: close + tweaks */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={10}>
          <IconSymbol name="chevron.left" size={22} color="#FAF6F0CC" />
        </TouchableOpacity>
        <View style={styles.label}>
          <Text style={styles.labelImprint}>
            {IMPRINT} · Volume One · {year}
          </Text>
          {preview.title ? (
            <Text style={styles.labelTitle}>{preview.title}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setTweaksOpen(true)} style={styles.iconBtn} hitSlop={10}>
          <IconSymbol name="paintbrush.fill" size={20} color="#FAF6F0CC" />
        </TouchableOpacity>
      </View>

      {/* Book stage — full spread on tablets, paged single-page on phones */}
      <View style={styles.stage}>
        {current && dims.isSpread && (
          <BookSpread
            descriptor={current}
            style={style}
            pageW={dims.pageW}
            pageH={dims.pageH}
            resolveSlot={resolveSlot}
            isSlotBusy={(id) => busySlot === id}
            onPickSlot={onPickSlot}
            onClearSlot={onClearSlot}
          />
        )}
        {current && !dims.isSpread && (
          // ScrollView width matches one page; the BookSpread inside is
          // 2*pageW wide and `pagingEnabled` snaps between verso and recto.
          // Vertical: BookPage already sets its own height — wrap in
          // alignItems:flex-start so vertical text doesn't clip.
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: dims.pageW, height: dims.pageH }}
            // Keep the BookSpread's own width (2*pageW) — ScrollView clips
            // to its own width and the user swipes between verso & recto.
            contentContainerStyle={{ width: dims.pageW * 2, height: dims.pageH }}
          >
            <BookSpread
              descriptor={current}
              style={style}
              pageW={dims.pageW}
              pageH={dims.pageH}
              resolveSlot={resolveSlot}
              isSlotBusy={(id) => busySlot === id}
              onPickSlot={onPickSlot}
              onClearSlot={onClearSlot}
            />
          </ScrollView>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={goPrev}
          disabled={idx === 0}
          style={[styles.navBtn, idx === 0 && styles.navBtnDisabled]}
          hitSlop={10}
        >
          <IconSymbol name="chevron.left" size={18} color="#FAF6F0DD" />
        </TouchableOpacity>
        <View style={styles.spreadLabel}>
          <Text style={styles.spreadLabelTitle}>{spreadLabel}</Text>
          <Text style={styles.spreadLabelSub}>
            {t('book.viewer.spreadOf', { current: idx + 1, total })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={goNext}
          disabled={idx === total - 1}
          style={[styles.navBtn, idx === total - 1 && styles.navBtnDisabled]}
          hitSlop={10}
        >
          <IconSymbol name="chevron.right" size={18} color="#FAF6F0DD" />
        </TouchableOpacity>
      </View>

      {/* Pip indicators */}
      <View style={styles.pips}>
        {spreads.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => setIdx(i)}
            style={[
              styles.pip,
              i === idx
                ? { width: 18, backgroundColor: style.ribbon }
                : { backgroundColor: 'rgba(250,246,240,0.18)' },
            ]}
          />
        ))}
      </View>

      {(tweakMutation.isPending || illuMutation.isPending) && (
        <View style={styles.savingPill}>
          <ActivityIndicator color="#FAF6F0" size="small" />
          <Text style={styles.savingPillText}>{t('book.viewer.saving')}</Text>
        </View>
      )}

      <Modal visible={tweaksOpen} transparent animationType="slide" onRequestClose={() => setTweaksOpen(false)}>
        <TweaksSheet
          tweaks={preview.tweaks}
          onChange={(next) => tweakMutation.mutate(next)}
          onClose={() => setTweaksOpen(false)}
        />
      </Modal>
    </View>
  );
}

function deriveSpreadLabel(d: ReturnType<typeof mapPreviewToSpreads>[number] | undefined): string {
  if (!d) return '';
  switch (d.kind) {
    case 'cover':
      return 'Frontispiece · Title page';
    case 'copyright':
      return 'Copyright · Dedication';
    case 'contents':
      return 'Contents · Part opener';
    case 'chapter-opener':
      return `Chapter ${d.chapterNumberLabel} · opener`;
    case 'body':
      return `${d.chapterTitle} · body`;
    case 'pullquote':
      return `${d.chapterTitle} · pull quote`;
    case 'plate':
      return 'Plate · body';
    case 'mediaList':
      return 'Media memories';
    case 'colophon':
      return 'Colophon';
  }
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,246,240,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(250,246,240,0.12)',
  },
  label: { flex: 1, alignItems: 'center', gap: 4 },
  labelImprint: {
    fontFamily: Type.mono,
    fontSize: 9,
    letterSpacing: 2.4,
    color: 'rgba(250,246,240,0.55)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  labelTitle: {
    fontFamily: Type.italic,
    fontStyle: 'italic',
    fontSize: 16,
    color: 'rgba(250,246,240,0.85)',
    textAlign: 'center',
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingTop: Spacing.md,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(250,246,240,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(250,246,240,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  spreadLabel: { minWidth: 200, alignItems: 'center', gap: 2 },
  spreadLabelTitle: {
    fontFamily: Type.italic,
    fontStyle: 'italic',
    fontSize: 16,
    color: 'rgba(250,246,240,0.85)',
  },
  spreadLabelSub: {
    fontFamily: Type.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(250,246,240,0.55)',
    textTransform: 'uppercase',
  },
  pips: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
  },
  pip: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  savingPill: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  savingPillText: {
    color: '#FAF6F0',
    fontFamily: Type.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
