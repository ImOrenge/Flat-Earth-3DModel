import type { TimeMode } from "@flat-earth/core-sim";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { palette } from "../theme";

interface ControlBarProps {
  timeMode: TimeMode;
  onToggleMode: () => void;
  onManualBackHour: () => void;
  onManualForwardHour: () => void;
  onSetNow: () => void;
}

function Chip({
  label,
  onPress,
  active = false
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function ControlBar({
  timeMode,
  onToggleMode,
  onManualBackHour,
  onManualForwardHour,
  onSetNow
}: ControlBarProps) {
  const manual = timeMode === "manual";
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Chip label={manual ? "Switch to Live" : "Switch to Manual"} onPress={onToggleMode} active />
        <Chip label="Now" onPress={onSetNow} />
      </View>
      {manual && (
        <View style={styles.row}>
          <Chip label="-1h" onPress={onManualBackHour} />
          <Chip label="+1h" onPress={onManualForwardHour} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 24,
    backgroundColor: palette.panel,
    borderColor: palette.panelBorder,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  chip: {
    backgroundColor: palette.accentMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipActive: {
    backgroundColor: palette.accent
  },
  chipLabel: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600"
  },
  chipLabelActive: {
    color: "#02040a"
  }
});
