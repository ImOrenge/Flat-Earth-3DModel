import contextlib
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect


REPO_ROOT = Path(__file__).resolve().parent


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture(scope="session")
def server_url() -> str:
    port = _find_free_port()
    process = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 10

    try:
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1):
                    yield f"http://127.0.0.1:{port}/"
                    return
            except Exception:
                time.sleep(0.1)
        raise RuntimeError("Timed out waiting for the local test server to start.")
    finally:
        if process.poll() is None:
            process.terminate()
            with contextlib.suppress(Exception):
                process.wait(timeout=5)


def open_eclipse_panel(page: Page, server_url: str) -> None:
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")
    page.locator("[data-hud-panel-tab='eclipse']").click()
    expect(page.locator("#eclipse-catalog-source")).to_be_visible()


def upload_csv_via_dom(page: Page, file_name: str, csv_text: str) -> None:
    page.evaluate(
        """
        async ({ fileName, csvText }) => {
          const input = document.getElementById('eclipse-catalog-upload');
          const dt = new DataTransfer();
          dt.items.add(new File([csvText], fileName, { type: 'text/csv' }));
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        """,
        {"fileName": file_name, "csvText": csv_text},
    )


def set_range_value(page: Page, selector: str, value: float) -> None:
    page.eval_on_selector(
        selector,
        """(el, nextValue) => {
          el.value = String(nextValue);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }""",
        value,
    )


def set_checkbox_value(page: Page, selector: str, checked: bool) -> None:
    page.eval_on_selector(
        selector,
        """(el, nextChecked) => {
          el.checked = Boolean(nextChecked);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }""",
        checked,
    )


def wrapped_delta(a: float, b: float) -> float:
    import math

    return math.atan2(math.sin(b - a), math.cos(b - a))


def test_builtin_solar_eclipse_selection_updates_observation_time(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)

    page.locator("#eclipse-kind-select").select_option("solar")
    page.locator("#eclipse-year-select").select_option("2026")
    page.locator("#eclipse-event-select").select_option("SE-2026Aug12T")

    expect(page.locator("#observation-time")).to_have_value("2026-08-13T02:47")
    assert page.locator("#reality-sync").is_checked()
    assert not page.locator("#reality-live").is_checked()
    expect(page.locator("#selected-eclipse-source")).to_have_text("SE-2026Aug12T")


def test_builtin_lunar_timepoints_update_preview(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)

    page.locator("#eclipse-kind-select").select_option("lunar")
    page.locator("#eclipse-year-select").select_option("2026")
    page.locator("#eclipse-event-select").select_option("LE-09708")

    page.locator("#eclipse-timepoint-select").select_option("start")
    start_value = page.locator("#observation-time").input_value()

    page.locator("#eclipse-timepoint-select").select_option("end")
    end_value = page.locator("#observation-time").input_value()

    page.locator("#eclipse-timepoint-select").select_option("peak")
    peak_value = page.locator("#observation-time").input_value()

    assert start_value == "2026-03-03T17:45"
    assert peak_value == "2026-03-03T20:34"
    assert end_value == "2026-03-03T23:24"
    assert len({start_value, peak_value, end_value}) == 3
    assert page.locator("#reality-sync").is_checked()
    assert not page.locator("#reality-live").is_checked()
    page.wait_for_function(
        "() => Boolean(window.__E2E_SNAPSHOT?.activeLunarEclipseData)"
    )
    snapshot = page.evaluate("window.__E2E_SNAPSHOT")
    assert snapshot["activeLunarEclipseData"]["visibleInView"] is True


def test_selected_lunar_event_stays_non_idle_on_start_peak_end(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)

    page.locator("#eclipse-kind-select").select_option("lunar")
    page.locator("#eclipse-year-select").select_option("2026")
    page.locator("#eclipse-event-select").select_option("LE-09708")

    for timepoint in ("start", "peak", "end"):
        page.locator("#eclipse-timepoint-select").select_option(timepoint)
        page.wait_for_function(
            "() => Boolean(window.__E2E_SNAPSHOT?.activeLunarEclipseData?.selectedLunarEventId)"
        )
        state = page.evaluate("window.__E2E_SNAPSHOT?.activeLunarEclipseData ?? null")
        assert state is not None
        assert state["selectedLunarEventId"] == "LE-09708"
        assert state["activeLunarEventId"] == "LE-09708"
        assert state["catalogStrictMode"] is True
        assert state["stageKey"] != "idle"
        assert state["lunarGateReason"] in ("selected-active-match", "selected-active-priority")


