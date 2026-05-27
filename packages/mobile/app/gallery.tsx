import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Dimensions, Modal, Pressable, Animated, TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useGallery, GalleryItem } from "../lib/gallery-context";
import { useAlbums } from "../lib/albums-context";
import { T } from "../lib/theme";

const { width } = Dimensions.get("window");
const PAD  = 14;
const GAP  = 10;
const CARD_W = (width - PAD * 2 - GAP) / 2;
// Staggered heights for masonry feel
const HEIGHTS = [CARD_W * 1.1, CARD_W * 0.9, CARD_W * 1.0, CARD_W * 1.2, CARD_W * 0.85, CARD_W * 1.05];

type FilterTab = "All" | "Favorites";

// ─── Gallery Card ─────────────────────────────────────────────────────────────
function GalleryCard({ item, onPress, onHeart, isFavorite, index }: {
  item: GalleryItem; onPress: () => void; onHeart: () => void; isFavorite: boolean; index: number;
}) {
  const scale   = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const heartS  = useRef(new Animated.Value(1)).current;
  const cardH   = HEIGHTS[index % HEIGHTS.length];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: index * 45, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, delay: index * 45, useNativeDriver: true, tension: 100, friction: 8 }),
    ]).start();
  }, []);

  const handleHeart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(heartS, { toValue: 1.5, useNativeDriver: true, tension: 240, friction: 5 }),
      Animated.spring(heartS, { toValue: 1,   useNativeDriver: true, tension: 240, friction: 5 }),
    ]).start();
    onHeart();
  };

  return (
    <Animated.View style={{ opacity, transform: [{ scale }], width: CARD_W, height: cardH }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[s.card, { height: cardH }]}>
        <Image source={{ uri: item.generatedBase64 }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={s.cardGrad} />

        <View style={s.styleBadge}>
          <Text style={s.styleBadgeText}>{item.style}</Text>
        </View>

        <View style={s.sketchThumb}>
          <Image source={{ uri: item.sketchBase64 }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </View>

        {/* Remix badge */}
        {item.remixes && item.remixes.length > 0 && (
          <View style={s.remixBadge}>
            <Text style={s.remixBadgeText}>⇄ {item.remixes.length + 1}</Text>
          </View>
        )}

        <TouchableOpacity style={s.heartBtn} onPress={handleHeart} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Animated.Text style={[s.heartIcon, isFavorite && s.heartActive, { transform: [{ scale: heartS }] }]}>
            {isFavorite ? "♥" : "♡"}
          </Animated.Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, removeItem, isFavorite, toggleFavorite } = useGallery();
  const { albums, createAlbum, addToAlbum } = useAlbums();

  const [tab, setTab]             = useState<FilterTab>("All");
  const [expanded, setExpanded]   = useState<GalleryItem | null>(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [albumTarget, setAlbumTarget]         = useState<GalleryItem | null>(null);
  const [newAlbumName, setNewAlbumName]       = useState("");
  const [showNewAlbum, setShowNewAlbum]       = useState(false);

  const headerO  = useRef(new Animated.Value(0)).current;
  const modalS   = useRef(new Animated.Value(0.9)).current;
  const modalO   = useRef(new Animated.Value(0)).current;
  const emptyO   = useRef(new Animated.Value(0)).current;
  const emptyY   = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.timing(headerO, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, []);

  const displayItems = tab === "Favorites" ? items.filter((i) => isFavorite(i.id)) : items;

  useEffect(() => {
    if (displayItems.length === 0) {
      emptyO.setValue(0); emptyY.setValue(20);
      Animated.parallel([
        Animated.timing(emptyO, { toValue: 1, duration: 420, delay: 100, useNativeDriver: true }),
        Animated.timing(emptyY, { toValue: 0, duration: 420, delay: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [displayItems.length]);

  useEffect(() => {
    if (expanded) {
      modalS.setValue(0.9); modalO.setValue(0);
      Animated.parallel([
        Animated.timing(modalO, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(modalS, { toValue: 1, useNativeDriver: true, tension: 90, friction: 8 }),
      ]).start();
    }
  }, [expanded]);

  const TAB_H = 60 + insets.bottom;

  const handlePickAlbum = (albumId: string) => {
    if (albumTarget) addToAlbum(albumId, albumTarget.id);
    setShowAlbumPicker(false); setAlbumTarget(null);
    Haptics.selectionAsync();
  };

  const handleCreateAndAdd = () => {
    if (!newAlbumName.trim() || !albumTarget) return;
    const album = createAlbum(newAlbumName);
    addToAlbum(album.id, albumTarget.id);
    setNewAlbumName(""); setShowNewAlbum(false);
    setShowAlbumPicker(false); setAlbumTarget(null);
    Haptics.selectionAsync();
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={["#1C1C1E", "#212121"]} style={s.headerBg}>
        <SafeAreaView edges={["top", "left", "right"]}>
          <Animated.View style={{ opacity: headerO }}>
            {/* Title row */}
            <View style={s.titleRow}>
              <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                <Text style={s.backArrow}>‹</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, paddingLeft: 4 }}>
                <Text style={s.title}>Gallery</Text>
                <Text style={s.subtitle}>{items.length} creation{items.length !== 1 ? "s" : ""}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/canvas")} style={{ borderRadius: 50, overflow: "hidden" }}>
                <LinearGradient colors={[T.accentDark, T.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.newBtnGrad}>
                  <Text style={s.newBtnText}>+ New</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Filter tabs */}
            <View style={s.tabsRow}>
              {(["All", "Favorites"] as FilterTab[]).map((t) => {
                const count = t === "All" ? items.length : items.filter((i) => isFavorite(i.id)).length;
                const isActive = tab === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[s.tabPill, isActive && s.tabPillActive]}
                    onPress={() => { Haptics.selectionAsync(); setTab(t); }}
                  >
                    {t === "Favorites" && (
                      <Text style={[s.tabHeart, isActive && s.tabHeartActive]}>♥ </Text>
                    )}
                    <Text style={[s.tabPillText, isActive && s.tabPillTextActive]}>{t}</Text>
                    <View style={[s.tabCount, isActive && s.tabCountActive]}>
                      <Text style={[s.tabCountText, isActive && s.tabCountTextActive]}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>

      {/* Grid or Empty */}
      {displayItems.length === 0 ? (
        <Animated.View style={[s.empty, { opacity: emptyO, transform: [{ translateY: emptyY }] }]}>
          <Text style={s.emptyIcon}>{tab === "Favorites" ? "♥" : "🎨"}</Text>
          <Text style={s.emptyTitle}>
            {tab === "Favorites" ? "No favorites yet" : "Nothing here yet"}
          </Text>
          <Text style={s.emptySub}>
            {tab === "Favorites"
              ? "Tap the heart on any image to save it here"
              : "Draw something and generate your first image"}
          </Text>
          {tab === "All" && (
            <TouchableOpacity onPress={() => router.push("/canvas")} activeOpacity={0.85}>
              <LinearGradient colors={[T.accentDark, T.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
                <Text style={s.emptyBtnText}>Start Drawing</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        <FlatList
          data={displayItems}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.grid, { paddingBottom: TAB_H + 16 }]}
          columnWrapperStyle={s.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <GalleryCard
              item={item} index={index}
              isFavorite={isFavorite(item.id)}
              onPress={() => setExpanded(item)}
              onHeart={() => toggleFavorite(item.id)}
            />
          )}
        />
      )}

      {/* Tab bar */}
      <View style={[s.tabBar, { paddingBottom: insets.bottom + 8 }]}>
        {[
          { icon: "⊙", label: "Home",    route: "/",        active: false },
          { icon: "✏",  label: "Draw",    route: "/canvas",  active: false },
          { icon: "⊞",  label: "Gallery", route: "/gallery", active: true  },
          { icon: "🎬", label: "Reels",   route: "/albums",  active: false },
          { icon: "👤", label: "Profile", route: "/profile", active: false },
        ].map((t) => (
          <TouchableOpacity
            key={t.label} style={s.tabItem}
            onPress={() => { Haptics.selectionAsync(); router.push(t.route as any); }}
          >
            <Text style={t.active ? s.tabIconActive : s.tabIcon}>{t.icon}</Text>
            <Text style={t.active ? s.tabLabelActive : s.tabLabel}>{t.label}</Text>
            {t.active && <View style={s.tabDot} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Expanded modal */}
      <Modal visible={!!expanded} transparent animationType="fade" onRequestClose={() => setExpanded(null)}>
        <View style={s.modalBg}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExpanded(null)} />
          {expanded && (
            <Animated.View style={[s.modalCard, { opacity: modalO, transform: [{ scale: modalS }] }]}>
              {/* Image */}
              <View>
                <Image source={{ uri: expanded.generatedBase64 }} style={s.modalImage} resizeMode="cover" />
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={s.modalImgGrad} />

                <TouchableOpacity style={s.modalCloseBtn} onPress={() => setExpanded(null)}>
                  <Text style={s.modalCloseTxt}>✕</Text>
                </TouchableOpacity>

                <View style={s.modalImgFooter}>
                  <View style={s.modalBadge}>
                    <Text style={s.modalBadgeText}>{expanded.style}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { toggleFavorite(expanded.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={s.modalHeartBtn}
                  >
                    <Text style={[s.modalHeartIcon, isFavorite(expanded.id) && s.modalHeartActive]}>
                      {isFavorite(expanded.id) ? "♥" : "♡"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Footer */}
              <View style={s.modalFooter}>
                <View style={s.modalSketchRow}>
                  <Image source={{ uri: expanded.sketchBase64 }} style={s.modalSketch} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalSketchLabel}>Original Sketch</Text>
                    <Text style={s.modalSketchSub}>Style: {expanded.style}</Text>
                  </View>
                </View>
                <View style={s.modalActionsRow}>
                  <TouchableOpacity
                    onPress={() => { setAlbumTarget(expanded); setShowAlbumPicker(true); }}
                    style={s.modalAddBtn}
                  >
                    <Text style={s.modalAddBtnText}>+ Add to Album</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { removeItem(expanded.id); setExpanded(null); }}
                    style={s.modalDeleteBtn}
                  >
                    <Text style={s.modalDeleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </Modal>

      {/* Album picker */}
      <Modal visible={showAlbumPicker} transparent animationType="slide" onRequestClose={() => setShowAlbumPicker(false)}>
        <View style={s.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAlbumPicker(false)} />
          <View style={[s.pickerSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Add to Album</Text>
            {showNewAlbum ? (
              <View style={s.newAlbumRow}>
                <TextInput
                  style={s.newAlbumInput}
                  placeholder="Album name…"
                  placeholderTextColor={T.textMuted}
                  value={newAlbumName}
                  onChangeText={setNewAlbumName}
                  autoFocus returnKeyType="done"
                  onSubmitEditing={handleCreateAndAdd}
                />
                <TouchableOpacity style={s.newAlbumConfirm} onPress={handleCreateAndAdd}>
                  <Text style={s.newAlbumConfirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.newAlbumBtnRow} onPress={() => setShowNewAlbum(true)}>
                <Text style={s.newAlbumBtnRowText}>+ New Album</Text>
              </TouchableOpacity>
            )}
            {albums.map((album) => (
              <TouchableOpacity key={album.id} style={s.albumRow} onPress={() => handlePickAlbum(album.id)}>
                <Text style={s.albumRowName}>{album.name}</Text>
                <Text style={s.albumRowCount}>{album.itemIds.length} images</Text>
              </TouchableOpacity>
            ))}
            {albums.length === 0 && !showNewAlbum && (
              <Text style={s.pickerEmpty}>No albums yet — create one above</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  // Header
  headerBg: {},
  titleRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
  },
  backBtn:  { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  backArrow:{ color: "#fff", fontSize: 32, fontWeight: "300", lineHeight: 36, marginTop: -2 },
  title:    { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "500" },
  newBtnGrad: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50 },
  newBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  tabsRow: {
    flexDirection: "row", paddingHorizontal: 16,
    paddingBottom: 14, gap: 8,
  },
  tabPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  tabPillActive: { backgroundColor: T.accentDark, borderColor: T.accentDark },
  tabHeart:      { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  tabHeartActive:{ color: "#fff" },
  tabPillText:   { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  tabPillTextActive: { color: "#fff" },
  tabCount: {
    marginLeft: 6, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 50, paddingHorizontal: 7, paddingVertical: 2,
  },
  tabCountActive:  { backgroundColor: "rgba(255,255,255,0.25)" },
  tabCountText:    { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "700" },
  tabCountTextActive: { color: "#fff" },

  // Grid
  grid: { paddingHorizontal: PAD, paddingTop: 12 },
  row:  { gap: GAP, marginBottom: GAP, alignItems: "flex-start" },

  card: { width: CARD_W, borderRadius: 18, overflow: "hidden", backgroundColor: "#1C1C1E" },
  cardGrad: { position: "absolute", bottom: 0, left: 0, right: 0, height: CARD_W * 0.55 },
  styleBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "rgba(0,0,0,0.58)", borderRadius: 50,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  styleBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  remixBadge: {
    position: "absolute", bottom: 8, right: 36,
    backgroundColor: "rgba(92,122,30,0.85)", borderRadius: 50,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  remixBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  sketchThumb: {
    position: "absolute", bottom: 8, left: 8,
    width: 34, height: 34, borderRadius: 8, overflow: "hidden",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "#F8F4EE",
  },
  heartBtn: {
    position: "absolute", bottom: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  heartIcon:   { fontSize: 14, color: "rgba(255,255,255,0.65)" },
  heartActive: { color: "#FF4F4F" },

  // Empty
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 48, gap: 12,
  },
  emptyIcon:  { fontSize: 60, marginBottom: 8 },
  emptyTitle: { color: T.textPrimary, fontSize: 22, fontWeight: "800", textAlign: "center" },
  emptySub:   { color: T.textSec, fontSize: 14, textAlign: "center", lineHeight: 22 },
  emptyBtn:   { marginTop: 16, borderRadius: 50, paddingHorizontal: 36, paddingVertical: 15 },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Tab bar
  tabBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", backgroundColor: T.card,
    borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 }, elevation: 10,
  },
  tabItem:       { flex: 1, alignItems: "center", gap: 3 },
  tabIcon:       { fontSize: 20, color: T.textMuted },
  tabIconActive: { fontSize: 20, color: T.accentDark },
  tabLabel:      { fontSize: 10, color: T.textMuted, fontWeight: "500" },
  tabLabelActive:{ fontSize: 10, color: T.accentDark, fontWeight: "700" },
  tabDot:        { width: 4, height: 4, borderRadius: 2, backgroundColor: T.accentDark, marginTop: 1 },

  // Expanded modal
  modalBg: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  modalCard: {
    width: "100%", backgroundColor: "#1C1C1E",
    borderRadius: 24, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  modalImage:   { width: "100%", aspectRatio: 1 },
  modalImgGrad: { position: "absolute", bottom: 0, left: 0, right: 0, height: 80 },
  modalCloseBtn: {
    position: "absolute", top: 12, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  modalCloseTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  modalImgFooter: {
    position: "absolute", bottom: 12, left: 12, right: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  modalBadge: {
    backgroundColor: "rgba(92,122,30,0.85)", borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  modalBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  modalHeartBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  modalHeartIcon:   { fontSize: 18, color: "rgba(255,255,255,0.55)" },
  modalHeartActive: { color: "#FF4F4F" },
  modalFooter:   { padding: 16, gap: 14 },
  modalSketchRow:{ flexDirection: "row", alignItems: "center", gap: 12 },
  modalSketch: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: "#F8F4EE",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  modalSketchLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  modalSketchSub:   { color: "rgba(255,255,255,0.38)", fontSize: 12, marginTop: 2 },
  modalActionsRow:  { flexDirection: "row", gap: 10 },
  modalAddBtn: {
    flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 14,
    backgroundColor: "rgba(92,122,30,0.18)",
    borderWidth: 1, borderColor: "rgba(92,122,30,0.45)",
  },
  modalAddBtnText:  { color: T.accent, fontSize: 13, fontWeight: "700" },
  modalDeleteBtn: {
    width: 46, paddingVertical: 12, alignItems: "center", borderRadius: 14,
    backgroundColor: "rgba(232,64,64,0.1)",
    borderWidth: 1, borderColor: "rgba(232,64,64,0.22)",
  },
  modalDeleteBtnText: { fontSize: 16 },

  // Album picker
  pickerOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  pickerSheet: {
    backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20, maxHeight: "60%",
  },
  pickerHandle: {
    width: 40, height: 4, backgroundColor: T.border,
    borderRadius: 2, alignSelf: "center", marginBottom: 18,
  },
  pickerTitle: { color: T.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 14 },
  pickerEmpty: { color: T.textMuted, fontSize: 13, paddingVertical: 18, textAlign: "center" },
  newAlbumBtnRow: {
    marginBottom: 12, paddingVertical: 13, borderRadius: 50,
    borderWidth: 1, borderColor: T.accent, alignItems: "center",
    backgroundColor: T.accentBg,
  },
  newAlbumBtnRowText: { color: T.accentDark, fontSize: 14, fontWeight: "700" },
  newAlbumRow:    { flexDirection: "row", gap: 8, marginBottom: 12 },
  newAlbumInput: {
    flex: 1, backgroundColor: T.bg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: T.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: T.border,
  },
  newAlbumConfirm: {
    backgroundColor: T.accentDark, borderRadius: 12,
    paddingHorizontal: 18, justifyContent: "center",
  },
  newAlbumConfirmText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  albumRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: T.border,
  },
  albumRowName:  { color: T.textPrimary, fontSize: 14, fontWeight: "600" },
  albumRowCount: { color: T.textMuted, fontSize: 12 },
});
