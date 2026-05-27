import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  ImageBackground,
  Easing,
  FlatList,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { T } from "../lib/theme";

const { width, height } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────────────
// SLIDES DATA — shown every time after "Start Creating"
// ─────────────────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: "1",
    bg: ["#0C0B09", "#1A1712", "#0C0B09"] as [string, string, string],
    accent: "#E8D5A3",
    tag: "STEP 01",
    title: "Just draw.\nAnything.",
    body: "No skill needed. Stick figures, rough shapes — your lines are the spark.",
    image: require("../assets/images/slide1-draw.jpg"),
    decorChar: "✏️",
    highlight: "E8D5A3",
    ctaColor: "#2C2A24",
    ctaTextColor: "#E8D5A3",
  },
  {
    id: "2",
    bg: ["#0A0A0A", "#141414", "#0A0A0A"] as [string, string, string],
    accent: "#FF6B4A",
    tag: "STEP 02",
    title: "Pick a style.\nWatch it shift.",
    body: "Anime. Cyberpunk. Oil paint. Realistic. Ten ways to reimagine what you drew.",
    image: require("../assets/images/slide2-styles.jpg"),
    decorChar: "//",
    highlight: "FF6B4A",
    ctaColor: "#1A1A1A",
    ctaTextColor: "#FF6B4A",
  },
  {
    id: "3",
    bg: ["#090D0A", "#111A12", "#090D0A"] as [string, string, string],
    accent: "#6BCB77",
    tag: "STEP 03",
    title: "Save it.\nShare it.",
    body: "Your creations live in your gallery. Build a collection. Show the world.",
    image: require("../assets/images/slide3-gallery.jpg"),
    decorChar: "📌",
    highlight: "6BCB77",
    ctaColor: "#141A14",
    ctaTextColor: "#6BCB77",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME CARD DATA
// ─────────────────────────────────────────────────────────────────────────────
const STYLE_CARDS = [
  { src: require("../assets/images/preview-realistic.png"), rotate: "4deg",  top: 0,  label: "Realistic" },
  { src: require("../assets/images/preview-anime.png"),     rotate: "-3deg", top: 22, label: "Anime"     },
  { src: require("../assets/images/preview-cyberpunk.png"), rotate: "2deg",  top: 6,  label: "Cyberpunk" },
  { src: require("../assets/images/preview-oilpaint.png"),  rotate: "-4deg", top: 18, label: "Oil Paint" },
];

// ─────────────────────────────────────────────────────────────────────────────
// INTRO SLIDES (shown every time after "Start Creating")
// ─────────────────────────────────────────────────────────────────────────────
function IntroSlides({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const listRef = useRef<FlatList>(null);

  // Per-slide enter animations
  const imgO      = useRef(new Animated.Value(0)).current;
  const imgScale  = useRef(new Animated.Value(1.06)).current;
  const numO      = useRef(new Animated.Value(0)).current;
  const numX      = useRef(new Animated.Value(-20)).current;
  const titleO    = useRef(new Animated.Value(0)).current;
  const titleY    = useRef(new Animated.Value(22)).current;
  const bodyO     = useRef(new Animated.Value(0)).current;
  const bodyY     = useRef(new Animated.Value(16)).current;
  const btnScale  = useRef(new Animated.Value(1)).current;

  const animateIn = () => {
    imgO.setValue(0);
    imgScale.setValue(1.06);
    numO.setValue(0);
    numX.setValue(-20);
    titleO.setValue(0);
    titleY.setValue(22);
    bodyO.setValue(0);
    bodyY.setValue(16);

    Animated.parallel([
      Animated.timing(imgO,    { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(imgScale,{ toValue: 1, duration: 600, easing: Easing.out(Easing.quad),  useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(80),
        Animated.parallel([
          Animated.timing(numO, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(numX, { toValue: 0, damping: 14, stiffness: 100, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(titleO, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(titleY, { toValue: 0, damping: 16, stiffness: 130, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.parallel([
          Animated.timing(bodyO, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(bodyY, { toValue: 0, damping: 18, stiffness: 140, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  };

  useEffect(() => { animateIn(); }, []);

  const pressBtnIn  = () => Animated.spring(btnScale, { toValue: 0.94, useNativeDriver: true }).start();
  const pressBtnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (idx < SLIDES.length - 1) {
      const next = idx + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIdx(next);
      setTimeout(animateIn, 120);
    } else {
      onDone();
    }
  };

  const slide  = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;
  const IMG_H  = height * 0.55;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={[sl.slide, { width }]}>

            {/* ── FULL-BLEED IMAGE TOP 55% ── */}
            <Animated.View style={[sl.imgWrap, { height: IMG_H, opacity: imgO, transform: [{ scale: imgScale }] }]}>
              <Image source={item.image} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
              {/* fade bottom into cream */}
              <LinearGradient
                colors={["transparent", T.bg + "CC", T.bg]}
                locations={[0.6, 0.88, 1]}
                style={StyleSheet.absoluteFill as any}
              />
              {/* Big ghost step number */}
              <Animated.Text
                style={[sl.stepNum, { opacity: numO, transform: [{ translateX: numX }, { rotate: "-15deg" }] }]}
              >
                {item.tag.replace("STEP ", "0")}
              </Animated.Text>
            </Animated.View>

            {/* ── CREAM BOTTOM SECTION ── */}
            <View style={[sl.textPanel, { borderLeftWidth: 4, borderLeftColor: item.accent }]}>
              {/* accent label */}
              <Text style={[sl.accentLabel, { color: item.accent }]}>{item.tag}</Text>

              {/* Title */}
              <Animated.Text
                style={[sl.title, { opacity: titleO, transform: [{ translateY: titleY }] }]}
              >
                {item.title}
              </Animated.Text>

              {/* Body */}
              <Animated.Text
                style={[sl.body, { opacity: bodyO, transform: [{ translateY: bodyY }] }]}
              >
                {item.body}
              </Animated.Text>
            </View>
          </View>
        )}
      />

      {/* ── FOOTER ── */}
      <View style={[sl.footer, { paddingBottom: insets.bottom + 20 }]}>
        {/* Dash indicators */}
        <View style={sl.dotsRow}>
          {SLIDES.map((s, i) => (
            <View
              key={i}
              style={[
                sl.dash,
                i === idx
                  ? [sl.dashActive, { backgroundColor: slide.accent }]
                  : sl.dashInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <Animated.View style={{ width: "100%", transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={sl.cta}
            onPress={goNext}
            onPressIn={pressBtnIn}
            onPressOut={pressBtnOut}
            activeOpacity={1}
          >
            <Text style={sl.ctaText}>{isLast ? "Let's create →" : "Next  →"}</Text>
          </TouchableOpacity>
        </Animated.View>

        {!isLast && (
          <TouchableOpacity
            onPress={onDone}
            style={sl.skipBtn}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
          >
            <Text style={sl.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME SCREEN (shown every launch)
// ─────────────────────────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const insets = useSafeAreaInsets();

  const canvasO   = useRef(new Animated.Value(0)).current;
  const canvasS   = useRef(new Animated.Value(1.08)).current;
  const titleO    = useRef(new Animated.Value(0)).current;
  const titleY    = useRef(new Animated.Value(32)).current;
  const titleRot  = useRef(new Animated.Value(-3)).current;
  const subO      = useRef(new Animated.Value(0)).current;
  const subY      = useRef(new Animated.Value(20)).current;
  const card0O    = useRef(new Animated.Value(0)).current;
  const card0Y    = useRef(new Animated.Value(50)).current;
  const card1O    = useRef(new Animated.Value(0)).current;
  const card1Y    = useRef(new Animated.Value(50)).current;
  const card2O    = useRef(new Animated.Value(0)).current;
  const card2Y    = useRef(new Animated.Value(50)).current;
  const card3O    = useRef(new Animated.Value(0)).current;
  const card3Y    = useRef(new Animated.Value(50)).current;
  const ctaO      = useRef(new Animated.Value(0)).current;
  const ctaY      = useRef(new Animated.Value(24)).current;
  const btnScale  = useRef(new Animated.Value(1)).current;
  const splatRot  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fade = (v: Animated.Value, to: number, dur: number, delay = 0) =>
      Animated.timing(v, { toValue: to, duration: dur, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const spring = (v: Animated.Value, to: number, delay = 0) =>
      Animated.spring(v, { toValue: to, damping: 14, stiffness: 100, delay, useNativeDriver: true });

    Animated.parallel([
      fade(canvasO, 1, 700),
      Animated.timing(canvasS, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      // Title slams in with rotation
      Animated.sequence([
        Animated.delay(250),
        Animated.parallel([
          fade(titleO, 1, 350),
          spring(titleY, 0),
          Animated.timing(titleRot, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        ]),
      ]),
      // Sub
      Animated.sequence([Animated.delay(480), Animated.parallel([fade(subO, 1, 300), spring(subY, 0)])]),
      // Cards stagger in
      Animated.sequence([Animated.delay(300), Animated.parallel([fade(card0O, 1, 280), spring(card0Y, 0)])]),
      Animated.sequence([Animated.delay(380), Animated.parallel([fade(card1O, 1, 280), spring(card1Y, 0)])]),
      Animated.sequence([Animated.delay(460), Animated.parallel([fade(card2O, 1, 280), spring(card2Y, 0)])]),
      Animated.sequence([Animated.delay(540), Animated.parallel([fade(card3O, 1, 280), spring(card3Y, 0)])]),
      // CTA
      Animated.sequence([Animated.delay(650), Animated.parallel([fade(ctaO, 1, 340), spring(ctaY, 0)])]),
    ]).start();

    // Slow wobble on splat emoji
    Animated.loop(
      Animated.sequence([
        Animated.timing(splatRot, { toValue: 12, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(splatRot, { toValue: -8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const cardAnims = [
    { opacity: card0O, translateY: card0Y },
    { opacity: card1O, translateY: card1Y },
    { opacity: card2O, translateY: card2Y },
    { opacity: card3O, translateY: card3Y },
  ];

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };

  const pressBtnIn  = () => Animated.spring(btnScale, { toValue: 0.93, useNativeDriver: true }).start();
  const pressBtnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <View style={ws.root}>
      <StatusBar barStyle="light-content" />

      {/* ── FULL CANVAS HERO ── */}
      <Animated.View style={[ws.heroWrap, { opacity: canvasO, transform: [{ scale: canvasS }] }]}>
        {/* Painted canvas texture — the real background */}
        <ImageBackground
          source={require("../assets/images/welcome-canvas.png")}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Dark scrim so text is readable */}
        <LinearGradient
          colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.88)"]}
          locations={[0, 0.3, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* App name — top left, raw & handmade */}
        <View style={[ws.topBar, { paddingTop: insets.top + 14 }]}>
          <View style={ws.logoChip}>
            <Image source={require("../assets/icon.png")} style={ws.logoIcon} />
            <Text style={ws.logoText}>Sketchify</Text>
          </View>
          {/* Floating chaos marks */}
          <Animated.Text style={[ws.splatEmoji, { transform: [{ rotate: splatRot.interpolate({ inputRange: [-12, 12], outputRange: ["-12deg", "12deg"] }) }] }]}>
          </Animated.Text>
        </View>

        {/* Preview cards — raw, stacked with big rotations */}
        <View style={ws.cardStack}>
          {STYLE_CARDS.map((card, i) => (
            <Animated.View
              key={card.label}
              style={[
                ws.stackCard,
                {
                  zIndex: i,
                  opacity: cardAnims[i].opacity,
                  transform: [
                    { translateY: cardAnims[i].translateY },
                    { rotate: card.rotate },
                    { translateX: i === 0 ? -30 : i === 1 ? 10 : i === 2 ? -15 : 25 },
                  ],
                },
              ]}
            >
              <Image source={card.src} style={ws.stackImg} resizeMode="cover" />
              {/* Torn label tape */}
              <View style={ws.stackTape}>
                <Text style={ws.stackTapeText}>{card.label}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Big messy title — bottom of canvas */}
        <View style={ws.titleBlock}>
          <Animated.Text
            style={[
              ws.headline,
              {
                opacity: titleO,
                transform: [
                  { translateY: titleY },
                  { rotate: titleRot.interpolate({ inputRange: [-3, 0], outputRange: ["-3deg", "0deg"] }) },
                ],
              },
            ]}
          >
            {"Sketches\ncome alive."}
          </Animated.Text>
          <Animated.Text style={[ws.sub, { opacity: subO, transform: [{ translateY: subY }] }]}>
            Draw anything rough. Get something stunning.
          </Animated.Text>
        </View>
      </Animated.View>

      {/* ── BOTTOM STRIP — CTA ── */}
      <View style={[ws.bottomStrip, { paddingBottom: insets.bottom + 28 }]}>
        <Animated.View style={{ opacity: ctaO, transform: [{ translateY: ctaY }, { scale: btnScale }], width: "100%" }}>
          <TouchableOpacity
            style={ws.cta}
            onPress={handleStart}
            onPressIn={pressBtnIn}
            onPressOut={pressBtnOut}
            activeOpacity={0.85}
          >
            {/* Paint-brush stroke fill — two layered thick brush marks */}
            <Svg style={ws.ctaBorder} viewBox="0 0 320 66" preserveAspectRatio="none">
              {/* Background brush blob */}
              <Path
                d="M6,18 Q2,6 18,4 Q60,0 120,3 Q200,6 270,2 Q302,0 316,10 Q324,22 318,34 Q324,50 314,60 Q300,67 260,64 Q190,68 120,65 Q60,62 22,66 Q6,66 2,54 Q-4,40 6,18 Z"
                fill="#fff"
                opacity={0.97}
              />
              {/* Top edge rough brush stroke for texture */}
              <Path
                d="M20,4 Q80,1 160,3 Q240,5 300,2"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
            <Text style={ws.ctaText}>Start Creating</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.Text style={[ws.tagline, { opacity: ctaO }]}>
          No skill needed. Just draw.
        </Animated.Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — controls Welcome → Slides → Home flow
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingRoot() {
  const [phase, setPhase] = useState<"welcome" | "slides">("welcome");

  if (phase === "slides") {
    return <IntroSlides onDone={() => router.replace("/")} />;
  }

  return <WelcomeScreen onStart={() => setPhase("slides")} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Intro slides
// ─────────────────────────────────────────────────────────────────────────────
const sl = StyleSheet.create({
  slide: {
    flex: 1,
    height,
    backgroundColor: T.bg,
    overflow: "hidden",
  },

  // Full-bleed image top half
  imgWrap: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },

  // Giant ghost step number overlaid on image
  stepNum: {
    position: "absolute",
    bottom: 30,
    left: 18,
    fontSize: 120,
    fontWeight: "900",
    color: "rgba(255,255,255,0.18)",
    letterSpacing: -6,
    lineHeight: 120,
  },

  // Cream text panel — curves up from bottom of image
  textPanel: {
    flex: 1,
    backgroundColor: T.bg,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginTop: -36,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingLeft: 32,
    gap: 10,
  },

  accentLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  title: {
    fontSize: 40,
    fontWeight: "900",
    color: T.textPrimary,
    letterSpacing: -1.2,
    lineHeight: 46,
  },

  body: {
    fontSize: 14,
    color: T.textSec,
    lineHeight: 21,
    maxWidth: 300,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: "center",
    gap: 0,
    backgroundColor: T.bg,
  },

  // Dash indicators replacing dots
  dotsRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  dash: { height: 4, borderRadius: 2 },
  dashActive: { width: 28 },
  dashInactive: { width: 10, backgroundColor: T.textMuted + "50" },

  cta: {
    width: "100%",
    height: 56,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.textPrimary,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    marginBottom: 14,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "900",
    color: T.bg,
    letterSpacing: -0.2,
  },

  skipBtn: { paddingVertical: 4 },
  skipText: { fontSize: 13, color: T.textMuted, fontWeight: "500" },
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Welcome screen
// ─────────────────────────────────────────────────────────────────────────────
const CARD_W = 110;
const CARD_H = CARD_W * 1.45;

const ws = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111" },

  // Full-screen painted canvas hero
  heroWrap: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "space-between",
  },

  // Top bar — logo + floating emoji
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    zIndex: 10,
  },
  logoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  logoIcon: { width: 24, height: 24, borderRadius: 6 },
  logoText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.3,
  },
  splatEmoji: {
    fontSize: 36,
  },

  // Card stack — overlapping, rotated
  cardStack: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    marginTop: 10,
    height: CARD_H + 30,
    gap: -12, // overlap
  },
  stackCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  stackImg: {
    width: "100%",
    height: "100%",
  },
  // Masking tape label on each card
  stackTape: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,220,0.92)",
    paddingVertical: 5,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  stackTapeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#222",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Title block — bottom of canvas
  titleBlock: {
    paddingHorizontal: 22,
    paddingBottom: 32,
    gap: 10,
  },
  headline: {
    fontSize: 46,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1.5,
    lineHeight: 50,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  sub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
    fontWeight: "500",
  },

  // Bottom strip — CTA
  bottomStrip: {
    backgroundColor: "#111",
    paddingHorizontal: 22,
    paddingTop: 22,
    alignItems: "center",
    gap: 12,
  },
  cta: {
    width: "100%",
    height: 62,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
  },
  ctaBorder: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    width: "100%",
    height: "100%",
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    letterSpacing: 0.4,
    zIndex: 2,
  },

  tagline: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});
