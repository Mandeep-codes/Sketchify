import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, Alert, ActivityIndicator, Image, Easing,
  FlatList, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import Constants from "expo-constants";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { T } from "../lib/theme";
import { reelStore } from "../lib/reel-store";

const { width, height } = Dimensions.get("window");

const DARK = "#0D0F0A";
const DARK_CARD = "#1C1E19";
const DARK_BORDER = "rgba(255,255,255,0.08)";
const DARK_TEXT = "#F0EDE6";
const DARK_MUTED = "rgba(240,237,230,0.45)";

const API_BASE = (() => {
  const raw: string = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:4200";
  return raw.endsWith("/") ? raw : raw + "/";
})();

type JobStatus = "pending" | "processing" | "done" | "error";

interface JobPollResult {
  jobId: string;
  status: JobStatus;
  videoUrl?: string;
  videoType?: string;
  cinematicPrompt?: string;
  errorMsg?: string;
  albumName?: string;
}

// ── Animated filmstrip waiting screen ─────────────────────────────────────────
const FILM_CARD = 140; // px per image card
const FILM_GAP  = 12;

function GeneratingScreen({
  images, msgO, msgText, spin,
}: {
  images: string[];
  msgO: Animated.Value;
  msgText: string;
  spin: Animated.AnimatedInterpolation<string>;
}) {
  const scrollX    = useRef(new Animated.Value(0)).current;
  const flatRef    = useRef<FlatList<string>>(null);
  const idxRef     = useRef(0);
  const displayImgs = images.length >= 2 ? images : [];

  // Infinite slow scroll — advance one card every 1.8s
  useEffect(() => {
    if (displayImgs.length < 2) return;

    const step = () => {
      const next = (idxRef.current + 1) % displayImgs.length;
      idxRef.current = next;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
    };

    const t = setInterval(step, 1800);
    return () => clearInterval(t);
  }, [displayImgs.length]);

  // Pulse anim for "film" frames
  const pulseA = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseA, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseA, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Progress bar fills over ~90s (typical reel gen time)
  const progressA = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressA, {
      toValue: 0.9,
      duration: 90_000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, []);

  const barWidth = progressA.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={s.genScreen}>
      {/* Title */}
      <View style={s.genTitleRow}>
        <Animated.View style={[s.genRing, { transform: [{ rotate: spin }] }]} />
        <View style={{ gap: 2 }}>
          <Text style={s.genTitle}>Creating Your Reel</Text>
          <Animated.Text style={[s.genSubtitle, { opacity: msgO }]}>
            {msgText}
          </Animated.Text>
        </View>
      </View>

      {/* Filmstrip */}
      {displayImgs.length >= 2 ? (
        <View style={s.filmstripWrap}>
          {/* Top sprocket holes */}
          <View style={s.sprocketRow}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={s.sprocketHole} />
            ))}
          </View>

          <FlatList
            ref={flatRef}
            data={displayImgs}
            keyExtractor={(_, i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            getItemLayout={(_, index) => ({
              length: FILM_CARD + FILM_GAP,
              offset: (FILM_CARD + FILM_GAP) * index,
              index,
            })}
            contentContainerStyle={{ gap: FILM_GAP, paddingHorizontal: 16 }}
            renderItem={({ item, index }) => (
              <Animated.View
                style={[
                  s.filmCard,
                  { transform: [{ scale: index === idxRef.current ? pulseA : 1 }] },
                ]}
              >
                <Image
                  source={{ uri: item }}
                  style={s.filmImg}
                  resizeMode="cover"
                />
                {/* Vignette overlay */}
                <View style={s.filmVignette} />
                {/* Frame number */}
                <Text style={s.frameNum}>{String(index + 1).padStart(2, "0")}</Text>
              </Animated.View>
            )}
          />

          {/* Bottom sprocket holes */}
          <View style={s.sprocketRow}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={s.sprocketHole} />
            ))}
          </View>

          {/* Scan line sweep */}
          <ScanLine />
        </View>
      ) : (
        // Fallback if no images yet
        <View style={s.genFallback}>
          <Text style={{ fontSize: 40 }}>🎬</Text>
        </View>
      )}

      {/* Fake progress bar */}
      <View style={s.genProgressWrap}>
        <View style={s.genProgressTrack}>
          <Animated.View style={[s.genProgressFill, { width: barWidth }]} />
        </View>
        <Text style={s.genProgressLabel}>AI is working its magic…</Text>
      </View>

      {/* Tip */}
      <Text style={s.genTip}>
        This takes 1–3 min. Stay on this screen.
      </Text>
    </View>
  );
}

