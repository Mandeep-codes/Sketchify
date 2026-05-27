/**
 * DrawingReplay — full-screen modal that replays the sketch stroke-by-stroke.
 * Uses SVG strokeDashoffset animation — no DOM APIs needed.
 * Path length estimated by summing Euclidean deltas between L-command points.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing, Modal, Pressable,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

export interface SerializedStroke {
  d: string;
  color: string;
  strokeWidth: number;
}

interface Props {
  strokes: SerializedStroke[];
  canvasSize: number;
  visible: boolean;
  onClose: () => void;
}

const SPEEDS = [1, 2, 3] as const;
type Speed = typeof SPEEDS[number];

// ── Estimate SVG path length from d-string ───────────────────────────────────
function estimatePathLength(d: string): number {
  // Parse all M/L coordinate pairs
  const re = /[ML]([\d.]+),([\d.]+)/g;
  let match;
  let prevX = 0;
  let prevY = 0;
  let len = 0;
  let first = true;
  while ((match = re.exec(d)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    if (!first) {
      const dx = x - prevX;
      const dy = y - prevY;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    prevX = x;
    prevY = y;
    first = false;
  }
  return Math.max(len, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const { width: SW } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────────────
export default function DrawingReplay({ strokes, canvasSize, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  // Replay state
  const [currentStroke, setCurrentStroke]   = useState(-1); // -1 = not started
  const [completedCount, setCompletedCount] = useState(0);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [speed, setSpeed]                   = useState<Speed>(1);
  const [finished, setFinished]             = useState(false);

  // strokeDashoffset animated value — one per stroke (reset each replay)
  const dashOffsetRef = useRef<Animated.Value>(new Animated.Value(0));
  const animRef       = useRef<Animated.CompositeAnimation | null>(null);
  const completedRef  = useRef(0);
  const playingRef    = useRef(false);
  const speedRef      = useRef<Speed>(1);
  speedRef.current    = speed;

  // Current path length
  const pathLengths = useRef<number[]>([]);

  // Pre-compute path lengths when strokes change
  useEffect(() => {
    pathLengths.current = strokes.map((s) => estimatePathLength(s.d));
  }, [strokes]);

  // Reset on open
  useEffect(() => {
    if (visible) {
      resetReplay();
    } else {
      stopCurrent();
    }
  }, [visible]);

  const stopCurrent = () => {
    animRef.current?.stop();
    animRef.current = null;
    playingRef.current = false;
  };

  const resetReplay = useCallback(() => {
    stopCurrent();
    setCurrentStroke(-1);
    setCompletedCount(0);
    completedRef.current = 0;
    setFinished(false);
    setIsPlaying(false);
    dashOffsetRef.current = new Animated.Value(0);
  }, []);

  // Animate one stroke then advance
  const animateStroke = useCallback((index: number) => {
    if (index >= strokes.length) {
      setFinished(true);
      setIsPlaying(false);
      playingRef.current = false;
      return;
    }

    const pathLen = pathLengths.current[index] ?? 100;
    const baseDuration = clamp(pathLen * 0.4, 120, 800);
    const duration = baseDuration / speedRef.current;

    // Create new animated value for this stroke
    const anim = new Animated.Value(pathLen);
    dashOffsetRef.current = anim;

    setCurrentStroke(index);

    const a = Animated.timing(anim, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });

    animRef.current = a;

    a.start(({ finished: done }) => {
      if (!done) return; // stopped externally
      completedRef.current = index + 1;
      setCompletedCount(index + 1);
      setCurrentStroke(-1);

      if (playingRef.current) {
        // small gap between strokes
        setTimeout(() => {
          if (playingRef.current) animateStroke(index + 1);
        }, 30);
      }
    });
  }, [strokes]);

  const play = useCallback(() => {
    if (finished) {
      // Restart from beginning
      stopCurrent();
      setCompletedCount(0);
      completedRef.current = 0;
      setCurrentStroke(-1);
      setFinished(false);
      playingRef.current = true;
      setIsPlaying(true);
      setTimeout(() => animateStroke(0), 50);
      return;
    }

    playingRef.current = true;
    setIsPlaying(true);
    animateStroke(completedRef.current);
  }, [finished, animateStroke]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    animRef.current?.stop();
    animRef.current = null;
    // completedRef stays at current completed count so resume continues from there
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const progress = strokes.length > 0 ? completedCount / strokes.length : 0;

  // Determine which strokes to show:
  // - 0..completedCount-1 → fully drawn (solid)
  // - completedCount → animating (dashOffset applied)
  // - rest → invisible
  const currentPathLength =
    currentStroke >= 0 ? (pathLengths.current[currentStroke] ?? 100) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Background tap to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Drawing Replay</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Canvas */}
          <View style={[styles.canvasWrap, { width: canvasSize, height: canvasSize }]}>
            <Svg
              width={canvasSize}
              height={canvasSize}
              style={StyleSheet.absoluteFill}
            >
              {strokes.map((stroke, i) => {
                const pl = pathLengths.current[i] ?? 100;

                if (i < completedCount) {
                  // Fully drawn
                  return (
                    <Path
                      key={i}
                      d={stroke.d}
                      stroke={stroke.color}
                      strokeWidth={stroke.strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  );
                }

                if (i === currentStroke) {
                  // Animating — use AnimatedPath via native props
                  return (
                    <AnimatedPath
                      key={i}
                      d={stroke.d}
                      stroke={stroke.color}
                      strokeWidth={stroke.strokeWidth}
                      pathLength={pl}
                      dashOffset={dashOffsetRef.current}
                    />
                  );
                }

                // Not reached yet — invisible
                return null;
              })}
            </Svg>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {finished ? "Done!" : `${completedCount} / ${strokes.length} strokes`}
          </Text>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Play / Pause */}
            <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
              <Text style={styles.playBtnText}>
                {finished ? "↺ Replay" : isPlaying ? "⏸ Pause" : completedCount === 0 ? "▶ Play" : "▶ Resume"}
              </Text>
            </TouchableOpacity>

            {/* Speed selector */}
            <View style={styles.speedRow}>
              {SPEEDS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.speedBtn, speed === s && styles.speedBtnActive]}
                  onPress={() => setSpeed(s)}
                >
                  <Text style={[styles.speedBtnText, speed === s && styles.speedBtnTextActive]}>
                    {s}×
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── AnimatedPath helper — wraps react-native-svg Path with Animated.Value ────
// react-native-svg doesn't support Animated.Value on strokeDashoffset directly
// via props without createAnimatedComponent. We use it here:
const AnimatedSvgPath = Animated.createAnimatedComponent(Path as any);

function AnimatedPath({
  d, stroke, strokeWidth, pathLength, dashOffset,
}: {
  d: string;
  stroke: string;
  strokeWidth: number;
  pathLength: number;
  dashOffset: Animated.Value;
}) {
  return (
    <AnimatedSvgPath
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={`${pathLength} ${pathLength}`}
      strokeDashoffset={dashOffset}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    width: SW - 32,
    backgroundColor: "#1C1C1E",
    borderRadius: 28,
    padding: 20,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  closeBtn: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 16,
    fontWeight: "600",
  },
  canvasWrap: {
    backgroundColor: "#F8F4EE",
    borderRadius: 16,
    overflow: "hidden",
  },
  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#8CB33A",
  },
  progressLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "600",
  },
  controls: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: "#5C7A1E",
    alignItems: "center",
  },
  playBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  speedRow: {
    flexDirection: "row",
    gap: 6,
  },
  speedBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  speedBtnActive: {
    backgroundColor: "rgba(92,122,30,0.3)",
    borderColor: "#8CB33A",
  },
  speedBtnText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "700",
  },
  speedBtnTextActive: {
    color: "#8CB33A",
  },
});