def test_lunar_peak_phase_uses_real_full_moon_geometry(page: Page, server_url: str):
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")
    phase_data = page.evaluate(
        """
        async () => {
          const mod = await import('./modules/astronomy-utils.js?v=20260324-moon-cycle28');
          const readPhase = (iso) => {
            const phase = mod.getMoonPhase(new Date(iso));
            return {
              illuminationFraction: phase.illuminationFraction,
              labelKey: phase.labelKey,
              phaseProgress: phase.phaseProgress,
            };
          };
          return {
            march: readPhase('2026-03-03T11:34:52Z'),
            august: readPhase('2026-08-28T04:14:04Z'),
          };
        }
        """
    )

    for entry in (phase_data["march"], phase_data["august"]):
        assert abs(entry["phaseProgress"] - 0.5) < 0.03
        assert entry["illuminationFraction"] >= 0.98
        assert entry["labelKey"] == "moonPhaseFull"


def test_valid_csv_upload_replaces_catalog_options(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)

    page.locator("#eclipse-catalog-source").select_option("upload")
    assert page.locator("#eclipse-year-select").is_disabled()
    assert page.locator("#eclipse-event-select").is_disabled()

    upload_csv_via_dom(
        page,
        "valid-eclipse.csv",
        "\n".join(
            [
                "kind,type,startUtc,peakUtc,endUtc,magnitude,gamma,sourceId,label",
                "solar,total,2030-01-01T00:00:00Z,2030-01-01T01:00:00Z,2030-01-01T02:00:00Z,1.020,0.1234,TEST-SOLAR-2030,Test Solar 2030",
                "lunar,partial,2030-02-01T03:00:00Z,2030-02-01T04:00:00Z,2030-02-01T05:00:00Z,0.850,-0.2222,TEST-LUNAR-2030,Test Lunar 2030",
            ]
        ),
    )

    expect(page.locator("#eclipse-catalog-status")).to_contain_text("valid-eclipse.csv")
    expect(page.locator("#eclipse-catalog-status")).to_contain_text("2")
    expect(page.locator("#eclipse-year-select")).to_have_value("2030")

    page.locator("#eclipse-kind-select").select_option("solar")
    expect(page.locator("#eclipse-event-select")).to_have_value("TEST-SOLAR-2030")
    expect(page.locator("#observation-time")).to_have_value("2030-01-01T10:00")
    expect(page.locator("#selected-eclipse-source")).to_have_text("TEST-SOLAR-2030")


def test_kind_filter_does_not_auto_switch_to_other_catalog_kind(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)

    page.locator("#eclipse-kind-select").select_option("solar")
    page.locator("#eclipse-catalog-source").select_option("upload")

    upload_csv_via_dom(
        page,
        "lunar-only.csv",
        "\n".join(
            [
                "kind,type,startUtc,peakUtc,endUtc,magnitude,gamma,sourceId,label",
                "lunar,partial,2030-02-01T03:00:00Z,2030-02-01T04:00:00Z,2030-02-01T05:00:00Z,0.850,-0.2222,TEST-LUNAR-2030,Test Lunar 2030",
            ]
        ),
    )

    expect(page.locator("#eclipse-kind-select")).to_have_value("solar")
    assert page.locator("#eclipse-year-select").is_disabled()
    assert page.locator("#eclipse-event-select").is_disabled()
    assert page.locator("#preview-selected-eclipse").is_disabled()
    expect(page.locator("#selected-eclipse-summary")).to_contain_text("이클립스 이벤트를 선택")

    page.locator("#eclipse-kind-select").select_option("lunar")
    expect(page.locator("#eclipse-year-select")).to_have_value("2030")
    expect(page.locator("#eclipse-event-select")).to_have_value("TEST-LUNAR-2030")
    expect(page.locator("#preview-selected-eclipse")).to_be_enabled()


