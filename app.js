import * as THREE from "./vendor/three.module.js";

const DEFAULT_MAP_PATH = "./assets/flat-earth-map.png";
const DEFAULT_MAP_LABEL = "assets/flat-earth-map.png";
const DISC_RADIUS = 5;
const DISC_HEIGHT = 0.36;
const RIM_THICKNESS = 0.28;
const RIM_CLEARANCE = 0.08;
const RIM_OUTER_RADIUS = DISC_RADIUS + RIM_CLEARANCE;
const RIM_INNER_RADIUS = DISC_RADIUS - RIM_THICKNESS;
const RIM_HEIGHT = 0.62;
const RIM_CENTER_Y = 0.11;
const RIM_TOP_Y = RIM_CENTER_Y + (RIM_HEIGHT / 2);
const RIM_BOTTOM_Y = RIM_CENTER_Y - (RIM_HEIGHT / 2);
const DOME_RADIUS = RIM_INNER_RADIUS - 0.14;
const DOME_BASE_Y = 0.46;
const TROPIC_LATITUDE = 23.44;
const ORBIT_TRACK_HEIGHT = DOME_BASE_Y + 2.01;
const ORBIT_SUN_HEIGHT = ORBIT_TRACK_HEIGHT + 0.04;
const ORBIT_SUN_SIZE = 0.18;
const ORBIT_SUN_SPEED = 0.011;
const ORBIT_SUN_SEASON_SPEED = 0.0026;
const ORBIT_SURFACE_LINE_WIDTH = 0.0045;

function projectedRadiusFromLatitude(latitudeDegrees) {
  return DISC_RADIUS * ((90 - latitudeDegrees) / 180);
}

function latitudeFromProjectedRadius(radius) {
  return 90 - ((radius / DISC_RADIUS) * 180);
}

const TROPIC_CANCER_RADIUS = projectedRadiusFromLatitude(TROPIC_LATITUDE);
const EQUATOR_RADIUS = projectedRadiusFromLatitude(0);
const TROPIC_CAPRICORN_RADIUS = projectedRadiusFromLatitude(-TROPIC_LATITUDE);
const ORBIT_RADIUS_MID = (TROPIC_CANCER_RADIUS + TROPIC_CAPRICORN_RADIUS) / 2;
const ORBIT_RADIUS_AMPLITUDE = (TROPIC_CAPRICORN_RADIUS - TROPIC_CANCER_RADIUS) / 2;

const canvas = document.getElementById("scene");
const statusEl = document.getElementById("status");
const uploadInput = document.getElementById("map-upload");
const resetButton = document.getElementById("reset-camera");
const orbitLabelEl = document.getElementById("orbit-label");
const orbitModeButtons = [...document.querySelectorAll("[data-orbit-mode]")];
const seasonLatitudeEl = document.getElementById("season-latitude");
const seasonSummaryEl = document.getElementById("season-summary");
const seasonDetailEl = document.getElementById("season-detail");

const orbitModes = {
  auto: {
    label: "자동 모드: 태양이 북회귀선, 적도, 남회귀선 사이를 왕복합니다."
  },
  north: {
    radius: TROPIC_CANCER_RADIUS,
    label: "북회귀선 모드: 태양이 북회귀선 궤도만 따라 공전합니다."
  },
  equator: {
    radius: EQUATOR_RADIUS,
    label: "적도 모드: 태양이 적도 궤도만 따라 공전합니다."
  },
  south: {
    radius: TROPIC_CAPRICORN_RADIUS,
    label: "남회귀선 모드: 태양이 남회귀선 궤도만 따라 공전합니다."
  }
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06101d, 14, 28);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

const cameraState = {
  radius: 10.5,
  theta: -0.55,
  phi: 1.12,
  targetTheta: -0.55,
  targetPhi: 1.12,
  targetRadius: 10.5
};

const stage = new THREE.Group();
scene.add(stage);

const topMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.9,
  metalness: 0.04
});

const sideMaterial = new THREE.MeshStandardMaterial({
  color: 0x202f3d,
  roughness: 0.82,
  metalness: 0.08
});

const bottomMaterial = new THREE.MeshStandardMaterial({
  color: 0x0c1624,
  roughness: 0.9,
  metalness: 0.04
});

