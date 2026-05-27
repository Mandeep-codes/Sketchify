import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  ImageBackground,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useGallery } from "../lib/gallery-context";
import { getTodayChallenge } from "../lib/challenges";
import { Storage, KEYS } from "../lib/storage";
import { T } from "../lib/theme";
import { MODES } from "../lib/modes";
import { getMilestoneForStreak, Milestone } from "../lib/streaks";
import BadgeModal from "../components/BadgeModal";

const { width } = Dimensions.get("window");

// Per-challenge color palettes — watercolor / painterly
const CHALLENGE_PALETTES: Record<string, { from: string; to: string; splash: string; text: string }> = {
  "🏚️": { from: "#6B21A8", to: "#1E1B4B", splash: "#A855F7", text: "#E9D5FF" },
  "🌳": { from: "#065F46", to: "#064E3B", splash: "#34D399", text: "#D1FAE5" },
  "🤖": { from: "#1D4ED8", to: "#1E3A5F", splash: "#60A5FA", text: "#DBEAFE" },
  "🏙️": { from: "#0C4A6E", to: "#0F172A", splash: "#38BDF8", text: "#E0F2FE" },
  "🐱": { from: "#BE185D", to: "#831843", splash: "#F472B6", text: "#FCE7F3" },
  "🍕": { from: "#B45309", to: "#78350F", splash: "#FBBF24", text: "#FEF3C7" },
  "🐉": { from: "#065F46", to: "#7F1D1D", splash: "#A3E635", text: "#D9F99D" },
  "🍾": { from: "#1E3A5F", to: "#0C4A6E", splash: "#67E8F9", text: "#CFFAFE" },
  "🚲": { from: "#1E40AF", to: "#312E81", splash: "#818CF8", text: "#E0E7FF" },
  "🦊": { from: "#9A3412", to: "#7C2D12", splash: "#FB923C", text: "#FFEDD5" },
  "🏰": { from: "#0C4A6E", to: "#1E3A5F", splash: "#7DD3FC", text: "#E0F2FE" },
  "🧙": { from: "#4C1D95", to: "#2E1065", splash: "#C084FC", text: "#F3E8FF" },
  "🔥": { from: "#991B1B", to: "#7C2D12", splash: "#F97316", text: "#FFEDD5" },
  "🐕": { from: "#92400E", to: "#78350F", splash: "#FDE68A", text: "#FFFBEB" },
  "🍄": { from: "#065F46", to: "#0F4C30", splash: "#86EFAC", text: "#DCFCE7" },
  "🚗": { from: "#1E3A5F", to: "#0F172A", splash: "#A78BFA", text: "#EDE9FE" },
  "☕": { from: "#78350F", to: "#451A03", splash: "#D97706", text: "#FEF3C7" },
  "🐻": { from: "#92400E", to: "#451A03", splash: "#FCD34D", text: "#FFFBEB" },
  "🌀": { from: "#312E81", to: "#1E1B4B", splash: "#818CF8", text: "#E0E7FF" },
  "👨‍🚀": { from: "#0F172A", to: "#1E3A5F", splash: "#7DD3FC", text: "#CFFAFE" },
  "🐋": { from: "#075985", to: "#0C4A6E", splash: "#38BDF8", text: "#E0F2FE" },
  "🕷️": { from: "#1C1917", to: "#292524", splash: "#DC2626", text: "#FEE2E2" },
  "🏠": { from: "#1E3A5F", to: "#0F172A", splash: "#93C5FD", text: "#DBEAFE" },
  "🧜": { from: "#0E7490", to: "#164E63", splash: "#22D3EE", text: "#CFFAFE" },
  "🕐": { from: "#065F46", to: "#14532D", splash: "#4ADE80", text: "#DCFCE7" },
  "🌌": { from: "#1E1B4B", to: "#0F172A", splash: "#A78BFA", text: "#EDE9FE" },
  "🌸": { from: "#9D174D", to: "#831843", splash: "#F9A8D4", text: "#FCE7F3" },
  "🏴‍☠️": { from: "#1C1917", to: "#292524", splash: "#FCD34D", text: "#FFFBEB" },
  "🗺️": { from: "#713F12", to: "#451A03", splash: "#D97706", text: "#FEF9C3" },
  "🌙": { from: "#312E81", to: "#1E1B4B", splash: "#C084FC", text: "#F3E8FF" },
};
function getChallengeColors(emoji: string) {
  return CHALLENGE_PALETTES[emoji] ?? { from: "#1D4ED8", to: "#312E81", splash: "#60A5FA", text: "#DBEAFE" };
}

