import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Dimensions, TextInput, Modal, Pressable, Animated, Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAlbums } from "../lib/albums-context";
import { useGallery } from "../lib/gallery-context";
import { T } from "../lib/theme";

const { width } = Dimensions.get("window");
const CARD_W  = (width - 48) / 2;
const COVER_H = CARD_W * 1.15;

export default function AlbumsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { albums, createAlbum, deleteAlbum } = useAlbums();
  const { items } = useGallery();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const headerO = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerO, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, []);

  const TAB_H = 60 + insets.bottom;

  const handleCreate = () => {
    if (!newName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const album = createAlbum(newName.trim());
    setNewName("");
    setShowCreate(false);
    router.push(`/album/${album.id}`);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, "This won't delete the images inside.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteAlbum(id) },
    ]);
  };

  const getCover = (itemIds: string[]) => {
    const first = items.find((i) => i.id === itemIds[0]);
    return first?.generatedBase64 ?? null;
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={["#1C1C1E", "#212121"]} style={s.headerBg}>
        <SafeAreaView edges={["top", "left", "right"]}>
          <Animated.View style={[s.header, { opacity: headerO }]}>
            <View>
              <Text style={s.title}>Reels</Text>
              <Text style={s.subtitle}>{albums.length} album{albums.length !== 1 ? "s" : ""}</Text>
            </View>
            <TouchableOpacity
              style={{ borderRadius: 50, overflow: "hidden" }}
              onPress={() => { Haptics.selectionAsync(); setShowCreate(true); }}
            >
              <LinearGradient
                colors={[T.accentDark, T.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.newBtnGrad}
              >
                <Text style={s.newBtnText}>+ New Album</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>

      {/* Empty or grid */}
      {albums.length === 0 ? (
        <View style={[s.empty, { paddingBottom: TAB_H + 16 }]}>
          <View style={s.emptyIconWrap}>
            <Text style={s.emptyIconText}>🗂</Text>
          </View>
          <Text style={s.emptyTitle}>No albums yet</Text>
          <Text style={s.emptySub}>Create an album, add your images,{"\n"}then generate a reel</Text>
          <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.85}>
            <LinearGradient
              colors={[T.accentDark, T.accent]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.emptyBtn}
            >
              <Text style={s.emptyBtnText}>Create Album</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={albums}
          numColumns={2}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[s.grid, { paddingBottom: TAB_H + 16 }]}
          columnWrapperStyle={s.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: album, index }) => {
            const cover = getCover(album.itemIds);
            return (
              <Animated.View
                style={{
                  opacity: headerO,
                  transform: [{
                    translateY: headerO.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
                  }],
                }}
              >
                <TouchableOpacity
                  style={s.card}
                  onPress={() => router.push(`/album/${album.id}`)}
                  onLongPress={() => handleDelete(album.id, album.name)}
                  activeOpacity={0.82}
                >
                  {/* Cover image or placeholder */}
                  <View style={{ height: COVER_H, overflow: "hidden" }}>
                    {cover ? (
                      <>
                        <Image
                          source={{ uri: cover }}
                          style={{ width: "100%", height: COVER_H }}
                          resizeMode="cover"
                        />
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.65)"]}
                          style={StyleSheet.absoluteFill}
                        />
                      </>
                    ) : (
                      <View style={s.coverEmpty}>
                        <View style={s.coverEmptyIcon}>
                          <Text style={{ fontSize: 26 }}>🖼</Text>
                        </View>
                        <Text style={s.coverEmptyLabel}>No images yet</Text>
                      </View>
                    )}
                  </View>

                  {/* Footer */}
                  <View style={s.cardFooter}>
                    <Text style={s.cardName} numberOfLines={1}>{album.name}</Text>
                    <Text style={s.cardCount}>
                      {album.itemIds.length} image{album.itemIds.length !== 1 ? "s" : ""}
                    </Text>
                  </View>

                  {/* Reel badge */}
                  {album.itemIds.length > 0 && (
                    <View style={s.reelBadge}>
                      <LinearGradient
                        colors={[T.accentDark, T.accent]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={s.reelBadgeGrad}
                      >
                        <Text style={s.reelBadgeText}>▶ Reel</Text>
                      </LinearGradient>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}

      {/* Tab bar */}
      <View style={[s.tabBar, { paddingBottom: insets.bottom + 8 }]}>
        {[
          { icon: "⊙", label: "Home",    route: "/",        active: false },
          { icon: "✏",  label: "Draw",    route: "/canvas",  active: false },
          { icon: "⊞",  label: "Gallery", route: "/gallery", active: false },
          { icon: "🎬", label: "Reels",   route: "/albums",  active: true  },
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

      {/* Create album modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={s.modalBg} onPress={() => setShowCreate(false)}>
          <Pressable style={s.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>New Album</Text>
            <Text style={s.modalSub}>Give your collection a name</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Summer Sketches"
              placeholderTextColor={T.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowCreate(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} activeOpacity={0.85} style={{ flex: 1 }}>
                <LinearGradient
                  colors={[T.accentDark, T.accent]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.modalCreate}
                >
                  <Text style={s.modalCreateText}>Create</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  // Header
  headerBg: {},
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
  },
  title:    { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: "rgba(255,255,255,0.38)", fontSize: 12, marginTop: 2 },
  newBtnGrad: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 50 },
  newBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Grid
  grid: { paddingHorizontal: 16, paddingTop: 16 },
  row:  { gap: 12, marginBottom: 14 },

  card: {
    width: CARD_W, borderRadius: 20, overflow: "hidden",
    backgroundColor: T.card,
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  coverEmpty: {
    width: "100%", height: COVER_H,
    backgroundColor: "#EEEAE0",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  coverEmptyIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  coverEmptyLabel: { color: T.textMuted, fontSize: 11, fontWeight: "500" },
  cardFooter: { paddingHorizontal: 12, paddingVertical: 11, gap: 2 },
  cardName:   { color: T.textPrimary, fontSize: 14, fontWeight: "700" },
  cardCount:  { color: T.textMuted, fontSize: 11 },
  reelBadge:  { position: "absolute", top: 8, right: 8, borderRadius: 50, overflow: "hidden" },
  reelBadgeGrad: { paddingHorizontal: 9, paddingVertical: 4 },
  reelBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // Empty state
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 48, gap: 14,
  },
  emptyIconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#EEEAE0",
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emptyIconText: { fontSize: 40 },
  emptyTitle:    { color: T.textPrimary, fontSize: 24, fontWeight: "800", textAlign: "center" },
  emptySub:      { color: T.textSec, fontSize: 15, textAlign: "center", lineHeight: 22 },
  emptyBtn:      { marginTop: 8, borderRadius: 50, paddingHorizontal: 36, paddingVertical: 15 },
  emptyBtnText:  { color: "#fff", fontSize: 15, fontWeight: "700" },

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

  // Modal
  modalBg: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  modalBox: {
    width: "100%", backgroundColor: T.card,
    borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  modalTitle:  { color: T.textPrimary, fontSize: 20, fontWeight: "900", marginBottom: 4 },
  modalSub:    { color: T.textMuted, fontSize: 13, marginBottom: 20 },
  modalInput: {
    backgroundColor: T.bg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    color: T.textPrimary, fontSize: 15,
    borderWidth: 1.5, borderColor: T.border, marginBottom: 16,
  },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 50,
    backgroundColor: T.bg, alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },
  modalCancelText: { color: T.textSec, fontSize: 14, fontWeight: "600" },
  modalCreate:     { borderRadius: 50, paddingVertical: 14, alignItems: "center" },
  modalCreateText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
