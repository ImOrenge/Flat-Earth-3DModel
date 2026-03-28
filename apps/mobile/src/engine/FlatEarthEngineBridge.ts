import {
  advanceFeatureRuntime,
  advanceSimulation,
  applyCameraGesture,
  createFeatureRuntime,
  createSimulationState,
  DISC_RADIUS,
  getDetailSnapshot,
  getHudState,
  MOON_ALTITUDE,
  projectedRadiusFromLatitude,
  reduceDetailAction,
  SUN_ALTITUDE,
  toRadians,
  type DetailAction,
  type DetailSnapshot,
  type DetailTab,
  type FeatureRuntimeConfig,
  type FeatureRuntimeState,
  type SimulationState,
  type TimeMode
} from "@flat-earth/core-sim";
import type { ExpoWebGLRenderingContext } from "expo-gl";
import * as THREE from "three";
import type { EngineBridge, EngineInitParams } from "./EngineBridge";

const DISC_THICKNESS = 0.24;
const AUTO_QUALITY_TARGET_MS = 1000 / 45;
const AUTO_QUALITY_RECOVERY_MS = 1000 / 55;
const ROUTE_ALTITUDE = 0.18;
const ROUTE_ARC_LIFT = 0.58;
const ROUTE_SEGMENTS = 88;
const CONSTELLATION_ALTITUDE = 3.6;
const ROCKET_ALTITUDE_SCALE = 0.018;
const CIRCUMFERENCE_KM = 40_075;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function mod1(value: number): number {
  return ((value % 1) + 1) % 1;
}

function geoToWorld(latitudeDegrees: number, longitudeDegrees: number, y: number): THREE.Vector3 {
  const projectedRadius = projectedRadiusFromLatitude(latitudeDegrees, DISC_RADIUS);
  const lonRad = toRadians(longitudeDegrees);
  return new THREE.Vector3(
    -Math.cos(lonRad) * projectedRadius,
    y,
    Math.sin(lonRad) * projectedRadius
  );
}

function raDecToWorld(raHours: number, decDegrees: number): THREE.Vector3 {
  const longitudeDegrees = ((raHours / 24) * 360) - 180;
  const latitudeDegrees = decDegrees;
  return geoToWorld(latitudeDegrees, longitudeDegrees, CONSTELLATION_ALTITUDE);
}

export class FlatEarthEngineBridge implements EngineBridge {
  private gl: ExpoWebGLRenderingContext | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private discMesh: THREE.Mesh | null = null;
  private sunMesh: THREE.Mesh | null = null;
  private sunLight: THREE.PointLight | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private state: SimulationState = createSimulationState();
  private featureState: FeatureRuntimeState;
  private appActive = true;
  private lastTickMs: number | null = null;
  private avgFrameMs = AUTO_QUALITY_TARGET_MS;
  private dynamicPixelRatio = 1;
  private routePath: THREE.Line | null = null;
  private routeMarker: THREE.Mesh | null = null;
  private routeLayer: THREE.Group | null = null;
  private constellationLayer: THREE.Group | null = null;
  private rocketMesh: THREE.Mesh | null = null;
  private rocketTrail: THREE.Line | null = null;
  private rocketTrailPoints: THREE.Vector3[] = [];

  constructor(featureConfig: FeatureRuntimeConfig = {}) {
    this.featureState = createFeatureRuntime(featureConfig);
  }

