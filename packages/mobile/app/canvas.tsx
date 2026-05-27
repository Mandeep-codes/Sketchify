import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Alert, PanResponder, TextInput,
  ScrollView, Modal, Pressable, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle, Line as SvgLine } from "react-native-svg";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { T } from "../lib/theme";
import { TEMPLATES, Template } from "../lib/templates";
import { getCanvasDims } from "../lib/modes";
import { Storage, KEYS } from "../lib/storage";

const { width, height } = Dimensions.get("window");

const PATTERNS = ["none", "dots", "lines", "grid"] as const;
type Pattern = typeof PATTERNS[number];
const PATTERN_LABELS: Record<Pattern, string> = {
  none: "No grid",
  dots: "Dot grid",
  lines: "Ruled",
  grid: "Graph",
};

function PatternOverlay({ pattern, width: w, height: h }: { pattern: Pattern; width: number; height: number }) {  if (pattern === "none") return null;
  const elements: React.ReactNode[] = [];

  if (pattern === "dots") {
    const spacing = 24;
    for (let x = spacing; x < w; x += spacing) {
      for (let y = spacing; y < h; y += spacing) {
        elements.push(<Circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill="rgba(0,0,0,0.12)" />);
      }
    }
  }

  if (pattern === "lines") {
    const spacing = 28;
    for (let y = spacing; y < h; y += spacing) {
      elements.push(<SvgLine key={y} x1={0} y1={y} x2={w} y2={y} stroke="rgba(0,0,0,0.1)" strokeWidth={1} />);
    }
  }

  if (pattern === "grid") {
    const spacing = 28;
    for (let x = spacing; x < w; x += spacing) {
      elements.push(<SvgLine key={`v${x}`} x1={x} y1={0} x2={x} y2={h} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />);
    }
    for (let y = spacing; y < h; y += spacing) {
      elements.push(<SvgLine key={`h${y}`} x1={0} y1={y} x2={w} y2={y} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />);
    }
  }

  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      {elements}
    </Svg>
  );
}

// ── Symmetry / Mirror ────────────────────────────────────────────────────────
const SYM_MODES = ["none", "H", "V", "HV"] as const;
type SymMode = typeof SYM_MODES[number];
const SYM_LABELS: Record<SymMode, string> = {
  none: "Mirror",
  H:    "⟺ Horiz",
  V:    "↕ Vert",
  HV:   "✛ Both",
};

/** Mirror a path-data string across canvas axes.
 *  Works by replacing every coord pair in M/L commands. */
function applyMirror(d: string, mode: SymMode, w: number, h: number): string[] {
  if (mode === "none") return [];
  const flip = (s: string, mx: boolean, my: boolean) =>
    s.replace(/([ML])([\d.]+),([\d.]+)/g, (_m, cmd, x, y) => {
      const nx = mx ? (w - parseFloat(x)).toFixed(1) : x;
      const ny = my ? (h - parseFloat(y)).toFixed(1) : y;
      return `${cmd}${nx},${ny}`;
    });
  if (mode === "H")  return [flip(d, true,  false)];
  if (mode === "V")  return [flip(d, false, true)];
  if (mode === "HV") return [flip(d, true,  false), flip(d, false, true), flip(d, true, true)];
  return [];
}
// ─────────────────────────────────────────────────────────────────────────────

interface StrokePath {
  d: string;
  color: string;
  strokeWidth: number;
}

const COLORS = [
  "#1A1A1A", "#5C7A1E", "#2563EB", "#DC2626",
  "#D97706", "#7C3AED", "#DB2777", "#0891B2",
  "#F8F4EE", "#6B7280",
];

