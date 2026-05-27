import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  PanResponder,
  ScrollView,
  ActivityIndicator,
  Image,
  ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useGallery } from "../lib/gallery-context";
import BeforeAfterSlider from "../components/BeforeAfterSlider";

const { width: SW, height: SH } = Dimensions.get("window");

const CATEGORIES = [
  {
    id: "tattoo" as const,
    label: "Tattoo",
    labelSmall: "TATTOO",
    tagline: "Ink it\nbefore you\ncommit.",
    sub: "Draw on skin · see it real",
    accent: "#C084FC",
    accentDark: "#7C3AED",
    img: require("../assets/images/tio-tattoo.png"),
    hint: "Sketch the design over the body part",
    tips: ["Well-lit photo of the area", "Arm, leg, back or neck", "Avoid dark or blurry shots"],
  },
  {
    id: "room" as const,
    label: "Room",
    labelSmall: "ROOM",
    tagline: "Redesign\nyour space\ninstantly.",
    sub: "Sketch changes · AI renders",
    accent: "#34D399",
    accentDark: "#059669",
    img: require("../assets/images/tio-room.png"),
    hint: "Sketch furniture & decor over the room",
    tips: ["Wide shot of the full room", "Natural daylight is best", "Include walls & furniture"],
  },
  {
    id: "hair" as const,
    label: "Hairstyle",
    labelSmall: "HAIR",
    tagline: "Try before\nyou cut.",
    sub: "Sketch the style · no regrets",
    accent: "#FCD34D",
    accentDark: "#D97706",
    img: require("../assets/images/tio-hair.png"),
    hint: "Sketch the new cut over your selfie",
    tips: ["Clear selfie, face visible", "Good lighting", "Front angle works best"],
  },
  {
    id: "outfit" as const,
    label: "Outfit",
    labelSmall: "OUTFIT",
    tagline: "Style it\nbefore you\nbuy it.",
    sub: "Sketch clothes · wear it virtually",
    accent: "#F472B6",
    accentDark: "#BE185D",
    img: require("../assets/images/tio-outfit.png"),
    hint: "Sketch clothing over your mirror selfie",
    tips: ["Full-body mirror selfie", "Stand in natural light", "Fitted clothing as base"],
  },
] as const;

type CategoryId = "tattoo" | "room" | "hair" | "outfit";
type Step = "category" | "photo" | "sketch" | "result";
interface Stroke { d: string; color: string; sw: number; }

const COLORS = ["#FF3B3B","#FF9500","#FFD60A","#30D158","#32ADE6","#BF5AF2","#FF375F","#FFFFFF","#000000"];

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4200") + "/api";

function toB64(str: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const bytes = unescape(encodeURIComponent(str));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes.charCodeAt(i), b1 = bytes.charCodeAt(i + 1), b2 = bytes.charCodeAt(i + 2);
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? chars[b2 & 63] : "=";
  }
  return out;
}