  async init(params: EngineInitParams): Promise<void> {
    const { gl, width, height, pixelRatio } = params;
    this.gl = gl;

    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width,
        height,
        style: {}
      } as never,
      context: gl as never,
      antialias: true,
      alpha: false
    });
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
    this.sunLight = sunLight;
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

    this.routeLayer = new THREE.Group();
    this.routeLayer.visible = false;
    scene.add(this.routeLayer);
    this.routePath = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x86d6ff,
        transparent: true,
        opacity: 0.9
      })
    );
    this.routeLayer.add(this.routePath);
    this.routeMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 14),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff })
    );
    this.routeLayer.add(this.routeMarker);

    this.constellationLayer = new THREE.Group();
    this.constellationLayer.visible = true;
    scene.add(this.constellationLayer);
    this.buildConstellationLines();

    this.rocketMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.32, 10),
      new THREE.MeshBasicMaterial({ color: 0xff6f59 })
    );
    this.rocketMesh.rotation.x = Math.PI;
    scene.add(this.rocketMesh);
    this.rocketTrail = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffd38f,
        transparent: true,
        opacity: 0.7
      })
    );
    scene.add(this.rocketTrail);

    this.applyCameraState();
    this.syncSceneFromState();
    this.syncFeatureScene();
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
    this.featureState = advanceFeatureRuntime(this.featureState, dtSeconds, {
      observationTimeMs: this.state.currentObservationTimeMs,
      appActive: this.appActive,
      seasonalEclipticAngleRadians: this.state.celestial.seasonalEclipticAngleRadians
    });
    this.syncSceneFromState();
    this.syncFeatureScene();
    this.updateAutoQuality(dtSeconds);
    this.renderFrame();
  }

  setObservationTime(next: Date | number | string): void {
    this.state = advanceSimulation(this.state, 0, {
      observationTime: next,
      appActive: this.appActive
    });
    this.featureState = advanceFeatureRuntime(this.featureState, 0, {
      observationTimeMs: this.state.currentObservationTimeMs,
      appActive: this.appActive,
      seasonalEclipticAngleRadians: this.state.celestial.seasonalEclipticAngleRadians
    });
    this.syncFeatureScene();
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

  dispatchDetailAction(action: DetailAction): void {
    this.featureState = reduceDetailAction(this.featureState, action);
    if (this.featureState.pendingObservationTimeMs !== null) {
      this.setObservationTime(this.featureState.pendingObservationTimeMs);
      this.featureState = {
        ...this.featureState,
        pendingObservationTimeMs: null
      };
    }
    this.syncFeatureScene();
  }

  getHudSnapshot() {
    return getHudState(this.state);
  }

  getDetailSnapshot(tab?: DetailTab): DetailSnapshot {
    return getDetailSnapshot(this.featureState, tab);
  }

  dispose(): void {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.discMesh = null;
    this.sunMesh = null;
    this.sunLight = null;
    this.moonMesh = null;
    this.routePath = null;
    this.routeMarker = null;
    this.routeLayer = null;
    this.constellationLayer = null;
    this.rocketMesh = null;
    this.rocketTrail = null;
    this.rocketTrailPoints = [];
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
    if (this.sunLight) {
      this.sunLight.position.copy(sunPosition);
    }
    this.moonMesh.position.copy(moonPosition);
    if (this.discMesh) {
      const mat = this.discMesh.material as THREE.MeshStandardMaterial;
      const eclipseDim = clampNumber(this.featureState.eclipse.coveragePercent / 100, 0, 1);
      mat.color.setHex(0x2b4f82).lerp(new THREE.Color(0x172a4a), eclipseDim * 0.7);
      mat.needsUpdate = true;
    }
    this.applyCameraState();
  }

  private buildConstellationLines(): void {
    if (!this.constellationLayer) {
      return;
    }
    this.constellationLayer.clear();
    const material = new THREE.LineBasicMaterial({
      color: 0x8fb8ff,
      transparent: true,
      opacity: 0.35
    });
    for (const entry of this.featureState.data.constellations) {
      for (const segment of entry.segments) {
        if (!Array.isArray(segment) || segment.length < 2) {
          continue;
        }
        const points = segment.map((point) => raDecToWorld(point[0], point[1]));
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
        this.constellationLayer.add(line);
      }
    }
  }

  private syncFeatureScene(): void {
    this.syncRouteScene();
    this.syncConstellationScene();
    this.syncRocketScene();
  }

  private syncRouteScene(): void {
    if (!this.routeLayer || !this.routePath || !this.routeMarker) {
      return;
    }
    const route = this.featureState.routes;
    if (!route.ready || !route.renderData) {
      this.routeLayer.visible = false;
      this.routePath.geometry.setFromPoints([]);
      return;
    }
    this.routeLayer.visible = true;
    const origin = geoToWorld(route.renderData.originLatitude, route.renderData.originLongitude, ROUTE_ALTITUDE);
    const destination = geoToWorld(route.renderData.destinationLatitude, route.renderData.destinationLongitude, ROUTE_ALTITUDE);
    const control = origin.clone().lerp(destination, 0.5);
    control.y += ROUTE_ARC_LIFT;
    const curve = new THREE.QuadraticBezierCurve3(origin, control, destination);
    const points = curve.getPoints(ROUTE_SEGMENTS);
    this.routePath.geometry.setFromPoints(points);
    this.routeMarker.position.copy(curve.getPointAt(route.progressRatio));
    this.routeMarker.visible = route.playing || route.progressRatio > 0;
  }

  private syncConstellationScene(): void {
    if (!this.constellationLayer) {
      return;
    }
    this.constellationLayer.visible = this.featureState.constellations.visible;
    for (const child of this.constellationLayer.children) {
      const line = child as THREE.Line;
      const material = line.material as THREE.LineBasicMaterial;
      material.opacity = this.featureState.constellations.linesVisible ? 0.36 : 0;
      material.color.set(this.featureState.constellations.selectedName ? 0x9bc6ff : 0x6f8fb8);
      material.needsUpdate = true;
    }
  }

  private syncRocketScene(): void {
    if (!this.rocketMesh || !this.rocketTrail) {
      return;
    }
    const rocket = this.featureState.rockets;
    if (!rocket.renderData || rocket.phase === "idle") {
      this.rocketMesh.visible = false;
      this.rocketTrail.visible = false;
      this.rocketTrailPoints = [];
      this.rocketTrail.geometry.setFromPoints([]);
      return;
    }
    this.rocketMesh.visible = true;
    this.rocketTrail.visible = true;
    const position = geoToWorld(
      rocket.renderData.latitudeDegrees,
      rocket.renderData.longitudeDegrees,
      ROUTE_ALTITUDE + (rocket.renderData.altitudeKm * ROCKET_ALTITUDE_SCALE)
    );
    this.rocketMesh.position.copy(position);
    const downrangeProgress = mod1(rocket.telemetry.downrangeKm / CIRCUMFERENCE_KM);
    const tangentLon = (rocket.renderData.longitudeDegrees + (downrangeProgress * 360)) % 360;
    const ahead = geoToWorld(rocket.renderData.latitudeDegrees, tangentLon, ROUTE_ALTITUDE + (rocket.renderData.altitudeKm * ROCKET_ALTITUDE_SCALE));
    this.rocketMesh.lookAt(ahead);
    this.rocketTrailPoints.push(position.clone());
    if (this.rocketTrailPoints.length > 96) {
      this.rocketTrailPoints.shift();
    }
    this.rocketTrail.geometry.setFromPoints(this.rocketTrailPoints);
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