const QUICK_STYLES = [
  { label: "Realistic",  tag: "Photo",     color: "#C97B3A", img: require("../assets/images/style-realistic.png") },
  { label: "Anime",      tag: "Manga",     color: "#9B5EA6", img: require("../assets/images/style-anime.png") },
  { label: "Cyberpunk",  tag: "Neon",      color: "#1E6FA6", img: require("../assets/images/style-cyberpunk.png") },
  { label: "Oil Paint",  tag: "Fine Art",  color: "#2E7D52", img: require("../assets/images/style-oilpaint.png") },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useGallery();


  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(18)).current;
  const fadeB  = useRef(new Animated.Value(0)).current;
  const slideB = useRef(new Animated.Value(18)).current;

  const todayChallenge = getTodayChallenge();
  const [streak, setStreak] = useState(0);
  const [shownMilestone, setShownMilestone] = useState<Milestone | null>(null);
  const [avatarEmoji, setAvatarEmoji] = useState("🎨");
  const [timeLeft, setTimeLeft] = useState("");
  const chalPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(slideA, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeB,  { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(slideB, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();

    // Midnight countdown
    const tick = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m left`);
    };
    tick();
    const timerId = setInterval(tick, 60000);

    // Emoji pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(chalPulse, { toValue: 1.1, duration: 950, useNativeDriver: true }),
        Animated.timing(chalPulse, { toValue: 1.0, duration: 950, useNativeDriver: true }),
      ])
    ).start();
    (async () => {
      const s = await Storage.get<number>(KEYS.STREAK_COUNT);
      const streakVal = s ?? 0;
      setStreak(streakVal);

      // Load avatar emoji from profile
      const prof = await Storage.get<{ avatarEmoji?: string }>(KEYS.PROFILE);
      if (prof?.avatarEmoji) setAvatarEmoji(prof.avatarEmoji);

      // Check for new milestone
      const milestone = getMilestoneForStreak(streakVal);
      if (milestone) {
        const earned = await Storage.get<number[]>(KEYS.BADGES) ?? [];
        if (!earned.includes(milestone.days)) {
          setShownMilestone(milestone);
        }
      }
    })();
    return () => clearInterval(timerId);
  }, []);

  const push = (path: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path);
  };

  const handleBadgeDismiss = async () => {
    if (!shownMilestone) return;
    const earned = await Storage.get<number[]>(KEYS.BADGES) ?? [];
    await Storage.set(KEYS.BADGES, [...earned, shownMilestone.days]);
    setShownMilestone(null);
  };

  const TAB_H = 60 + insets.bottom;
  const CARD_W = (width - 36 - 10) / 2;

  return (
    <View style={s.root}>
      {shownMilestone && (
        <BadgeModal
          milestone={shownMilestone}
          streak={streak}
          onDismiss={handleBadgeDismiss}
        />
      )}

      <SafeAreaView style={s.safe} edges={[]}>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: TAB_H + 20 }]}
        >

          {/* ── HERO + HEADER combined ── */}
          <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>
            <View style={s.hero}>
              <ImageBackground
                source={require("../assets/images/hero-bg.png")}
                style={s.heroBg}
                imageStyle={s.heroBgImg}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.75)", "rgba(0,0,0,0.92)"]}
                  locations={[0, 0.3, 0.7, 1]}
                  style={s.heroGradient}
                >
                  {/* ── HEADER inside hero ── */}
                  <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <View>
                      <Text style={s.greeting}>{getGreeting()}</Text>
                      <Text style={s.wordmark}>Sketchify</Text>
                    </View>
                    <View style={s.headerRight}>
                      <TouchableOpacity style={s.iconBtn} onPress={() => push("/gallery")} activeOpacity={0.75}>
                        <Text style={s.iconGlyph}>□</Text>
                        {items.length > 0 && (
                          <View style={s.dot}><Text style={s.dotText}>{items.length > 9 ? "9+" : items.length}</Text></View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={s.iconBtn} onPress={() => push("/albums")} activeOpacity={0.75}>
                        <Text style={s.iconGlyph}>▶</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.avatarBtn} onPress={() => push("/profile")} activeOpacity={0.75}>
                        <Text style={s.avatarBtnEmoji}>{avatarEmoji}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* eyebrow pill */}
                  <View style={s.heroTop}>
                    <View style={s.heroEyebrowPill}>
                      <Text style={s.heroEyebrow}>✦  Sketch → Reality</Text>
                    </View>
                  </View>

                  {/* bottom — title + CTA */}
                  <View style={s.heroInner}>
                    <Text style={s.heroTitle}>Draw something.{"\n"}Make it real.</Text>
                    <Text style={s.heroBody}>
                      Your rough sketch becomes a stunning image in seconds.
                    </Text>

                    <View style={s.heroDivider} />

                    <View style={s.heroBottom}>
                      <View style={s.heroMeta}>
                        <View style={s.heroStat}>
                          <Text style={s.heroStatNum}>{MODES.length}</Text>
                          <Text style={s.heroStatLabel}>styles</Text>
                        </View>
                        <View style={s.heroStatSep} />
                        <View style={s.heroStat}>
                          <Text style={s.heroStatNum}>{items.length || "0"}</Text>
                          <Text style={s.heroStatLabel}>created</Text>
                        </View>
                        {streak > 0 && (
                          <>
                            <View style={s.heroStatSep} />
                            <View style={s.heroStat}>
                              <Text style={s.heroStatNum}>{streak}</Text>
                              <Text style={s.heroStatLabel}>streak</Text>
                            </View>
                          </>
                        )}
                      </View>

                      <TouchableOpacity
                        style={s.heroCta}
                        onPress={() => push("/canvas")}
                        activeOpacity={0.88}
                      >
                        <Text style={s.heroCtaText}>Start Drawing</Text>
                        <View style={s.heroCtaArrow}>
                          <Text style={s.heroCtaArrowText}>→</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </View>
          </Animated.View>

          {/* ── DAILY CHALLENGE ── */}
          {(() => {
            const pal = getChallengeColors(todayChallenge.emoji);
            return (
              <Animated.View style={{ opacity: fadeB, transform: [{ translateY: slideB }] }}>
                <TouchableOpacity
                  onPress={() => push({ pathname: "/canvas", params: { challenge: todayChallenge.title } })}
                  activeOpacity={0.93}
                  style={s.chalCard}
                >
                  {/* Real paint splatter texture behind everything */}
                  <ImageBackground
                    source={require("../assets/images/challenge-paint-bg.png")}
                    style={StyleSheet.absoluteFill as any}
                    resizeMode="cover"
                    imageStyle={{ borderRadius: 28 }}
                  />

                  {/* Color tint overlay — per-challenge hue */}
                  <LinearGradient
                    colors={[pal.from + "CC", pal.to + "E8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill as any}
                  />

                  {/* Top row — label + timer */}
                  <View style={s.chalTop}>
                    <View style={s.chalTagPill}>
                      <Text style={s.chalTagText}>DAILY CHALLENGE</Text>
                    </View>
                    <View style={s.chalTimerChip}>
                      <Text style={s.chalTimerText}>{timeLeft}</Text>
                    </View>
                  </View>

                  {/* Giant emoji — THE hero */}
                  <Animated.Text style={[s.chalEmoji, { transform: [{ scale: chalPulse }] }]}>
                    {todayChallenge.emoji}
                  </Animated.Text>

                  {/* Title — big bold white, slight italic tilt */}
                  <Text style={s.chalTitle}>{todayChallenge.title}</Text>

                  {/* Description */}
                  <Text style={s.chalDesc}>{todayChallenge.description}</Text>

                  {/* CTA — hand-drawn wobbly border */}
                  <TouchableOpacity
                    onPress={() => push({ pathname: "/canvas", params: { challenge: todayChallenge.title } })}
                    activeOpacity={0.82}
                    style={s.chalCTAWrap}
                  >
                    <Svg style={s.chalCTABorder} viewBox="0 0 320 56" preserveAspectRatio="none">
                      <Path
                        d="M7,5 Q11,1 22,2 Q80,0 160,2 Q240,4 298,1 Q311,1 317,6 Q321,13 318,28 Q321,43 315,51 Q308,57 296,56 Q220,59 160,57 Q80,55 24,58 Q11,58 5,52 Q0,44 2,28 Q-1,13 7,5 Z"
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth="2"
                        fill="rgba(0,0,0,0.25)"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </Svg>
                    <Text style={s.chalCTAText}>Start Drawing</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Animated.View>
            );
          })()}

          {/* ── SPEED DRAW CHALLENGE ── */}
          <Animated.View style={{ opacity: fadeB, transform: [{ translateY: slideB }] }}>
            <TouchableOpacity
              onPress={() => push("/challenge-mode")}
              activeOpacity={0.92}
              style={s.speedCard}
            >
              <Image
                source={require("../assets/images/speed-draw-bg.jpg")}
                style={StyleSheet.absoluteFill as any}
                resizeMode="cover"
              />
              <View style={s.speedOverlay} />
              <View style={s.speedContent}>
                <View style={s.speedLeft}>
                  <View style={s.speedTagRow}>
                    <View style={s.speedDot} />
                    <Text style={s.speedTagText}>Speed Draw</Text>
                  </View>
                  <Text style={s.speedTitle}>Race the{"\n"}clock.</Text>
                  <Text style={s.speedSub}>30s · 60s · 90s</Text>
                </View>
                <View style={s.speedGoBtn}>
                  <Text style={s.speedGoBtnText}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── TRY IT ON ── */}
          <Animated.View style={{ opacity: fadeB, transform: [{ translateY: slideB }] }}>
            <TouchableOpacity
              onPress={() => push("/try-it-on")}
              activeOpacity={0.92}
              style={s.tioCard}
            >
              <Image
                source={require("../assets/images/try-it-on-bg.png")}
                style={StyleSheet.absoluteFill as any}
                resizeMode="cover"
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.72)"]}
                style={StyleSheet.absoluteFill as any}
              />
              <View style={s.tioContent}>
                <View style={s.tioLeft}>
                  <View style={s.tioTagRow}>
                    <View style={s.tioBadge}>
                      <Text style={s.tioBadgeText}>NEW</Text>
                    </View>
                    <Text style={s.tioTagText}>Try It On</Text>
                  </View>
                  <Text style={s.tioTitle}>See it before{"\n"}you do it.</Text>
                  <Text style={s.tioSub}>Tattoo · Room · Hair · Outfit</Text>
                </View>
                <View style={s.tioGoBtn}>
                  <Text style={s.tioGoBtnText}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── QUICK STYLES — magazine grid ── */}
          <Animated.View style={{ opacity: fadeB, transform: [{ translateY: slideB }] }}>
            <View style={s.rowHeader}>
              <Text style={s.rowTitle}>Styles</Text>
              <View style={s.rowPill}>
                <Text style={s.rowPillText}>pick your look →</Text>
              </View>
            </View>

            {/* Big card (Realistic) + tall card (Anime) side by side */}
            <View style={s.magRow}>
              <TouchableOpacity style={[s.magCardBig]} onPress={() => push("/canvas")} activeOpacity={0.85}>
                <ImageBackground source={QUICK_STYLES[0].img} style={s.magImg} imageStyle={s.magImgStyle}>
                  <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={s.magGrad}>
                    <View style={[s.magTag, { backgroundColor: QUICK_STYLES[0].color }]}>
                      <Text style={s.magTagText}>{QUICK_STYLES[0].tag}</Text>
                    </View>
                    <Text style={s.magLabel}>{QUICK_STYLES[0].label}</Text>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>

              <TouchableOpacity style={[s.magCardTall]} onPress={() => push("/canvas")} activeOpacity={0.85}>
                <ImageBackground source={QUICK_STYLES[1].img} style={s.magImg} imageStyle={s.magImgStyle}>
                  <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={s.magGrad}>
                    <View style={[s.magTag, { backgroundColor: QUICK_STYLES[1].color }]}>
                      <Text style={s.magTagText}>{QUICK_STYLES[1].tag}</Text>
                    </View>
                    <Text style={s.magLabel}>{QUICK_STYLES[1].label}</Text>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            </View>

            {/* Two equal cards below */}
            <View style={s.magRowSmall}>
              {[QUICK_STYLES[2], QUICK_STYLES[3]].map((st) => (
                <TouchableOpacity key={st.label} style={s.magCardHalf} onPress={() => push("/canvas")} activeOpacity={0.85}>
                  <ImageBackground source={st.img} style={s.magImg} imageStyle={s.magImgStyle}>
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={s.magGrad}>
                      <View style={[s.magTag, { backgroundColor: st.color }]}>
                        <Text style={s.magTagText}>{st.tag}</Text>
                      </View>
                      <Text style={s.magLabel}>{st.label}</Text>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* ── REEL BANNER ── */}
          <Animated.View style={{ opacity: fadeB, transform: [{ translateY: slideB }] }}>
            <TouchableOpacity style={s.reelBanner} onPress={() => push("/albums")} activeOpacity={0.86}>
              <LinearGradient
                colors={["#0D0D0D", "#1C1C1C"]}
                style={s.reelGrad}
              >
                {/* big decorative film strip lines */}
                <View style={s.reelStripe1} />
                <View style={s.reelStripe2} />

                <View style={s.reelContent}>
                  {/* top: eyebrow + emoji float */}
                  <View style={s.reelTopRow}>
                    <View style={s.reelBadge}>
                      <Text style={s.reelBadgeText}>NEW</Text>
                    </View>
                    <Text style={s.reelEye}>SKETCHIFY REELS</Text>
                    <Text style={s.reelBig}>//</Text>
                  </View>

                  {/* giant title */}
                  <Text style={s.reelTitle}>Your art.{"\n"}Short film.</Text>

                  {/* pill CTA row — like reference */}
                  <View style={s.reelPillRow}>
                    <TouchableOpacity style={s.reelPillMain} onPress={() => push("/albums")} activeOpacity={0.85}>
                      <Text style={s.reelPillMainText}>▶  Create Reel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.reelPillSec} onPress={() => push("/gallery")} activeOpacity={0.85}>
                      <Text style={s.reelPillSecText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>

      {/* ── TAB BAR ── */}
      <View style={[s.tabs, { paddingBottom: insets.bottom + 6 }]}>
        {/* Hand-drawn wavy top line */}
        <Svg height={10} width="100%" viewBox="0 0 375 10" style={s.tabWaveLine} preserveAspectRatio="none">
          <Path
            d="M0 6 Q30 2 60 6 Q90 10 120 6 Q150 2 180 6 Q210 10 240 6 Q270 2 300 6 Q330 10 360 6 Q367 5 375 6"
            stroke={T.accent + "55"}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
        {[
          { icon: "⌂",  label: "Home",    route: "/",        active: true  },
          { icon: "✏",  label: "Draw",    route: "/canvas",  active: false },
          { icon: "□",  label: "Gallery", route: "/gallery", active: false, badge: items.length > 0 ? items.length : null },
          { icon: "▶",  label: "Reels",   route: "/albums",  active: false },
          { icon: "👤", label: "Profile", route: "/profile", active: false },
        ].map((t) => (
          <TouchableOpacity key={t.label} style={s.tab} onPress={() => push(t.route as any)} activeOpacity={0.7}>
            <View style={s.tabIconWrap}>
              <Text style={[s.tabIcon, t.active && s.tabIconOn, t.active && s.tabIconScale]}>{t.icon}</Text>
              {t.badge != null && (
                <View style={s.tabBadge}><Text style={s.tabBadgeText}>{t.badge > 9 ? "9+" : t.badge}</Text></View>
              )}
            </View>
            <Text style={[s.tabLabel, t.active && s.tabLabelOn]}>{t.label}</Text>
            {/* Hand-drawn squiggle underline on active */}
            {t.active && (
              <Svg height={5} width={28} viewBox="0 0 28 5" style={s.tabSquiggle}>
                <Path
                  d="M0 3 Q4 0 8 3 Q12 5.5 16 3 Q20 0 24 3 Q26 4.5 28 3"
                  stroke={T.accentDark}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  safe: { flex: 1, backgroundColor: "transparent" },

  // Header — floats on top of hero image
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14,
    zIndex: 10,
  },
  greeting: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.7)", letterSpacing: 0.4, marginBottom: 1 },
  wordmark: { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.8,
    textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  iconGlyph: { fontSize: 15, color: "#fff" },
  avatarBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.45)",
  },
  avatarBtnEmoji: { fontSize: 18 },
  dot: {
    position: "absolute", top: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: T.accentDark, alignItems: "center", justifyContent: "center",
  },
  dotText: { fontSize: 8, fontWeight: "800", color: "#fff" },

  scroll: { paddingHorizontal: 18, paddingTop: 0 },

  // Hero
  hero: {
    overflow: "hidden",
    marginBottom: 24,
    marginHorizontal: -18,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroBg: { width: "100%", minHeight: 420 },
  heroBgImg: {},
  heroGradient: {
    flex: 1,
    minHeight: 420,
    justifyContent: "space-between",
  },
  heroTop: {
    paddingHorizontal: 22, paddingBottom: 8,
  },
  heroEyebrowPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  heroEyebrow: {
    fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.9)",
    letterSpacing: 1.2, textTransform: "uppercase",
  },
  heroInner: { padding: 22, paddingTop: 12, gap: 8 },
  heroTitle: {
    fontSize: 32, fontWeight: "900", color: "#fff",
    lineHeight: 38, letterSpacing: -1,
    textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  heroBody: {
    fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 19,
  },
  heroDivider: {
    height: 1, backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 4,
  },
  heroBottom: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", gap: 12, paddingTop: 4,
  },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 0 },
  heroStat: { alignItems: "center", paddingHorizontal: 10 },
  heroStatNum: { fontSize: 18, fontWeight: "800", color: "#fff" },
  heroStatLabel: { fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: "500", marginTop: 1, textTransform: "uppercase", letterSpacing: 0.5 },
  heroStatSep: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.2)" },
  heroCta: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    paddingLeft: 16, paddingRight: 4, paddingVertical: 4,
    gap: 8,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  heroCtaText: { fontSize: 13, fontWeight: "800", color: T.accentDark },
  heroCtaArrow: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: T.accentDark, alignItems: "center", justifyContent: "center",
  },
  heroCtaArrowText: { fontSize: 16, color: "#fff" },

  // Row header
  rowHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  rowTitle: { fontSize: 20, fontWeight: "900", color: T.textPrimary, letterSpacing: -0.5 },
  rowSub: { fontSize: 11, fontWeight: "600", color: T.textMuted, letterSpacing: 0.2 },
  rowPill: {
    backgroundColor: T.pill, borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  rowPillText: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.85)", letterSpacing: 0.3 },

  // Daily Challenge card — painted texture base
  chalCard: {
    borderRadius: 28,
    marginBottom: 24,
    paddingLeft: 22,
    paddingRight: 22,
    paddingTop: 20,
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
    overflow: "hidden",
  },
  chalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  chalTagPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 50,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  chalTagText: {
    fontSize: 10, fontWeight: "900", color: "#fff",
    letterSpacing: 1.2, textTransform: "uppercase",
  },
  chalTimerChip: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chalTimerText: {
    fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.2,
  },
  // Giant emoji — massive, centrepiece
  chalEmoji: {
    fontSize: 96,
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 8,
  },
  chalTitle: {
    fontSize: 30, fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.8, lineHeight: 35,
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },
  chalDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
    marginBottom: 20,
    fontWeight: "500",
  },
  chalCTAWrap: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  chalCTABorder: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    width: "100%",
    height: "100%",
  },
  chalCTA: {},
  chalCTAText: {
    fontSize: 16, fontWeight: "900", color: "#fff",
    letterSpacing: 0.3,
    zIndex: 2,
  },
  chalCTAEmoji: {
    fontSize: 18,
  },
  // legacy stubs — keep to avoid ref errors
  chalBlob1: {}, chalBlob2: {}, chalBlob3: {},
  chalStroke1: {}, chalStroke2: {},

  // Speed Draw card
  speedCard: {
    height: 130,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  speedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  speedContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  speedLeft: { gap: 4 },
  speedTagRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  speedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent },
  speedTagText: { fontSize: 10, fontWeight: "800", color: T.accent, letterSpacing: 1.2, textTransform: "uppercase" },
  speedTitle: { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.5, lineHeight: 26 },
  speedSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2, fontWeight: "500" },
  speedGoBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.accent, alignItems: "center", justifyContent: "center",
  },
  speedGoBtnText: { fontSize: 18, color: "#fff", fontWeight: "900" },

  // Try It On card
  tioCard: {
    borderRadius: 24, overflow: "hidden", height: 170, marginBottom: 24,
    position: "relative", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  tioContent: {
    flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20,
  },
  tioLeft: { flex: 1, gap: 6 },
  tioTagRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tioBadge: { backgroundColor: "#FF2D2D", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tioBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  tioTagText: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
  tioTitle: { color: "#fff", fontSize: 24, fontWeight: "900", lineHeight: 29, letterSpacing: -0.4 },
  tioSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "500" },
  tioGoBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center", alignSelf: "flex-end",
  },
  tioGoBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  // Magazine style grid
  magRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  magRowSmall: { flexDirection: "row", gap: 10, marginBottom: 26 },
  magCardBig: {
    flex: 1.3, height: 220, borderRadius: 20, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  magCardTall: {
    flex: 1, height: 220, borderRadius: 20, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  magCardHalf: {
    flex: 1, height: 150, borderRadius: 20, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  magImg: { flex: 1 },
  magImgStyle: { borderRadius: 20 },
  magGrad: {
    flex: 1, justifyContent: "flex-end", padding: 14, gap: 4,
  },
  magTag: {
    alignSelf: "flex-start", borderRadius: 50,
    paddingHorizontal: 9, paddingVertical: 3,
    marginBottom: 2,
  },
  magTagText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" },
  magLabel: { fontSize: 15, fontWeight: "900", color: "#fff", letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Reel banner — bold editorial (Serafina-inspired)
  reelBanner: {
    borderRadius: 28, overflow: "hidden", marginBottom: 4,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  reelGrad: { borderRadius: 28 },
  // decorative diagonal stripes (film strip vibe)
  reelStripe1: {
    position: "absolute", width: 3, height: "180%", backgroundColor: "rgba(255,255,255,0.03)",
    top: -20, right: 60, transform: [{ rotate: "20deg" }],
  },
  reelStripe2: {
    position: "absolute", width: 3, height: "180%", backgroundColor: "rgba(255,255,255,0.03)",
    top: -20, right: 90, transform: [{ rotate: "20deg" }],
  },
  reelContent: { padding: 24, paddingBottom: 22, gap: 12 },
  reelTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reelBadge: {
    backgroundColor: T.accent, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  reelBadgeText: { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  reelEye: { flex: 1, fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase" },
  reelBig: { fontSize: 36 },
  reelTitle: { fontSize: 34, fontWeight: "900", color: "#fff", lineHeight: 38, letterSpacing: -1 },
  // pill CTA row — like the reference
  reelPillRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  reelPillMain: {
    flex: 1,
    backgroundColor: "#fff", borderRadius: 50,
    paddingVertical: 14, alignItems: "center", justifyContent: "center",
  },
  reelPillMainText: { fontSize: 14, fontWeight: "900", color: "#111", letterSpacing: 0.2 },
  reelPillSec: {
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 50,
    paddingHorizontal: 22, paddingVertical: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  reelPillSecText: { fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.85)" },

  // compat stubs (unused but kept to avoid stale ref errors)
  reelAccent: {},
  reelFooter: {},
  reelBtn: {},
  reelBtnText: {},

  // Try It On card


  // Tabs — art-app hand-drawn style
  tabWaveLine: {
    position: "absolute",
    top: 0, left: 0, right: 0,
  },
  tabs: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row",
    backgroundColor: T.bg,
    borderTopWidth: 0,
    paddingTop: 14,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 10,
  },
  tab: { flex: 1, alignItems: "center", gap: 1, paddingBottom: 2 },
  tabIconWrap: { position: "relative", alignItems: "center", justifyContent: "center", height: 30 },
  tabIcon:      { fontSize: 18, color: T.textMuted },
  tabIconOn:    { color: T.accentDark },
  tabIconScale: { transform: [{ scale: 1.15 }] },
  tabLabel:     { fontSize: 9, color: T.textMuted, fontWeight: "600", letterSpacing: 0.2 },
  tabLabelOn:   { color: T.accentDark, fontWeight: "800" },
  tabSquiggle:  { marginTop: 1 },
  tabBadge: {
    position: "absolute", top: -2, right: -6,
    backgroundColor: T.danger, borderRadius: 5,
    minWidth: 14, height: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 2,
  },
  tabBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },
});
