import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { useEffect, useRef, useState } from "react";
import { GalleryProvider } from "../lib/gallery-context";
import { AlbumsProvider } from "../lib/albums-context";
import { ModesProvider } from "../lib/modes-context";
import SplashAnimated from "../components/SplashAnimated";

const queryClient = new QueryClient();

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    // Defer until navigator is fully mounted
    const t = setTimeout(() => router.replace("/onboarding"), 50);
    return () => clearTimeout(t);
  }, []);

  return <>{children}</>;
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <GalleryProvider>
            <AlbumsProvider>
              <ModesProvider>
                <StatusBar style={splashDone ? "dark" : "light"} />
                <OnboardingGuard>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: "#F2EDE4" },
                      animation: "fade_from_bottom",
                    }}
                  />
                </OnboardingGuard>

                {/* Animated splash overlays everything until done */}
                {!splashDone && (
                  <SplashAnimated onFinish={() => setSplashDone(true)} />
                )}
              </ModesProvider>
            </AlbumsProvider>
          </GalleryProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