const disc = new THREE.Mesh(
  new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_HEIGHT, 128, 1, false),
  [sideMaterial, topMaterial, bottomMaterial]
);
disc.rotation.x = 0.04;
stage.add(disc);

const northSeasonOverlay = new THREE.Mesh(
  new THREE.CircleGeometry(EQUATOR_RADIUS, 128),
  new THREE.MeshBasicMaterial({
    color: 0xffd77c,
    transparent: true,
    opacity: 0.1,
    depthWrite: false
  })
);
northSeasonOverlay.rotation.x = -Math.PI / 2;
northSeasonOverlay.position.y = (DISC_HEIGHT / 2) + 0.012;
stage.add(northSeasonOverlay);

const southSeasonOverlay = new THREE.Mesh(
  new THREE.RingGeometry(EQUATOR_RADIUS, DISC_RADIUS, 128),
  new THREE.MeshBasicMaterial({
    color: 0x7ed3ff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false
  })
);
southSeasonOverlay.rotation.x = -Math.PI / 2;
southSeasonOverlay.position.y = (DISC_HEIGHT / 2) + 0.011;
stage.add(southSeasonOverlay);

const iceOuterMaterial = new THREE.MeshStandardMaterial({
  color: 0xf3f7ff,
  roughness: 0.72,
  metalness: 0.02
});

const iceInnerMaterial = new THREE.MeshStandardMaterial({
  color: 0xe4f0ff,
  roughness: 0.66,
  metalness: 0.02,
  side: THREE.BackSide
});

const iceCapMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.62,
  metalness: 0.02,
  side: THREE.DoubleSide
});

const iceWallOuter = new THREE.Mesh(
  new THREE.CylinderGeometry(RIM_OUTER_RADIUS, RIM_OUTER_RADIUS, RIM_HEIGHT, 128, 1, true),
  iceOuterMaterial
);
iceWallOuter.position.y = RIM_CENTER_Y;
stage.add(iceWallOuter);

const iceWallInner = new THREE.Mesh(
  new THREE.CylinderGeometry(RIM_INNER_RADIUS, RIM_INNER_RADIUS, RIM_HEIGHT, 128, 1, true),
  iceInnerMaterial
);
iceWallInner.position.y = RIM_CENTER_Y;
stage.add(iceWallInner);

const iceTopCap = new THREE.Mesh(
  new THREE.RingGeometry(RIM_INNER_RADIUS, RIM_OUTER_RADIUS, 128),
  iceCapMaterial
);
iceTopCap.rotation.x = -Math.PI / 2;
iceTopCap.position.y = RIM_TOP_Y;
stage.add(iceTopCap);

const iceBottomCap = new THREE.Mesh(
  new THREE.RingGeometry(RIM_INNER_RADIUS, RIM_OUTER_RADIUS, 128),
  new THREE.MeshStandardMaterial({
    color: 0xdfe9f7,
    roughness: 0.74,
    metalness: 0.02,
    side: THREE.DoubleSide
  })
);
iceBottomCap.rotation.x = -Math.PI / 2;
iceBottomCap.position.y = RIM_BOTTOM_Y;
stage.add(iceBottomCap);

const iceCrown = new THREE.Mesh(
  new THREE.TorusGeometry((RIM_OUTER_RADIUS + RIM_INNER_RADIUS) / 2, 0.05, 12, 128),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x3a546f,
    emissiveIntensity: 0.18,
    roughness: 0.52,
    metalness: 0.03
  })
);
iceCrown.rotation.x = Math.PI / 2;
iceCrown.position.y = RIM_TOP_Y + 0.01;
stage.add(iceCrown);

const dome = new THREE.Mesh(
  new THREE.SphereGeometry(DOME_RADIUS, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshPhysicalMaterial({
    color: 0x9fd8ff,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.72,
    transparent: true,
    opacity: 0.24,
    thickness: 0.18,
    ior: 1.22,
    side: THREE.DoubleSide
  })
);
dome.position.y = DOME_BASE_Y;
stage.add(dome);

const domeRing = new THREE.Mesh(
  new THREE.TorusGeometry(DOME_RADIUS, 0.045, 12, 96),
  new THREE.MeshStandardMaterial({
    color: 0xdff3ff,
    emissive: 0x23445e,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.06
  })
);
domeRing.rotation.x = Math.PI / 2;
domeRing.position.y = DOME_BASE_Y;
stage.add(domeRing);

const glow = new THREE.Mesh(
  new THREE.CircleGeometry(6.7, 96),
  new THREE.MeshBasicMaterial({
    color: 0x123a67,
    transparent: true,
    opacity: 0.3
  })
);
glow.rotation.x = -Math.PI / 2;
glow.position.y = -0.7;
stage.add(glow);

const ambient = new THREE.AmbientLight(0xc5d7ff, 1.3);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xeaf4ff, 1.7);
keyLight.position.set(5, 7, 6);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8fd9ff, 0.85);
rimLight.position.set(-7, 4, -5);
scene.add(rimLight);

