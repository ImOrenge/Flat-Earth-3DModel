import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { palette } from "../theme";

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

interface HelpSection {
  title: string;
  body: string;
}

const SECTIONS: HelpSection[] = [
  {
    title: "Overview",
    body: "This viewer runs from offline bundled assets and renders a native 3D Flat Earth disc scene. Mobile MVP prioritizes core simulation, HUD, and gesture flow."
  },
  {
    title: "Astronomy",
    body: "Sun and moon positions are calculated from synchronized time. Use Settings to switch between live and manual modes and inspect time-shifted states."
  },
  {
    title: "Routes",
    body: "Route replay and transport datasets are moved to phase-two backlog in this mobile MVP."
  },
  {
    title: "Constellations",
    body: "Constellation interaction is also phase-two backlog. MVP keeps focus on disc, sun, moon, and time synchronization stability."
  },
  {
    title: "Rockets",
    body: "Rocket simulation panels are out of scope for this first standalone mobile release."
  },
  {
    title: "Navigation & Camera",
    body: "Drag rotates the camera, pinch zooms, and double-tap resets framing. Touches outside interactive HUD controls are routed to scene gestures."
  },
  {
    title: "First Person",
    body: "Walker and first-person modes are deferred. The current MVP provides orbit-camera exploration only."
  }
];

export function HelpModal({ visible, onClose }: HelpModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.layer}>
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Help</Text>
              <Text style={styles.title}>Guide & Controls</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 24
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.backdrop
  },
  panel: {
    borderWidth: 1,
    borderColor: palette.topbarBorder,
    borderRadius: 20,
    backgroundColor: palette.panelStrong,
    maxHeight: "88%",
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: palette.topbarBorder,
    paddingHorizontal: 14,
    paddingVertical: 12
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
    paddingHorizontal: 11,
    paddingVertical: 8
  },
  closeText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600"
  },
  body: {
    gap: 12,
    padding: 14
  },
  section: {
    borderWidth: 1,
    borderColor: "rgba(121, 178, 255, 0.22)",
    borderRadius: 14,
    backgroundColor: "rgba(11, 19, 35, 0.72)",
    padding: 12
  },
  sectionTitle: {
    color: palette.chipValue,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6
  },
  sectionBody: {
    color: palette.subtleText,
    fontSize: 12,
    lineHeight: 18
  }
});
