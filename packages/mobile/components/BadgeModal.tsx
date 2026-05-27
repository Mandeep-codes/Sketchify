import React, { useEffect, useRef } from "react";
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Milestone } from "../lib/streaks";
import { T } from "../lib/theme";

interface Props {
  milestone: Milestone;
  streak: number;
  onDismiss: () => void;
}

export default function BadgeModal({ milestone, streak, onDismiss }: Props) {
  const scaleA = useRef(new Animated.Value(0.5)).current;
  const fadeA  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scaleA, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeA,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Modal transparent animationType="fade" onRequestClose={onDismiss}>
      <Animated.View style={[s.overlay, { opacity: fadeA }]}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleA }] }]}>
          {/* Glow background */}
          <View style={[s.glow, { backgroundColor: milestone.color + "22" }]} />

          {/* Emoji */}
          <Text style={s.emoji}>{milestone.emoji}</Text>

          {/* Badge pill */}
          <View style={[s.pill, { backgroundColor: milestone.color + "33", borderColor: milestone.color + "66" }]}>
            <Text style={[s.pillText, { color: milestone.color }]}>{milestone.label}</Text>
          </View>

          {/* Title + subtitle */}
          <Text style={s.title}>{milestone.title}</Text>
          <Text style={s.sub}>{milestone.subtitle}</Text>

          {/* Streak count */}
          <View style={s.streakRow}>
            <Text style={s.streakNum}>🔥 {streak}</Text>
            <Text style={s.streakLabel}> day streak</Text>
          </View>

          {/* CTA */}
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.85} style={{ width: "100%" }}>
            <LinearGradient
              colors={[T.accent, T.accentDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btn}
            >
              <Text style={s.btnText}>Claim Badge →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  card: {
    backgroundColor: "#1C1C1E", borderRadius: 32, padding: 32,
    alignItems: "center", gap: 12, width: "100%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 }, overflow: "hidden",
  },
  glow: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
  },
  emoji:     { fontSize: 72, marginBottom: 4 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 50, borderWidth: 1,
  },
  pillText:  { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  title:     { fontSize: 26, fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: -0.5 },
  sub:       { fontSize: 14, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 20 },
  streakRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 8 },
  streakNum: { fontSize: 20, fontWeight: "900", color: "#fff" },
  streakLabel:{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: "500" },
  btn:       { borderRadius: 50, paddingVertical: 15, alignItems: "center", width: "100%" },
  btnText:   { color: "#fff", fontSize: 16, fontWeight: "800" },
});