const orbitSun = new THREE.Group();
const orbitSunBody = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_SUN_SIZE, 32, 24),
  new THREE.MeshStandardMaterial({
    color: 0xffd56f,
    emissive: 0xffb42f,
    emissiveIntensity: 2.4,
    roughness: 0.16,
    metalness: 0.02
  })
);
orbitSun.add(orbitSunBody);

const orbitSunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(ORBIT_SUN_SIZE * 1.9, 24, 16),
  new THREE.MeshBasicMaterial({
    color: 0xffd781,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide
  })
);
orbitSun.add(orbitSunHalo);

const orbitSunLight = new THREE.PointLight(0xffcf75, 14, 8, 1.6);
orbitSun.add(orbitSunLight);
stage.add(orbitSun);

function createOrbitTrack(radius, color, opacity) {
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.04, 16, 192),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity,
      roughness: 0.18,
      metalness: 0.06
    })
  );
  track.rotation.x = Math.PI / 2;
  track.position.y = ORBIT_TRACK_HEIGHT;
  return track;
}

stage.add(createOrbitTrack(TROPIC_CANCER_RADIUS, 0xffc96c, 0.82));
stage.add(createOrbitTrack(EQUATOR_RADIUS, 0x7fd8ff, 0.78));
stage.add(createOrbitTrack(TROPIC_CAPRICORN_RADIUS, 0xff93b6, 0.82));

let orbitSunAngle = 0;
let orbitSeasonPhase = -Math.PI / 2;
let orbitMode = "auto";

const starCanvas = document.createElement("canvas");
starCanvas.width = 1024;
starCanvas.height = 1024;
const starCtx = starCanvas.getContext("2d");
starCtx.fillStyle = "#040912";
starCtx.fillRect(0, 0, starCanvas.width, starCanvas.height);
for (let i = 0; i < 500; i += 1) {
  const x = Math.random() * starCanvas.width;
  const y = Math.random() * starCanvas.height;
  const size = Math.random() * 2.2;
  const alpha = 0.18 + Math.random() * 0.82;
  starCtx.fillStyle = `rgba(240,245,255,${alpha})`;
  starCtx.beginPath();
  starCtx.arc(x, y, size, 0, Math.PI * 2);
  starCtx.fill();
}

const skyTexture = new THREE.CanvasTexture(starCanvas);
skyTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTexture;

function setStatus(message) {
  statusEl.textContent = message;
}

function formatLatitude(latitude) {
  const absolute = Math.abs(latitude).toFixed(1);
  if (Math.abs(latitude) < 0.05) {
    return `${absolute}°`;
  }
  return `${absolute}°${latitude >= 0 ? "N" : "S"}`;
}

function updateOrbitModeUi() {
  for (const button of orbitModeButtons) {
    button.classList.toggle("active", button.dataset.orbitMode === orbitMode);
  }
  orbitLabelEl.textContent = orbitModes[orbitMode].label;
}

function getCurrentOrbitRadius() {
  if (orbitMode === "auto") {
    return ORBIT_RADIUS_MID + Math.sin(orbitSeasonPhase) * ORBIT_RADIUS_AMPLITUDE;
  }
  return orbitModes[orbitMode].radius;
}

