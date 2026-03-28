import {
  advanceSimulation,
  applyCameraGesture,
  createSimulationState,
  DISC_RADIUS,
  getHudState,
  MOON_ALTITUDE,
  projectedRadiusFromLatitude,
  SUN_ALTITUDE,
  toRadians,
  type SimulationState,
  type TimeMode
} from "@flat-earth/core-sim";
import type { ExpoWebGLRenderingContext } from "expo-gl";
import { loadAsync, Renderer } from "expo-three";
import * as THREE from "three";
import type { EngineBridge, EngineInitParams } from "./EngineBridge";

const DISC_THICKNESS = 0.24;
const AUTO_QUALITY_TARGET_MS = 1000 / 45;
const AUTO_QUALITY_RECOVERY_MS = 1000 / 55;

function geoToWorld(latitudeDegrees: number, longitudeDegrees: number, y: number): THREE.Vector3 {
  const projectedRadius = projectedRadiusFromLatitude(latitudeDegrees, DISC_RADIUS);
  const lonRad = toRadians(longitudeDegrees);
  return new THREE.Vector3(
    -Math.cos(lonRad) * projectedRadius,
    y,
    Math.sin(lonRad) * projectedRadius
  );
}

export class FlatEarthEngineBridge implements EngineBridge {
  private gl: ExpoWebGLRenderingContext | null = null;
  private renderer: Renderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private discMesh: THREE.Mesh | null = null;
  private sunMesh: THREE.Mesh | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private state: SimulationState = createSimulationState();
  private appActive = true;
  private lastTickMs: number | null = null;
  private avgFrameMs = AUTO_QUALITY_TARGET_MS;
  private dynamicPixelRatio = 1;

  async init(params: EngineInitParams): Promise<void> {
    const { gl, width, height, pixelRatio } = params;
    this.gl = gl;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = false;
    this.dynamicPixelRatio = pixelRatio;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030711);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(46, width / Math.max(height, 1), 0.1, 180);
    this.camera = camera;

    scene.add(new THREE.AmbientLight(0xbfd8ff, 0.65));

    const sunLight = new THREE.PointLight(0xfff4c9, 2.4, 90, 2);
    scene.add(sunLight);