export default function CanvasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { challenge } = useLocalSearchParams<{ challenge?: string }>();

  const [paths, setPaths] = useState<StrokePath[]>([]);
  const [currentD, setCurrentD] = useState<string>("");
  const [brushSize, setBrushSize] = useState(5);
  const [selectedColor, setSelectedColor] = useState("#1A1A1A");
  const [isEraser, setIsEraser] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [userHint, setUserHint] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);

  const [bgPattern, setBgPattern] = useState<Pattern>("none");

  // Brush presets
  interface BrushPreset { id: string; color: string; size: number; }
  const [presets, setPresets]         = useState<BrushPreset[]>([]);
  const [showPresets, setShowPresets] = useState(false);

  // Timer state
  const [timerDuration, setTimerDuration]     = useState<number | null>(null);
  const [timeLeft, setTimeLeft]               = useState<number | null>(null);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const TIMER_OPTIONS = [30, 60, 90, 180];

  const brushRef   = useRef(brushSize);
  const colorRef   = useRef(selectedColor);
  const eraserRef  = useRef(isEraser);
  brushRef.current  = brushSize;
  colorRef.current  = selectedColor;
  eraserRef.current = isEraser;

  const currentDRef = useRef("");

  // Symmetry / mirror
  const [symMode, setSymMode] = useState<SymMode>("none");
  const symModeRef  = useRef<SymMode>("none");
  symModeRef.current = symMode;
  // Canvas dims available in PanResponder closure via refs
  const canvasWRef = useRef(0);
  const canvasHRef = useRef(0);
  // Undo groups: track how many paths per gesture so Undo removes all mirrors at once
  const strokeGroupSizesRef = useRef<number[]>([]);

  // Canvas is always square — mode/aspect ratio chosen later on convert screen
  const HEADER_H   = 56;
  const BANNER_H   = challenge ? 40 : 0;
  const TOOLBAR_H  = (showHint ? 228 : 172) + (showTimerPicker ? 50 : 0);
  const SAFE_TOP   = insets.top;
  const SAFE_BOT   = insets.bottom;
  const AVAILABLE  = height - SAFE_TOP - HEADER_H - BANNER_H - TOOLBAR_H - SAFE_BOT - 12;
  const CANVAS_W   = Math.min(width - 32, Math.max(200, AVAILABLE));
  const CANVAS_H   = CANVAS_W; // always square at draw time

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const { locationX, locationY } = e.nativeEvent;
        const d = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentDRef.current = d;
        setCurrentD(d);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const next = currentDRef.current + ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentDRef.current = next;
        setCurrentD(next);
      },
      onPanResponderRelease: () => {
        const d = currentDRef.current;
        if (!d) return;
        const color = eraserRef.current ? "#F8F4EE" : colorRef.current;
        const sw    = eraserRef.current ? brushRef.current * 3.5 : brushRef.current;
        const mirrors = applyMirror(d, symModeRef.current, canvasWRef.current, canvasHRef.current);
        const newStrokes: StrokePath[] = [
          { d, color, strokeWidth: sw },
          ...mirrors.map((md) => ({ d: md, color, strokeWidth: sw })),
        ];
        strokeGroupSizesRef.current = [...strokeGroupSizesRef.current, newStrokes.length];
        setPaths((prev) => [...prev, ...newStrokes]);
        currentDRef.current = "";
        setCurrentD("");
      },
    })
  ).current;

  // Timer logic
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimerDuration(null);
    setTimeLeft(null);
    setShowTimerPicker(false);
  }, []);

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerDuration(seconds);
    setTimeLeft(seconds);
    setShowTimerPicker(false);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Load presets on mount
  useEffect(() => {
    Storage.get<BrushPreset[]>(KEYS.BRUSH_PRESETS).then((p) => { if (p) setPresets(p); });
  }, []);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0) {
      if (paths.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        handleGenerate();
      } else {
        Alert.alert("Time's up!", "Draw something next time 😄");
        stopTimer();
      }
    }
  }, [timeLeft]);

  const handleUndo = () => {
    const sizes = strokeGroupSizesRef.current;
    if (sizes.length === 0) return;
    const groupSize = sizes[sizes.length - 1];
    strokeGroupSizesRef.current = sizes.slice(0, -1);
    setPaths((p) => p.slice(0, p.length - groupSize));
  };
  const handleClear = () => {
    Alert.alert("Clear Canvas", "Start over?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => {
        setPaths([]);
        setActiveTemplate(null);
        strokeGroupSizesRef.current = [];
      }},
    ]);
  };

  // Brush preset handlers
  const savePreset = async () => {
    if (presets.length >= 6) {
      Alert.alert("Max presets", "Long-press a preset to delete it first.");
      return;
    }
    const newPreset: BrushPreset = {
      id: Date.now().toString(),
      color: isEraser ? "#F8F4EE" : selectedColor,
      size: brushSize,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    await Storage.set(KEYS.BRUSH_PRESETS, updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deletePreset = async (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    await Storage.set(KEYS.BRUSH_PRESETS, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const applyPreset = (preset: BrushPreset) => {
    setSelectedColor(preset.color);
    setBrushSize(preset.size);
    setIsEraser(false);
    setShowPresets(false);
    Haptics.selectionAsync();
  };

  const handleGenerate = useCallback(() => {
    if (paths.length === 0) {
      Alert.alert("Empty Canvas", "Draw something first!");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const svgPaths = paths
      .map((s) => `<path d="${s.d}" stroke="${s.color}" stroke-width="${s.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`)
      .join("");
    const svgStr  = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" style="background:#F8F4EE">${svgPaths}</svg>`;
    const b64     = btoa(unescape(encodeURIComponent(svgStr)));
    const dataUri = `data:image/svg+xml;base64,${b64}`;
    router.push({
      pathname: "/convert",
      params: {
        imageBase64: dataUri,
        userHint: userHint.trim(),
        canvasW: String(CANVAS_W),
        canvasH: String(CANVAS_H),
        sketchId: Date.now().toString(),
        strokesJson: JSON.stringify(paths),
      },
    });
  }, [paths, userHint, CANVAS_W, CANVAS_H]);

  const activeColor  = isEraser ? "#F8F4EE" : selectedColor;
  const activeStroke = isEraser ? brushSize * 3.5 : brushSize;

  return (
    <View style={{ flex: 1, backgroundColor: "#1C1C1E" }}>
      {/* Header */}
      <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: "#1C1C1E" }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Canvas</Text>
            <Text style={s.headerSub}>Pick style after drawing</Text>
          </View>

          <TouchableOpacity
            onPress={handleUndo}
            style={[s.headerBtn, paths.length === 0 && { opacity: 0.3 }]}
            disabled={paths.length === 0}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.undoText}>Undo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Challenge banner */}
      {!!challenge && (
        <LinearGradient colors={["#3D5216", "#5C7A1E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.banner}>
          <Text style={s.bannerIcon}>✦</Text>
          <Text style={s.bannerText} numberOfLines={1}>{challenge}</Text>
        </LinearGradient>
      )}

      {/* Canvas area — cream bg */}
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" }}>
        <View
          style={[s.canvas, { height: CANVAS_H, width: CANVAS_W }]}
          onLayout={(e) => {
            canvasWRef.current = e.nativeEvent.layout.width;
            canvasHRef.current = e.nativeEvent.layout.height;
          }}
          {...panResponder.panHandlers}
        >
          {/* Background pattern — not exported */}
          <PatternOverlay pattern={bgPattern} width={CANVAS_W} height={CANVAS_H} />

          {activeTemplate && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%"
                viewBox={`0 0 ${activeTemplate.viewBox[0]} ${activeTemplate.viewBox[1]}`}>
                {activeTemplate.paths.map((d, i) => (
                  <Path key={i} d={d} stroke="#BBBBBB" strokeWidth={1.5}
                    strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.5} />
                ))}
              </Svg>
            </View>
          )}

          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            {paths.map((stroke, i) => (
              <Path key={i} d={stroke.d} stroke={stroke.color} strokeWidth={stroke.strokeWidth}
                strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
            {currentD.length > 0 && (
              <Path d={currentD} stroke={activeColor} strokeWidth={activeStroke}
                strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
            {currentD.length > 0 && symMode !== "none" &&
              applyMirror(currentD, symMode, CANVAS_W, CANVAS_H).map((md, i) => (
                <Path key={`m${i}`} d={md} stroke={activeColor} strokeWidth={activeStroke}
                  strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.65} />
              ))
            }
          </Svg>

          {/* Axis guide lines — visible only, not exported */}
          {symMode !== "none" && (
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
              {(symMode === "H" || symMode === "HV") && (
                <SvgLine
                  x1={CANVAS_W / 2} y1={0} x2={CANVAS_W / 2} y2={CANVAS_H}
                  stroke="rgba(92,122,30,0.45)" strokeWidth={1}
                  strokeDasharray="6,5"
                />
              )}
              {(symMode === "V" || symMode === "HV") && (
                <SvgLine
                  x1={0} y1={CANVAS_H / 2} x2={CANVAS_W} y2={CANVAS_H / 2}
                  stroke="rgba(92,122,30,0.45)" strokeWidth={1}
                  strokeDasharray="6,5"
                />
              )}
            </Svg>
          )}

          {/* Timer badge — top left */}
          {timeLeft !== null && (
            <View style={s.timerBadge} pointerEvents="none">
              <Text style={[s.timerText, timeLeft <= 10 && { color: "#FF4444" }]}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </Text>
              <Text style={s.timerLabel}>⏱ speed run</Text>
            </View>
          )}

          {paths.length === 0 && currentD.length === 0 && !activeTemplate && (
            <View style={s.emptyHint} pointerEvents="none">
              <Text style={s.emptyHintIcon}>✍️</Text>
              <Text style={s.emptyHintText}>Draw with your finger</Text>
              <Text style={s.emptyHintSub}>or pick a template below</Text>
            </View>
          )}

          {paths.length > 0 && (
            <View style={s.strokeBadge} pointerEvents="none">
              <Text style={s.strokeBadgeText}>{paths.length} stroke{paths.length !== 1 ? "s" : ""}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Toolbar — always at bottom, dark bg */}
      <View style={[s.toolbar, { paddingBottom: insets.bottom + 12 }]}>
        {/* Brush size row */}
        <View style={s.toolRow}>
          {/* Color circle — tap to open picker */}
          <TouchableOpacity
            style={[s.colorCircle, { backgroundColor: isEraser ? "#ccc" : selectedColor }, showColors && s.colorCircleRing]}
            onPress={() => { Haptics.selectionAsync(); setShowColors(!showColors); if (isEraser) setIsEraser(false); }}
          />

          {/* Brush slider */}
          <View style={s.sliderWrap}>
            <View style={s.dotS} />
            <Slider
              style={s.slider}
              minimumValue={2}
              maximumValue={28}
              value={brushSize}
              onValueChange={setBrushSize}
              minimumTrackTintColor={T.accent}
              maximumTrackTintColor="rgba(255,255,255,0.15)"
              thumbTintColor={T.accent}
            />
            <View style={s.dotL} />
          </View>

          {/* Eraser */}
          <TouchableOpacity
            style={[s.toolBtn, isEraser && s.toolBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setIsEraser(!isEraser); setShowColors(false); }}
          >
            <Text style={s.toolBtnText}>⌫</Text>
          </TouchableOpacity>

          {/* Clear */}
          <TouchableOpacity style={s.toolBtn} onPress={handleClear}>
            <Text style={s.toolBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>

        {/* Color palette (expanded inline) */}
        {showColors && (
          <View style={s.colorRow}>
            {COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  s.swatch,
                  { backgroundColor: c },
                  c === "#F8F4EE" && { borderColor: "rgba(0,0,0,0.15)" },
                  selectedColor === c && !isEraser && s.swatchSelected,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedColor(c);
                  setIsEraser(false);
                  setShowColors(false);
                }}
              >
                {selectedColor === c && !isEraser && (
                  <Text style={{ color: c === "#F8F4EE" ? "#333" : "#fff", fontSize: 10, fontWeight: "900" }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Hint input (expanded inline) */}
        {showHint && (
          <View style={s.hintRow}>
            <TextInput
              style={s.hintInput}
              placeholder="Describe your vision… e.g. sunset over mountains"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={userHint}
              onChangeText={setUserHint}
              maxLength={200}
              returnKeyType="done"
              onSubmitEditing={() => setShowHint(false)}
              autoFocus
            />
            <TouchableOpacity onPress={() => setShowHint(false)} style={s.hintDone}>
              <Text style={s.hintDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Brush preset tray */}
        {showPresets && (
          <View style={s.presetRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetScroll}>
              {presets.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.presetDot, { backgroundColor: p.color }]}
                  onPress={() => applyPreset(p)}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    Alert.alert("Delete preset?", undefined, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deletePreset(p.id) },
                    ]);
                  }}
                >
                  <View style={[s.presetInner, {
                    width: Math.max(4, p.size * 0.6),
                    height: Math.max(4, p.size * 0.6),
                    borderRadius: p.size,
                    backgroundColor: p.color === "#F8F4EE" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.55)",
                  }]} />
                </TouchableOpacity>
              ))}

              {presets.length < 6 && (
                <TouchableOpacity style={s.presetAdd} onPress={savePreset}>
                  <Text style={s.presetAddText}>＋</Text>
                  <Text style={s.presetAddSub}>Save</Text>
                </TouchableOpacity>
              )}

              {presets.length === 0 && (
                <Text style={s.presetEmpty}>Pick brush + color, then tap + to save</Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Timer picker row */}
        {showTimerPicker && (
          <View style={s.timerRow}>
            {TIMER_OPTIONS.map((sec) => (
              <TouchableOpacity key={sec} style={s.timerOption} onPress={() => { Haptics.selectionAsync(); startTimer(sec); }}>
                <Text style={s.timerOptionText}>{sec < 60 ? `${sec}s` : `${sec / 60}m`}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.timerOption} onPress={() => setShowTimerPicker(false)}>
              <Text style={s.timerOptionText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Extra buttons row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.extraRow}>
          <TouchableOpacity
            style={[s.extraBtn, activeTemplate && s.extraBtnOn]}
            onPress={() => { Haptics.selectionAsync(); setShowTemplates(true); setShowColors(false); }}
          >
            <Text style={s.extraBtnText}>{activeTemplate ? `📐 ${activeTemplate.label}` : "📐 Templates"}</Text>
          </TouchableOpacity>

          {activeTemplate && (
            <TouchableOpacity style={s.clearTemplateBtn} onPress={() => setActiveTemplate(null)}>
              <Text style={s.clearTemplateBtnText}>✕</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.extraBtn, (showHint || userHint.trim()) && s.extraBtnOn]}
            onPress={() => { Haptics.selectionAsync(); setShowHint(!showHint); setShowColors(false); setShowTimerPicker(false); }}
          >
            <Text style={s.extraBtnText}>{userHint.trim() ? "✦ Hint set" : "✦ Add hint"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.extraBtn, timeLeft !== null && s.extraBtnOn]}
            onPress={() => {
              Haptics.selectionAsync();
              if (timeLeft !== null) { stopTimer(); return; }
              setShowTimerPicker((v) => !v);
              setShowColors(false);
              setShowHint(false);
            }}
          >
            <Text style={s.extraBtnText}>
              {timeLeft !== null
                ? `⏱ ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
                : "⏱ Timer"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.extraBtn, showPresets && s.extraBtnOn]}
            onPress={() => {
              Haptics.selectionAsync();
              setShowPresets((v) => !v);
              setShowColors(false);
              setShowHint(false);
              setShowTimerPicker(false);
            }}
          >
            <Text style={s.extraBtnText}>🎨 Presets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.extraBtn, bgPattern !== "none" && s.extraBtnOn]}
            onPress={() => {
              Haptics.selectionAsync();
              setBgPattern((p) => PATTERNS[(PATTERNS.indexOf(p) + 1) % PATTERNS.length]);
            }}
          >
            <Text style={s.extraBtnText}>
              {bgPattern === "none" ? "▦ Grid" : `▦ ${PATTERN_LABELS[bgPattern]}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.extraBtn, symMode !== "none" && s.extraBtnOn]}
            onPress={() => {
              Haptics.selectionAsync();
              setSymMode((m) => SYM_MODES[(SYM_MODES.indexOf(m) + 1) % SYM_MODES.length]);
            }}
          >
            <Text style={s.extraBtnText}>{SYM_LABELS[symMode]}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Generate button */}
        <TouchableOpacity onPress={handleGenerate} activeOpacity={0.85} disabled={paths.length === 0}>
          <LinearGradient
            colors={paths.length === 0 ? ["#555", "#444"] : ["#5C7A1E", "#8CB33A"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[s.genBtn, paths.length === 0 && { opacity: 0.45 }]}
          >
            <Text style={s.genBtnText}>Generate  →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Templates bottom sheet */}
      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <View style={s.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTemplates(false)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Stencils</Text>
            <Text style={s.sheetSub}>Faint guide overlay — draw on top</Text>
            <ScrollView contentContainerStyle={s.templateGrid} showsVerticalScrollIndicator={false}>
              {[
                ...TEMPLATES,
                { id: "__none__", emoji: "✕", label: "None", paths: [], viewBox: [0, 0] as [number, number] },
              ].map((t) => {
                const isActive = t.id === "__none__" ? !activeTemplate : activeTemplate?.id === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.templateCard, isActive && s.templateCardActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveTemplate(t.id === "__none__" ? null : t as Template);
                      setShowTemplates(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={s.templatePreview}>
                      {t.paths.length > 0 ? (
                        <Svg width="100%" height="100%"
                          viewBox={`0 0 ${(t as Template).viewBox[0]} ${(t as Template).viewBox[1]}`}>
                          {t.paths.map((d, i) => (
                            <Path key={i} d={d}
                              stroke={isActive ? T.accent : "rgba(255,255,255,0.5)"}
                              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          ))}
                        </Svg>
                      ) : (
                        <Text style={{ fontSize: 28 }}>{t.emoji}</Text>
                      )}
                    </View>
                    <Text style={[s.templateLabel, isActive && { color: T.accent }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  // Header
  header: {
    height: 56, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, gap: 8,
  },
  headerBtn:   { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backArrow:   { color: "#fff", fontSize: 32, fontWeight: "300", lineHeight: 36, marginTop: -2 },
  undoText:    { color: T.accent, fontSize: 13, fontWeight: "700" },
  headerCenter:{ flex: 1, alignItems: "center", gap: 3 },
  headerTitle: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  headerSub:   { color: "rgba(255,255,255,0.35)", fontSize: 11 },

  // Banner
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  bannerIcon: { fontSize: 11, color: "#D4E8A0" },
  bannerText: { flex: 1, fontSize: 12, color: "#D4E8A0", fontWeight: "600" },

  // Canvas
  canvas: { backgroundColor: "#F8F4EE" },
  emptyHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  emptyHintIcon: { fontSize: 36, marginBottom: 4 },
  emptyHintText: { color: T.textMuted, fontSize: 15, fontWeight: "500" },
  emptyHintSub:  { color: T.textMuted, fontSize: 12 },
  strokeBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.28)", borderRadius: 50,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  strokeBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // Timer
  timerBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6, alignItems: "center",
  },
  timerText:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  timerLabel: { color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 1 },
  timerRow:   { flexDirection: "row", gap: 8 },
  timerOption: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  timerOptionText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Brush presets
  presetRow:    { paddingVertical: 2 },
  presetScroll: { flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 2, paddingVertical: 2 },
  presetDot: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  presetInner: {},
  presetAdd: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5, borderColor: T.accent,
    alignItems: "center", justifyContent: "center",
  },
  presetAddText: { color: T.accent, fontSize: 20, fontWeight: "700", lineHeight: 22 },
  presetAddSub:  { color: "rgba(255,255,255,0.35)", fontSize: 7, fontWeight: "600", letterSpacing: 0.3, marginTop: -2 },
  presetEmpty:   { color: "rgba(255,255,255,0.3)", fontSize: 11, fontStyle: "italic", paddingHorizontal: 4, alignSelf: "center" },

  // Toolbar
  toolbar: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 16, paddingTop: 14, gap: 11,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },

  // Tool row
  toolRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  colorCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.25)",
  },
  colorCircleRing: { borderColor: T.accent },
  sliderWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dotS: { width: 7,  height: 7,  borderRadius: 3.5, backgroundColor: "rgba(255,255,255,0.2)" },
  dotL: { width: 13, height: 13, borderRadius: 6.5, backgroundColor: "rgba(255,255,255,0.2)" },
  slider: { flex: 1, height: 36 },
  toolBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  toolBtnActive: { backgroundColor: "rgba(140,179,58,0.2)", borderColor: T.accent },
  toolBtnText:   { fontSize: 16 },

  // Color palette row
  colorRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
    paddingVertical: 4,
  },
  swatch: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  swatchSelected: { borderColor: "#fff", borderWidth: 3 },

  // Hint row
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hintInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    color: "#fff", fontSize: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  hintDone: {
    paddingHorizontal: 16, paddingVertical: 11,
    borderRadius: 12, backgroundColor: T.accentDark,
  },
  hintDoneText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Extra buttons
  extraRow: { flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 2 },
  extraBtn: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  extraBtnOn: { backgroundColor: "rgba(92,122,30,0.2)", borderColor: T.accent },
  extraBtnText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.65)" },
  clearTemplateBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  clearTemplateBtnText: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "700" },

  // Generate button
  genBtn: { borderRadius: 50, paddingVertical: 15, alignItems: "center" },
  genBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  // Template sheet
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: "#1C1C1E", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20, maxHeight: "80%",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)", alignSelf: "center", marginBottom: 20,
  },
  sheetTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 4 },
  sheetSub:   { color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 20 },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 16 },
  templateCard: {
    width: (width - 40 - 24) / 3,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden", alignItems: "center",
    paddingBottom: 10,
  },
  templateCardActive: { borderColor: T.accent, backgroundColor: "rgba(92,122,30,0.15)" },
  templatePreview: {
    width: "100%", height: 88,
    alignItems: "center", justifyContent: "center",
    padding: 10,
  },
  templateLabel: {
    fontSize: 11, fontWeight: "600",
    color: "rgba(255,255,255,0.55)", textAlign: "center",
  },
});
