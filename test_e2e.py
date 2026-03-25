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
