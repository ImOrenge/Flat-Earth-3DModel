import * as THREE from "./vendor/three.module.js";

const DEFAULT_MAP_PATH = "./assets/flat-earth-map.png";
const DEFAULT_MAP_LABEL = "assets/flat-earth-map.png";
const DISC_RADIUS = 5;
const DISC_HEIGHT = 0.36;
const RIM_THICKNESS = 0.28;
const RIM_OUTER_RADIUS = DISC_RADIUS;
const RIM_INNER_RADIUS = DISC_RADIUS - RIM_THICKNESS;
const RIM_HEIGHT = 0.62;
const DOME_RADIUS = RIM_INNER_RADIUS - 0.14;
const DOME_BASE_Y = 0.46;

const canvas = document.getElementById("scene");
const statusEl = document.getElementById("status");
const uploadInput = document.getElementById("map-upload");
const resetButton = document.getElementById("reset-camera");

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

const iceWall = new THREE.Mesh(
  new THREE.CylinderGeometry(RIM_OUTER_RADIUS, RIM_OUTER_RADIUS, RIM_HEIGHT, 128, 1, true),
  new THREE.MeshStandardMaterial({
    color: 0xf3f7ff,
    roughness: 0.72,
    metalness: 0.02,
    transparent: true,
    opacity: 0.95
  })
);
iceWall.position.y = 0.11;
stage.add(iceWall);

const iceCap = new THREE.Mesh(
  new THREE.TorusGeometry((RIM_OUTER_RADIUS + RIM_INNER_RADIUS) / 2, RIM_THICKNESS / 2, 16, 128),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.02
  })
);
iceCap.rotation.x = Math.PI / 2;
iceCap.position.y = 0.42;
stage.add(iceCap);

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

const sun = new THREE.DirectionalLight(0xeaf4ff, 1.7);
sun.position.set(5, 7, 6);
scene.add(sun);

const rimLight = new THREE.DirectionalLight(0x8fd9ff, 0.85);
rimLight.position.set(-7, 4, -5);
scene.add(rimLight);

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

window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  stage.rotation.y += 0.0017;
  updateCamera();
  renderer.render(scene, camera);
}

resize();
loadDefaultTexture();
animate();
