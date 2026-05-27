import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Pressable, Alert, Animated, ImageBackground, Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useGallery } from "../lib/gallery-context";
import { useAlbums } from "../lib/albums-context";
import { Storage, KEYS } from "../lib/storage";
import { MILESTONES } from "../lib/streaks";
import { T } from "../lib/theme";

const AVATAR_OPTIONS = ["🎨","✏️","🖌️","🦊","🐱","🐶","🌿","⚡","🔥","💎","🌙","👾"];

const STYLES = [
  "Realistic","Anime","Oil Painting","Cyberpunk",
  "Watercolor","Pencil Sketch","Comic Book","Pixel Art","3D Render","Fantasy Art",
];

interface Profile {
  name: string;
  avatarEmoji: string;
  tagline: string;
}

const DEFAULT_PROFILE: Profile = { name: "Artist", avatarEmoji: "🎨", tagline: "Sketching the world" };

const LEVELS = [
  { min: 0,   max: 5,   label: "Beginner",    icon: "🌱", color: "#4CAF50" },
  { min: 5,   max: 20,  label: "Sketcher",    icon: "✏️", color: "#FF9800" },
  { min: 20,  max: 50,  label: "Illustrator", icon: "🖌️", color: "#9C27B0" },
  { min: 50,  max: 100, label: "Artist",      icon: "🎨", color: "#E91E63" },
  { min: 100, max: 999, label: "Master",      icon: "💎", color: "#00BCD4" },
];

function getLevel(count: number) {
  return LEVELS.find((l) => count >= l.min && count < l.max) ?? LEVELS[LEVELS.length - 1];
}
function getLevelProgress(count: number) {
  const lv = getLevel(count);
  if (lv.max === 999) return 1;
  return Math.min((count - lv.min) / (lv.max - lv.min), 1);
}

function getWeekDots(items: { createdAt?: number | string }[]) {
  const days: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toDateString();
    days.push(items.some((it) => it.createdAt && new Date(it.createdAt).toDateString() === day));
  }
  return days;
}

const DAY_LABELS = ["M","T","W","T","F","S","S"];