function updateSeasonPresentation(radius) {
  const latitude = latitudeFromProjectedRadius(radius);
  const ratio = THREE.MathUtils.clamp(latitude / TROPIC_LATITUDE, -1, 1);
  const northWarmth = THREE.MathUtils.clamp((ratio + 1) / 2, 0, 1);
  const southWarmth = 1 - northWarmth;

  northSeasonOverlay.material.color.setRGB(
    THREE.MathUtils.lerp(0.48, 1.0, northWarmth),
    THREE.MathUtils.lerp(0.73, 0.83, northWarmth),
    THREE.MathUtils.lerp(1.0, 0.49, northWarmth)
  );
  northSeasonOverlay.material.opacity = THREE.MathUtils.lerp(0.05, 0.18, Math.abs(ratio));

  southSeasonOverlay.material.color.setRGB(
    THREE.MathUtils.lerp(0.48, 1.0, southWarmth),
    THREE.MathUtils.lerp(0.73, 0.83, southWarmth),
    THREE.MathUtils.lerp(1.0, 0.49, southWarmth)
  );
  southSeasonOverlay.material.opacity = THREE.MathUtils.lerp(0.05, 0.18, Math.abs(ratio));

  seasonLatitudeEl.textContent = formatLatitude(latitude);

  if (Math.abs(latitude) < 1.2) {
    seasonSummaryEl.textContent = "양 반구 전환기 / 적도 통과";
    seasonDetailEl.textContent = "태양이 적도 부근 궤도를 지나면서 북반구와 남반구의 계절이 바뀌는 구간으로 표시합니다.";
    return;
  }

  if (latitude > 0) {
    seasonSummaryEl.textContent = "북반구 여름 / 남반구 겨울";
    seasonDetailEl.textContent = "태양이 북쪽 회귀선 쪽으로 올라갈수록 북반구를 더 직접 비추고, 남반구는 상대적으로 멀어지는 설정으로 표현합니다.";
    return;
  }

  seasonSummaryEl.textContent = "북반구 겨울 / 남반구 여름";
  seasonDetailEl.textContent = "태양이 남쪽 회귀선 쪽으로 내려갈수록 남반구를 더 직접 비추고, 북반구는 상대적으로 멀어지는 설정으로 표현합니다.";
}

function drawOrbitCircle(ctx, size, radius, strokeStyle) {
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius * (size / 2), 0, Math.PI * 2);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = Math.max(2, size * ORBIT_SURFACE_LINE_WIDTH);
  ctx.shadowColor = strokeStyle;
  ctx.shadowBlur = size * 0.01;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawSurfaceOrbitGuides(ctx, size) {
  drawOrbitCircle(ctx, size, TROPIC_CANCER_RADIUS / DISC_RADIUS, "rgba(255, 203, 113, 0.92)");
  drawOrbitCircle(ctx, size, EQUATOR_RADIUS / DISC_RADIUS, "rgba(133, 224, 255, 0.88)");
  drawOrbitCircle(ctx, size, TROPIC_CAPRICORN_RADIUS / DISC_RADIUS, "rgba(255, 148, 188, 0.92)");
}

function configureTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  topMaterial.map = texture;
  topMaterial.needsUpdate = true;
}

