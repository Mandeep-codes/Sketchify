import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Dimensions, Alert, ScrollView, ActivityIndicator, Animated,
  Modal, Pressable, TextInput, PanResponder, FlatList,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useGallery, RemixEntry, SerializedStroke } from "../lib/gallery-context";
import DrawingReplay from "../components/DrawingReplay";
import { useAlbums } from "../lib/albums-context";
import { api } from "../lib/api";
import { T } from "../lib/theme";

const { width, width: SW } = Dimensions.get("window");

const STYLES = ["Realistic", "Anime", "Oil Painting", "Cyberpunk", "Watercolor"] as const;
type StyleType = typeof STYLES[number];

// ─── Reveal Slider ────────────────────────────────────────────────────────────
function RevealSlider({
  sketchUri, generatedUri, size, isLoading,
}: { sketchUri: string; generatedUri: string; size: number; isLoading: boolean }) {
  const [dividerX, setDividerX] = useState(size / 2);
  const rawX = useRef(size / 2);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => { rawX.current = dividerX; },
      onPanResponderMove: (_, gs) => {
        setDividerX(Math.max(4, Math.min(size - 4, rawX.current + gs.dx)));
      },
      onPanResponderRelease: (_, gs) => {
        rawX.current = Math.max(4, Math.min(size - 4, rawX.current + gs.dx));
      },
    })
  ).current;

  return (
    <View style={{ width: size, height: size, overflow: "hidden" }}>
      {/* Sketch (right side / background) */}
      <Image source={{ uri: sketchUri }} style={[StyleSheet.absoluteFill, { width: size, height: size }]} resizeMode="cover" />

      {/* Generated (left clipped panel) */}
      <View style={{ position: "absolute", left: 0, top: 0, width: dividerX, height: size, overflow: "hidden" }}>
        {isLoading ? (
          <View style={{ width: size, height: size, backgroundColor: "#111", alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={T.accent} size="large" />
          </View>
        ) : (
          <Image source={{ uri: generatedUri }} style={{ width: size, height: size }} resizeMode="cover" />
        )}
      </View>

      {/* Divider line */}
      <View style={{ position: "absolute", left: dividerX - 1, top: 0, width: 2, height: size, backgroundColor: "#fff" }} />

      {/* Handle */}
      <View
        {...pan.panHandlers}
        style={{
          position: "absolute",
          left: dividerX - 22, top: size / 2 - 22,
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: "#fff",
          alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
        }}
      >
        <Text style={{ fontSize: 14, color: T.accentDark, fontWeight: "900" }}>⇌</Text>
      </View>

      {/* Labels */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 56 }}
      />
      <View style={{ position: "absolute", bottom: 12, left: 12 }}>
        <View style={sl.pill}>
          <Text style={sl.pillText}>SKETCH</Text>
        </View>
      </View>
      <View style={{ position: "absolute", bottom: 12, right: 12 }}>
        <LinearGradient colors={[T.accentDark, T.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sl.pill}>
          <Text style={[sl.pillText, { color: "#fff" }]}>RESULT</Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  pill: {
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  pillText: { fontSize: 9, fontWeight: "800", color: T.textPrimary, letterSpacing: 0.8 },
});

// ─── Remix Thumbnail ──────────────────────────────────────────────────────────
const STYLE_PALETTES: Record<string, [string, string]> = {
  "Realistic":    ["#4A4A4A", "#8A8A8A"],
  "Anime":        ["#7C3AED", "#DB2777"],
  "Oil Painting": ["#92400E", "#D97706"],
  "Cyberpunk":    ["#0891B2", "#7C3AED"],
  "Watercolor":   ["#0369A1", "#06B6D4"],
};

function RemixThumb({ style, isActive, imageUri, isLoading, onPress }: {
  style: StyleType; isActive: boolean; imageUri?: string; isLoading: boolean; onPress: () => void;
}) {
  const palette = STYLE_PALETTES[style] ?? ["#444", "#888"];
  const scale   = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,   duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={isLoading && !imageUri}
        style={[rt.thumb, isActive && rt.thumbActive]}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={rt.thumbImg} resizeMode="cover" />
        ) : (
          <LinearGradient colors={palette as [string,string]} style={rt.thumbGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {isLoading ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            ) : (
              <Text style={rt.thumbPlus}>+</Text>
            )}
          </LinearGradient>
        )}
        {isActive && <View style={rt.activeRing} />}
      </TouchableOpacity>
      <Text style={[rt.thumbLabel, isActive && rt.thumbLabelActive]} numberOfLines={1}>
        {style.split(" ")[0]}
      </Text>
    </Animated.View>
  );
}

