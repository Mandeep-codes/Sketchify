/**
 * Speed Draw Challenge Mode
 * ─ 30/60/90s countdown timer
 * ─ Embedded mini-canvas
 * ─ Auto-generates when time runs out (or on tap)
 * ─ Battle card: sketch + result side-by-side, shareable
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  Alert, Animated, Dimensions, Easing, Modal, PanResponder,
  Platform, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, ImageBackground,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect, Circle, Text as SvgText, Image as SvgImage } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { Image } from "react-native";
import { T } from "../lib/theme";
import { CHALLENGES, getTodayChallenge } from "../lib/challenges";
import { api } from "../lib/api";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Types ────────────────────────────────────────────────────────────────────
interface StrokePath {
  d: string;
  color: string;
  strokeWidth: number;
}

type Phase = "lobby" | "drawing" | "generating" | "result";
type TimerOption = 30 | 60 | 90;

const TIMER_OPTIONS: TimerOption[] = [30, 60, 90];
const COLORS = ["#1A1A1A", "#5C7A1E", "#2563EB", "#DC2626", "#F59E0B", "#EC4899", "#FFFFFF"];
const DEFAULT_COLOR = "#1A1A1A";
const DEFAULT_BRUSH = 4;
const STYLES_LIST = ["Realistic", "Anime", "Oil Painting", "Cyberpunk", "Watercolor"] as const;
type StyleChoice = typeof STYLES_LIST[number];

// ── Countdown ring ────────────────────────────────────────────────────────────
function CountdownRing({
  total, remaining, size = 72,
}: { total: number; remaining: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = remaining / total;
  const offset = circ * (1 - pct);
  const urgent = remaining <= 10;
  const color = urgent ? T.danger : T.accent;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {/* Track */}
        <Path
          d={`M ${size / 2} ${size / 2 - r} A ${r} ${r} 0 1 1 ${size / 2 - 0.001} ${size / 2 - r}`}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={6}
          fill="none"
        />
        {/* Fill */}
        <Path
          d={`M ${size / 2} ${size / 2 - r} A ${r} ${r} 0 1 1 ${size / 2 - 0.001} ${size / 2 - r}`}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ color: urgent ? T.danger : "#fff", fontWeight: "900", fontSize: size * 0.3 }}>
        {remaining}
      </Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChallengeModeScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  // ── Lobby state
  const [phase, setPhase]             = useState<Phase>("lobby");
  const [timerChoice, setTimerChoice] = useState<TimerOption>(60);
  const [styleChoice, setStyleChoice] = useState<StyleChoice>("Realistic");
  const [challenge, setChallenge]     = useState(getTodayChallenge());

  // ── Drawing state
  const [paths, setPaths]           = useState<StrokePath[]>([]);
  const [currentD, setCurrentD]     = useState("");
  const [color, setColor]           = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize]   = useState(DEFAULT_BRUSH);
  const [isEraser, setIsEraser]     = useState(false);

  // ── Timer
  const [remaining, setRemaining]   = useState(60);
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef                    = useRef<Phase>("lobby");
  phaseRef.current                  = phase;

  // ── Result
  const [generatedB64, setGeneratedB64] = useState<string | null>(null);
  const [sketchB64, setSketchB64]       = useState<string | null>(null);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  // ── Canvas dims (computed once drawing starts)
  const CANVAS_SIZE = useMemo(() => {
    const avail = Math.min(SW - 32, SH * 0.42);
    return Math.floor(avail);
  }, []);

  // ── Refs for PanResponder closures
  const pathsRef        = useRef<StrokePath[]>([]);
  const colorRef        = useRef(DEFAULT_COLOR);
  const brushRef        = useRef(DEFAULT_BRUSH);
  const eraserRef       = useRef(false);
  const currentDRef     = useRef("");
  pathsRef.current      = paths;
  colorRef.current      = color;
  brushRef.current      = brushSize;
  eraserRef.current     = isEraser;

  // ── PanResponder ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        if (phaseRef.current !== "drawing") return;
        const { locationX, locationY } = e.nativeEvent;
        const d = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentDRef.current = d;
        setCurrentD(d);
      },
      onPanResponderMove: (e) => {
        if (phaseRef.current !== "drawing") return;
        const { locationX, locationY } = e.nativeEvent;
        const d = currentDRef.current + ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentDRef.current = d;
        setCurrentD(d);
      },
      onPanResponderRelease: () => {
        if (phaseRef.current !== "drawing" || !currentDRef.current) return;
        const stroke: StrokePath = {
          d: currentDRef.current,
          color: eraserRef.current ? "#F8F4EE" : colorRef.current,
          strokeWidth: eraserRef.current ? brushRef.current * 3.5 : brushRef.current,
        };
        setPaths((prev) => [...prev, stroke]);
        currentDRef.current = "";
        setCurrentD("");
      },
    })
  ).current;

  // ── Start drawing phase ───────────────────────────────────────────────────
  const startDrawing = useCallback(() => {
    setPaths([]);
    setCurrentD("");
    setRemaining(timerChoice);
    setGeneratedB64(null);
    setSketchB64(null);
    setErrorMsg(null);
    setIsEraser(false);
    setPhase("drawing");

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const tick = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(tick);
          // auto-submit
          triggerGenerate();
          return 0;
        }
        if (next <= 10) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return next;
      });
    }, 1000);
    intervalRef.current = tick;
  }, [timerChoice]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Trigger AI generation ─────────────────────────────────────────────────
  const triggerGenerate = useCallback(() => {
    stopTimer();
    setPhase("generating");

    // Build SVG from paths
    const currentPaths = pathsRef.current;
    if (currentPaths.length === 0) {
      setErrorMsg("No strokes — draw something first!");
      setPhase("result");
      return;
    }

    const svgPaths = currentPaths
      .map((s) => `<path d="${s.d}" stroke="${s.color}" stroke-width="${s.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`)
      .join("");
    const svgStr  = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" style="background:#F8F4EE">${svgPaths}</svg>`;
    const b64     = btoa(unescape(encodeURIComponent(svgStr)));
    const dataUri = `data:image/svg+xml;base64,${b64}`;
    setSketchB64(dataUri);

    // Call API
    (async () => {
      try {
        const res = await (api as any)["/generate"].$post({
          json: {
            imageBase64: dataUri,
            style: styleChoice,
            userHint: challenge.description,
            modeId: "square",
            aspectRatio: "1:1",
          },
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        const url: string = (data as any).imageUrl ?? (data as any).url ?? "";
        if (!url) throw new Error("No image in response");
        // Fetch as base64
        const resp = await fetch(url);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setGeneratedB64(reader.result as string);
          setPhase("result");
        };
        reader.readAsDataURL(blob);
      } catch (err: any) {
        setErrorMsg(err?.message ?? "Generation failed");
        setPhase("result");
      }
    })();
  }, [CANVAS_SIZE, styleChoice, challenge, stopTimer]);

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), []);

  // ── Share battle card ─────────────────────────────────────────────────────
  const shareBattleCard = useCallback(async () => {
    if (!sketchB64 || !generatedB64) return;
    try {
      // Build a simple SVG battle card and save as file
      const cardW = 800;
      const cardH = 460;
      const imgW  = 340;
      const imgH  = 340;
      const yOff  = 60;

      const card = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}" style="background:#1C1C1E;font-family:sans-serif">
  <rect width="${cardW}" height="${cardH}" rx="32" fill="#1C1C1E"/>
  <text x="${cardW/2}" y="42" text-anchor="middle" font-size="20" font-weight="900" fill="#8CB33A" letter-spacing="0.5">Speed Draw Challenge</text>
  <text x="${cardW/2}" y="66" text-anchor="middle" font-size="13" fill="rgba(255,255,255,0.45)">${challenge.title}</text>
  <image href="${sketchB64}" x="40" y="${yOff + 10}" width="${imgW}" height="${imgH}" rx="16"/>
  <text x="40" y="${yOff + imgH + 30}" font-size="12" font-weight="700" fill="rgba(255,255,255,0.4)">YOUR SKETCH</text>
  <image href="${generatedB64}" x="${cardW - imgW - 40}" y="${yOff + 10}" width="${imgW}" height="${imgH}" rx="16"/>
  <text x="${cardW - imgW - 40}" y="${yOff + imgH + 30}" font-size="12" font-weight="700" fill="rgba(255,255,255,0.4)">AI RESULT · ${styleChoice}</text>
  
  <text x="${cardW/2}" y="${cardH - 18}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.2)">Made with Sketch to Real</text>
</svg>`;

      const path = (FileSystem as any).cacheDirectory + `battle-${Date.now()}.svg`;
      await FileSystem.writeAsStringAsync(path, card, { encoding: (FileSystem as any).EncodingType?.UTF8 ?? "utf8" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "image/svg+xml" });
      } else {
        Alert.alert("Sharing not available on this device");
      }
    } catch (e: any) {
      Alert.alert("Share failed", e?.message);
    }
  }, [sketchB64, generatedB64, challenge, styleChoice]);

  const saveToGallery = useCallback(async () => {
    if (!generatedB64) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission denied"); return; }
      // save as file
      const b64only = generatedB64.replace(/^data:image\/\w+;base64,/, "");
      const path = (FileSystem as any).cacheDirectory + `challenge-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(path, b64only, { encoding: (FileSystem as any).EncodingType?.Base64 ?? "base64" });
      await MediaLibrary.saveToLibraryAsync(path);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Image saved to your photo library.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message);
    }
  }, [generatedB64]);

  // ── Pick random challenge ────────────────────────────────────────────────
  const randomChallenge = useCallback(() => {
    const idx = Math.floor(Math.random() * CHALLENGES.length);
    setChallenge(CHALLENGES[idx]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // LOBBY
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
        <ScrollView contentContainerStyle={styles.lobbyContainer} showsVerticalScrollIndicator={false}>

          {/* ── HERO HEADER — dark ink wash ── */}
          <View style={styles.lobbyHero}>
            <ImageBackground
              source={require("../assets/images/challenge-paint-bg.png")}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {/* Deep dark overlay */}
            <LinearGradient
              colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0.5)", "rgba(10,10,10,0.95)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Decorative dashed ring — top right */}
            <Svg style={styles.heroRing} viewBox="0 0 120 120">
              <Circle cx="60" cy="60" r="52" stroke="rgba(140,179,58,0.2)" strokeWidth="1.5" fill="none" strokeDasharray="6 5" strokeLinecap="round" />
              <Circle cx="60" cy="60" r="38" stroke="rgba(140,179,58,0.1)" strokeWidth="1" fill="none" />
            </Svg>

            {/* Back button */}
            <SafeAreaView edges={["top"]} style={styles.heroTopBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.heroBackBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.heroBackTxt}>← Back</Text>
              </TouchableOpacity>
              {/* Eyebrow pill */}
              <View style={styles.heroEyebrow}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroEyebrowTxt}>SPEED DRAW</Text>
              </View>
              <View style={{ width: 60 }} />
            </SafeAreaView>

            {/* Giant title */}
            <View style={styles.heroInner}>
              <Text style={styles.heroTitle}>{"Race the\nclock."}</Text>
              <Text style={styles.heroSub}>Sketch something. AI transforms it.</Text>
            </View>

            {/* Ink-stroke divider at bottom of hero */}
            <Svg height={10} width="100%" viewBox="0 0 375 10" preserveAspectRatio="none" style={styles.heroDivider}>
              <Path
                d="M0 5 Q40 1 90 5 Q140 9 200 5 Q260 1 320 5 Q350 8 375 5"
                stroke="rgba(140,179,58,0.3)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
          </View>

          {/* ── CHALLENGE CARD — dramatic centrepiece ── */}
          <View style={styles.challengeCard}>
            {/* Accent left bar */}
            <View style={styles.challengeCardBar} />

            <View style={styles.challengeCardInner}>
              <View style={styles.challengeTopRow}>
                <View style={styles.challengeLabelPill}>
                  <Text style={styles.challengeLabelTxt}>TODAY'S PROMPT</Text>
                </View>
                <TouchableOpacity onPress={randomChallenge} style={styles.randomBtn} activeOpacity={0.75}>
                  <Text style={styles.randomBtnText}>Random</Text>
                </TouchableOpacity>
              </View>

              {/* Emoji — huge, floats */}
              <Text style={styles.challengeEmoji}>{challenge.emoji}</Text>

              <Text style={styles.challengeName}>{challenge.title}</Text>
              <Text style={styles.challengeDesc}>{challenge.description}</Text>
            </View>
          </View>

          {/* ── TIME LIMIT ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>TIME LIMIT</Text>
              <Text style={styles.sectionHint}>shorter = harder</Text>
            </View>
            <View style={styles.timerRow}>
              {TIMER_OPTIONS.map((t) => {
                const active = timerChoice === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.timerBtn, active && styles.timerBtnActive]}
                    onPress={() => { setTimerChoice(t); Haptics.selectionAsync(); }}
                    activeOpacity={0.8}
                  >
                    {active && (
                      <LinearGradient
                        colors={["rgba(92,122,30,0.35)", "rgba(140,179,58,0.2)"]}
                        style={StyleSheet.absoluteFill as any}
                      />
                    )}
                    <Text style={[styles.timerBtnNum, active && styles.timerBtnNumActive]}>{t}</Text>
                    <Text style={[styles.timerBtnSec, active && styles.timerBtnSecActive]}>sec</Text>
                    {active && <View style={styles.timerActiveDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── AI STYLE ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AI STYLE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {STYLES_LIST.map((s) => {
                const active = styleChoice === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.styleChip, active && styles.styleChipActive]}
                    onPress={() => { setStyleChoice(s); Haptics.selectionAsync(); }}
                    activeOpacity={0.8}
                  >
                    {active && (
                      <LinearGradient
                        colors={["rgba(92,122,30,0.4)", "rgba(140,179,58,0.25)"]}
                        style={StyleSheet.absoluteFill as any}
                      />
                    )}
                    <Text style={[styles.styleChipText, active && styles.styleChipTextActive]}>{s}</Text>
                    {active && <Text style={styles.styleChipCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── START BUTTON — paint-blob filled ── */}
          <TouchableOpacity onPress={startDrawing} activeOpacity={0.88} style={styles.startBtnWrap}>
            {/* SVG paint blob */}
            <Svg style={styles.startBtnBlob} viewBox="0 0 340 70" preserveAspectRatio="none">
              <Path
                d="M8,18 Q4,5 22,3 Q80,0 170,3 Q260,6 318,2 Q334,1 338,12 Q344,26 338,38 Q344,54 334,63 Q318,70 270,67 Q190,71 110,68 Q50,65 24,68 Q8,68 3,56 Q-3,42 8,18 Z"
                fill="#8CB33A"
              />
              {/* Highlight brush streak */}
              <Path
                d="M30,10 Q120,5 220,8 Q280,10 320,7"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.startBtnText}>Start Challenge</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DRAWING
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "drawing") {
    const activeColor  = isEraser ? "#F8F4EE" : color;
    const activeBrush  = isEraser ? brushSize * 3.5 : brushSize;
    const urgent       = remaining <= 10;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D0F" }}>
        {/* Top bar */}
        <View style={styles.drawHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.drawPrompt} numberOfLines={1}>
              {challenge.emoji} {challenge.title}
            </Text>
            <Text style={styles.drawStyle}>{styleChoice}</Text>
          </View>
          <CountdownRing total={timerChoice} remaining={remaining} size={64} />
        </View>

        {/* Canvas */}
        <View
          style={[styles.canvasWrap, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}
          {...panResponder.panHandlers}
        >
          <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={StyleSheet.absoluteFill}>
            {/* Background */}
            <Rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill="#F8F4EE" />
            {/* Completed strokes */}
            {paths.map((p, i) => (
              <Path
                key={i}
                d={p.d}
                stroke={p.color}
                strokeWidth={p.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {/* Live stroke */}
            {currentD ? (
              <Path
                d={currentD}
                stroke={activeColor}
                strokeWidth={activeBrush}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : null}
          </Svg>
        </View>

        {/* Toolbar */}
        <View style={styles.drawToolbar}>
          {/* Colors */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }} contentContainerStyle={{ gap: 8, alignItems: "center", paddingHorizontal: 4 }}>
            {COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => { setColor(c); setIsEraser(false); }}
                style={[
                  styles.colorDot,
                  { backgroundColor: c, borderColor: c === "#FFFFFF" ? "rgba(255,255,255,0.3)" : c },
                  !isEraser && color === c && styles.colorDotActive,
                ]}
              />
            ))}
            {/* Eraser */}
            <TouchableOpacity
              onPress={() => setIsEraser((v) => !v)}
              style={[styles.eraserBtn, isEraser && styles.eraserBtnActive]}
            >
              <Text style={{ fontSize: 16 }}>⌫</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Brush sizes */}
          <View style={styles.brushRow}>
            {[2, 4, 7, 12].map((b) => (
              <TouchableOpacity
                key={b}
                onPress={() => setBrushSize(b)}
                style={[styles.brushBtn, brushSize === b && styles.brushBtnActive]}
              >
                <View style={[styles.brushDot, { width: Math.min(b * 2.5, 22), height: Math.min(b * 2.5, 22), borderRadius: 20 }]} />
              </TouchableOpacity>
            ))}

            {/* Undo */}
            <TouchableOpacity
              onPress={() => setPaths((p) => p.slice(0, -1))}
              style={styles.brushBtn}
            >
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>↩</Text>
            </TouchableOpacity>
          </View>

          {/* Done */}
          <TouchableOpacity onPress={triggerGenerate} style={styles.doneBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={["#5C7A1E", "#8CB33A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.doneBtnGrad}
            >
              <Text style={styles.doneBtnText}>Done — Generate</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {urgent && (
          <View style={styles.urgentBanner}>
            <Text style={styles.urgentText}>Time's almost up!</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GENERATING
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "generating") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D0F", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <Text style={{ fontSize: 48, fontWeight: "900", color: "#8CB33A" }}>!</Text>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>
          Transforming…
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          AI is working its magic
        </Text>
        {/* Pulsing dots */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <PulsingDot key={i} delay={i * 200} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESULT — Battle card
  // ─────────────────────────────────────────────────────────────────────────
  const imgSize = Math.floor((SW - 56) / 2);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D0F" }}>
      <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>Challenge Complete!</Text>
          <Text style={styles.resultSub}>{challenge.emoji} {challenge.title}</Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : (
          <>
            {/* Battle Card */}
            <View style={styles.battleCard}>
              <LinearGradient
                colors={["#1A2A0A", "#0D1F0D"]}
                style={styles.battleCardGrad}
              >
                <View style={styles.battleRow}>
                  {/* Sketch side */}
                  <View style={styles.battleSide}>
                    <Text style={styles.battleLabel}>YOUR SKETCH</Text>
                    <View style={[styles.battleImgWrap, { width: imgSize, height: imgSize }]}>
                      {sketchB64 ? (
                        <Image
                          source={{ uri: sketchB64 }}
                          style={{ width: imgSize, height: imgSize, borderRadius: 12 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.battleImgPlaceholder, { width: imgSize, height: imgSize }]} />
                      )}
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={styles.battleDivider}>
                    <Text style={styles.battleVs}>vs</Text>
                  </View>

                  {/* Result side */}
                  <View style={styles.battleSide}>
                    <Text style={styles.battleLabel}>AI · {styleChoice.toUpperCase()}</Text>
                    <View style={[styles.battleImgWrap, { width: imgSize, height: imgSize }]}>
                      {generatedB64 ? (
                        <Image
                          source={{ uri: generatedB64 }}
                          style={{ width: imgSize, height: imgSize, borderRadius: 12 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.battleImgPlaceholder, { width: imgSize, height: imgSize }]} />
                      )}
                    </View>
                  </View>
                </View>

                {/* Timer badge */}
                <View style={styles.timerBadge}>
                  <Text style={styles.timerBadgeText}>
                    {timerChoice - remaining}s used of {timerChoice}s
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              {generatedB64 && (
                <TouchableOpacity style={styles.actionBtn} onPress={saveToGallery}>
                  <Text style={styles.actionBtnEmoji}>💾</Text>
                  <Text style={styles.actionBtnLabel}>Save</Text>
                </TouchableOpacity>
              )}
              {generatedB64 && sketchB64 && (
                <TouchableOpacity style={styles.actionBtn} onPress={shareBattleCard}>
                  <Text style={styles.actionBtnEmoji}>📤</Text>
                  <Text style={styles.actionBtnLabel}>Share Card</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Play again / Back */}
        <View style={styles.bottomBtns}>
          <TouchableOpacity
            onPress={() => {
              setPaths([]);
              setCurrentD("");
              setGeneratedB64(null);
              setSketchB64(null);
              setErrorMsg(null);
              setPhase("lobby");
            }}
            style={styles.playAgainBtn}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={["#5C7A1E", "#8CB33A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.playAgainGrad}
            >
              <Text style={styles.playAgainText}>Play Again</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.backHome}>
            <Text style={styles.backHomeText}>← Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Pulsing dot ───────────────────────────────────────────────────────────────
function PulsingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.accent, opacity: anim }} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Lobby
  lobbyContainer: { paddingBottom: 48, gap: 20 },

  // Hero
  lobbyHero: {
    minHeight: 260,
    overflow: "hidden",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  heroRing: {
    position: "absolute",
    top: -20, right: -20,
    width: 140, height: 140,
  },
  heroTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 4,
    zIndex: 2,
  },
  heroBackBtn: {
    width: 60,
    paddingVertical: 4,
  },
  heroBackTxt: { color: T.accent, fontSize: 15, fontWeight: "700" },
  heroEyebrow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(92,122,30,0.2)",
    borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(140,179,58,0.3)",
  },
  heroLiveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: T.accent,
  },
  heroEyebrowTxt: {
    fontSize: 9, fontWeight: "900", color: T.accent,
    letterSpacing: 2, textTransform: "uppercase",
  },
  heroInner: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    paddingTop: 16,
    gap: 8,
  },
  heroTitle: {
    fontSize: 44, fontWeight: "900", color: "#fff",
    letterSpacing: -1.5, lineHeight: 48,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  heroSub: {
    fontSize: 14, color: "rgba(255,255,255,0.5)",
    lineHeight: 20, fontWeight: "500",
  },
  heroDivider: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
  },

  // Challenge card
  challengeCard: {
    marginHorizontal: 20,
    backgroundColor: "#151515",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    flexDirection: "row",
  },
  challengeCardBar: {
    width: 4,
    backgroundColor: T.accent,
  },
  challengeCardInner: {
    flex: 1,
    padding: 20,
    gap: 8,
  },
  challengeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  challengeLabelPill: {
    backgroundColor: "rgba(140,179,58,0.12)",
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(140,179,58,0.25)",
  },
  challengeLabelTxt: {
    fontSize: 9, fontWeight: "900", color: T.accent,
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  randomBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 50,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  randomBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700" },

  challengeEmoji: {
    fontSize: 56,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 8,
    marginVertical: 4,
  },
  challengeName: {
    fontSize: 24, fontWeight: "900", color: "#fff",
    letterSpacing: -0.5, lineHeight: 28,
  },
  challengeDesc: {
    fontSize: 13, color: "rgba(255,255,255,0.45)",
    lineHeight: 18, fontWeight: "500",
  },

  section:      { gap: 10, paddingHorizontal: 20 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  sectionHint:  { color: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: "600" },

  timerRow: { flexDirection: "row", gap: 10 },
  timerBtn: {
    flex: 1, paddingVertical: 18, borderRadius: 18,
    backgroundColor: "#151515", alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden", gap: 2,
  },
  timerBtnActive: { borderColor: T.accent },
  timerBtnNum: { fontSize: 26, fontWeight: "900", color: "rgba(255,255,255,0.35)" },
  timerBtnNumActive: { color: "#fff" },
  timerBtnSec: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.2)", letterSpacing: 0.5 },
  timerBtnSecActive: { color: T.accent },
  timerActiveDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: T.accent, marginTop: 4,
  },

  styleChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50,
    backgroundColor: "#151515",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row", alignItems: "center", gap: 6,
    overflow: "hidden",
  },
  styleChipActive: { borderColor: T.accent },
  styleChipText:   { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "700" },
  styleChipTextActive: { color: "#fff", fontWeight: "900" },
  styleChipCheck: { fontSize: 11, color: T.accent, fontWeight: "900" },

  // Start button — paint blob
  startBtnWrap: {
    marginHorizontal: 20,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  startBtnBlob: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    width: "100%", height: "100%",
  },
  startBtnText: { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: 0.3, zIndex: 2 },

  backBtn: { color: T.accent, fontSize: 15, fontWeight: "700" },

  // Drawing
  drawHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  drawPrompt: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  drawStyle:  { color: T.accent, fontSize: 11, fontWeight: "700", marginTop: 2 },
  canvasWrap: {
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    marginVertical: 8,
  },
  drawToolbar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  colorDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2,
  },
  colorDotActive: { borderColor: "#fff", borderWidth: 3 },
  eraserBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  eraserBtnActive: { backgroundColor: "rgba(92,122,30,0.3)", borderColor: T.accent },
  brushRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  brushBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  brushBtnActive: { borderColor: T.accent, backgroundColor: "rgba(92,122,30,0.2)" },
  brushDot: { backgroundColor: "#fff" },
  doneBtn: { marginTop: 4 },
  doneBtnGrad: { borderRadius: 50, alignItems: "center", paddingVertical: 15 },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  urgentBanner: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: T.danger,
    paddingVertical: 8,
    alignItems: "center",
  },
  urgentText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  // Result
  resultContainer: { padding: 20, paddingBottom: 40, gap: 16 },
  resultHeader:    { alignItems: "center", gap: 4 },
  resultTitle:     { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  resultSub:       { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  errorBox:        { backgroundColor: "rgba(232,64,64,0.15)", borderRadius: 16, padding: 20 },
  errorText:       { color: T.danger, fontSize: 14, textAlign: "center" },

  battleCard: { borderRadius: 24, overflow: "hidden" },
  battleCardGrad: { borderRadius: 24, padding: 16, gap: 12 },
  battleRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  battleSide: { flex: 1, alignItems: "center", gap: 6 },
  battleLabel: { color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  battleImgWrap: { borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)" },
  battleImgPlaceholder: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12 },
  battleDivider: { alignItems: "center", justifyContent: "center", width: 24 },
  battleVs: { fontSize: 20 },
  timerBadge: { alignSelf: "center", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  timerBadgeText: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700" },

  actionRow: { flexDirection: "row", gap: 12, justifyContent: "center" },
  actionBtn:      { alignItems: "center", gap: 4, paddingHorizontal: 20 },
  actionBtnEmoji: { fontSize: 24 },
  actionBtnLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" },

  bottomBtns:    { gap: 12 },
  playAgainBtn:  {},
  playAgainGrad: { borderRadius: 50, alignItems: "center", paddingVertical: 16 },
  playAgainText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  backHome:      { alignItems: "center", paddingVertical: 8 },
  backHomeText:  { color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: "700" },
});
