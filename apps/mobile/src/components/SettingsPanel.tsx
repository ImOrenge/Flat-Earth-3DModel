import type { HudState } from "@flat-earth/core-sim";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { palette } from "../theme";

interface SettingsPanelProps {
  visible: boolean;
  hud: HudState;
  topInset: number;
  onClose: () => void;
  onToggleTimeMode: () => void;
  onSetNow: () => void;
  onShiftManualHour: (offsetHours: number) => void;
}

function ToggleRow({
  title,
  value,
  disabled = true
}: {
  title: string;
  value: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={[styles.badge, disabled && styles.badgeDisabled]}>
        <Text style={[styles.badgeText, disabled && styles.badgeTextDisabled]}>{value}</Text>
      </View>
    </View>
  );
}

export function SettingsPanel({
  visible,
  hud,
  topInset,
  onClose,
  onToggleTimeMode,
  onSetNow,
  onShiftManualHour
}: SettingsPanelProps) {
  const isManual = hud.timeMode === "manual";
  const observationLabel = new Date(hud.observationTimeMs).toISOString().replace("T", " ").slice(0, 16);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.layer}>
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View style={[styles.panel, { marginTop: topInset + 78 }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Settings</Text>
              <Text style={styles.title}>App Settings</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonLabel}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Layout</Text>
              <Text style={styles.copy}>Mobile keeps HUD layout only. Classic layout remains web-only in this phase.</Text>
              <View style={styles.modeChip}>
                <Text style={styles.modeChipText}>HUD Mode Active</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Time Sync</Text>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Time Mode</Text>
                <Pressable onPress={onToggleTimeMode} style={styles.ctaButton}>
                  <Text style={styles.ctaLabel}>{isManual ? "Switch to Live" : "Switch to Manual"}</Text>
                </Pressable>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Observation Time</Text>
                <Text style={styles.rowValue}>{observationLabel} UTC</Text>
              </View>
              <View style={styles.inlineActions}>
                <Pressable onPress={() => onShiftManualHour(-1)} disabled={!isManual} style={[styles.ctaButton, !isManual && styles.ctaDisabled]}>
                  <Text style={[styles.ctaLabel, !isManual && styles.ctaLabelDisabled]}>-1h</Text>
                </Pressable>
                <Pressable onPress={onSetNow} style={styles.ctaButton}>
                  <Text style={styles.ctaLabel}>Now</Text>
                </Pressable>
                <Pressable onPress={() => onShiftManualHour(1)} disabled={!isManual} style={[styles.ctaButton, !isManual && styles.ctaDisabled]}>
                  <Text style={[styles.ctaLabel, !isManual && styles.ctaLabelDisabled]}>+1h</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overlay Controls</Text>
              <Text style={styles.copy}>Backlog controls now live in the Detail Sheet tabs (Astronomy, Routes, Constellations, Rockets).</Text>
              <ToggleRow title="Eclipse Controls" value="Enabled" disabled={false} />
              <ToggleRow title="Route Playback" value="Enabled" disabled={false} />
              <ToggleRow title="Rocket Telemetry" value="Enabled" disabled={false} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Privacy & Consent</Text>
              <Text style={styles.copy}>Web-specific privacy and ad scripts are excluded from the standalone mobile MVP.</Text>
              <Pressable disabled style={[styles.ctaButton, styles.ctaDisabled]}>
                <Text style={[styles.ctaLabel, styles.ctaLabelDisabled]}>Web-only action unavailable</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>HUD Status</Text>
              <Text style={styles.copy}>Solar Latitude: {hud.solarLatitudeLabel}</Text>
              <Text style={styles.copy}>Season State: {hud.seasonStateLabel}</Text>
              <Text style={styles.copy}>System: {hud.systemLabel}</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.backdrop
  },
  panel: {
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 20,
    backgroundColor: palette.panelStrong,
    maxHeight: "78%",
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.topbarBorder
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
    fontSize: 18,
    fontWeight: "700",
    marginTop: 3
  },
  closeButton: {
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 999,
    backgroundColor: palette.topbarBg,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  closeButtonLabel: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600"
  },
  body: {
    padding: 14,
    gap: 14
  },
  section: {
    borderWidth: 1,
    borderColor: "rgba(121, 178, 255, 0.2)",
    borderRadius: 16,
    padding: 12,
    gap: 9,
    backgroundColor: "rgba(11, 19, 35, 0.72)"
  },
  sectionTitle: {
    color: palette.chipValue,
    fontSize: 14,
    fontWeight: "700"
  },
  copy: {
    color: palette.subtleText,
    fontSize: 12,
    lineHeight: 18
  },
  modeChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    backgroundColor: palette.topbarBg,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  modeChipText: {
    color: palette.chipValue,
    fontSize: 12,
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  rowTitle: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600",
    flex: 1
  },
  rowValue: {
    color: palette.chipValue,
    fontSize: 12,
    fontWeight: "600"
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8
  },
  ctaButton: {
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 10,
    backgroundColor: palette.topbarBg,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  ctaDisabled: {
    borderColor: "rgba(95, 115, 148, 0.4)",
    backgroundColor: "rgba(40, 50, 72, 0.45)"
  },
  ctaLabel: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600"
  },
  ctaLabelDisabled: {
    color: palette.disabled
  },
  badge: {
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 999,
    backgroundColor: palette.topbarBg,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  badgeDisabled: {
    borderColor: "rgba(95, 115, 148, 0.4)"
  },
  badgeText: {
    color: palette.chipValue,
    fontSize: 11,
    fontWeight: "700"
  },
  badgeTextDisabled: {
    color: palette.disabled
  }
});
