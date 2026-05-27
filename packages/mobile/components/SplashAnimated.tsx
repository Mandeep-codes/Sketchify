import React, { useEffect, useRef } from "react";
import {
  View,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
} from "react-native";

const { width, height } = Dimensions.get("window");

interface Props {
  onFinish: () => void;
}

export default function SplashAnimated({ onFinish }: Props) {
  // Animations
  const bgO     = useRef(new Animated.Value(1)).current;
  const logoS   = useRef(new Animated.Value(0.3)).current;
  const logoO   = useRef(new Animated.Value(0)).current;
  const logoY   = useRef(new Animated.Value(30)).current;
  const glowS   = useRef(new Animated.Value(0.6)).current;
  const glowO   = useRef(new Animated.Value(0)).current;
  const exitO   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Logo fades + springs in
      Animated.parallel([
        Animated.timing(logoO, {
          toValue: 1, duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoS, {
          toValue: 1, damping: 14, stiffness: 140,
          useNativeDriver: true,
        }),
        Animated.spring(logoY, {
          toValue: 0, damping: 18, stiffness: 120,
          useNativeDriver: true,
        }),
      ]),

      // 2. Glow ring pulses out
      Animated.parallel([
        Animated.timing(glowO, {
          toValue: 0.5, duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowS, {
          toValue: 1.6, duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 3. Hold
      Animated.delay(320),

      // 4. Logo pulses slightly
      Animated.sequence([
        Animated.timing(logoS, {
          toValue: 1.07, duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoS, {
          toValue: 1, duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 5. Hold a beat
      Animated.delay(200),

      // 6. Whole screen fades out
      Animated.timing(exitO, {
        toValue: 0, duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: exitO }]}>
      {/* Background */}
      <View style={styles.bg} />

      {/* Glow ring behind logo */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            opacity: glowO,
            transform: [{ scale: glowS }],
          },
        ]}
      />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoO,
            transform: [{ scale: logoS }, { translateY: logoY }],
          },
        ]}
      >
        <Image
          source={require("../assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const LOGO_SIZE = 120;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A1A1A",
  },
  glowRing: {
    position: "absolute",
    width: LOGO_SIZE + 40,
    height: LOGO_SIZE + 40,
    borderRadius: (LOGO_SIZE + 40) / 2,
    borderWidth: 2,
    borderColor: "#8CB33A",
    backgroundColor: "transparent",
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#8CB33A",
    shadowOpacity: 0.6,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
