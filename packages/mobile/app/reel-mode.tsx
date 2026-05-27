/**
 * Reel Mode Screen — pick ONE style for the entire reel.
 * Images are read from reelStore (in-memory) — NOT URL params (too large).
 */
import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Dimensions, Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { T } from "../lib/theme";
import { MODES, Mode } from "../lib/modes";
import { reelStore } from "../lib/reel-store";

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;

export default function ReelModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { albumId, albumName } = useLocalSearchParams<{
    albumId: string;
    albumName: string;
  }>();

  const [selected, setSelected] = useState<Mode>(MODES[0]);
  const pressedScale = useRef(new Animated.Value(1)).current;

  // Read from global store — no URL param passing of large base64
  const sketches = reelStore.get();

  const handleSelect = (mode: Mode) => {
    Haptics.selectionAsync();
    setSelected(mode);
  };

  const handleCreate = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(pressedScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(pressedScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => {
      router.push({
        pathname: "/reel",
        params: {
          albumId,
          albumName,
          modeId: selected.id,
          modeLabel: selected.label,
          promptSuffix: selected.promptSuffix,
          aspectRatio: selected.aspectRatio,
          modeEmoji: selected.emoji,
        },
      });
    });
  };

  const renderItem = ({ item }: { item: Mode }) => {
    const on = selected.id === item.id;
    return (
      <TouchableOpacity
        style={[s.card, on && s.cardOn]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.75}
      >
        {on && (
          <LinearGradient
            colors={["rgba(92,122,30,0.18)", "rgba(140,179,58,0.08)"]}
            style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
          />
        )}
        <View style={s.cardTop}>
          <Text style={s.cardEmoji}>{item.emoji}</Text>
          {on && (
            <View style={s.checkBadge}>
              <Text style={s.checkText}>✓</Text>
            </View>
          )}
        </View>
        <Text style={[s.cardLabel, on && s.cardLabelOn]}>{item.label}</Text>
        <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
        <View style={[s.ratioPill, on && s.ratioPillOn]}>
          <Text style={[s.ratioText, on && s.ratioTextOn]}>{item.aspectRatio}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <SafeAreaView edges={["top", "left", "right"]} style={s.safeTop}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Reel Style</Text>
            <Text style={s.headerSub} numberOfLines={1}>
              {sketches.length} image{sketches.length !== 1 ? "s" : ""} · {albumName}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      {/* Mode grid */}
      <FlatList
        data={MODES}
        keyExtractor={(m) => m.id}
        numColumns={2}
        renderItem={renderItem}
        contentContainerStyle={[s.grid, { paddingBottom: insets.bottom + 130 }]}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={s.row}
      />

      {/* Bottom CTA */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.selectedInfo}>
          <Text style={s.selectedEmoji}>{selected.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.selectedLabel}>{selected.label}</Text>
            <Text style={s.selectedDesc}>{selected.description}</Text>
          </View>
          <View style={s.sketchCount}>
            <Text style={s.sketchCountNum}>{sketches.length}</Text>
            <Text style={s.sketchCountLabel}>images</Text>
          </View>
        </View>
        <Animated.View style={{ transform: [{ scale: pressedScale }] }}>
          <TouchableOpacity onPress={handleCreate} activeOpacity={0.85}>
            <LinearGradient
              colors={["#5C7A1E", "#8CB33A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.genBtn}
            >
              <Text style={s.genBtnText}>Create Reel  ▶</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#0D0F0A" },
  safeTop: { backgroundColor: "#0D0F0A" },

  header: {
    height: 64, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, gap: 8,
  },
  backBtn:      { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backArrow:    { color: "#fff", fontSize: 32, fontWeight: "300", lineHeight: 36, marginTop: -2 },
  headerCenter: { flex: 1, alignItems: "center", gap: 3 },
  headerTitle:  { color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub:    { color: "rgba(255,255,255,0.38)", fontSize: 12 },

  grid: { paddingHorizontal: 16, paddingTop: 16 },
  row:  { gap: 12, marginBottom: 12 },

  card: {
    width: CARD_W, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    padding: 16, gap: 6, overflow: "hidden",
  },
  cardOn: { borderColor: T.accent },
  cardTop: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 4,
  },
  cardEmoji:   { fontSize: 30 },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: T.accent,
    alignItems: "center", justifyContent: "center",
  },
  checkText:    { color: "#fff", fontSize: 11, fontWeight: "900" },
  cardLabel:    { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700" },
  cardLabelOn:  { color: "#fff" },
  cardDesc:     { color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 16 },
  ratioPill: {
    alignSelf: "flex-start", marginTop: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  ratioPillOn:  { backgroundColor: "rgba(92,122,30,0.25)", borderColor: T.accent },
  ratioText:    { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "700" },
  ratioTextOn:  { color: T.accent },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0D0F0A",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 16, paddingTop: 14, gap: 12,
  },
  selectedInfo: {
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  selectedEmoji: { fontSize: 26 },
  selectedLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  selectedDesc:  { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  sketchCount: {
    alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  sketchCountNum:   { color: "#fff", fontSize: 16, fontWeight: "900" },
  sketchCountLabel: { color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "600" },

  genBtn:    { borderRadius: 50, paddingVertical: 15, alignItems: "center" },
  genBtnText:{ color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
});