// Hand-drawn section divider
function InkDivider({ color = "rgba(255,255,255,0.15)" }: { color?: string }) {
  return (
    <Svg height={8} width="100%" viewBox="0 0 320 8" preserveAspectRatio="none" style={{ marginVertical: 2 }}>
      <Path
        d="M0 4 Q20 1 50 4 Q80 7 120 4 Q160 1 200 4 Q240 7 280 4 Q300 2 320 4"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, removeItem } = useGallery();
  const { albums } = useAlbums();

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(24)).current;
  const fadeB  = useRef(new Animated.Value(0)).current;
  const slideB = useRef(new Animated.Value(20)).current;
  const xpAnim = useRef(new Animated.Value(0)).current;
  const avatarPulse = useRef(new Animated.Value(1)).current;

  const [profile, setProfile]           = useState<Profile>(DEFAULT_PROFILE);
  const [editing, setEditing]           = useState(false);
  const [editName, setEditName]         = useState("");
  const [editTagline, setEditTagline]   = useState("");
  const [streak, setStreak]             = useState(0);
  const [bestStreak, setBestStreak]     = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<number[]>([]);
  const [defaultStyle, setDefaultStyle] = useState("Realistic");
  const [showAvatar, setShowAvatar]     = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [xpWidth, setXpWidth]           = useState(0);

  useEffect(() => {
    Animated.stagger(60, [
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideA, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeB,  { toValue: 1, duration: 440, useNativeDriver: true }),
        Animated.timing(slideB, { toValue: 0, duration: 440, useNativeDriver: true }),
      ]),
    ]).start();

    // Avatar subtle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(avatarPulse, { toValue: 1.04, duration: 1600, useNativeDriver: true }),
        Animated.timing(avatarPulse, { toValue: 1.0,  duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    (async () => {
      const [p, s, b, eb, ds] = await Promise.all([
        Storage.get<Profile>(KEYS.PROFILE),
        Storage.get<number>(KEYS.STREAK_COUNT),
        Storage.get<number>(KEYS.STREAK_BEST),
        Storage.get<number[]>(KEYS.BADGES),
        Storage.get<string>(KEYS.DEFAULT_STYLE),
      ]);
      if (p) setProfile(p);
      setStreak(s ?? 0);
      setBestStreak(b ?? 0);
      setEarnedBadges(eb ?? []);
      if (ds) setDefaultStyle(ds);
    })();
  }, []);

  useEffect(() => {
    if (xpWidth === 0) return;
    const progress = getLevelProgress(items.length);
    Animated.timing(xpAnim, {
      toValue: xpWidth * progress,
      duration: 1000,
      delay: 400,
      useNativeDriver: false,
    }).start();
  }, [xpWidth, items.length]);

  const favCount = items.filter((i) => i.isFavorite).length;
  const mostUsed = (() => {
    const freq: Record<string, number> = {};
    items.forEach((i) => { freq[i.style] = (freq[i.style] ?? 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  })();

  const weekDots = getWeekDots(items);
  const level    = getLevel(items.length);
  const nextLevel = LEVELS.find((l) => l.min > level.min) ?? null;
  const toNext   = nextLevel ? nextLevel.min - items.length : 0;

  const startEdit = () => {
    setEditName(profile.name);
    setEditTagline(profile.tagline);
    setEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveEdit = async () => {
    const updated: Profile = { ...profile, name: editName.trim() || "Artist", tagline: editTagline.trim() };
    setProfile(updated);
    await Storage.set(KEYS.PROFILE, updated);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cancelEdit = () => { setEditing(false); Haptics.selectionAsync(); };

  const pickAvatar = async (emoji: string) => {
    const updated: Profile = { ...profile, avatarEmoji: emoji };
    setProfile(updated);
    await Storage.set(KEYS.PROFILE, updated);
    setShowAvatar(false);
    Haptics.selectionAsync();
  };

  const pickStyle = async (style: string) => {
    setDefaultStyle(style);
    await Storage.set(KEYS.DEFAULT_STYLE, style);
    setShowStylePicker(false);
    Haptics.selectionAsync();
  };

  const handleClearGallery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Clear Gallery?",
      `Permanently delete all ${items.length} images. Cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: () => { items.forEach((i) => removeItem(i.id)); } },
      ]
    );
  };

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 20 }]}
      >

        {/* ══════════════════════════════════════
            HERO HEADER — painted canvas texture
        ══════════════════════════════════════ */}
        <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>
          <View style={[s.header, { paddingTop: insets.top + 10 }]}>

            {/* Painted canvas background */}
            <ImageBackground
              source={require("../assets/images/profile-header-bg.png")}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {/* Dark overlay so text is legible */}
            <LinearGradient
              colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.82)"]}
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Top bar */}
            <View style={s.topRow}>
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => { Haptics.selectionAsync(); router.back(); }}
              >
                <Text style={s.backTxt}>←</Text>
              </TouchableOpacity>

              {/* Wobbly "Profile" label */}
              <View style={s.titleWrap}>
                <Svg style={s.titleUnderline} viewBox="0 0 80 6" preserveAspectRatio="none">
                  <Path
                    d="M2 4 Q15 1 30 4 Q50 7 65 3 Q72 1 78 4"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={s.headerTitle}>Profile</Text>
              </View>

              {!editing ? (
                <TouchableOpacity style={s.editPill} onPress={startEdit} activeOpacity={0.75}>
                  <Text style={s.editPillText}>✎ Edit</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 52 }} />
              )}
            </View>

            {/* Avatar + identity */}
            <View style={s.identity}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setShowAvatar(true); }}
                activeOpacity={0.85}
              >
                <Animated.View style={[s.avatarWrap, { transform: [{ scale: avatarPulse }] }]}>
                  {/* Rough sketched ring */}
                  <Svg style={s.avatarRing} viewBox="0 0 92 92">
                    <Circle
                      cx="46" cy="46" r="42"
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth="2.5"
                      fill="none"
                      strokeDasharray="8 5"
                      strokeLinecap="round"
                    />
                  </Svg>
                  <View style={[s.avatarCircle, { borderColor: level.color }]}>
                    <Text style={s.avatarEmoji}>{profile.avatarEmoji}</Text>
                  </View>
                  {/* Level badge */}
                  <View style={[s.avatarLevelBadge, { backgroundColor: level.color }]}>
                    <Text style={s.avatarLevelIcon}>{level.icon}</Text>
                  </View>
                  {/* Edit badge */}
                  <View style={s.avatarEditBadge}>
                    <Text style={s.avatarEditTxt}>✎</Text>
                  </View>
                </Animated.View>
              </TouchableOpacity>

              <View style={s.identityText}>
                {editing ? (
                  <>
                    <TextInput
                      style={s.nameInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Your name"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      maxLength={32}
                      autoFocus
                    />
                    <TextInput
                      style={s.taglineInput}
                      value={editTagline}
                      onChangeText={setEditTagline}
                      placeholder="Short tagline…"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      maxLength={48}
                    />
                    <View style={s.editActions}>
                      <TouchableOpacity style={s.saveBtn} onPress={saveEdit}>
                        <Text style={s.saveBtnText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit}>
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={s.nameText}>{profile.name}</Text>
                    {!!profile.tagline && (
                      <Text style={s.taglineText}>"{profile.tagline}"</Text>
                    )}
                    {/* Level pill — hand-drawn border */}
                    <View style={[s.levelPill, { borderColor: level.color }]}>
                      <Text style={[s.levelPillText, { color: level.color }]}>
                        {level.icon}  {level.label}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Stats row — raw dark chips on canvas */}
            <View style={s.statsRow}>
              {[
                { num: items.length,  label: "Images",    color: "#60A5FA" },
                { num: favCount,      label: "Favorites", color: "#F472B6" },
                { num: streak > 0 ? streak : 0, label: streak > 0 ? "Streak" : "Streak", color: "#FB923C" },
                { num: albums.length, label: "Albums",    color: "#A78BFA" },
              ].map((st, i) => (
                <View key={i} style={s.statChip}>
                  <Text style={[s.statNum, { color: st.color }]}>{st.num}</Text>
                  <Text style={s.statLabel}>{st.label}</Text>
                </View>
              ))}
            </View>

          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeB, transform: [{ translateY: slideB }] }}>

          {/* ══════════════════════════════════════
              THIS WEEK — activity strip
          ══════════════════════════════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>This Week</Text>
              <Text style={s.sectionSub}>{weekDots.filter(Boolean).length}/7 active</Text>
            </View>
            <View style={s.weekStrip}>
              {weekDots.map((active, i) => (
                <View key={i} style={s.weekCol}>
                  <View style={[s.weekDot, active ? s.weekDotOn : s.weekDotOff]}>
                    {active && (
                      <Text style={s.weekDotCheck}>✓</Text>
                    )}
                  </View>
                  <Text style={[s.weekDay, active && s.weekDayOn]}>
                    {DAY_LABELS[(new Date().getDay() + i) % 7]}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ══════════════════════════════════════
              LEVEL / XP
          ══════════════════════════════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Level</Text>
              {nextLevel && <Text style={s.sectionSub}>{toNext} to {nextLevel.label}</Text>}
            </View>

            <View style={s.levelCard}>
              {/* Dark canvas texture strip */}
              <LinearGradient
                colors={["#1a1a1a", "#111"]}
                style={StyleSheet.absoluteFill as any}
              />
              {/* Color accent swipe */}
              <View style={[s.levelAccentSwipe, { backgroundColor: level.color + "22" }]} />

              <View style={s.levelCardInner}>
                <View style={[s.levelIconBox, { backgroundColor: level.color + "30" }]}>
                  <Text style={s.levelIconEmoji}>{level.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={s.levelNameRow}>
                    <Text style={s.levelName}>{level.label}</Text>
                    <View style={[s.levelBadge, { backgroundColor: level.color }]}>
                      <Text style={s.levelBadgeTxt}>Lv {LEVELS.indexOf(level) + 1}</Text>
                    </View>
                  </View>
                  {/* XP bar with rough track */}
                  <View
                    style={s.xpTrack}
                    onLayout={(e) => setXpWidth(e.nativeEvent.layout.width)}
                  >
                    <Animated.View style={[s.xpFill, { width: xpAnim, backgroundColor: level.color }]} />
                    {/* Tick marks */}
                    {[0.25, 0.5, 0.75].map((t) => (
                      <View key={t} style={[s.xpTick, { left: `${t * 100}%` as any }]} />
                    ))}
                  </View>
                  <View style={s.xpLabels}>
                    <Text style={s.xpLeft}>{items.length} images</Text>
                    {nextLevel && <Text style={s.xpRight}>{nextLevel.min} needed</Text>}
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ══════════════════════════════════════
              ACHIEVEMENTS
          ══════════════════════════════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Achievements</Text>
              {bestStreak > 0 && <Text style={s.sectionSub}>Best: {bestStreak}d</Text>}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.badgesRow}>
              {MILESTONES.map((m) => {
                const earned = earnedBadges.includes(m.days);
                return (
                  <View
                    key={m.days}
                    style={[
                      s.badgeCard,
                      earned ? { borderColor: m.color, backgroundColor: m.color + "15" } : s.badgeLocked,
                    ]}
                  >
                    {earned && (
                      <View style={[s.badgeGlow, { backgroundColor: m.color + "25" }]} />
                    )}
                    <Text style={[s.badgeEmoji, !earned && s.badgeEmojiLocked]}>
                      {earned ? m.emoji : "🔒"}
                    </Text>
                    <Text style={[s.badgeLabel, { color: earned ? m.color : T.textMuted }]}>
                      {m.label}
                    </Text>
                    <Text style={s.badgeDays}>{m.days}d</Text>
                    {!earned && streak < m.days && (
                      <View style={s.badgeCountdownPill}>
                        <Text style={s.badgeCountdownTxt}>{m.days - streak}d</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* ══════════════════════════════════════
              YOUR ART — ink-style stat cards
          ══════════════════════════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Your Art</Text>
            <View style={s.artGrid}>

              {/* Top style */}
              <View style={[s.artCard, s.artCardAccent]}>
                <Text style={s.artCardLabel}>TOP STYLE</Text>
                <Text style={s.artCardValue}>{mostUsed}</Text>
                <View style={[s.artCardBar, { backgroundColor: "#60A5FA" }]} />
              </View>

              {/* Total */}
              <View style={[s.artCard, s.artCardPurple]}>
                <Text style={s.artCardLabel}>CREATED</Text>
                <Text style={s.artCardBigNum}>{items.length}</Text>
                <Text style={s.artCardBigSub}>images</Text>
                <View style={[s.artCardBar, { backgroundColor: "#A78BFA" }]} />
              </View>

            </View>

            {/* Albums bar */}
            <View style={s.artCardWide}>
              <View style={[s.artCardBar, { backgroundColor: "#F472B6", width: 4, height: "100%", position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }]} />
              <View style={{ paddingLeft: 12, flex: 1 }}>
                <Text style={s.artCardLabel}>ALBUMS</Text>
                <View style={s.albumRow}>
                  <Text style={s.artCardBigNum}>{albums.length}</Text>
                  <View style={s.albumTrack}>
                    <View style={[s.albumFill, { width: `${Math.min(albums.length / 10, 1) * 100}%` as any }]} />
                    {/* Tick marks on album bar */}
                    {[0.25, 0.5, 0.75].map((t) => (
                      <View key={t} style={[s.albumTick, { left: `${t * 100}%` as any }]} />
                    ))}
                  </View>
                  <Text style={s.albumMax}>/10</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ══════════════════════════════════════
              SETTINGS
          ══════════════════════════════════════ */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Settings</Text>
            <View style={s.settingsCard}>

              <TouchableOpacity
                style={s.settingRow}
                onPress={() => { Haptics.selectionAsync(); setShowStylePicker(true); }}
                activeOpacity={0.7}
              >
                <View style={[s.settingIcon, { backgroundColor: T.accentBg }]}>
                  <Text style={{ fontSize: 28, fontWeight: "900" }}>S</Text>
                </View>
                <Text style={s.settingLabel}>Default Style</Text>
                <View style={s.settingRight}>
                  <View style={s.settingChip}>
                    <Text style={s.settingChipTxt}>{defaultStyle}</Text>
                  </View>
                  <Text style={s.settingChevron}>›</Text>
                </View>
              </TouchableOpacity>

              <InkDivider color={T.border} />

              <TouchableOpacity
                style={s.settingRow}
                onPress={handleClearGallery}
                activeOpacity={0.7}
                disabled={items.length === 0}
              >
                <View style={[s.settingIcon, { backgroundColor: items.length === 0 ? "#F5F5F5" : "#FFEBEB" }]}>
                  <Text>🗑️</Text>
                </View>
                <Text style={[s.settingLabel, { color: items.length === 0 ? T.textMuted : T.danger }]}>
                  Clear Gallery
                </Text>
                <View style={s.settingRight}>
                  <Text style={s.settingCount}>{items.length} images</Text>
                  <Text style={s.settingChevron}>›</Text>
                </View>
              </TouchableOpacity>

            </View>
          </View>

          {/* ══════════════════════════════════════
              CREATIVE SIGN-OFF — ink stamp style
          ══════════════════════════════════════ */}
          <View style={s.signOff}>
            {/* Ink divider line */}
            <Svg height={12} width="100%" viewBox="0 0 320 12" preserveAspectRatio="none" style={{ marginBottom: 18 }}>
              <Path
                d="M0 6 Q20 2 50 6 Q80 10 120 6 Q160 2 200 6 Q240 10 280 6 Q300 3 320 6"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
            {/* Stamp circle */}
            <View style={s.stampWrap}>
              <Svg style={StyleSheet.absoluteFill as any} viewBox="0 0 100 100">
                <Circle
                  cx="50" cy="50" r="44"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
                <Circle
                  cx="50" cy="50" r="36"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                  fill="none"
                />
              </Svg>
              <Text style={s.stampEmoji}>S</Text>
            </View>
            <Text style={s.stampTitle}>SKETCHIFY</Text>
            <Text style={s.stampSub}>v1.0 · keep creating</Text>
          </View>

          <View style={{ height: 120 }} />

        </Animated.View>
      </ScrollView>

      {/* ── AVATAR PICKER ── */}
      <Modal visible={showAvatar} transparent animationType="fade" onRequestClose={() => setShowAvatar(false)}>
        <Pressable style={s.modalBg} onPress={() => setShowAvatar(false)}>
          <Pressable style={s.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Choose Avatar</Text>
            <Text style={s.modalSub}>Tap to pick your icon</Text>
            <View style={s.emojiGrid}>
              {AVATAR_OPTIONS.map((em) => (
                <TouchableOpacity
                  key={em}
                  style={[s.emojiOption, profile.avatarEmoji === em && s.emojiOptionActive]}
                  onPress={() => pickAvatar(em)}
                >
                  <Text style={s.emojiOptionText}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── STYLE PICKER ── */}
      <Modal visible={showStylePicker} transparent animationType="fade" onRequestClose={() => setShowStylePicker(false)}>
        <Pressable style={s.modalBg} onPress={() => setShowStylePicker(false)}>
          <Pressable style={s.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Default Style</Text>
            <Text style={s.modalSub}>Canvas will pre-select this</Text>
            <View style={s.styleList}>
              {STYLES.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[s.styleOption, defaultStyle === st && s.styleOptionActive]}
                  onPress={() => pickStyle(st)}
                >
                  <Text style={[s.styleOptionText, defaultStyle === st && s.styleOptionTextActive]}>{st}</Text>
                  {defaultStyle === st && <Text style={s.styleCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0E0E0E" },
  scroll: { paddingTop: 0 },

  // ── Header ──────────────────────────────────────
  header: {
    minHeight: 300,
    paddingHorizontal: 20,
    paddingBottom: 28,
    overflow: "hidden",
    justifyContent: "space-between",
    gap: 20,
  },

  topRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  backTxt: { fontSize: 18, color: "#fff", fontWeight: "700" },

  titleWrap: { alignItems: "center", position: "relative" },
  titleUnderline: {
    position: "absolute", bottom: -4, left: 0, right: 0,
    width: 80, height: 6,
  },
  headerTitle: {
    fontSize: 17, fontWeight: "900", color: "#fff", letterSpacing: 0.3,
  },

  editPill: {
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  editPillText: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "700" },

  // Avatar
  identity: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  avatarWrap: { width: 90, height: 90, position: "relative", alignItems: "center", justifyContent: "center" },
  avatarRing: { position: "absolute", top: -1, left: -1, width: 92, height: 92 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2.5,
  },
  avatarEmoji: { fontSize: 38 },
  avatarLevelBadge: {
    position: "absolute", top: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#0E0E0E",
  },
  avatarLevelIcon: { fontSize: 11 },
  avatarEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)",
  },
  avatarEditTxt: { fontSize: 10, color: "#fff" },

  identityText: { flex: 1, gap: 5, paddingTop: 4 },
  nameText: { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.6 },
  taglineText: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontStyle: "italic", lineHeight: 18 },
  levelPill: {
    alignSelf: "flex-start",
    borderRadius: 6, borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    marginTop: 2,
  },
  levelPillText: { fontSize: 12, fontWeight: "800" },

  nameInput: {
    fontSize: 20, fontWeight: "800", color: "#fff",
    borderBottomWidth: 1.5, borderBottomColor: T.accent, paddingVertical: 4,
  },
  taglineInput: {
    fontSize: 13, color: "rgba(255,255,255,0.7)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)", paddingVertical: 4,
  },
  editActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  saveBtn: {
    backgroundColor: T.accentDark, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  saveBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  cancelBtn: {
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  cancelBtnText: { fontSize: 13, color: "rgba(255,255,255,0.5)" },

  // Stats row
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
  },
  statChip: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "900" },
  statLabel: {
    fontSize: 9, color: "rgba(255,255,255,0.45)",
    fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 0.4, marginTop: 2,
  },

  // ── Sections ──────────────────────────────────────
  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19, fontWeight: "900", color: "#fff",
    letterSpacing: -0.4,
  },
  sectionSub: { fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: "600" },

  // ── Week strip ────────────────────────────────────
  weekStrip: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#1A1A1A",
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  weekCol: { alignItems: "center", gap: 6 },
  weekDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  weekDotOn: {
    backgroundColor: T.accentDark,
    shadowColor: T.accentDark,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  weekDotOff: {
    backgroundColor: "#2A2A2A",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  weekDotCheck: { fontSize: 14, color: "#fff", fontWeight: "900" },
  weekDay: { fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: "700", textTransform: "uppercase" },
  weekDayOn: { color: T.accentDark },

  // ── Level card ────────────────────────────────────
  levelCard: {
    borderRadius: 20, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  levelAccentSwipe: {
    position: "absolute", top: -30, right: -30,
    width: 140, height: 140, borderRadius: 70,
  },
  levelCardInner: {
    flexDirection: "row", alignItems: "center",
    gap: 16, padding: 20,
  },
  levelIconBox: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  levelIconEmoji: { fontSize: 26 },
  levelNameRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
  },
  levelName: { fontSize: 18, fontWeight: "900", color: "#fff" },
  levelBadge: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  levelBadgeTxt: { fontSize: 10, fontWeight: "900", color: "#fff" },

  xpTrack: {
    height: 6, backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3, overflow: "visible", position: "relative",
    marginTop: 8,
  },
  xpFill: { height: 6, borderRadius: 3 },
  xpTick: {
    position: "absolute", top: -2, width: 1, height: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  xpLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  xpLeft: { fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: "600" },
  xpRight: { fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: "600" },

  // ── Badges ────────────────────────────────────────
  badgesRow: { gap: 10, paddingBottom: 4, paddingRight: 4 },
  badgeCard: {
    alignItems: "center", borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 16,
    borderWidth: 1.5, minWidth: 84,
    position: "relative", overflow: "hidden",
    backgroundColor: "#1A1A1A",
  },
  badgeLocked: {
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#151515",
  },
  badgeGlow: {
    position: "absolute", top: -20, right: -20,
    width: 70, height: 70, borderRadius: 35,
  },
  badgeEmoji: { fontSize: 28, marginBottom: 6, zIndex: 1 },
  badgeEmojiLocked: { opacity: 0.4 },
  badgeLabel: { fontSize: 10, fontWeight: "800", zIndex: 1 },
  badgeDays: { fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 },
  badgeCountdownPill: {
    marginTop: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 50, paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeCountdownTxt: { fontSize: 9, color: T.accentDark, fontWeight: "800" },

  // ── Art stat cards ────────────────────────────────
  artGrid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  artCard: {
    flex: 1, borderRadius: 16,
    padding: 16, backgroundColor: "#1A1A1A",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden", position: "relative",
    minHeight: 100,
  },
  artCardAccent: {},
  artCardPurple: {},
  artCardBar: {
    position: "absolute", top: 0, left: 0, bottom: 0,
    width: 3, borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
  },
  artCardLabel: {
    fontSize: 9, fontWeight: "900", color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 8,
  },
  artCardValue: {
    fontSize: 15, fontWeight: "900", color: "#fff", marginLeft: 8,
  },
  artCardBigNum: {
    fontSize: 30, fontWeight: "900", color: "#fff", marginLeft: 8, lineHeight: 34,
  },
  artCardBigSub: {
    fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 8, marginTop: 2,
  },

  artCardWide: {
    borderRadius: 16, backgroundColor: "#1A1A1A",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    padding: 16, overflow: "hidden",
    flexDirection: "row", alignItems: "center",
    minHeight: 80,
  },
  albumRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  albumTrack: {
    flex: 1, height: 5, backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3, overflow: "visible", position: "relative",
  },
  albumFill: { height: 5, backgroundColor: "#F472B6", borderRadius: 3 },
  albumTick: {
    position: "absolute", top: -2, width: 1, height: 9,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  albumMax: { fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: "700" },

  // ── Settings ──────────────────────────────────────
  settingsCard: {
    backgroundColor: "#1A1A1A", borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  settingLabel: { flex: 1, fontSize: 14, color: "#fff", fontWeight: "600" },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingChip: {
    backgroundColor: T.accentBg, borderRadius: 50,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  settingChipTxt: { fontSize: 11, fontWeight: "700", color: T.accentDark },
  settingChevron: { fontSize: 20, color: "rgba(255,255,255,0.3)" },
  settingCount: { fontSize: 13, color: "rgba(255,255,255,0.35)" },

  // ── Creative sign-off ─────────────────────────────
  signOff: {
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 32,
    paddingBottom: 8,
  },
  stampWrap: {
    width: 90, height: 90,
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  stampEmoji: { fontSize: 36, zIndex: 1 },
  stampTitle: {
    fontSize: 11, fontWeight: "900", color: "rgba(255,255,255,0.22)",
    letterSpacing: 4, textTransform: "uppercase", marginBottom: 4,
  },
  stampSub: {
    fontSize: 10, color: "rgba(255,255,255,0.15)",
    fontWeight: "600", letterSpacing: 1,
  },

  // ── Modals ───────────────────────────────────────
  modalBg: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  modalBox: {
    width: "100%", backgroundColor: "#1E1E1E", borderRadius: 28,
    padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: { fontSize: 19, fontWeight: "900", color: "#fff", marginBottom: 2 },
  modalSub:   { fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 18 },

  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  emojiOption: {
    width: 58, height: 58, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#2A2A2A", borderWidth: 2, borderColor: "transparent",
  },
  emojiOptionActive: { borderColor: T.accentDark, backgroundColor: T.accentBg },
  emojiOptionText: { fontSize: 28 },

  styleList: { gap: 2, marginTop: 4 },
  styleOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  styleOptionActive: {},
  styleOptionText: { fontSize: 15, color: "#fff", fontWeight: "500" },
  styleOptionTextActive: { color: T.accentDark, fontWeight: "800" },
  styleCheck: { fontSize: 16, color: T.accentDark, fontWeight: "700" },
});
