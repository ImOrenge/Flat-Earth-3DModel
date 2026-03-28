import type { HudState } from "@flat-earth/core-sim";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "../theme";

interface HudOverlayProps {
  hud: HudState;
  fpsEstimate: number;
}

export function HudOverlay({ hud, fpsEstimate }: HudOverlayProps) {
  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Flat Earth Model</Text>
        <Text style={styles.value}>Time: {hud.timeLabel}</Text>
        <Text style={styles.value}>Solar Latitude: {hud.solarLatitudeLabel}</Text>
        <Text style={styles.value}>System: {hud.systemLabel}</Text>
        <Text style={styles.meta}>
          Mode {hud.timeMode.toUpperCase()} | Quality {hud.qualityLevel.toUpperCase()} | {Math.round(fpsEstimate)} FPS
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 22,
    left: 14,
    right: 14
  },
  card: {
    backgroundColor: palette.panel,
    borderColor: palette.panelBorder,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  value: {
    color: palette.text,
    fontSize: 12,
    marginTop: 2
  },
  meta: {
    color: palette.subtleText,
    fontSize: 11,
    marginTop: 8
  }
});
