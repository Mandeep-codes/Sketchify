import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  PanResponder,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

interface Props {
  beforeUri: string; // original photo
  afterUri: string;  // AI result
  width?: number;
  height?: number;
}

export default function BeforeAfterSlider({
  beforeUri,
  afterUri,
  width: w = SCREEN_W - 32,
  height: h = SCREEN_W - 32,
}: Props) {
  const sliderX = useRef(new Animated.Value(w / 2)).current;
  const sliderXVal = useRef(w / 2);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, g) => {
        const newX = Math.max(2, Math.min(w - 2, sliderXVal.current + g.dx));
        sliderX.setValue(newX);
      },
      onPanResponderRelease: (_, g) => {
        const newX = Math.max(2, Math.min(w - 2, sliderXVal.current + g.dx));
        sliderXVal.current = newX;
        sliderX.setValue(newX);
      },
    })
  ).current;

  const clipWidth = sliderX.interpolate({
    inputRange: [0, w],
    outputRange: [0, w],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      {/* AFTER (full — rendered underneath) */}
      <Image
        source={{ uri: afterUri }}
        style={[styles.img, { width: w, height: h }]}
        resizeMode="cover"
      />

      {/* BEFORE (clipped on left side) */}
      <Animated.View
        style={[
          styles.clip,
          { width: clipWidth, height: h },
        ]}
      >
        <Image
          source={{ uri: beforeUri }}
          style={[styles.img, { width: w, height: h }]}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Divider line */}
      <Animated.View
        style={[
          styles.divider,
          { left: Animated.add(sliderX, new Animated.Value(-1)), height: h },
        ]}
      />

      {/* Drag handle */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.handle,
          {
            left: Animated.add(sliderX, new Animated.Value(-22)),
            top: h / 2 - 22,
          },
        ]}
      >
        <View style={styles.handleInner}>
          <Text style={styles.handleArrows}>◀  ▶</Text>
        </View>
      </Animated.View>

      {/* Labels */}
      <View style={[styles.label, styles.labelLeft]} pointerEvents="none">
        <Text style={styles.labelText}>BEFORE</Text>
      </View>
      <View style={[styles.label, styles.labelRight]} pointerEvents="none">
        <Text style={styles.labelText}>AFTER</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#111",
    position: "relative",
  },
  img: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  clip: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
  },
  divider: {
    position: "absolute",
    top: 0,
    width: 2,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  handle: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "visible",
    zIndex: 10,
  },
  handleInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  handleArrows: {
    fontSize: 11,
    color: "#111",
    fontWeight: "800",
    letterSpacing: -1,
  },
  label: {
    position: "absolute",
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    pointerEvents: "none",
  },
  labelLeft: { left: 12 },
  labelRight: { right: 12 },
  labelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