const rt = StyleSheet.create({
  thumb: {
    width: 72, height: 72, borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2, borderColor: "transparent",
  },
  thumbActive: { borderColor: T.accent },
  thumbImg:    { width: "100%", height: "100%" },
  thumbGrad:   { flex: 1, alignItems: "center", justifyContent: "center" },
  thumbPlus:   { color: "rgba(255,255,255,0.7)", fontSize: 24, fontWeight: "300" },
  activeRing:  {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 2.5, borderColor: T.accent,
  },
  thumbLabel: {
    color: T.textMuted, fontSize: 10, fontWeight: "600",
    textAlign: "center", marginTop: 5,
  },
  thumbLabelActive: { color: T.accentDark, fontWeight: "800" },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ResultScreen() {
  const params = useLocalSearchParams<{
    sketchBase64: string; generatedUrl: string; style: string;
    modeId?: string; modeLabel?: string; aspectRatio?: string;
    sketchId?: string; strokesJson?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, addRemix } = useGallery();
  const { albums, createAlbum, addToAlbum } = useAlbums();

  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [showNewAlbum, setShowNewAlbum]       = useState(false);
  const [showReplay, setShowReplay]           = useState(false);

  // Parse strokes for replay
  const strokes: SerializedStroke[] = (() => {
    try { return params.strokesJson ? JSON.parse(params.strokesJson) : []; }
    catch { return []; }
  })();
  const [newAlbumName, setNewAlbumName]       = useState("");
  const [savedToAlbum, setSavedToAlbum]       = useState(false);
  const [selectedStyle, setSelectedStyle]     = useState<StyleType>((params.style as StyleType) ?? "Realistic");
  const [generatedImage, setGeneratedImage]   = useState<string>(params.generatedUrl);
  const [isRegenerating, setIsRegenerating]   = useState(false);
  const [isSaved, setIsSaved]                 = useState(false);
  const itemIdRef = useRef<string>("");

  const [styleCache, setStyleCache] = useState<Partial<Record<StyleType, string>>>({
    [(params.style as StyleType) ?? "Realistic"]: params.generatedUrl,
  });

  // Which style is currently loading
  const [loadingStyle, setLoadingStyle] = useState<StyleType | null>(null);
  const sketchId = params.sketchId ?? Date.now().toString();

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    if (params.sketchBase64 && params.generatedUrl) {
      const id = addItem({
        sketchBase64: params.sketchBase64,
        generatedBase64: params.generatedUrl,
        style: selectedStyle,
        modeId: params.modeId,
        modeLabel: params.modeLabel,
        sketchId,
        strokes: strokes.length > 0 ? strokes : undefined,
      });
      itemIdRef.current = id;
    }
  }, []);

  const regenerate = async (style: StyleType) => {
    if (styleCache[style]) {
      setSelectedStyle(style);
      setGeneratedImage(styleCache[style]!);
      Haptics.selectionAsync();
      return;
    }
    setSelectedStyle(style);
    setIsRegenerating(true);
    setLoadingStyle(style);
    Haptics.selectionAsync();
    try {
      const res = await api.generate.$post({ json: { imageBase64: params.sketchBase64, style: style as any } });
      const data = await res.json() as any;
      if (data.imageUrl || data.imageBase64) {
        const displayImg = data.imageBase64 ?? data.imageUrl;
        setGeneratedImage(displayImg);
        setStyleCache((prev) => ({ ...prev, [style]: displayImg }));
        // Link as remix on the primary gallery item
        addRemix(sketchId, style, displayImg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Error", data.error ?? "Regeneration failed");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setIsRegenerating(false);
      setLoadingStyle(null);
    }
  };

  const getLocalUri = async () => {
    const cacheDir = (FileSystem as any).cacheDirectory ?? "";
    const fileUri  = cacheDir + `str_${Date.now()}.png`;
    const { uri }  = await FileSystem.downloadAsync(generatedImage, fileUri);
    return uri;
  };

  const handleSave = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access."); return; }
      const uri = await getLocalUri();
      await MediaLibrary.saveToLibraryAsync(uri);
      setIsSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Image saved to your photos.");
    } catch (err: any) { Alert.alert("Error", err?.message ?? "Could not save"); }
  };

  const handleShare = async () => {
    try {
      const uri = await getLocalUri();
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch (err: any) { Alert.alert("Error", err?.message ?? "Could not share"); }
  };

  const handleAddToAlbum = (albumId: string) => {
    if (itemIdRef.current) addToAlbum(albumId, itemIdRef.current);
    setSavedToAlbum(true);
    setShowAlbumPicker(false);
    setShowNewAlbum(false);
    Haptics.selectionAsync();
  };

  const handleCreateAndAdd = () => {
    if (!newAlbumName.trim()) return;
    const album = createAlbum(newAlbumName.trim());
    if (itemIdRef.current) addToAlbum(album.id, itemIdRef.current);
    setSavedToAlbum(true);
    setNewAlbumName("");
    setShowNewAlbum(false);
    setShowAlbumPicker(false);
    router.push(`/album/${album.id}`);
  };

  return (
    <View style={s.container}>
      {/* Overlay header — floating above image */}
      <View style={[s.overlayHeader, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <SafeAreaView edges={[]} style={{ width: "100%" }} pointerEvents="box-none">
          <LinearGradient
            colors={["rgba(0,0,0,0.72)", "transparent"]}
            style={s.headerGrad}
            pointerEvents="box-none"
          >
            <View style={s.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
                <Text style={s.backArrow}>‹</Text>
              </TouchableOpacity>
              <View style={s.headerMiddle}>
                {!!params.modeLabel && (
                  <View style={s.modePill}>
                    <Text style={s.modePillText}>{params.modeLabel}</Text>
                    {!!params.aspectRatio && (
                      <Text style={s.modePillRatio}> · {params.aspectRatio}</Text>
                    )}
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => router.replace("/canvas")} style={s.redrawBtn}>
                <Text style={s.redrawBtnText}>Redraw</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </SafeAreaView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Full-width image reveal */}
        <Animated.View style={{ opacity: fadeIn }}>
          <RevealSlider
            sketchUri={params.sketchBase64}
            generatedUri={generatedImage}
            size={width}
            isLoading={isRegenerating}
          />
        </Animated.View>

        <Text style={s.dragHint}>← drag to compare →</Text>

        {/* Regenerating banner */}
        {isRegenerating && (
          <View style={s.regenBanner}>
            <ActivityIndicator size="small" color={T.accentDark} />
            <Text style={s.regenText}>Generating {selectedStyle}…</Text>
          </View>
        )}

        {/* Remix carousel */}
        <View style={s.section}>
          <View style={s.remixHeader}>
            <Text style={s.sectionLabel}>Remix Styles</Text>
            <Text style={s.remixCount}>
              {Object.keys(styleCache).length} of {STYLES.length} generated
            </Text>
          </View>
          <FlatList
            data={STYLES as unknown as StyleType[]}
            keyExtractor={(st) => st}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.remixScroll}
            renderItem={({ item: st }) => (
              <RemixThumb
                key={st}
                style={st}
                isActive={selectedStyle === st}
                imageUri={styleCache[st]}
                isLoading={loadingStyle === st}
                onPress={() => regenerate(st)}
              />
            )}
          />
        </View>

        {/* Action buttons */}
        <View style={s.actionsSection}>
          {/* 3 icon buttons */}
          <View style={s.iconBtnsRow}>
            <TouchableOpacity
              style={[s.iconAction, isSaved && s.iconActionDone]}
              onPress={handleSave}
              disabled={isRegenerating}
            >
              <Text style={s.iconActionEmoji}>{isSaved ? "✓" : "⬇"}</Text>
              <Text style={[s.iconActionLabel, isSaved && { color: T.accentDark }]}>
                {isSaved ? "Saved" : "Save"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.iconAction} onPress={handleShare} disabled={isRegenerating}>
              <Text style={s.iconActionEmoji}>↗</Text>
              <Text style={s.iconActionLabel}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.iconAction, savedToAlbum && s.iconActionDone]}
              onPress={() => setShowAlbumPicker(true)}
              disabled={isRegenerating}
            >
              <Text style={s.iconActionEmoji}>{savedToAlbum ? "✓" : "+"}</Text>
              <Text style={[s.iconActionLabel, savedToAlbum && { color: T.accentDark }]}>
                {savedToAlbum ? "In Album" : "Album"}
              </Text>
            </TouchableOpacity>

            {strokes.length > 0 && (
              <TouchableOpacity
                style={s.iconAction}
                onPress={() => { Haptics.selectionAsync(); setShowReplay(true); }}
                disabled={isRegenerating}
              >
                <Text style={s.iconActionEmoji}>▶</Text>
                <Text style={s.iconActionLabel}>Replay</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Draw Again CTA */}
          <TouchableOpacity onPress={() => router.replace("/canvas")} activeOpacity={0.85}>
            <LinearGradient
              colors={[T.accentDark, T.accent]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.drawAgainBtn}
            >
              <Text style={s.drawAgainText}>Draw Again  →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Drawing Replay modal */}
      {strokes.length > 0 && (
        <DrawingReplay
          strokes={strokes}
          canvasSize={Math.min(SW - 72, 320)}
          visible={showReplay}
          onClose={() => setShowReplay(false)}
        />
      )}

      {/* Album picker sheet */}
      <Modal
        visible={showAlbumPicker} transparent animationType="slide"
        onRequestClose={() => { setShowAlbumPicker(false); setShowNewAlbum(false); }}
      >
        <View style={s.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setShowAlbumPicker(false); setShowNewAlbum(false); }} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add to Album</Text>

            {showNewAlbum ? (
              <View style={s.newAlbumRow}>
                <TextInput
                  style={s.newAlbumInput}
                  placeholder="Album name…"
                  placeholderTextColor={T.textMuted}
                  value={newAlbumName}
                  onChangeText={setNewAlbumName}
                  autoFocus returnKeyType="done"
                  onSubmitEditing={handleCreateAndAdd}
                />
                <TouchableOpacity style={s.newAlbumConfirm} onPress={handleCreateAndAdd}>
                  <Text style={s.newAlbumConfirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.newAlbumBtn} onPress={() => setShowNewAlbum(true)}>
                <Text style={s.newAlbumBtnText}>+ New Album</Text>
              </TouchableOpacity>
            )}

            {albums.map((album) => (
              <TouchableOpacity key={album.id} style={s.albumRow} onPress={() => handleAddToAlbum(album.id)}>
                <Text style={s.albumRowName}>{album.name}</Text>
                <Text style={s.albumRowCount}>{album.itemIds.length} images</Text>
              </TouchableOpacity>
            ))}
            {albums.length === 0 && !showNewAlbum && (
              <Text style={s.sheetEmpty}>No albums yet — create one above</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  // Floating header over image
  overlayHeader: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
  },
  headerGrad: { paddingHorizontal: 12, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", height: 52, gap: 8 },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backArrow:  { color: "#fff", fontSize: 32, fontWeight: "300", lineHeight: 36, marginTop: -2 },
  headerMiddle: { flex: 1, alignItems: "center" },
  modePill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.38)", borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  modePillText:  { color: "#fff", fontSize: 12, fontWeight: "700" },
  modePillRatio: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  redrawBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  redrawBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  dragHint: {
    color: T.textMuted, fontSize: 11, textAlign: "center",
    marginTop: 10, marginBottom: 2,
  },

  regenBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    justifyContent: "center", paddingVertical: 10,
  },
  regenText: { color: T.accentDark, fontSize: 13, fontWeight: "600" },

  // Remix section
  section: { paddingHorizontal: 16, paddingTop: 14 },
  sectionLabel: {
    color: T.textMuted, fontSize: 10, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 1.2,
  },
  remixHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12,
  },
  remixCount: { color: T.accentDark, fontSize: 11, fontWeight: "700" },
  remixScroll: { gap: 12, paddingRight: 16 },

  // Actions
  actionsSection: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  iconBtnsRow:    { flexDirection: "row", gap: 10 },
  iconAction: {
    flex: 1, paddingVertical: 16, borderRadius: 16,
    backgroundColor: T.card, alignItems: "center",
    borderWidth: 1.5, borderColor: T.border, gap: 4,
  },
  iconActionDone:  { backgroundColor: T.accentBg, borderColor: T.accent },
  iconActionEmoji: { fontSize: 20 },
  iconActionLabel: { color: T.textSec, fontSize: 12, fontWeight: "600" },
  drawAgainBtn:    { borderRadius: 16, paddingVertical: 18, alignItems: "center" },
  drawAgainText:   { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Sheet
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20, maxHeight: "65%",
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: T.border, alignSelf: "center", marginBottom: 20,
  },
  sheetTitle: { color: T.textPrimary, fontSize: 17, fontWeight: "800", marginBottom: 16 },
  sheetEmpty: { color: T.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 20 },
  newAlbumBtn: {
    paddingVertical: 13, borderRadius: 12,
    backgroundColor: T.accentBg, borderWidth: 1, borderColor: T.accent,
    alignItems: "center", marginBottom: 12,
  },
  newAlbumBtnText: { color: T.accentDark, fontSize: 14, fontWeight: "700" },
  newAlbumRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  newAlbumInput: {
    flex: 1, backgroundColor: T.bg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: T.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: T.border,
  },
  newAlbumConfirm: {
    paddingHorizontal: 18, borderRadius: 12,
    backgroundColor: T.accentDark, justifyContent: "center",
  },
  newAlbumConfirmText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  albumRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  albumRowName:  { color: T.textPrimary, fontSize: 14, fontWeight: "600" },
  albumRowCount: { color: T.textMuted, fontSize: 12 },
});
