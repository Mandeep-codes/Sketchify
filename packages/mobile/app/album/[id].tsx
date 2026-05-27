import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Dimensions, Modal, Pressable, Animated, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAlbums } from "../../lib/albums-context";
import { useGallery, GalleryItem } from "../../lib/gallery-context";
import { T } from "../../lib/theme";

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 48) / 2;
const PICKER_SIZE = (width - 48) / 3;

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { albums, removeFromAlbum, addToAlbum } = useAlbums();
  const { items } = useGallery();

  const album = albums.find((a) => a.id === id);
  const albumItems = album ? items.filter((i) => album.itemIds.includes(i.id)) : [];
  const notInAlbum = items.filter((i) => !album?.itemIds.includes(i.id));

  const [showPicker, setShowPicker] = useState(false);
  const [generatingReel, setGeneratingReel] = useState(false);

  const headerO = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerO, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  if (!album) {
    return (
      <View style={s.container}>
        <SafeAreaView style={s.safe} edges={["top"]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtnStandalone}>
            <Text style={s.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Album not found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handleRemove = (item: GalleryItem) => {
    Alert.alert("Remove from album?", item.style, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeFromAlbum(album.id, item.id) },
    ]);
  };

  const handleCreateReel = async () => {
    if (albumItems.length < 2) {
      Alert.alert("Need more images", "Add at least 2 images to create a reel.");
      return;
    }
    // Store images in memory (not URL params — base64 is too large and freezes the app)
    const { reelStore } = await import("../../lib/reel-store");
    reelStore.set(albumItems.map((i) => i.generatedBase64 ?? i.sketchBase64));
    router.push({
      pathname: "/reel-mode",
      params: {
        albumId: album.id,
        albumName: album.name,
      },
    });
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <Animated.View style={[s.header, { opacity: headerO }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.title} numberOfLines={1}>{album.name}</Text>
            <Text style={s.subtitle}>{albumItems.length} image{albumItems.length !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity style={s.reelBtn} onPress={handleCreateReel} disabled={generatingReel}>
            {generatingReel
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.reelBtnText}>▶ Reel</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        {albumItems.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🖼</Text>
            <Text style={s.emptyTitle}>Empty album</Text>
            <Text style={s.emptySub}>Add images from your gallery to this album</Text>
            {items.length > 0 ? (
              <TouchableOpacity style={s.addBtn} onPress={() => setShowPicker(true)}>
                <Text style={s.addBtnText}>+ Add Images</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.addBtn} onPress={() => router.push("/canvas")}>
                <Text style={s.addBtnText}>Draw something first</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={albumItems}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.grid}
            columnWrapperStyle={s.row}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              notInAlbum.length > 0 ? (
                <TouchableOpacity style={s.addMoreBtn} onPress={() => setShowPicker(true)}>
                  <Text style={s.addMoreText}>+ Add More Images</Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={s.card} onLongPress={() => handleRemove(item)} activeOpacity={0.85}>
                <Image source={{ uri: item.generatedBase64 }} style={s.cardImage} resizeMode="cover" />
                <View style={s.styleBadge}>
                  <Text style={s.styleBadgeText}>{item.style}</Text>
                </View>
                <TouchableOpacity style={s.removeBtn} onPress={() => handleRemove(item)}>
                  <Text style={s.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Tab bar */}
        <View style={s.tabBar}>
          <TouchableOpacity style={s.tabItem} onPress={() => router.push("/")}>
            <Text style={s.tabIcon}>⊙</Text>
            <Text style={s.tabLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tabItem} onPress={() => router.push("/canvas")}>
            <Text style={s.tabIcon}>✏</Text>
            <Text style={s.tabLabel}>Draw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tabItem} onPress={() => router.push("/gallery")}>
            <Text style={s.tabIcon}>⊞</Text>
            <Text style={s.tabLabel}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tabItem} onPress={() => router.push("/albums")}>
            <Text style={[s.tabIcon, s.tabIconActive]}>🎬</Text>
            <Text style={[s.tabLabel, s.tabLabelActive]}>Reels</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Image picker modal */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={s.pickerBg}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPicker(false)} />
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Add to "{album.name}"</Text>
            {notInAlbum.length === 0 ? (
              <Text style={s.pickerEmpty}>All your images are already in this album</Text>
            ) : (
              <FlatList
                data={notInAlbum}
                numColumns={3}
                keyExtractor={(i) => i.id}
                contentContainerStyle={s.pickerGrid}
                columnWrapperStyle={s.pickerRow}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.pickerCard} onPress={() => addToAlbum(album.id, item.id)} activeOpacity={0.75}>
                    <Image source={{ uri: item.generatedBase64 }} style={s.pickerImg} resizeMode="cover" />
                    <View style={s.pickerBadge}>
                      <Text style={s.pickerBadgeText}>{item.style.slice(0, 3)}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={s.pickerDone} onPress={() => setShowPicker(false)}>
              <Text style={s.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
    backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.border, gap: 8,
  },
  backBtn: { padding: 4 },
  backBtnStandalone: { padding: 16 },
  backBtnText: { color: T.textSec, fontSize: 14, fontWeight: "500" },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { color: T.textPrimary, fontSize: 16, fontWeight: "800" },
  subtitle: { color: T.textMuted, fontSize: 11, marginTop: 1 },
  reelBtn: {
    backgroundColor: T.accentDark, borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 7, minWidth: 72, alignItems: "center",
  },
  reelBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  grid: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 130 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    width: CARD_SIZE, height: CARD_SIZE, borderRadius: 18, overflow: "hidden",
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border, ...T.shadow,
  },
  cardImage: { width: "100%", height: "100%" },
  styleBadge: {
    position: "absolute", bottom: 8, left: 8,
    backgroundColor: T.accentDark, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3,
  },
  styleBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  removeBtn: {
    position: "absolute", top: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 50,
    width: 24, height: 24, alignItems: "center", justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  addMoreBtn: {
    marginHorizontal: 16, marginTop: 8, paddingVertical: 14,
    borderRadius: 50, borderWidth: 1, borderColor: T.accent,
    alignItems: "center", backgroundColor: T.accentBg,
  },
  addMoreText: { color: T.accentDark, fontSize: 14, fontWeight: "700" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12, paddingBottom: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 8 },
  emptyTitle: { color: T.textPrimary, fontSize: 20, fontWeight: "700" },
  emptySub: { color: T.textSec, fontSize: 14, textAlign: "center", lineHeight: 21 },
  addBtn: { marginTop: 12, backgroundColor: T.accentDark, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 13 },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  // Tab bar
  tabBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", backgroundColor: T.card,
    borderTopWidth: 1, borderTopColor: T.border,
    paddingBottom: 26, paddingTop: 12, ...T.card_sm,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  tabIcon: { fontSize: 20, color: T.textMuted },
  tabIconActive: { color: T.accentDark },
  tabLabel: { fontSize: 10, color: T.textMuted, fontWeight: "500" },
  tabLabelActive: { color: T.accentDark, fontWeight: "700" },
  // Picker modal
  pickerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 36, maxHeight: "80%",
    borderTopWidth: 1, borderTopColor: T.border,
  },
  pickerHandle: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  pickerTitle: { color: T.textPrimary, fontSize: 15, fontWeight: "800", paddingHorizontal: 20, marginBottom: 12 },
  pickerEmpty: { color: T.textMuted, fontSize: 14, paddingHorizontal: 20, paddingVertical: 20 },
  pickerGrid: { paddingHorizontal: 16, paddingBottom: 8 },
  pickerRow: { gap: 8, marginBottom: 8 },
  pickerCard: { width: PICKER_SIZE, height: PICKER_SIZE, borderRadius: 12, overflow: "hidden", backgroundColor: "#F0EBE1" },
  pickerImg: { width: "100%", height: "100%" },
  pickerBadge: {
    position: "absolute", bottom: 4, left: 4,
    backgroundColor: T.accentDark, borderRadius: 50, paddingHorizontal: 6, paddingVertical: 2,
  },
  pickerBadgeText: { color: "#fff", fontSize: 8, fontWeight: "700" },
  pickerDone: {
    marginHorizontal: 20, marginTop: 12, paddingVertical: 14,
    backgroundColor: T.accentDark, borderRadius: 50, alignItems: "center",
  },
  pickerDoneText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