def test_invalid_csv_upload_keeps_previous_catalog(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)
    page.locator("#eclipse-catalog-source").select_option("upload")

    upload_csv_via_dom(
        page,
        "valid-eclipse.csv",
        "\n".join(
            [
                "kind,type,startUtc,peakUtc,endUtc,magnitude,gamma,sourceId,label",
                "lunar,partial,2030-02-01T03:00:00Z,2030-02-01T04:00:00Z,2030-02-01T05:00:00Z,0.850,-0.2222,TEST-LUNAR-2030,Test Lunar 2030",
            ]
        ),
    )
    page.locator("#eclipse-kind-select").select_option("lunar")

    before_years = page.locator("#eclipse-year-select").evaluate(
        "(el) => Array.from(el.options).map((option) => option.value)"
    )
    before_events = page.locator("#eclipse-event-select").evaluate(
        "(el) => Array.from(el.options).map((option) => option.value)"
    )

    upload_csv_via_dom(
        page,
        "invalid-eclipse.csv",
        "\n".join(
            [
                "kind,type,startUtc,peakUtc,endUtc",
                "solar,total,2030-01-01T00:00:00,not-a-date,2030-01-01T02:00:00Z",
            ]
        ),
    )

    after_years = page.locator("#eclipse-year-select").evaluate(
        "(el) => Array.from(el.options).map((option) => option.value)"
    )
    after_events = page.locator("#eclipse-event-select").evaluate(
        "(el) => Array.from(el.options).map((option) => option.value)"
    )

    assert before_years == after_years == ["2030"]
    assert before_events == after_events == ["TEST-LUNAR-2030"]
    expect(page.locator("#eclipse-catalog-status")).to_contain_text("invalid-eclipse.csv")
    expect(page.locator("#eclipse-catalog-status")).to_have_class("sync-copy subtle error")


def test_existing_eclipse_staging_buttons_still_toggle_dark_sun_lock(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)

    page.locator("#stage-pre-eclipse").click()
    assert page.evaluate("window.__simulationState.darkSunStageAltitudeLock") is True

    page.locator("#stage-pre-lunar-eclipse").click()
    assert page.evaluate("window.__simulationState.darkSunStageAltitudeLock") is False


def test_stage_pre_lunar_eclipse_uses_selected_event_start_window(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)

    page.locator("#eclipse-kind-select").select_option("lunar")
    page.locator("#eclipse-year-select").select_option("2026")
    page.locator("#eclipse-event-select").select_option("LE-09708")

    page.locator("#stage-pre-lunar-eclipse").click()
    page.wait_for_function(
        "() => Boolean(window.__simulationState?.darkSunLunarStageLock) && Boolean(window.__E2E_SNAPSHOT?.activeLunarEclipseData)"
    )
    stage_state = page.evaluate(
        """
        () => ({
          darkSunBandProgress: window.__simulationState.darkSunBandProgress,
          darkSunLunarStageLock: window.__simulationState.darkSunLunarStageLock,
          demoPhaseDateMs: window.__simulationState.demoPhaseDateMs,
          eclipse: window.__E2E_SNAPSHOT?.activeLunarEclipseData ?? null,
          moonBandProgress: window.__simulationState.moonBandProgress,
          snapshotDateIso: window.__E2E_SNAPSHOT?.dateIso ?? null,
        })
        """
    )

    expected_stage_start_ms = 1772526334000
    event_start_ms = 1772527534000
    assert stage_state["darkSunLunarStageLock"] is True
    assert abs(stage_state["demoPhaseDateMs"] - expected_stage_start_ms) < 120000
    assert stage_state["demoPhaseDateMs"] < event_start_ms
    assert abs(stage_state["darkSunBandProgress"] - stage_state["moonBandProgress"]) < 1e-4
    snapshot_date_ms = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")
    assert abs(snapshot_date_ms - expected_stage_start_ms) < 120000
    assert snapshot_date_ms < event_start_ms
    assert stage_state["eclipse"] is not None
    assert stage_state["eclipse"]["stageKey"] == "approach"


