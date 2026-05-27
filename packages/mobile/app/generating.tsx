import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Alert, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../lib/api";
import { T } from "../lib/theme";

const { width } = Dimensions.get("window");

const MESSAGES = [
  "Reading your sketch…",
  "Building shapes…",
  "Adding depth…",
  "Applying light…",
  "Almost there…",
];

export default function GeneratingScreen() {
  const {
    imageBase64, style: initialStyle, userHint,
    modeId, modeLabel, promptSuffix, aspectRatio, sketchId, strokesJson,
  } = useLocalSearchParams<{
    imageBase64: string; style?: string; userHint?: string;
    modeId?: string; modeLabel?: string; promptSuffix?: string; aspectRatio?: string;
    sketchId?: string; strokesJson?: string;
  }>();
  const router = useRouter();

  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const spinOuter   = useRef(new Animated.Value(0)).current;
  const spinInner   = useRef(new Animated.Value(0)).current;
  const pulseS      = useRef(new Animated.Value(1)).current;
  const msgOpacity  = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const msgRef      = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const stopAnims = () => {
    clearInterval(intervalRef.current);
    clearInterval(msgRef.current);
  };

  useEffect(() => {
    // Outer spin
    Animated.loop(
      Animated.timing(spinOuter, { toValue: 1, duration: 2600, useNativeDriver: true })
    ).start();

    // Inner spin reverse
    Animated.loop(
      Animated.timing(spinInner, { toValue: 1, duration: 1500, useNativeDriver: true })
    ).start();

    // Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseS, { toValue: 1.1,  duration: 900, useNativeDriver: true }),
        Animated.timing(pulseS, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();

    // Progress
    let p = 0;
    intervalRef.current = setInterval(() => {
      p = Math.min(91, p + Math.random() * 7 + 2);
      Animated.timing(progressAnim, { toValue: p / 100, duration: 350, useNativeDriver: false }).start();
      setProgress(Math.round(p));
    }, 700);

    // Message cycle
    let idx = 0;
    msgRef.current = setInterval(() => {
      Animated.sequence([
        Animated.timing(msgOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(msgOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
      idx = (idx + 1) % MESSAGES.length;
      setMsgIndex(idx);
    }, 2000);

    callAPI();

    return stopAnims;
  }, []);

  const callAPI = async () => {
    try {
      const body: any = {
        imageBase64: imageBase64 as string,
        style: (initialStyle as any) ?? "Realistic",
      };
      if (userHint) body.userHint = userHint;
      if (promptSuffix) body.promptSuffix = promptSuffix;

      const res  = await api.generate.$post({ json: body });
      const data = await res.json() as any;

      stopAnims();

      if (data.error) { Alert.alert("Failed", data.error); router.back(); return; }

      Animated.timing(progressAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
      setProgress(100);

      setTimeout(() => {
        router.replace({
          pathname: "/result",
          params: {
            sketchBase64:  imageBase64,
            generatedUrl:  data.imageBase64 ?? data.imageUrl,  // prefer base64 (never expires)
            style:         data.style ?? "Realistic",
            modeId:        modeId    ?? "cinematic",
            modeLabel:     modeLabel ?? "Cinematic Reel",
            aspectRatio:   aspectRatio ?? "16:9",
            sketchId:      sketchId  ?? Date.now().toString(),
            strokesJson:   strokesJson ?? "",
          },
        });
      }, 600);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Generation failed");
      router.back();
    }
  };

  const rotateOuter = spinOuter.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const rotateInner = spinInner.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
  const barWidth    = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={s.container}>
      <LinearGradient colors={["#0D0F0A", "#161A0F", "#0D0F0A"]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        {/* Top chip */}
        <View style={s.topRow}>
          <View style={s.chip}>
            <Text style={s.chipText}>
              {modeLabel ? String(modeLabel) : String(initialStyle ?? "Realistic")}
            </Text>
          </View>
        </View>

        {/* Center content */}
        <View style={s.center}>
          {/* Spinner */}
          <View style={s.spinnerWrap}>
            <View style={s.ringBg} />
            <Animated.View style={[s.ringOuter, { transform: [{ rotate: rotateOuter }] }]} />
            <Animated.View style={[s.ringInner, { transform: [{ rotate: rotateInner }] }]} />
            <Animated.View style={[s.centerCard, { transform: [{ scale: pulseS }] }]}>
              <Text style={s.centerEmoji}>✏️</Text>
            </Animated.View>
          </View>

          {/* Animated message */}
          <Animated.Text style={[s.message, { opacity: msgOpacity }]}>
            {MESSAGES[msgIndex]}
          </Animated.Text>

          {/* Hint bubble */}
          {!!userHint && (
            <View style={s.hintBubble}>
              <Text style={s.hintLabel}>YOUR HINT</Text>
              <Text style={s.hintText}>"{userHint}"</Text>
            </View>
          )}

          {/* Progress bar */}
          <View style={s.progressBlock}>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: barWidth }]}>
                <LinearGradient
                  colors={[T.accentDark, T.accent]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
            <Text style={s.progressPct}>{progress}%</Text>
          </View>

          <Text style={s.note}>This may take 10–20 seconds</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const RING = 176;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F0A" },
  safe: { flex: 1 },

  topRow: { alignItems: "center", paddingTop: 20 },
  chip: {
    backgroundColor: "rgba(92,122,30,0.22)", borderRadius: 50,
    paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(92,122,30,0.45)",
  },
  chipText: { color: T.accent, fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },

  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 36, gap: 30,
  },

  spinnerWrap: {
    width: RING, height: RING,
    alignItems: "center", justifyContent: "center",
  },
  ringBg: {
    position: "absolute", width: RING, height: RING, borderRadius: RING / 2,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.04)",
  },
  ringOuter: {
    position: "absolute", width: RING - 8, height: RING - 8, borderRadius: (RING - 8) / 2,
    borderWidth: 3, borderColor: "transparent",
    borderTopColor: T.accentDark, borderRightColor: "rgba(92,122,30,0.25)",
  },
  ringInner: {
    position: "absolute", width: RING - 40, height: RING - 40, borderRadius: (RING - 40) / 2,
    borderWidth: 2, borderColor: "transparent",
    borderTopColor: T.accent, borderLeftColor: "rgba(140,179,58,0.25)",
  },
  centerCard: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center", justifyContent: "center",
  },
  centerEmoji: { fontSize: 40 },

  message: {
    fontSize: 20, color: "rgba(255,255,255,0.82)", fontWeight: "600",
    textAlign: "center", letterSpacing: -0.3,
  },

  hintBubble: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16,
    paddingHorizontal: 22, paddingVertical: 14,
    maxWidth: width * 0.8, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center", gap: 5,
  },
  hintLabel: {
    color: "rgba(255,255,255,0.3)", fontSize: 9,
    fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase",
  },
  hintText: {
    color: "rgba(255,255,255,0.7)", fontSize: 13,
    fontWeight: "500", textAlign: "center", fontStyle: "italic",
  },

  progressBlock: { width: "100%", gap: 10, alignItems: "center" },
  progressTrack: {
    width: "100%", height: 7, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4, overflow: "hidden" },
  progressPct: {
    color: "rgba(255,255,255,0.4)", fontSize: 13,
    fontWeight: "700", letterSpacing: 0.4,
  },

  note: { color: "rgba(255,255,255,0.18)", fontSize: 12, textAlign: "center" },
});
