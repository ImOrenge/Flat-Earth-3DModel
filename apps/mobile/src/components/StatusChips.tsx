import type { HudState } from "@flat-earth/core-sim";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "../theme";

interface StatusChipsProps {
  hud: HudState;
  fpsEstimate: number;
}

interface ChipItem {
  label: string;
  value: string;
}

export function StatusChips({ hud, fpsEstimate }: StatusChipsProps) {
  const chips: ChipItem[] = [
    { label: "Solar Latitude", value: hud.solarLatitudeLabel },
    { label: "Season State", value: hud.seasonStateLabel },
    { label: "Time", value: hud.timeLabel },
    { label: "System", value: hud.systemLabel },
    { label: "Performance", value: `${Math.round(fpsEstimate)} FPS | ${hud.qualityLevel.toUpperCase()}` }
  ];

  return (
    <View style={styles.wrap}>
      {chips.map((chip) => (
        <View key={chip.label} style={styles.chip}>
          <Text style={styles.label}>{chip.label}</Text>
          <Text numberOfLines={1} style={styles.value}>{chip.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    minWidth: 132,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    backgroundColor: palette.topbarBg
  },
  label: {
    color: palette.chipLabel,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  value: {
    color: palette.chipValue,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4
  }
});