    const rimGeometry = new THREE.TorusGeometry(DISC_RADIUS + 0.08, 0.12, 24, 128);
    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x35538a, metalness: 0.25, roughness: 0.5 });
    const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = -DISC_THICKNESS / 2;
    scene.add(rimMesh);

    const discGeometry = new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_THICKNESS, 96, 1, false);
    const discMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b4f82,
      roughness: 0.92,
      metalness: 0.03
    });
    this.discMesh = new THREE.Mesh(discGeometry, discMaterial);
    scene.add(this.discMesh);

    try {
      const mapTexture = await loadAsync(require("../../../../assets/flat-earth-map-square.png"));
      mapTexture.wrapS = THREE.ClampToEdgeWrapping;
      mapTexture.wrapT = THREE.ClampToEdgeWrapping;
      mapTexture.colorSpace = THREE.SRGBColorSpace;
      discMaterial.map = mapTexture;
      discMaterial.needsUpdate = true;
    } catch (_error) {
      // Keep fallback material when texture loading fails.
    }

    const sunGeometry = new THREE.SphereGeometry(0.32, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffd876 });
    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(this.sunMesh);
    sunLight.position.copy(this.sunMesh.position);

    const moonGeometry = new THREE.SphereGeometry(0.27, 28, 28);
    const moonMaterial = new THREE.MeshStandardMaterial({
      color: 0xefeff7,
      emissive: 0x31333c,
      emissiveIntensity: 0.28,
      roughness: 0.95,
      metalness: 0.01
    });
    this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    scene.add(this.moonMesh);

    try {
      const moonTexture = await loadAsync(require("../../../../assets/moon-phases-360-ko.png"));
      moonTexture.wrapS = THREE.RepeatWrapping;
      moonTexture.wrapT = THREE.ClampToEdgeWrapping;
      moonTexture.colorSpace = THREE.SRGBColorSpace;
      moonMaterial.map = moonTexture;
      moonMaterial.needsUpdate = true;
    } catch (_error) {
      // Keep fallback material when texture loading fails.
    }

    this.applyCameraState();
    this.syncSceneFromState();
    this.renderFrame();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    if (!this.renderer || !this.camera) {
      return;
    }
    this.renderer.setSize(width, height);
    this.dynamicPixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  tick(timeMs: number): void {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    if (this.lastTickMs === null) {
      this.lastTickMs = timeMs;
    }

    const dtSeconds = Math.min(0.05, Math.max(0, (timeMs - this.lastTickMs) / 1000));
    this.lastTickMs = timeMs;
    this.state = advanceSimulation(this.state, dtSeconds, {
      appActive: this.appActive,
      nowMs: timeMs
    });
    this.syncSceneFromState();
    this.updateAutoQuality(dtSeconds);
    this.renderFrame();
  }

  setObservationTime(next: Date | number | string): void {
    this.state = advanceSimulation(this.state, 0, {
      observationTime: next,
      appActive: this.appActive
    });
  }

  setTimeMode(mode: TimeMode): void {
    this.state = {
      ...this.state,
      config: {
        ...this.state.config,
        timeMode: mode
      }
    };
  }

  setAppActive(active: boolean): void {
    this.appActive = active;
  }

  setCameraGesture(input: Parameters<typeof applyCameraGesture>[1]): void {
    this.state = applyCameraGesture(this.state, input);
    this.applyCameraState();
  }

  getHudSnapshot() {
    return getHudState(this.state);
  }

  dispose(): void {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.discMesh = null;
    this.sunMesh = null;
    this.moonMesh = null;
    this.gl = null;
    this.lastTickMs = null;
  }

  private applyCameraState(): void {
    if (!this.camera) {
      return;
    }
    const { azimuthRadians, elevationRadians, radius } = this.state.camera;
    const horizontal = radius * Math.cos(elevationRadians);
    this.camera.position.set(
      horizontal * Math.sin(azimuthRadians),
      radius * Math.sin(elevationRadians),
      horizontal * Math.cos(azimuthRadians)
    );
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private syncSceneFromState(): void {
    if (!this.sunMesh || !this.moonMesh || !this.scene) {
      return;
    }
    const sunPosition = geoToWorld(
      this.state.celestial.sun.latitudeDegrees,
      this.state.celestial.sun.longitudeDegrees,
      SUN_ALTITUDE
    );
    const moonPosition = geoToWorld(
      this.state.celestial.moon.latitudeDegrees,
      this.state.celestial.moon.longitudeDegrees,
      MOON_ALTITUDE
    );
    this.sunMesh.position.copy(sunPosition);
    this.moonMesh.position.copy(moonPosition);
    this.applyCameraState();
  }

  private renderFrame(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.gl) {
      return;
    }
    this.renderer.render(this.scene, this.camera);
    this.gl.endFrameEXP();
  }

  private updateAutoQuality(dtSeconds: number): void {
    if (!this.renderer || this.state.config.qualityLevel !== "auto" || dtSeconds <= 0) {
      return;
    }
    const frameMs = dtSeconds * 1000;
    this.avgFrameMs = (this.avgFrameMs * 0.9) + (frameMs * 0.1);

    if (this.avgFrameMs > AUTO_QUALITY_TARGET_MS * 1.2 && this.dynamicPixelRatio > 0.65) {
      this.dynamicPixelRatio = Math.max(0.65, this.dynamicPixelRatio - 0.05);
      this.renderer.setPixelRatio(this.dynamicPixelRatio);
      return;
    }
    if (this.avgFrameMs < AUTO_QUALITY_RECOVERY_MS && this.dynamicPixelRatio < 1.2) {
      this.dynamicPixelRatio = Math.min(1.2, this.dynamicPixelRatio + 0.03);
      this.renderer.setPixelRatio(this.dynamicPixelRatio);
    }
  }
}
