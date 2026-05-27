/**
 * Convert Screen — pick ART STYLE after drawing, before AI generation.
 * Anime / Realistic / Oil Painting / Cyberpunk / Watercolor etc.
 * Receives: imageBase64, canvasW, canvasH, userHint
 * Routes to: /generating with style param
 */
import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { T } from "../lib/theme";

const { width } = Dimensions.get("window");

interface ArtStyle {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  promptSuffix: string;
  palette: [string, string]; // gradient preview colors
}

const ART_STYLES: ArtStyle[] = [
  {
    id: "realistic",
    label: "Realistic",
    emoji: "📷",
    desc: "Photo-real, detailed",
    promptSuffix: "photorealistic, ultra detailed, natural lighting, DSLR quality, sharp focus",
    palette: ["#4A4A4A", "#8A8A8A"],
  },
  {
    id: "anime",
    label: "Anime",
    emoji: "🌸",
    desc: "Manga & anime style",
    promptSuffix: "anime illustration, manga art style, vibrant colors, Studio Ghibli inspired, cel shading",
    palette: ["#7C3AED", "#DB2777"],
  },
  {
    id: "oil_painting",
    label: "Oil Painting",
    emoji: "🖼️",
    desc: "Classic fine art",
    promptSuffix: "oil painting, fine art, impasto texture, rich colors, museum quality, old masters style",
    palette: ["#92400E", "#D97706"],
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    emoji: "⚡",
    desc: "Neon & dystopia",
    promptSuffix: "cyberpunk art, neon lights, rain-soaked streets, dystopian future, blade runner aesthetic",
    palette: ["#0891B2", "#7C3AED"],
  },
  {
    id: "watercolor",
    label: "Watercolor",
    emoji: "💧",
    desc: "Soft & dreamy",
    promptSuffix: "watercolor painting, soft edges, flowing colors, paper texture, dreamy illustration",
    palette: ["#0369A1", "#2E7D52"],
  },
  {
    id: "sketch",
    label: "Pencil Sketch",
    emoji: "✏️",
    desc: "Black & white sketch",
    promptSuffix: "detailed pencil sketch, black and white, cross-hatching, fine linework, graphite drawing",
    palette: ["#374151", "#6B7280"],
  },
  {
    id: "comic",
    label: "Comic Book",
    emoji: "💥",
    desc: "Bold & graphic",
    promptSuffix: "comic book art, bold outlines, halftone dots, pop art colors, graphic novel style",
    palette: ["#DC2626", "#D97706"],
  },
  {
    id: "pixel",
    label: "Pixel Art",
    emoji: "🎮",
    desc: "Retro 8-bit game",
    promptSuffix: "pixel art, 16-bit retro game style, sprite art, sharp pixels, nostalgic video game aesthetic",
    palette: ["#1E40AF", "#059669"],
  },
  {
    id: "3d_render",
    label: "3D Render",
    emoji: "🧊",
    desc: "CGI & cinematic",
    promptSuffix: "3D CGI render, physically based rendering, studio lighting, octane render, hyperrealistic",
    palette: ["#1E6FA6", "#5C7A1E"],
  },
  {
    id: "fantasy",
    label: "Fantasy Art",
    emoji: "🔮",
    desc: "Epic & mystical",
    promptSuffix: "fantasy concept art, epic illustration, magical atmosphere, digital painting, artstation trending",
    palette: ["#5C7A1E", "#7C3AED"],
  },
];

export default function ConvertScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { imageBase64, canvasW, canvasH, userHint, sketchId, strokesJson } = useLocalSearchParams<{
    imageBase64: string;
    canvasW: string;
    canvasH: string;
    userHint?: string;
    sketchId?: string;
    strokesJson?: string;
  }>();

  const [selected, setSelected] = useState<ArtStyle>(ART_STYLES[0]);
  const pressedScale = useRef(new Animated.Value(1)).current;

  const handleGenerate = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(pressedScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(pressedScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => {
      router.push({
        pathname: "/generating",
        params: {
          imageBase64,
          userHint: userHint ?? "",
          style: selected.label,
          promptSuffix: selected.promptSuffix,
          canvasW,
          canvasH,
          sketchId: sketchId ?? Date.now().toString(),
          strokesJson: strokesJson ?? "",
        },
      });
    });
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
            <Text style={s.headerTitle}>Art Style</Text>
            <Text style={s.headerSub}>How should your sketch look?</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      {/* Style list */}
      <ScrollView
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 130 }]}
        showsVerticalScrollIndicator={false}
      >
        {ART_STYLES.map((style) => {
          const on = selected.id === style.id;
          return (
            <TouchableOpacity
              key={style.id}
              style={[s.card, on && s.cardOn]}
              onPress={() => { Haptics.selectionAsync(); setSelected(style); }}
              activeOpacity={0.75}
            >
              {/* Color strip */}
              <LinearGradient
                colors={style.palette}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.strip, on && s.stripOn]}
              >
                <Text style={s.stripEmoji}>{style.emoji}</Text>
              </LinearGradient>

              {/* Text */}
              <View style={s.cardBody}>
                <Text style={[s.cardLabel, on && s.cardLabelOn]}>{style.label}</Text>
                <Text style={s.cardDesc}>{style.desc}</Text>
              </View>

              {/* Check */}
              {on && (
                <View style={s.checkBadge}>
                  <Text style={s.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.selectedInfo}>
          <LinearGradient
            colors={selected.palette}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.selectedSwatch}
          >
            <Text style={{ fontSize: 18 }}>{selected.emoji}</Text>
          </LinearGradient>
          <View>
            <Text style={s.selectedLabel}>{selected.label}</Text>
            <Text style={s.selectedDesc}>{selected.desc}</Text>
          </View>
        </View>
        <Animated.View style={{ transform: [{ scale: pressedScale }] }}>
          <TouchableOpacity onPress={handleGenerate} activeOpacity={0.85}>
            <LinearGradient
              colors={["#5C7A1E", "#8CB33A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.genBtn}
            >
              <Text style={s.genBtnText}>Generate  →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const CARD_H = 72;

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

  list: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },

  card: {
    height: CARD_H,
    flexDirection: "row", alignItems: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  cardOn: { borderColor: T.accent },

  strip: {
    width: 64, height: CARD_H,
    alignItems: "center", justifyContent: "center",
  },
  stripOn: {},
  stripEmoji: { fontSize: 26 },

  cardBody: { flex: 1, paddingHorizontal: 16, gap: 4 },
  cardLabel:   { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "700" },
  cardLabelOn: { color: "#fff" },
  cardDesc:    { color: "rgba(255,255,255,0.3)", fontSize: 12 },

  checkBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: T.accent,
    alignItems: "center", justifyContent: "center",
    marginRight: 16,
  },
  checkText: { color: "#fff", fontSize: 12, fontWeight: "900" },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0D0F0A",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 16, paddingTop: 14, gap: 12,
  },
  selectedInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectedSwatch: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  selectedLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  selectedDesc:  { color: "rgba(255,255,255,0.4)", fontSize: 12 },

  genBtn:    { borderRadius: 50, paddingVertical: 15, alignItems: "center" },
  genBtnText:{ color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
});