// Animated scan line that sweeps across the filmstrip
function ScanLine() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.scanLine, { transform: [{ translateX: tx }] }]}
    />
  );
}

export default function ReelScreen() {
  const {
    albumName, imageUrls,
    sketchUrls, modeId, modeLabel, promptSuffix, aspectRatio, modeEmoji,
  } = useLocalSearchParams<{
    albumId: string;
    albumName: string;
    imageUrls?: string;      // legacy — pre-converted images
    sketchUrls?: string;     // new — raw sketches to re-generate
    modeId?: string;
    modeLabel?: string;
    promptSuffix?: string;
    aspectRatio?: string;
    modeEmoji?: string;
  }>();
  const router = useRouter();
  const videoRef = useRef<any>(null);

  const [status, setStatus] = useState<"generating" | "upgrading" | "ready" | "error">("generating");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoType, setVideoType] = useState<string>("ffmpeg");
  const [cinematicPrompt, setCinematicPrompt] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);

  const spinVal = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const msgO = useRef(new Animated.Value(1)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const MESSAGES_GENERATING = [
    "Analyzing your sketches…",
    "Writing your story…",
    "Rendering cinematic scene…",
    "Grading colors & lighting…",
    "Almost ready…",
  ];
  const MESSAGES_UPGRADING = [
    "Generating your reel…",
    "Building motion & depth…",
    "Painting frames…",
    "Polishing final frames…",
  ];

  const [msgIdx, setMsgIdx] = useState(0);
  const msgList = status === "upgrading" ? MESSAGES_UPGRADING : MESSAGES_GENERATING;

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleJobResult = useCallback((data: JobPollResult) => {
    if (data.status === "done" && data.videoUrl) {
      if (data.videoType === "ai") {
        stopPolling();
        setVideoType("ai");
        setVideoUrl(data.videoUrl);
        setStatus("ready");
        Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      } else {
        setVideoType(data.videoType ?? "ffmpeg");
        setVideoUrl(data.videoUrl);
        setStatus("upgrading");
        Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }
    } else if (data.status === "error") {
      stopPolling();
      setErrorMsg(data.errorMsg ?? "Reel generation failed");
      setStatus("error");
    }
  }, [fadeIn]);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}api/reel/${jobId}`);
      if (!res.ok) {
        // 404 = job not found (API was down when submitted) — show error
        if (res.status === 404) {
          if (pollRef.current) clearInterval(pollRef.current);
          setErrorMsg("Job not found — please go back and try again.");
          setStatus("error");
        }
        return;
      }
      const data = await res.json() as JobPollResult;
      handleJobResult(data);
    } catch {
      // Network hiccup — keep polling
    }
  }, [handleJobResult]);

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinVal, { toValue: 1, duration: 1600, useNativeDriver: true })
    );
    spin.start();

    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(msgO, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(msgO, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setMsgIdx((i) => (i + 1) % msgList.length);
    }, 2200);

    generateReel();

    return () => {
      clearInterval(t);
      spin.stop();
      stopPolling();
    };
  }, []);

  const generateReel = async () => {
    try {
      // Read images from in-memory store (not URL params — base64 too large)
      const images: string[] = reelStore.get();
      if (images.length < 2) {
        setErrorMsg("Need at least 2 images to create a reel.");
        setStatus("error");
        return;
      }

      const res = await fetch(`${API_BASE}api/reel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls: images,
          albumName: albumName ?? "Reel",
          modeId:       modeId ?? "cinematic",
          modeLabel:    modeLabel ?? "Cinematic",
          promptSuffix: promptSuffix ?? "",
          aspectRatio:  aspectRatio ?? "16:9",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" })) as any;
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const { jobId } = await res.json() as { jobId: string; status: string };
      jobIdRef.current = jobId;

      pollRef.current = setInterval(() => pollJob(jobId), 2500);
      pollJob(jobId);

    } catch (err: any) {
      setErrorMsg(err?.message ?? "Reel generation failed");
      setStatus("error");
    }
  };

  const handleSave = async () => {
    if (!videoUrl) return;
    setIsSaving(true);
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync();
      if (perm !== "granted") {
        Alert.alert("Permission denied", "Allow media access to save video.");
        return;
      }
      const localUri = FileSystem.cacheDirectory + "reel.mp4";
      await FileSystem.downloadAsync(videoUrl, localUri);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert("Saved!", "Reel saved to your camera roll.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!videoUrl) return;
    try {
      const localUri = FileSystem.cacheDirectory + "reel-share.mp4";
      await FileSystem.downloadAsync(videoUrl, localUri);
      await Sharing.shareAsync(localUri, { mimeType: "video/mp4" });
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not share");
    }
  };

  const spin = spinVal.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {albumName ?? "Reel"}
            </Text>
            {modeLabel ? (
              <Text style={{ color: DARK_MUTED, fontSize: 11 }}>
                {modeEmoji} {modeLabel}
              </Text>
            ) : null}
          </View>
          <View style={{ width: 60 }} />
        </View>
      </SafeAreaView>

      {status === "generating" && (
        <GeneratingScreen
          images={reelStore.get()}
          msgO={msgO}
          msgText={msgList[msgIdx % msgList.length] ?? ""}
          spin={spin}
        />
      )}

      {status === "error" && (
        <View style={s.loadingCenter}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => { setStatus("generating"); setMsgIdx(0); generateReel(); }}
          >
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {(status === "ready" || status === "upgrading") && videoUrl && (
        <Animated.View style={[s.videoWrap, { opacity: fadeIn }]}>
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={s.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
            isLooping
            useNativeControls={false}
            onPlaybackStatusUpdate={(st: any) => {
              if (st.isLoaded) setIsPlaying(st.isPlaying);
            }}
          />

          {/* Upgrading overlay */}
          {status === "upgrading" && (
            <View style={s.upgradingOverlay}>
              <Animated.View style={[s.ringAiSmall, { transform: [{ rotate: spin }] }]} />
              <Text style={s.upgradingText}>Generating reel…</Text>
            </View>
          )}

          {/* Play/pause overlay */}
          <TouchableOpacity
            style={s.playOverlay}
            onPress={() => {
              if (isPlaying) videoRef.current?.pauseAsync();
              else videoRef.current?.playAsync();
              setIsPlaying(!isPlaying);
            }}
            activeOpacity={1}
          >
            {!isPlaying && (
              <View style={s.playBtn}>
                <Text style={s.playBtnText}>▶</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Actions bar */}
          <SafeAreaView edges={["bottom"]} style={s.actions}>
            <TouchableOpacity style={s.actionBtn} onPress={handleSave} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator color={T.accentDark} size="small" />
                : <Text style={s.actionBtnText}>⬇  Save</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtnPrimary} onPress={handleShare}>
              <Text style={s.actionBtnPrimaryText}>↑  Share Reel</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK },
  safe: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12,
    backgroundColor: DARK_CARD,
    borderBottomWidth: 1, borderBottomColor: DARK_BORDER,
  },
  backBtn: { width: 60 },
  backBtnText: { color: DARK_MUTED, fontSize: 14, fontWeight: "500" },
  headerTitle: { color: DARK_TEXT, fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  // ── Generating screen ──
  genScreen: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 28, paddingHorizontal: 20,
  },
  genTitleRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  genRing: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 3, borderColor: "transparent",
    borderTopColor: T.accentDark, borderRightColor: T.accent,
  },
  genTitle:    { color: DARK_TEXT, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  genSubtitle: { color: DARK_MUTED, fontSize: 13 },

  filmstripWrap: {
    width: "100%",
    backgroundColor: "#111",
    borderRadius: 10,
    overflow: "hidden",
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sprocketRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sprocketHole: {
    width: 10, height: 10, borderRadius: 2,
    backgroundColor: "#000",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  filmCard: {
    width: FILM_CARD, height: FILM_CARD,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  filmImg: { width: "100%", height: "100%" },
  filmVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  frameNum: {
    position: "absolute", bottom: 4, right: 6,
    color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  scanLine: {
    position: "absolute", top: 0, bottom: 0, width: 3,
    backgroundColor: "rgba(140,179,58,0.35)",
  },
  genFallback: {
    width: "100%", height: 160,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
  },
  genProgressWrap: { width: "100%", gap: 8 },
  genProgressTrack: {
    width: "100%", height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden",
  },
  genProgressFill: {
    height: "100%", borderRadius: 2,
    backgroundColor: T.accentDark,
  },
  genProgressLabel: { color: DARK_MUTED, fontSize: 12, textAlign: "center" },
  genTip: { color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center" },

  // ── Legacy (keep for other statuses) ──
  loadingCenter: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 16,
  },
  ring: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: "transparent",
    borderTopColor: T.accentDark, borderRightColor: T.accent,
  },
  ringAiSmall: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: "transparent",
    borderTopColor: T.accentDark, borderRightColor: T.accent,
  },
  loadingMsg: { color: DARK_TEXT, fontSize: 17, fontWeight: "600", textAlign: "center" },
  loadingHint: { color: DARK_MUTED, fontSize: 13, textAlign: "center" },
  progressBar: {
    width: "100%", height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: 2,
    backgroundColor: T.accentDark,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: "#FF6B6B", fontSize: 15, textAlign: "center", lineHeight: 22 },
  retryBtn: {
    marginTop: 8, backgroundColor: T.accentDark,
    borderRadius: 50, paddingHorizontal: 32, paddingVertical: 13,
  },
  retryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  videoWrap: { flex: 1 },
  video: { flex: 1, width: "100%", backgroundColor: "#000" },
  aiOverlay: {
    position: "absolute", top: 64, right: 16,
    backgroundColor: "rgba(92,122,30,0.18)",
    borderWidth: 1, borderColor: T.accentDark,
    borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5,
  },
  aiOverlayText: { color: T.accentDark, fontSize: 11, fontWeight: "700" },
  upgradingOverlay: {
    position: "absolute", bottom: 130, left: 0, right: 0,
    alignItems: "center", gap: 8,
    zIndex: 2,
  },
  upgradingText: {
    color: T.accentDark, fontSize: 12, fontWeight: "600",
    backgroundColor: "rgba(13,15,10,0.88)",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: DARK_BORDER,
  },
  playOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 120,
    alignItems: "center", justifyContent: "center", zIndex: 1,
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  playBtnText: { color: "#fff", fontSize: 24, marginLeft: 4 },
  actions: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingBottom: 28, paddingTop: 16,
    backgroundColor: "rgba(13,15,10,0.95)",
    borderTopWidth: 1, borderTopColor: DARK_BORDER,
    zIndex: 10,
  },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 50,
    backgroundColor: DARK_CARD, alignItems: "center",
    borderWidth: 1.5, borderColor: DARK_BORDER,
  },
  actionBtnText: { color: DARK_TEXT, fontSize: 14, fontWeight: "600" },
  actionBtnPrimary: {
    flex: 1.5, paddingVertical: 14, borderRadius: 50,
    backgroundColor: T.accentDark, alignItems: "center",
  },
  actionBtnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
