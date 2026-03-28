import type { DetailAction, DetailSnapshot, DetailTab } from "@flat-earth/core-sim";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { palette } from "../theme";

interface DetailSheetProps {
  snapshot: DetailSnapshot;
  bottomInset: number;
  onAction: (action: DetailAction) => void;
}

const TABS: { key: DetailTab; label: string }[] = [
  { key: "astronomy", label: "Astronomy" },
  { key: "routes", label: "Routes" },
  { key: "constellations", label: "Constellations" },
  { key: "rockets", label: "Rockets" }
];

function ActionButton({
  label,
  onPress,
  disabled = false,
  compact = false
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, compact && styles.actionButtonCompact, disabled && styles.actionButtonDisabled]}>
      <Text style={[styles.actionText, disabled && styles.actionTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function LabeledValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function DetailSheet({ snapshot, bottomInset, onAction }: DetailSheetProps) {
  const tab = snapshot.activeTab;
  const eclipse = snapshot.astronomy.eclipse;
  const constellation = snapshot.constellations;
  const route = snapshot.routes;
  const rocket = snapshot.rockets;

  const yearIndex = eclipse.availableYears.findIndex((year) => year === eclipse.selectedYear);
  const prevYear = yearIndex > 0 ? eclipse.availableYears[yearIndex - 1] : null;
  const nextYear = yearIndex >= 0 && yearIndex < eclipse.availableYears.length - 1 ? eclipse.availableYears[yearIndex + 1] : null;
  const prevEvent = eclipse.selectedEventIndex > 0 ? eclipse.eventOptions[eclipse.selectedEventIndex - 1] : null;
  const nextEvent = eclipse.selectedEventIndex >= 0 && eclipse.selectedEventIndex < eclipse.eventOptions.length - 1
    ? eclipse.eventOptions[eclipse.selectedEventIndex + 1]
    : null;

  const prevConstellation = constellation.selectedIndex > 0 ? constellation.options[constellation.selectedIndex - 1] : null;
  const nextConstellation = constellation.selectedIndex >= 0 && constellation.selectedIndex < constellation.options.length - 1
    ? constellation.options[constellation.selectedIndex + 1]
    : null;

  const prevRoute = route.selectedRouteIndex > 0 ? route.routeOptions[route.selectedRouteIndex - 1] : null;
  const nextRoute = route.selectedRouteIndex >= 0 && route.selectedRouteIndex < route.routeOptions.length - 1
    ? route.routeOptions[route.selectedRouteIndex + 1]
    : null;

  const prevSpaceport = rocket.selectedSpaceportIndex > 0 ? rocket.spaceportOptions[rocket.selectedSpaceportIndex - 1] : null;
  const nextSpaceport = rocket.selectedSpaceportIndex >= 0 && rocket.selectedSpaceportIndex < rocket.spaceportOptions.length - 1
    ? rocket.spaceportOptions[rocket.selectedSpaceportIndex + 1]
    : null;

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingBottom: bottomInset + 8 }]}>
      <View style={styles.sheet}>
        <View style={styles.tabRow}>
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onAction({ type: "set_active_tab", tab: item.key })}
              style={[styles.tabButton, tab === item.key && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {tab === "astronomy" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Eclipse</Text>
              <LabeledValue label="Catalog" value={eclipse.sourceLabel} />
              <LabeledValue label="Summary" value={eclipse.summary} />
              <LabeledValue label="Stage" value={`${eclipse.stageLabel} | coverage ${eclipse.coveragePercent}% | light ${eclipse.lightPercent}%`} />
              <LabeledValue label="Selected" value={eclipse.selectedEventLabel} />
              <LabeledValue label="Time (Local)" value={eclipse.selectedEventLocalTimeLabel} />
              <LabeledValue label="Time (UTC)" value={eclipse.selectedEventUtcTimeLabel} />
              <LabeledValue label="Magnitude" value={eclipse.selectedEventMagnitudeLabel} />

              <View style={styles.inlineActions}>
                <ActionButton label="Solar" compact onPress={() => onAction({ type: "eclipse_set_kind", kind: "solar" })} />
                <ActionButton label="Lunar" compact onPress={() => onAction({ type: "eclipse_set_kind", kind: "lunar" })} />
              </View>
              <View style={styles.inlineActions}>
                <ActionButton label="Year -" compact disabled={!prevYear} onPress={() => prevYear && onAction({ type: "eclipse_set_year", year: prevYear })} />
                <ActionButton label={String(eclipse.selectedYear ?? "-")} compact onPress={() => undefined} disabled />
                <ActionButton label="Year +" compact disabled={!nextYear} onPress={() => nextYear && onAction({ type: "eclipse_set_year", year: nextYear })} />
              </View>
              <View style={styles.inlineActions}>
                <ActionButton label="Event -" compact disabled={!prevEvent} onPress={() => prevEvent && onAction({ type: "eclipse_set_event", eventId: prevEvent.id })} />
                <ActionButton label="Event +" compact disabled={!nextEvent} onPress={() => nextEvent && onAction({ type: "eclipse_set_event", eventId: nextEvent.id })} />
                <ActionButton label="Preview" compact disabled={!eclipse.selectedEventId} onPress={() => onAction({ type: "eclipse_preview_selected" })} />
              </View>
              <View style={styles.inlineActions}>
                <ActionButton label="Start" compact onPress={() => onAction({ type: "eclipse_set_timepoint", timePoint: "start" })} />
                <ActionButton label="Peak" compact onPress={() => onAction({ type: "eclipse_set_timepoint", timePoint: "peak" })} />
                <ActionButton label="End" compact onPress={() => onAction({ type: "eclipse_set_timepoint", timePoint: "end" })} />
              </View>
            </View>
          )}

          {tab === "constellations" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Constellations</Text>
              <LabeledValue label="Selected" value={constellation.selectedName ? `${constellation.selectedName} (${constellation.selectedCode})` : "-"} />
              <LabeledValue label="Direction" value={constellation.directionLabel} />
              <LabeledValue label="RA / Dec" value={`${constellation.centerRaLabel} / ${constellation.centerDecLabel}`} />
              <LabeledValue label="Hemisphere" value={constellation.hemisphereLabel} />
              <LabeledValue label="Segments / Stars" value={`${constellation.segmentCount} / ${constellation.starCount}`} />
              <LabeledValue label="Zodiac Age" value={constellation.zodiacSignLabel} />
              <View style={styles.inlineActions}>
                <ActionButton label={constellation.visible ? "Hide Layer" : "Show Layer"} compact onPress={() => onAction({ type: "constellation_toggle_visibility", visible: !constellation.visible })} />
                <ActionButton label={constellation.linesVisible ? "Hide Lines" : "Show Lines"} compact onPress={() => onAction({ type: "constellation_toggle_lines", visible: !constellation.linesVisible })} />
              </View>
              <View style={styles.inlineActions}>
                <ActionButton label="Prev" compact disabled={!prevConstellation} onPress={() => prevConstellation && onAction({ type: "constellation_select", name: prevConstellation.name })} />
                <ActionButton label="Next" compact disabled={!nextConstellation} onPress={() => nextConstellation && onAction({ type: "constellation_select", name: nextConstellation.name })} />
              </View>
            </View>
          )}

          {tab === "routes" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Routes</Text>
              <LabeledValue label="Summary" value={route.summary} />
              <LabeledValue label="Leg" value={route.legLabel} />
              <LabeledValue label="Aircraft" value={route.aircraftLabel} />
              <LabeledValue label="Progress" value={route.routeProgressLabel} />
              <LabeledValue label="Geo" value={route.geoSummaryLabel} />
              <View style={styles.inlineActions}>
                <ActionButton label="Prev Route" compact disabled={!prevRoute} onPress={() => prevRoute && onAction({ type: "routes_select", routeId: prevRoute.id })} />
                <ActionButton label="Next Route" compact disabled={!nextRoute} onPress={() => nextRoute && onAction({ type: "routes_select", routeId: nextRoute.id })} />
              </View>
              <View style={styles.inlineActions}>
                <ActionButton label="Speed -" compact onPress={() => onAction({ type: "routes_set_speed", speedMultiplier: route.speedMultiplier - 1 })} />
                <ActionButton label={`x${route.speedMultiplier.toFixed(0)}`} compact disabled onPress={() => undefined} />
                <ActionButton label="Speed +" compact onPress={() => onAction({ type: "routes_set_speed", speedMultiplier: route.speedMultiplier + 1 })} />
              </View>
              <View style={styles.inlineActions}>
                <ActionButton label={route.playing ? "Pause" : "Play"} compact onPress={() => onAction({ type: "routes_toggle_playback" })} />
                <ActionButton label="Reset" compact onPress={() => onAction({ type: "routes_reset" })} />
              </View>
            </View>
          )}

          {tab === "rockets" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rockets</Text>
              <LabeledValue label="Backend" value={rocket.backend} />
              <LabeledValue label="Phase" value={`${rocket.telemetry.phase} | ${rocket.telemetry.statusLabel}`} />
              <LabeledValue label="Telemetry" value={`t+${rocket.telemetry.elapsedSeconds.toFixed(1)}s | ${rocket.telemetry.altitudeKm.toFixed(1)}km | ${rocket.telemetry.speedKps.toFixed(2)}km/s`} />
              <LabeledValue label="Downrange" value={`${rocket.telemetry.downrangeKm.toFixed(1)} km`} />
              <View style={styles.inlineActions}>
                <ActionButton label="Prev Port" compact disabled={!prevSpaceport} onPress={() => prevSpaceport && onAction({ type: "rockets_select_spaceport", spaceportId: prevSpaceport.id })} />
                <ActionButton label="Next Port" compact disabled={!nextSpaceport} onPress={() => nextSpaceport && onAction({ type: "rockets_select_spaceport", spaceportId: nextSpaceport.id })} />
              </View>
              <View style={styles.inlineActions}>
                <ActionButton label="2-stage" compact onPress={() => onAction({ type: "rockets_select_type", rocketType: "two-stage" })} />
                <ActionButton label="Single" compact onPress={() => onAction({ type: "rockets_select_type", rocketType: "single" })} />
              </View>
              <View style={styles.inlineActions}>
                <ActionButton label="Launch" compact disabled={!rocket.canLaunch} onPress={() => onAction({ type: "rockets_launch" })} />
                <ActionButton label="Reset" compact onPress={() => onAction({ type: "rockets_reset" })} />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 0
  },
  sheet: {
    borderWidth: 1,
    borderColor: palette.panelBorder,
    borderRadius: 16,
    backgroundColor: "rgba(6, 10, 20, 0.88)",
    overflow: "hidden",
    maxHeight: "46%"
  },
  tabRow: {
    flexDirection: "row",
    padding: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(121, 178, 255, 0.22)"
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(121, 178, 255, 0.32)",
    backgroundColor: "rgba(11, 19, 35, 0.6)",
    paddingVertical: 7
  },
  tabButtonActive: {
    backgroundColor: "rgba(35, 75, 130, 0.72)"
  },
  tabLabel: {
    textAlign: "center",
    color: palette.subtleText,
    fontSize: 11,
    fontWeight: "700"
  },
  tabLabelActive: {
    color: palette.text
  },
  body: {
    padding: 10,
    gap: 8
  },
  section: {
    borderWidth: 1,
    borderColor: "rgba(121, 178, 255, 0.2)",
    borderRadius: 12,
    backgroundColor: "rgba(10, 18, 33, 0.72)",
    padding: 10,
    gap: 7
  },
  sectionTitle: {
    color: palette.chipValue,
    fontSize: 13,
    fontWeight: "700"
  },
  field: {
    gap: 2
  },
  fieldLabel: {
    color: palette.chipLabel,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  fieldValue: {
    color: palette.text,
    fontSize: 12,
    lineHeight: 16
  },
  inlineActions: {
    flexDirection: "row",
    gap: 6
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "rgba(121, 178, 255, 0.34)",
    borderRadius: 9,
    backgroundColor: "rgba(16, 30, 53, 0.72)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  actionButtonCompact: {
    paddingVertical: 6
  },
  actionButtonDisabled: {
    opacity: 0.45
  },
  actionText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: "700"
  },
  actionTextDisabled: {
    color: palette.disabled
  }
});