async function uriToBase64(uri: string): Promise<string> {
  const resp = await fetch(uri);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function TryItOnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useGallery();

  const [step, setStep]         = useState<Step>("category");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [paths, setPaths]       = useState<Stroke[]>([]);
  const [currentD, setCurrentD] = useState("");
  const [brushSize, setBrushSize] = useState(7);
  const [color, setColor]       = useState("#FF3B3B");
  const [isEraser, setIsEraser] = useState(false);
  const [showColors, setShowColors] = useState(false);

  const dRef = useRef(""); const bRef = useRef(brushSize);
  const cRef = useRef(color); const eRef = useRef(isEraser);
  bRef.current = brushSize; cRef.current = color; eRef.current = isEraser;

  const canvasWRef = useRef(0); const canvasHRef = useRef(0);

  const [loading, setLoading]   = useState(false);
  const [resultB64, setResultB64] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const cat = CATEGORIES.find(c => c.id === category);
  const CW = SW - 32;
  const CH = Math.round(CW * (4 / 3));

  // ─── Pan responder ────────────────────────────────────────────────────────
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { locationX: x, locationY: y } = e.nativeEvent;
      dRef.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
      setCurrentD(dRef.current);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      dRef.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      setCurrentD(dRef.current);
    },
    onPanResponderRelease: () => {
      if (!dRef.current || dRef.current.length < 4) return;
      setPaths(p => [...p, { d: dRef.current, color: eRef.current ? "__eraser__" : cRef.current, sw: eRef.current ? bRef.current * 5 : bRef.current }]);
      dRef.current = ""; setCurrentD("");
    },
  })).current;

  // ─── Pickers ─────────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access."); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.9 });
    if (!r.canceled && r.assets[0]) { setPhotoUri(r.assets[0].uri); setPaths([]); setStep("sketch"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow camera access."); return; }
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.9 });
    if (!r.canceled && r.assets[0]) { setPhotoUri(r.assets[0].uri); setPaths([]); setStep("sketch"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const handleRender = useCallback(async () => {
    const visible = paths.filter(p => p.color !== "__eraser__");
    if (!photoUri) { Alert.alert("No photo", "Pick a photo first."); return; }
    if (visible.length === 0) { Alert.alert("Sketch first!", "Draw on the photo before rendering."); return; }

    setLoading(true); setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const photoB64Raw = await uriToBase64(photoUri);
      const photoB64 = `data:image/jpeg;base64,${photoB64Raw}`;
      const W = canvasWRef.current || CW;
      const H = canvasHRef.current || CH;
      const pathsStr = visible.map(s =>
        `<path d="${s.d}" stroke="${s.color}" stroke-width="${s.sw}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>`
      ).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${pathsStr}</svg>`;
      const sketchB64 = `data:image/svg+xml;base64,${toB64(svg)}`;

      const resp = await fetch(`${API_BASE}/try-it-on`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64: photoB64, sketchBase64: sketchB64, category }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) throw new Error(data.error ?? "Render failed");

      setResultB64(data.imageBase64);
      setStep("result");

      addItem({
        sketchBase64: sketchB64, generatedBase64: data.imageBase64,
        style: `Try It On — ${cat?.label ?? category}`,
        modeId: "try-it-on", modeLabel: `Try It On: ${cat?.label ?? category}`,
        sketchId: Date.now().toString(),
        strokes: paths.map(p => ({ d: p.d, color: p.color, strokeWidth: p.sw })),
      });
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setStep("result");
    } finally {
      setLoading(false);
    }
  }, [photoUri, paths, category, CW, CH]);

  const handleSave = async () => {
    if (!resultB64) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to save."); return; }
      const b64data = resultB64.replace(/^data:image\/\w+;base64,/, "");
      const fileUri = ((FileSystem as any).cacheDirectory ?? "") + `tio-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, b64data, { encoding: (FileSystem as any).EncodingType?.Base64 ?? "base64" });
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Result saved to your photos.");
    } catch (err: any) { Alert.alert("Save failed", err.message); }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP: CATEGORY  — full-bleed editorial stacked cards
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step === "category") {
    return (
      <View style={s.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* ── HEADER ── */}
          <View style={[s.catTopBar, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={s.backChevron}>‹</Text>
            </TouchableOpacity>
            <View style={s.catHeaderMid}>
              <Text style={s.catHeaderPill}>✦  TRY IT ON</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          {/* ── HERO TITLE ── */}
          <View style={s.catHeroText}>
            <Text style={s.catBigTitle}>See it{"\n"}before you{"\n"}do it.</Text>
            <Text style={s.catHeroSub}>Pick a category. Upload photo.{"\n"}Sketch the change. AI does the rest.</Text>
          </View>

          {/* ── CATEGORY CARDS — full-bleed stacked ── */}
          <View style={s.catList}>
            {CATEGORIES.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.9}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setCategory(c.id); setStep("photo");
                }}
                style={s.catCard}
              >
                {/* Photo background */}
                <Image source={c.img} style={s.catCardImg} resizeMode="cover" />

                {/* Bottom gradient overlay */}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.88)"]}
                  locations={[0.2, 0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />

                {/* Top label */}
                <View style={[s.catCardTopBadge, { backgroundColor: c.accent }]}>
                  <Text style={s.catCardTopBadgeText}>{c.labelSmall}</Text>
                </View>

                {/* Bottom content */}
                <View style={s.catCardBottom}>
                  <Text style={s.catCardTagline}>{c.tagline}</Text>
                  <View style={s.catCardFooter}>
                    <Text style={s.catCardSub}>{c.sub}</Text>
                    <View style={[s.catCardArrow, { backgroundColor: c.accent }]}>
                      <Text style={s.catCardArrowText}>→</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP: PHOTO  — immersive, category photo fills top half
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step === "photo") {
    const ac = cat!.accent;
    const acD = cat!.accentDark;

    return (
      <View style={s.root}>
        {/* ── HERO IMAGE fills top ~45% ── */}
        <View style={s.photoHeroWrap}>
          <Image source={cat!.img} style={s.photoHeroImg} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.5)", "#0A0A0A"]}
            locations={[0.3, 0.65, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* back button floats on image */}
          <View style={[s.photoHeroNav, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setStep("category")} style={s.photoNavBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={s.backChevron}>‹</Text>
            </TouchableOpacity>
            <View style={[s.photoNavBadge, { backgroundColor: ac }]}>
              <Text style={s.photoNavBadgeText}>{cat!.labelSmall}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
          {/* big text over image */}
          <View style={s.photoHeroLabel}>
            <Text style={s.photoHeroBig}>{cat!.tagline}</Text>
          </View>
        </View>

        {/* ── BOTTOM SHEET ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={s.photoSheet}
          contentContainerStyle={[s.photoSheetInner, { paddingBottom: insets.bottom + 40 }]}
        >
          <Text style={s.photoSheetTitle}>Add your photo</Text>
          <Text style={s.photoSheetSub}>{cat!.hint}</Text>

          {/* Camera CTA */}
          <TouchableOpacity onPress={takePhoto} activeOpacity={0.88} style={s.cameraCta}>
            <LinearGradient
              colors={[ac, acD]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.cameraCtaGrad}
            >
              <Text style={s.cameraCtaIcon}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cameraCtaTitle}>Take a Photo</Text>
                <Text style={s.cameraCtaSub}>Open camera now</Text>
              </View>
              <View style={s.cameraCtaArrow}>
                <Text style={s.cameraCtaArrowText}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divRow}>
            <View style={s.divLine} />
            <Text style={s.divText}>or</Text>
            <View style={s.divLine} />
          </View>

          {/* Library */}
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={s.libRow}>
            <View style={[s.libIconBox, { backgroundColor: ac + "20" }]}>
              <Text style={{ fontSize: 18 }}>🖼️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.libTitle}>Choose from Library</Text>
              <Text style={s.libSub}>Pick an existing photo</Text>
            </View>
            <Text style={[s.libChevron, { color: ac }]}>→</Text>
          </TouchableOpacity>

          {/* Tips */}
          <View style={[s.tipsWrap, { borderColor: ac + "30" }]}>
            <Text style={[s.tipsLabel, { color: ac }]}>BEST RESULTS</Text>
            {cat!.tips.map(t => (
              <View key={t} style={s.tipRow}>
                <View style={[s.tipDot, { backgroundColor: ac }]} />
                <Text style={s.tipText}>{t}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP: SKETCH
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step === "sketch" || loading) {
    const visible = paths.filter(p => p.color !== "__eraser__");
    const ac = cat?.accent ?? "#8B5CF6";

    return (
      <View style={s.root}>
        {/* SLIM HEADER */}
        <View style={[s.sketchBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={() => setStep("photo")} disabled={loading} style={s.sketchBarBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.backChevron}>‹</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={[s.sketchBarPill, { backgroundColor: ac + "25", borderColor: ac + "50" }]}>
              <Text style={[s.sketchBarPillText, { color: ac }]}>✏️  {cat?.labelSmall} · Draw here</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setPaths(p => p.slice(0, -1))}
            disabled={paths.length === 0 || loading}
            style={[s.undoBtn, (paths.length === 0 || loading) && { opacity: 0.2 }]}
          >
            <Text style={[s.undoBtnText, { color: ac }]}>Undo</Text>
          </TouchableOpacity>
        </View>

        {/* CANVAS */}
        <View style={s.canvasWrap}>
          <View
            style={[s.canvas, { width: CW, height: CH }]}
            onLayout={e => { canvasWRef.current = e.nativeEvent.layout.width; canvasHRef.current = e.nativeEvent.layout.height; }}
            {...(!loading ? pan.panHandlers : {})}
          >
            {photoUri && <Image source={{ uri: photoUri }} style={[StyleSheet.absoluteFill, { width: CW, height: CH }]} resizeMode="cover" />}

            <Svg width={CW} height={CH} style={StyleSheet.absoluteFill}>
              {paths.map((stroke, i) =>
                stroke.color === "__eraser__" ? null : (
                  <Path key={i} d={stroke.d} stroke={stroke.color} strokeWidth={stroke.sw} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.92} />
                )
              )}
              {currentD.length > 2 && (
                <Path d={currentD} stroke={isEraser ? "rgba(255,255,255,0.3)" : color} strokeWidth={isEraser ? brushSize * 5 : brushSize} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.92} />
              )}
            </Svg>

            {/* First-use hint */}
            {photoUri && visible.length === 0 && currentD.length === 0 && !loading && (
              <View style={s.firstHint} pointerEvents="none">
                <View style={[s.firstHintPill, { borderColor: ac + "60" }]}>
                  <Text style={[s.firstHintText, { color: ac }]}>✏️  Sketch on your photo</Text>
                </View>
              </View>
            )}

            {/* Stroke count badge */}
            {visible.length > 0 && (
              <View style={[s.strokeBadge, { backgroundColor: ac }]} pointerEvents="none">
                <Text style={s.strokeBadgeNum}>{visible.length}</Text>
              </View>
            )}

            {/* Loading overlay */}
            {loading && (
              <View style={s.loadingOverlay}>
                <ActivityIndicator size="large" color={ac} />
                <Text style={s.loadingTitle}>AI rendering…</Text>
                <Text style={s.loadingSub}>Analyzing photo + sketch</Text>
              </View>
            )}
          </View>
        </View>

        {/* TOOLBAR */}
        {!loading && (
          <View style={[s.toolbar, { paddingBottom: insets.bottom + 10 }]}>
            {/* Color palette */}
            {showColors && (
              <View style={s.palette}>
                {COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[s.swatch, { backgroundColor: c }, color === c && !isEraser && s.swatchActive]}
                    onPress={() => { setColor(c); setIsEraser(false); setShowColors(false); Haptics.selectionAsync(); }}
                  />
                ))}
              </View>
            )}

            <View style={s.toolRow}>
              {/* Color dot */}
              <TouchableOpacity
                style={[s.colorDot, { backgroundColor: isEraser ? "#2A2A2A" : color }, showColors && { borderColor: ac, borderWidth: 2.5 }]}
                onPress={() => { setShowColors(v => !v); if (isEraser) setIsEraser(false); Haptics.selectionAsync(); }}
              />

              {/* Brush sizes */}
              {([4, 7, 12, 20] as const).map(sz => (
                <TouchableOpacity
                  key={sz}
                  style={[s.brushBtn, brushSize === sz && { borderColor: ac, backgroundColor: ac + "22" }]}
                  onPress={() => { setBrushSize(sz); setIsEraser(false); Haptics.selectionAsync(); }}
                >
                  <View style={{ width: Math.min(sz * 0.72, 17), height: Math.min(sz * 0.72, 17), borderRadius: sz, backgroundColor: brushSize === sz ? ac : "rgba(255,255,255,0.22)" }} />
                </TouchableOpacity>
              ))}

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                style={[s.iconBtn, isEraser && { backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.35)" }]}
                onPress={() => { setIsEraser(v => !v); setShowColors(false); Haptics.selectionAsync(); }}
              >
                <Text style={s.iconBtnTxt}>⌫</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => Alert.alert("Clear?", "Remove all strokes?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clear", style: "destructive", onPress: () => { setPaths([]); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
                ])}
              >
                <Text style={s.iconBtnTxt}>🗑</Text>
              </TouchableOpacity>
            </View>

            {/* RENDER BUTTON */}
            <TouchableOpacity onPress={handleRender} activeOpacity={0.88} disabled={visible.length === 0}>
              <LinearGradient
                colors={visible.length === 0 ? ["#1E1E1E", "#181818"] : [ac, cat?.accentDark ?? ac]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.renderBtn, visible.length === 0 && { opacity: 0.3 }]}
              >
                <Text style={s.renderBtnText}>✨  Render with AI</Text>
                <View style={[s.renderBtnChip, visible.length > 0 && { backgroundColor: "rgba(0,0,0,0.22)" }]}>
                  <Text style={s.renderBtnChipText}>→</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP: RESULT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step === "result") {
    const ac = cat?.accent ?? "#8B5CF6";
    const acD = cat?.accentDark ?? "#6D28D9";

    return (
      <View style={s.root}>
        {/* NAV */}
        <View style={[s.resultNav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => { setError(null); setStep("sketch"); }} style={s.sketchBarBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={s.resultNavTitle}>Your Result</Text>
          {resultB64 && !error ? (
            <TouchableOpacity onPress={handleSave}>
              <Text style={[s.resultNavSave, { color: ac }]}>Save</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.resultScroll, { paddingBottom: insets.bottom + 40 }]}>

          {error ? (
            <View style={s.errorWrap}>
              <View style={[s.errorIconRing, { borderColor: "#EF444450" }]}>
                <Text style={{ fontSize: 28 }}>⚠️</Text>
              </View>
              <Text style={s.errorTitle}>Render failed</Text>
              <Text style={s.errorMsg}>{error}</Text>
              <TouchableOpacity onPress={() => { setError(null); setStep("sketch"); }}
                style={[s.errorRetry, { backgroundColor: ac + "20", borderColor: ac + "50" }]}>
                <Text style={[s.errorRetryText, { color: ac }]}>Try Again →</Text>
              </TouchableOpacity>
            </View>
          ) : resultB64 && photoUri ? (
            <>
              {/* Drag label */}
              <View style={s.dragLabelRow}>
                <View style={[s.dragLabelDot, { backgroundColor: ac }]} />
                <Text style={s.dragLabelText}>DRAG TO COMPARE</Text>
              </View>

              {/* Slider */}
              <BeforeAfterSlider
                beforeUri={photoUri}
                afterUri={resultB64}
                width={SW - 32}
                height={Math.round((SW - 32) * (4 / 3))}
              />

              {/* Save */}
              <TouchableOpacity onPress={handleSave} activeOpacity={0.88} style={{ width: "100%", borderRadius: 50, overflow: "hidden" }}>
                <LinearGradient colors={[ac, acD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveCta}>
                  <Text style={s.saveCtaText}>📥  Save to Photos</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Sketch again */}
              <TouchableOpacity onPress={() => { setResultB64(null); setError(null); setStep("sketch"); }}
                activeOpacity={0.85} style={s.sketchAgainBtn}>
                <Text style={s.sketchAgainText}>✏️  Sketch Again</Text>
              </TouchableOpacity>

              {/* New category */}
              <TouchableOpacity
                onPress={() => { setPaths([]); setResultB64(null); setError(null); setPhotoUri(null); setCategory(null); setStep("category"); }}
                style={{ alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={s.newCatText}>← Try Another Category</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },

  backChevron: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 34 },

  // ── CATEGORY ──────────────────────────────────────────────────────────────
  catTopBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 4,
  },
  catHeaderMid: { flex: 1, alignItems: "center" },
  catHeaderPill: {
    color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800",
    letterSpacing: 1.5,
  },
  catHeroText: {
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 24, gap: 10,
  },
  catBigTitle: {
    color: "#fff", fontSize: 44, fontWeight: "900",
    lineHeight: 50, letterSpacing: -1.5,
  },
  catHeroSub: {
    color: "rgba(255,255,255,0.35)", fontSize: 13, lineHeight: 20,
  },

  catList: { paddingHorizontal: 18, gap: 14 },

  catCard: {
    height: 220, borderRadius: 22, overflow: "hidden",
    position: "relative",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  catCardImg: {
    ...StyleSheet.absoluteFillObject as any,
    width: "100%", height: "100%",
  },
  catCardTopBadge: {
    position: "absolute", top: 16, left: 16,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  catCardTopBadgeText: {
    color: "#000", fontSize: 10, fontWeight: "900", letterSpacing: 1.2,
  },
  catCardBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 20, gap: 12,
  },
  catCardTagline: {
    color: "#fff", fontSize: 24, fontWeight: "900",
    lineHeight: 28, letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  catCardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catCardSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "500" },
  catCardArrow: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  catCardArrowText: { color: "#000", fontSize: 18, fontWeight: "900" },

  // ── PHOTO STEP ────────────────────────────────────────────────────────────
  photoHeroWrap: {
    height: SH * 0.42,
    position: "relative",
  },
  photoHeroImg: {
    ...StyleSheet.absoluteFillObject as any,
    width: "100%", height: "100%",
  },
  photoHeroNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 8,
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
  },
  photoNavBack: { width: 36, alignItems: "flex-start" },
  photoNavBadge: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
  },
  photoNavBadgeText: { color: "#000", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  photoHeroLabel: {
    position: "absolute", bottom: 24, left: 22,
  },
  photoHeroBig: {
    color: "#fff", fontSize: 30, fontWeight: "900",
    lineHeight: 36, letterSpacing: -0.8,
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },

  photoSheet: { flex: 1 },
  photoSheetInner: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  photoSheetTitle: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  photoSheetSub: { color: "rgba(255,255,255,0.38)", fontSize: 13, lineHeight: 19, marginTop: -8 },

  cameraCta: { borderRadius: 18, overflow: "hidden" },
  cameraCtaGrad: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 18, paddingHorizontal: 20, gap: 14,
  },
  cameraCtaIcon: { fontSize: 26 },
  cameraCtaTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cameraCtaSub: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  cameraCtaArrow: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center",
  },
  cameraCtaArrowText: { color: "#fff", fontSize: 17, fontWeight: "800" },

  divRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  divText: { color: "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: "600" },

  libRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  libIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  libTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  libSub: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
  libChevron: { fontSize: 18, fontWeight: "700" },

  tipsWrap: {
    borderRadius: 16, padding: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, gap: 10,
  },
  tipsLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 2 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tipDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  tipText: { color: "rgba(255,255,255,0.45)", fontSize: 13, flex: 1, lineHeight: 19 },

  // ── SKETCH ────────────────────────────────────────────────────────────────
  sketchBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 8, gap: 6,
  },
  sketchBarBack: { width: 32 },
  sketchBarPill: {
    borderRadius: 50, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1,
  },
  sketchBarPillText: { fontSize: 12, fontWeight: "800" },
  undoBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 50, backgroundColor: "rgba(255,255,255,0.07)",
  },
  undoBtnText: { fontSize: 12, fontWeight: "800" },

  canvasWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  canvas: { borderRadius: 18, overflow: "hidden", backgroundColor: "#1C1C1C" },

  firstHint: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "flex-end", paddingBottom: 20 },
  firstHintPill: {
    borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1,
  },
  firstHintText: { fontSize: 13, fontWeight: "700" },

  strokeBadge: {
    position: "absolute", top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  strokeBadgeNum: { color: "#000", fontSize: 11, fontWeight: "900" },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  loadingTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  loadingSub: { color: "rgba(255,255,255,0.4)", fontSize: 13 },

  toolbar: {
    backgroundColor: "#0F0F0F", paddingHorizontal: 16, paddingTop: 12, gap: 10,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  palette: { flexDirection: "row", gap: 8, paddingBottom: 2, flexWrap: "wrap" },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.1)" },
  swatchActive: { borderColor: "#fff", borderWidth: 2.5, transform: [{ scale: 1.15 }] },

  toolRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)" },
  brushBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  iconBtnTxt: { fontSize: 15 },

  renderBtn: {
    borderRadius: 50, paddingVertical: 15, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  renderBtnText: { color: "#fff", fontSize: 15, fontWeight: "900", flex: 1, textAlign: "center" },
  renderBtnChip: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  renderBtnChipText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  // ── RESULT ────────────────────────────────────────────────────────────────
  resultNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 10,
  },
  resultNavTitle: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  resultNavSave: { fontSize: 15, fontWeight: "800" },

  resultScroll: { paddingHorizontal: 16, paddingTop: 8, gap: 14, alignItems: "center" },

  dragLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  dragLabelDot: { width: 6, height: 6, borderRadius: 3 },
  dragLabelText: { color: "rgba(255,255,255,0.28)", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },

  saveCta: { paddingVertical: 16, alignItems: "center", borderRadius: 50 },
  saveCtaText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  sketchAgainBtn: {
    width: "100%", paddingVertical: 15, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  sketchAgainText: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700" },
  newCatText: { color: "rgba(255,255,255,0.22)", fontSize: 13, fontWeight: "600" },

  // ── ERROR ─────────────────────────────────────────────────────────────────
  errorWrap: { alignItems: "center", gap: 12, paddingTop: 60, paddingHorizontal: 20 },
  errorIconRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  errorTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  errorMsg: { color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", lineHeight: 20 },
  errorRetry: { marginTop: 10, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 50, borderWidth: 1 },
  errorRetryText: { fontSize: 14, fontWeight: "800" },
});