def test_sun_band_lock_applies_across_reality_catalog_and_demo_modes(page: Page, server_url: str):
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")

    if page.locator("#reality-live").is_checked():
        set_checkbox_value(page, "#reality-live", False)
    page.locator("#observation-time").fill("2026-03-03T20:34")
    page.locator("#apply-observation-time").click()
    set_checkbox_value(page, "#reality-sync", True)

    def read_metrics() -> dict:
        return page.evaluate(
            """
            () => {
              const snapshot = window.__E2E_SNAPSHOT ?? {};
              const sim = window.__simulationState ?? {};
              const sunBand = snapshot.sunBandProgress ?? sim.sunBandProgress ?? 0;
              const moonBand = snapshot.moonBandProgress ?? sim.moonBandProgress ?? 0;
              const darkBand = snapshot.darkSunBandProgress ?? sim.darkSunBandProgress ?? 0;
              return {
                darkDelta: snapshot.darkSunSunBandDelta ?? (darkBand - sunBand),
                moonDelta: snapshot.moonSunBandDelta ?? (moonBand - sunBand),
                sunAngle: snapshot.sunAngle ?? sim.orbitSunAngle ?? 0,
                moonAngle: snapshot.moonAngle ?? sim.orbitMoonAngle ?? 0,
              };
            }
            """
        )

    def assert_band_lock(mode_label: str) -> None:
        page.wait_for_timeout(300)
        metrics = read_metrics()
        assert abs(metrics["moonDelta"]) < 1e-4, mode_label
        assert abs(metrics["darkDelta"]) < 1e-4, mode_label
        assert abs(wrapped_delta(metrics["sunAngle"], metrics["moonAngle"])) > 1e-6, mode_label

    assert_band_lock("reality")

    page.locator("[data-hud-panel-tab='eclipse']").click()
    page.locator("#eclipse-kind-select").select_option("lunar")
    page.locator("#eclipse-year-select").select_option("2026")
    page.locator("#eclipse-event-select").select_option("LE-09708")
    assert_band_lock("catalog")

    set_checkbox_value(page, "#reality-sync", False)
    assert_band_lock("demo")

    snapshot_keys = page.evaluate("Object.keys(window.__E2E_SNAPSHOT ?? {})")
    assert "sunBandProgress" in snapshot_keys
    assert "moonBandProgress" in snapshot_keys
    assert "darkSunBandProgress" in snapshot_keys
    assert "moonSunBandDelta" in snapshot_keys
    assert "darkSunSunBandDelta" in snapshot_keys


def test_strict_catalog_lock_applies_in_accelerated_mode_for_lunar_events(page: Page, server_url: str):
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")

    if page.locator("#reality-live").is_checked():
        set_checkbox_value(page, "#reality-live", False)
    set_checkbox_value(page, "#reality-sync", False)

    page.locator("#observation-time").fill("2026-01-15T12:00")
    page.locator("#apply-observation-time").click()
    page.wait_for_timeout(350)
    idle_lunar = page.evaluate("window.__E2E_SNAPSHOT?.activeLunarEclipseData ?? null")
    assert idle_lunar is not None
    assert idle_lunar["stageKey"] == "idle"
    assert idle_lunar["active"] is False

    page.locator("#observation-time").fill("2026-03-03T20:34")
    page.locator("#apply-observation-time").click()
    page.wait_for_timeout(350)
    active_lunar = page.evaluate("window.__E2E_SNAPSHOT?.activeLunarEclipseData ?? null")
    assert active_lunar is not None
    assert active_lunar["stageKey"] != "idle"


def test_accelerated_mode_preserves_solar_orbit_direction_sign(page: Page, server_url: str):
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")

    page.wait_for_timeout(900)
    sun_on_start = page.evaluate("window.__simulationState.orbitSunAngle")
    page.wait_for_timeout(900)
    sun_on_end = page.evaluate("window.__simulationState.orbitSunAngle")
    delta_on = wrapped_delta(sun_on_start, sun_on_end)

    set_checkbox_value(page, "#reality-sync", False)
    set_range_value(page, "#celestial-speed", 1.0)
    page.wait_for_timeout(900)
    sun_off_start = page.evaluate("window.__simulationState.orbitSunAngle")
    page.wait_for_timeout(900)
    sun_off_end = page.evaluate("window.__simulationState.orbitSunAngle")
    delta_off = wrapped_delta(sun_off_start, sun_off_end)

    assert abs(delta_on) > 1e-6
    assert abs(delta_off) > 1e-6
    assert delta_on * delta_off > 0


def test_accelerated_mode_speed_multiplier_and_pause(page: Page, server_url: str):
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")

    if page.locator("#reality-live").is_checked():
      set_checkbox_value(page, "#reality-live", False)
    page.locator("#observation-time").fill("2026-01-15T12:00")
    page.locator("#apply-observation-time").click()
    set_checkbox_value(page, "#reality-sync", False)
    page.locator("[data-hud-panel-tab='orbit']").click()

    set_range_value(page, "#celestial-speed", 1.0)
    page.wait_for_timeout(150)
    t1_start = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")
    page.wait_for_timeout(700)
    t1_end = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")
    delta_1x = t1_end - t1_start

    page.locator("[data-celestial-speed-preset='5']").click()
    page.wait_for_timeout(150)
    t5_start = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")
    page.wait_for_timeout(700)
    t5_end = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")
    delta_5x = t5_end - t5_start

    page.locator("[data-celestial-speed-preset='0']").click()
    page.wait_for_timeout(150)
    t0_start = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")
    page.wait_for_timeout(700)
    t0_end = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")
    delta_0x = t0_end - t0_start

    assert delta_1x > 200
    assert delta_5x > delta_1x * 3.0
    assert abs(delta_0x) < 120


