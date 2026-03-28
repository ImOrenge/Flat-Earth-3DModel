import type { HudState } from "@flat-earth/core-sim";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { palette } from "../theme";
import { StatusChips } from "./StatusChips";

interface WebTopbarProps {
  hud: HudState;
  fpsEstimate: number;
  topInset: number;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

export function WebTopbar({
  hud,
  fpsEstimate,
  topInset,
  onOpenHelp,
  onOpenSettings
}: WebTopbarProps) {
  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingTop: topInset + 10 }]}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.brandCard}>
            <Text style={styles.eyebrow}>3D MODEL</Text>
            <Text style={styles.title}>Flat Earth Disc</Text>
          </View>
          <View style={styles.actionRow}>
            <View style={styles.layoutPill}>
              <Text style={styles.layoutLabel}>HUD</Text>
            </View>
            <Pressable onPress={onOpenHelp} style={styles.actionButton}>
              <Text style={styles.actionText}>Help</Text>
            </Pressable>
            <Pressable onPress={onOpenSettings} style={styles.actionButton}>
              <Text style={styles.actionText}>Settings</Text>
            </Pressable>
          </View>
        </View>
        <StatusChips hud={hud} fpsEstimate={fpsEstimate} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12
  },
  shell: {
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 22,
    backgroundColor: "rgba(7, 12, 24, 0.7)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  brandCard: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 16,
    backgroundColor: palette.topbarBg,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  eyebrow: {
    color: palette.chipLabel,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  layoutPill: {
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 999,
    backgroundColor: palette.topbarBg,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  layoutLabel: {
    color: palette.chipValue,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  actionButton: {
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 999,
    backgroundColor: palette.topbarBg,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  actionText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600"
  }
});