function createSquareTextureFromImage(image) {
  const side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceX = Math.floor((sourceWidth - side) / 2);
  const sourceY = Math.floor((sourceHeight - side) / 2);

  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = side;
  mapCanvas.height = side;

  const ctx = mapCanvas.getContext("2d");
  ctx.clearRect(0, 0, side, side);
  ctx.drawImage(image, sourceX, sourceY, side, side, 0, 0, side, side);
  drawSurfaceOrbitGuides(ctx, side);

  const texture = new THREE.CanvasTexture(mapCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadSquareTexture(url, successMessage, errorHandler, finalize) {
  const image = new Image();
  image.onload = () => {
    configureTexture(createSquareTextureFromImage(image));
    setStatus(successMessage);
    if (finalize) {
      finalize();
    }
  };
  image.onerror = () => {
    errorHandler();
    if (finalize) {
      finalize();
    }
  };
  image.src = url;
}

function createFallbackTexture() {
  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = 2048;
  mapCanvas.height = 2048;
  const ctx = mapCanvas.getContext("2d");

  const gradient = ctx.createRadialGradient(1024, 1024, 120, 1024, 1024, 1024);
  gradient.addColorStop(0, "#2d6d92");
  gradient.addColorStop(1, "#0c3953");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 2048);

  ctx.strokeStyle = "rgba(210, 233, 255, 0.3)";
  ctx.lineWidth = 2;
  for (let ring = 180; ring <= 950; ring += 110) {
    ctx.beginPath();
    ctx.arc(1024, 1024, ring, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
    ctx.beginPath();
    ctx.moveTo(1024, 1024);
    ctx.lineTo(1024 + Math.cos(angle) * 960, 1024 + Math.sin(angle) * 960);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 112px Space Grotesk, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DROP A FLAT MAP", 1024, 980);
  ctx.font = "40px Space Grotesk, sans-serif";
  ctx.fillStyle = "rgba(235,245,255,0.9)";
  ctx.fillText("or place assets/flat-earth-map.png", 1024, 1060);
  drawSurfaceOrbitGuides(ctx, 2048);

  const fallback = new THREE.CanvasTexture(mapCanvas);
  fallback.colorSpace = THREE.SRGBColorSpace;
  return fallback;
}

function applyFallback() {
  configureTexture(createFallbackTexture());
  setStatus("기본 텍스처가 없어 임시 맵을 표시 중입니다. 이미지를 올리면 교체됩니다.");
}

function loadDefaultTexture() {
  loadSquareTexture(
    DEFAULT_MAP_PATH,
    `${DEFAULT_MAP_LABEL} 텍스처를 정사각형으로 맞춰 적용했습니다.`,
    () => {
      applyFallback();
    }
  );
}

function loadUserTexture(file) {
  if (!file) {
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  loadSquareTexture(
    objectUrl,
    `${file.name} 텍스처를 정사각형으로 맞춰 적용했습니다.`,
    () => {
      setStatus("이미지를 불러오지 못했습니다. PNG 또는 JPG를 다시 시도하세요.");
    },
    () => {
      URL.revokeObjectURL(objectUrl);
    }
  );
}

function clampCamera() {
  cameraState.targetPhi = Math.min(Math.max(cameraState.targetPhi, 0.3), 1.48);
  cameraState.targetRadius = Math.min(Math.max(cameraState.targetRadius, 7.2), 16);
}

function updateCamera() {
  cameraState.theta += (cameraState.targetTheta - cameraState.theta) * 0.08;
  cameraState.phi += (cameraState.targetPhi - cameraState.phi) * 0.08;
  cameraState.radius += (cameraState.targetRadius - cameraState.radius) * 0.08;

  const sinPhi = Math.sin(cameraState.phi);
  camera.position.set(
    cameraState.radius * sinPhi * Math.sin(cameraState.theta),
    cameraState.radius * Math.cos(cameraState.phi),
    cameraState.radius * sinPhi * Math.cos(cameraState.theta)
  );
  camera.lookAt(0, 0.15, 0);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerWidth <= 820 ? Math.round(window.innerHeight * 0.66) : window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

let isDragging = false;
let previousX = 0;
let previousY = 0;

canvas.addEventListener("pointerdown", (event) => {
  isDragging = true;
  previousX = event.clientX;
  previousY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDragging) {
    return;
  }

  const deltaX = event.clientX - previousX;
  const deltaY = event.clientY - previousY;

  cameraState.targetTheta -= deltaX * 0.008;
  cameraState.targetPhi += deltaY * 0.006;
  clampCamera();

  previousX = event.clientX;
  previousY = event.clientY;
});

function stopDrag(event) {
  if (!isDragging) {
    return;
  }
  isDragging = false;
  if (event) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointerleave", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  cameraState.targetRadius += event.deltaY * 0.01;
  clampCamera();
}, { passive: false });

uploadInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  loadUserTexture(file);
});

resetButton.addEventListener("click", () => {
  cameraState.targetTheta = -0.55;
  cameraState.targetPhi = 1.12;
  cameraState.targetRadius = 10.5;
});

for (const button of orbitModeButtons) {
  button.addEventListener("click", () => {
    orbitMode = button.dataset.orbitMode;
    updateOrbitModeUi();
  });
}

window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  stage.rotation.y += 0.0017;
  orbitSunAngle += ORBIT_SUN_SPEED;
  if (orbitMode === "auto") {
    orbitSeasonPhase += ORBIT_SUN_SEASON_SPEED;
  }
  const orbitRadius = getCurrentOrbitRadius();
  orbitSun.position.set(
    Math.cos(orbitSunAngle) * orbitRadius,
    ORBIT_SUN_HEIGHT,
    Math.sin(orbitSunAngle) * orbitRadius
  );
  updateSeasonPresentation(orbitRadius);
  updateCamera();
  renderer.render(scene, camera);
}

resize();
loadDefaultTexture();
updateOrbitModeUi();
updateSeasonPresentation(getCurrentOrbitRadius());
animate();