def test_accelerated_mode_orbit_pose_advances_with_time(page: Page, server_url: str):
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")

    if page.locator("#reality-live").is_checked():
      set_checkbox_value(page, "#reality-live", False)
    page.locator("#observation-time").fill("2026-01-15T12:00")
    page.locator("#apply-observation-time").click()
    set_checkbox_value(page, "#reality-sync", False)
    set_range_value(page, "#celestial-speed", 5.0)

    page.wait_for_timeout(180)
    start = page.evaluate(
        """() => ({
          angle: window.__E2E_SNAPSHOT?.sunAngle ?? 0,
          pos: window.__E2E_SNAPSHOT?.sunPos ?? { x: 0, z: 0 }
        })"""
    )
    page.wait_for_timeout(2000)
    end = page.evaluate(
        """() => ({
          angle: window.__E2E_SNAPSHOT?.sunAngle ?? 0,
          pos: window.__E2E_SNAPSHOT?.sunPos ?? { x: 0, z: 0 }
        })"""
    )

    angle_delta = abs(wrapped_delta(start["angle"], end["angle"]))
    position_delta = ((end["pos"]["x"] - start["pos"]["x"]) ** 2 + (end["pos"]["z"] - start["pos"]["z"]) ** 2) ** 0.5
    assert angle_delta > 1e-6
    assert position_delta > 1e-4


def test_accelerated_mode_orbit_buttons_are_paused_like_reality_sync(page: Page, server_url: str):
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")

    if page.locator("#reality-live").is_checked():
      set_checkbox_value(page, "#reality-live", False)
    page.locator("#observation-time").fill("2026-08-13T02:47")
    page.locator("#apply-observation-time").click()
    page.locator("[data-hud-panel-tab='orbit']").click()

    assert page.locator("[data-orbit-mode='auto']").is_disabled()
    assert page.locator("[data-orbit-mode='north']").is_disabled()
    assert page.locator("[data-orbit-mode='equator']").is_disabled()
    assert page.locator("[data-orbit-mode='south']").is_disabled()

    set_checkbox_value(page, "#reality-sync", False)
    set_range_value(page, "#celestial-speed", 1.0)

    assert page.locator("[data-orbit-mode='auto']").is_disabled()
    assert page.locator("[data-orbit-mode='north']").is_disabled()
    assert page.locator("[data-orbit-mode='equator']").is_disabled()
    assert page.locator("[data-orbit-mode='south']").is_disabled()


def test_stage_buttons_do_not_force_disable_reality_sync(page: Page, server_url: str):
    open_eclipse_panel(page, server_url)
    assert page.locator("#reality-sync").is_checked()

    page.locator("#stage-pre-eclipse").click()
    assert page.locator("#reality-sync").is_checked()

    page.locator("#stage-pre-lunar-eclipse").click()
    assert page.locator("#reality-sync").is_checked()


def test_reality_sync_toggle_preserves_current_simulation_time(page: Page, server_url: str):
    page.goto(server_url)
    page.locator("#scene").wait_for(state="attached")

    if page.locator("#reality-live").is_checked():
      set_checkbox_value(page, "#reality-live", False)
    page.locator("#observation-time").fill("2026-01-15T12:00")
    page.locator("#apply-observation-time").click()
    set_checkbox_value(page, "#reality-sync", False)

    set_range_value(page, "#celestial-speed", 0.0)
    page.wait_for_timeout(450)
    accelerated_ms = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")

    set_checkbox_value(page, "#reality-sync", True)
    page.wait_for_timeout(220)
    synced_ms = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")

    set_checkbox_value(page, "#reality-sync", False)
    page.wait_for_timeout(220)
    accelerated_back_ms = page.evaluate("Date.parse(window.__E2E_SNAPSHOT?.dateIso)")

    assert abs(synced_ms - accelerated_ms) < 2500
    assert abs(accelerated_back_ms - synced_ms) < 2500
