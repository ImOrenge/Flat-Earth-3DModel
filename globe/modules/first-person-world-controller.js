import * as THREE from "../../vendor/three.module.js";
import { getGlobeBasisFromGeo } from "./geo-utils.js";

const DEFAULT_FOG_COLOR = new THREE.Color(0x06101d);

function drawGroundTexture(context, size) {
  context.clearRect(0, 0, size, size);
  context.fillStyle = "#6f8578";
  context.fillRect(0, 0, size, size);

  for (let layer = 0; layer < 7; layer += 1) {
    const alpha = 0.035 + (layer * 0.012);
    context.strokeStyle = `rgba(255,255,255,${alpha})`;
    context.lineWidth = 2 + layer;
    context.beginPath();
    context.arc(size / 2, size / 2, size * (0.16 + (layer * 0.08)), 0, Math.PI * 2);
    context.stroke();
  }

  for (let index = 0; index < 180; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const width = 8 + (Math.random() * 38);
    const height = 2 + (Math.random() * 7);
    const alpha = 0.018 + (Math.random() * 0.05);
    context.fillStyle = `rgba(28,38,31,${alpha})`;
    context.fillRect(x, y, width, height);
  }
}

function createGroundMaskTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.18,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.72, "rgba(255,255,255,1)");
  gradient.addColorStop(0.9, "rgba(255,255,255,0.96)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

const GROUND_PATCH_RADIUS_DEGREES = 3.2;
const GROUND_PATCH_REDRAW_THRESHOLD_DEGREES = 0.06;
const GROUND_PATCH_SEGMENTS = 96;

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, "rgba(255,248,210,1)");
  gradient.addColorStop(0.2, "rgba(255,206,120,0.92)");
  gradient.addColorStop(0.45, "rgba(255,120,72,0.42)");
  gradient.addColorStop(1, "rgba(255,120,72,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSilhouetteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255,255,255,0)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.beginPath();
  context.moveTo(0, canvas.height);

  let x = 0;
  let ridgeHeight = canvas.height * 0.44;
  while (x <= canvas.width + 80) {
    const step = 50 + (Math.random() * 120);
    ridgeHeight += (Math.random() - 0.5) * 90;
    ridgeHeight = THREE.MathUtils.clamp(ridgeHeight, canvas.height * 0.2, canvas.height * 0.7);
    context.lineTo(x, ridgeHeight);
    x += step;
  }

  context.lineTo(canvas.width, canvas.height);
  context.closePath();
  context.fillStyle = "#ffffff";
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHorizonVeilTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, canvas.height, 0, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.72)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.18)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0.02)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function nextRandom() {
    state = ((state * 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createOceanTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  context.fillStyle = "#7db4c9";
  context.fillRect(0, 0, size, size);

  for (let index = 0; index < 280; index += 1) {
    const y = Math.random() * size;
    const x = Math.random() * size;
    const width = (size * 0.04) + (Math.random() * size * 0.12);
    const alpha = 0.025 + (Math.random() * 0.06);
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.fillRect(x, y, width, 2 + (Math.random() * 2));
  }

  for (let index = 0; index < 220; index += 1) {
    const radius = 8 + (Math.random() * 30);
    const x = Math.random() * size;
    const y = Math.random() * size;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255,255,255,0.09)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function getOffsetGeoFromAzimuth(observerGeo, azimuthRadians, distanceDegrees) {
  const latitudeRadians = THREE.MathUtils.degToRad(observerGeo.latitudeDegrees);
  const northOffset = Math.cos(azimuthRadians) * distanceDegrees;
  const eastOffset = Math.sin(azimuthRadians) * distanceDegrees;
  const latitudeDegrees = THREE.MathUtils.clamp(
    observerGeo.latitudeDegrees + northOffset,
    -89.5,
    89.5
  );
  const longitudeScale = Math.max(Math.cos(latitudeRadians), 0.15);
  const longitudeDegrees = observerGeo.longitudeDegrees + (eastOffset / longitudeScale);

  return {
    latitudeDegrees,
    longitudeDegrees
  };
}

export function createFirstPersonWorldController({
  scene,
  constants,
  walkerState,
  renderState,
  drawSurfacePatch,
  getSurfaceSample,
  getSurfaceSampleVersion = () => 0,
  ambient,
  keyLight,
  rimLight,
  topDownBackground,
  orbitSun
}) {
  const scaleDimension = (value) => value * (constants.MODEL_SCALE ?? 1);
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  if (!keyLight.target.parent) {
    scene.add(keyLight.target);
  }
  if (!rimLight.target.parent) {
    scene.add(rimLight.target);
  }

  const groundCanvas = document.createElement("canvas");
  groundCanvas.width = 1024;
  groundCanvas.height = 1024;
  const groundContext = groundCanvas.getContext("2d");
  drawGroundTexture(groundContext, groundCanvas.width);
  const groundTexture = new THREE.CanvasTexture(groundCanvas);
  const groundMaskTexture = createGroundMaskTexture(1024);
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.wrapS = THREE.ClampToEdgeWrapping;
  groundTexture.wrapT = THREE.ClampToEdgeWrapping;
  groundTexture.magFilter = THREE.LinearFilter;
  groundTexture.minFilter = THREE.LinearMipmapLinearFilter;
  groundTexture.generateMipmaps = true;
  const groundGeometry = new THREE.PlaneGeometry(
    constants.FIRST_PERSON_WORLD_RADIUS * 2,
    constants.FIRST_PERSON_WORLD_RADIUS * 2,
    GROUND_PATCH_SEGMENTS,
    GROUND_PATCH_SEGMENTS
  );
  const groundPositions = groundGeometry.attributes.position;
  const groundBaseCoordinates = new Float32Array(groundPositions.count * 2);
  for (let index = 0; index < groundPositions.count; index += 1) {
    groundBaseCoordinates[(index * 2)] = groundPositions.getX(index);
    groundBaseCoordinates[(index * 2) + 1] = groundPositions.getY(index);
  }
  const oceanTexture = createOceanTexture(1024);
  const shallowsTexture = createOceanTexture(1024);
  const oceanRepeat = Math.max(14, Math.round(constants.FIRST_PERSON_WORLD_RADIUS / 20));
  oceanTexture.repeat.set(oceanRepeat, oceanRepeat);
  shallowsTexture.repeat.set(Math.max(10, Math.round(oceanRepeat * 0.65)), Math.max(10, Math.round(oceanRepeat * 0.65)));

  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({
      map: groundTexture,
      alphaMap: groundMaskTexture,
      color: 0x708676,
      transparent: true,
      roughness: 0.96,
      metalness: 0.02,
      depthWrite: false
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = constants.SURFACE_Y + scaleDimension(0.004);
  root.add(ground);

  const distantSea = new THREE.Mesh(
    new THREE.RingGeometry(constants.FIRST_PERSON_WORLD_RADIUS * 0.36, constants.FIRST_PERSON_WORLD_RADIUS * 0.985, 160),
    new THREE.MeshStandardMaterial({
      map: oceanTexture,
      color: 0x5e90af,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      roughness: 0.32,
      metalness: 0.14,
      emissive: 0x27475d,
      emissiveIntensity: 0.18
    })
  );
  distantSea.rotation.x = -Math.PI / 2;
  distantSea.position.y = constants.SURFACE_Y + scaleDimension(0.008);
  root.add(distantSea);

  const distantShallows = new THREE.Mesh(
    new THREE.RingGeometry(constants.FIRST_PERSON_WORLD_RADIUS * 0.52, constants.FIRST_PERSON_WORLD_RADIUS * 0.97, 160),
    new THREE.MeshStandardMaterial({
      map: shallowsTexture,
      color: 0x8fc1d1,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      roughness: 0.4,
      metalness: 0.08,
      emissive: 0x4a7f92,
      emissiveIntensity: 0.12
    })
  );
  distantShallows.rotation.x = -Math.PI / 2;
  distantShallows.position.y = constants.SURFACE_Y + scaleDimension(0.012);
  root.add(distantShallows);

  const seaSheen = new THREE.Mesh(
    new THREE.RingGeometry(constants.FIRST_PERSON_WORLD_RADIUS * 0.72, constants.FIRST_PERSON_WORLD_RADIUS * 0.965, 160),
    new THREE.MeshBasicMaterial({
      color: 0xffd7a1,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  seaSheen.rotation.x = -Math.PI / 2;
  seaSheen.position.y = constants.SURFACE_Y + scaleDimension(0.018);
  root.add(seaSheen);

  const distantLandMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b755d,
    transparent: true,
    opacity: 0.92,
    roughness: 0.98,
    metalness: 0.02
  });
  const distantBeachMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7c09a,
    transparent: true,
    opacity: 0.84,
    depthWrite: false
  });
  const distantLandGroup = new THREE.Group();
  const distantLandFeatures = [];
  const nextRandom = createSeededRandom(129736);

  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2 + ((nextRandom() - 0.5) * 0.28);
    const radius = THREE.MathUtils.lerp(
      constants.FIRST_PERSON_WORLD_RADIUS * 0.69,
      constants.FIRST_PERSON_WORLD_RADIUS * 0.93,
      nextRandom()
    );
    const width = THREE.MathUtils.lerp(scaleDimension(12), scaleDimension(38), nextRandom());
    const depth = THREE.MathUtils.lerp(scaleDimension(5), scaleDimension(15), nextRandom());
    const height = THREE.MathUtils.lerp(scaleDimension(0.6), scaleDimension(2.2), nextRandom());
    const landMaterial = distantLandMaterial.clone();
    const landMass = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 18, 1, false),
      landMaterial
    );
    landMass.scale.set(width, height, depth);
    landMass.position.set(
      Math.cos(angle) * radius,
      constants.SURFACE_Y + (height * 0.33),
      Math.sin(angle) * radius
    );
    landMass.rotation.y = angle + (nextRandom() * Math.PI);
    distantLandGroup.add(landMass);

    const beachMaterial = distantBeachMaterial.clone();
    const beach = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 18, 1, false),
      beachMaterial
    );
    beach.scale.set(width * 0.82, height * 0.18, depth * 0.82);
    beach.position.set(
      landMass.position.x,
      constants.SURFACE_Y + scaleDimension(0.08),
      landMass.position.z
    );
    beach.rotation.y = landMass.rotation.y;
    distantLandGroup.add(beach);

    distantLandFeatures.push({
      angle,
      baseDepth: depth,
      baseHeight: height,
      baseRadius: radius,
      baseRotation: landMass.rotation.y,
      baseWidth: width,
      beach,
      beachMaterial,
      coastalDistanceDegrees: THREE.MathUtils.lerp(5.5, 11.5, nextRandom()),
      horizonDistanceDegrees: THREE.MathUtils.lerp(10, 20, nextRandom()),
      index,
      landMass,
      landMaterial
    });
  }

  root.add(distantLandGroup);

  const horizonWall = new THREE.Mesh(
    new THREE.CylinderGeometry(
      constants.FIRST_PERSON_HORIZON_RADIUS,
      constants.FIRST_PERSON_HORIZON_RADIUS,
      scaleDimension(20),
      96,
      1,
      true
    ),
    new THREE.MeshBasicMaterial({
      color: 0xd7a36e,
      transparent: true,
      opacity: 0.48,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  horizonWall.position.y = constants.SURFACE_Y + scaleDimension(10.5);
  horizonWall.renderOrder = 27;
  root.add(horizonWall);

  const horizonGlow = new THREE.Mesh(
    new THREE.TorusGeometry(constants.FIRST_PERSON_HORIZON_RADIUS * 0.98, scaleDimension(1.2), 16, 128),
    new THREE.MeshBasicMaterial({
      color: 0xffb36f,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  horizonGlow.rotation.x = Math.PI / 2;
  horizonGlow.position.y = constants.SURFACE_Y + scaleDimension(0.8);
  root.add(horizonGlow);

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(constants.FIRST_PERSON_SKY_RADIUS, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenithColor: { value: new THREE.Color(0x356ec1) },
        uHorizonColor: { value: new THREE.Color(0xcfe5ff) },
        uWarmColor: { value: new THREE.Color(0xff8e54) },
        uNightColor: { value: new THREE.Color(0x081121) },
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uDayFactor: { value: 1 },
        uTwilightFactor: { value: 0 },
        uNightFactor: { value: 0 },
        uOpacity: { value: 0.94 }
      },
      vertexShader: `
        varying vec3 vLocalDirection;

        void main() {
          vLocalDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uWarmColor;
        uniform vec3 uNightColor;
        uniform vec3 uSunDirection;
        uniform float uDayFactor;
        uniform float uTwilightFactor;
        uniform float uNightFactor;
        uniform float uOpacity;
        varying vec3 vLocalDirection;

        void main() {
          vec3 dir = normalize(vLocalDirection);
          float height = clamp(dir.y, 0.0, 1.0);
          float horizonMix = pow(1.0 - height, 1.75);
          float zenithMix = pow(height, 0.68);
          vec3 baseColor = mix(uHorizonColor, uZenithColor, zenithMix);
          baseColor = mix(baseColor, uNightColor, uNightFactor * (0.72 + (0.28 * zenithMix)));

          vec3 horizontalDir = normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0001, 0.0, 0.0));
          vec3 horizontalSun = normalize(vec3(uSunDirection.x, 0.0, uSunDirection.z) + vec3(0.0001, 0.0, 0.0));
          float sunFacing = max(dot(horizontalDir, horizontalSun), 0.0);
          float sunsetBand = pow(sunFacing, 5.0) * exp(-abs(height - max(uSunDirection.y, 0.0) * 0.55) * 11.0);
          float horizonGlow = pow(sunFacing, 2.5) * pow(1.0 - height, 3.0);
          float sunDiscGlow = pow(max(dot(dir, normalize(uSunDirection)), 0.0), mix(14.0, 70.0, clamp(uDayFactor, 0.0, 1.0)));

          vec3 color = baseColor;
          color += uWarmColor * (sunsetBand * (0.85 * uTwilightFactor + 0.18 * uDayFactor));
          color += mix(uWarmColor, uHorizonColor, 0.55) * (horizonGlow * (0.75 * uTwilightFactor + 0.18));
          color += mix(vec3(1.0, 0.86, 0.62), uHorizonColor, 0.42) * sunDiscGlow * (0.7 * uDayFactor + 0.3 * uTwilightFactor);
          color = mix(color, uHorizonColor, horizonMix * 0.15 * uDayFactor);

          gl_FragColor = vec4(color, uOpacity);
        }
      `
    })
  );
  skyDome.position.y = constants.SURFACE_Y + scaleDimension(1.2);
  skyDome.visible = false;
  root.add(skyDome);

  // --- FP Sun (direction-based placement on sky) ---
  const FP_SKY_BODY_DIST = 250; // must be < camera far (280)
  const fpSunBody = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(12), 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff4d6,
      transparent: true,
      opacity: 1,
      depthWrite: false
    })
  );
  fpSunBody.renderOrder = 14;
  root.add(fpSunBody);

  const fpSunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(6.5), 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffd781,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  fpSunHalo.renderOrder = 12;
  root.add(fpSunHalo);

  // --- FP Moon (direction-based placement on sky) ---
  const fpMoonBody = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(1.5), 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0xeeeef4,
      transparent: true,
      opacity: 1,
      depthWrite: false
    })
  );
  fpMoonBody.renderOrder = 10;
  root.add(fpMoonBody);

  const fpMoonHalo = new THREE.Mesh(
    new THREE.SphereGeometry(scaleDimension(4.0), 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xcfd8f7,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  fpMoonHalo.renderOrder = 8;
  root.add(fpMoonHalo);

  const tempMoonDirection = new THREE.Vector3();

  const glowTexture = createGlowTexture();
  const silhouetteTexture = createSilhouetteTexture();
  const horizonVeilTexture = createHorizonVeilTexture();
  const sunsetGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffb06e,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  sunsetGlow.scale.set(scaleDimension(30), scaleDimension(18), 1);
  root.add(sunsetGlow);

  const horizonSilhouette = new THREE.Mesh(
    new THREE.CylinderGeometry(
      constants.FIRST_PERSON_HORIZON_RADIUS * 0.992,
      constants.FIRST_PERSON_HORIZON_RADIUS * 0.992,
      scaleDimension(12),
      160,
      1,
      true
    ),
    new THREE.MeshBasicMaterial({
      alphaMap: silhouetteTexture,
      color: 0x2f2f36,
      transparent: true,
      opacity: 0.92,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  horizonSilhouette.position.y = constants.SURFACE_Y + scaleDimension(5.6);
  horizonSilhouette.renderOrder = 25;
  root.add(horizonSilhouette);

  const horizonVeil = new THREE.Mesh(
    new THREE.CylinderGeometry(
      constants.FIRST_PERSON_HORIZON_RADIUS * 0.975,
      constants.FIRST_PERSON_HORIZON_RADIUS * 0.975,
      scaleDimension(16),
      128,
      1,
      true
    ),
    new THREE.MeshBasicMaterial({
      alphaMap: horizonVeilTexture,
      color: 0xffc08c,
      transparent: true,
      opacity: 0.46,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
  );
  horizonVeil.position.y = constants.SURFACE_Y + scaleDimension(6.8);
  horizonVeil.renderOrder = 26;
  root.add(horizonVeil);

  const tempObserverModelPosition = new THREE.Vector3();
  const tempSunDirection = new THREE.Vector3();
  const tempSunWorldDirection = new THREE.Vector3();
  const tempLightPosition = new THREE.Vector3();
  const tempObserverNorth = new THREE.Vector3();
  const tempObserverEast = new THREE.Vector3();
  const tempObserverUp = new THREE.Vector3();
  const tempObserverQuaternion = new THREE.Quaternion();
  const tempObserverQuaternionInverse = new THREE.Quaternion();
  const tempObserverBasisMatrix = new THREE.Matrix4();
  const topColor = new THREE.Color();
  const horizonColor = new THREE.Color();
  const warmColor = new THREE.Color();
  const nightSkyColor = new THREE.Color();
  const fogTargetColor = new THREE.Color();
  const ambientTargetColor = new THREE.Color();
  const keyTargetColor = new THREE.Color();
  const rimTargetColor = new THREE.Color();
  const seaTargetColor = new THREE.Color();
  const shallowsTargetColor = new THREE.Color();
  const seaSheenColor = new THREE.Color();
  const sampledGroundBase = new THREE.Color(0x708676);
  const sampledSeaBase = new THREE.Color(0x5f94b6);
  const sampledLandBase = new THREE.Color(0x7d765d);
  const sampledBeachBase = new THREE.Color(0xdcc7a0);
  const sampledHorizonBase = new THREE.Color(0xd7a36e);
  const sampledGlowBase = new THREE.Color(0xffb36f);
  const tempSampleColor = new THREE.Color();
  const surfacePaletteCache = {
    key: "",
    beachOpacity: 0.84,
    horizonLandPresence: 0.6,
    landOpacity: 0.92
  };
  const groundPatchCache = {
    latitudeDegrees: Number.NaN,
    longitudeDegrees: Number.NaN,
    version: -1
  };
  const observerEyeOffset = Math.max(
    walkerState.eyeHeightOffset ?? Math.max(constants.WALKER_EYE_HEIGHT - constants.SURFACE_Y, scaleDimension(0.05)),
    0.0001
  );

  function applySampleColor(target, sample, fallbackHex) {
    target.setHex(fallbackHex);
    if (!sample) {
      return target;
    }
    tempSampleColor.setRGB(sample.r, sample.g, sample.b);
    target.copy(tempSampleColor);
    return target;
  }

  function refreshSurfacePalette(observerGeo) {
    const sampleVersion = getSurfaceSampleVersion?.() ?? 0;
    const cacheKey = `${sampleVersion}:${observerGeo.latitudeDegrees.toFixed(1)}:${observerGeo.longitudeDegrees.toFixed(1)}`;
    if (surfacePaletteCache.key === cacheKey) {
      return surfacePaletteCache;
    }

    surfacePaletteCache.key = cacheKey;
    const centerSample = getSurfaceSample?.(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees, 2.4) ?? null;
    const horizonSamples = [
      getSurfaceSample?.(observerGeo.latitudeDegrees + 8, observerGeo.longitudeDegrees, 5.5) ?? null,
      getSurfaceSample?.(observerGeo.latitudeDegrees - 8, observerGeo.longitudeDegrees, 5.5) ?? null,
      getSurfaceSample?.(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees + 10, 5.5) ?? null,
      getSurfaceSample?.(observerGeo.latitudeDegrees, observerGeo.longitudeDegrees - 10, 5.5) ?? null
    ].filter(Boolean);

    const horizonAggregate = horizonSamples.length > 0
      ? horizonSamples.reduce((accumulator, sample) => {
        accumulator.r += sample.r;
        accumulator.g += sample.g;
        accumulator.b += sample.b;
        accumulator.waterness += sample.waterness;
        accumulator.vegetation += sample.vegetation;
        accumulator.arid += sample.arid;
        accumulator.ice += sample.ice;
        return accumulator;
      }, {
        r: 0,
        g: 0,
        b: 0,
        waterness: 0,
        vegetation: 0,
        arid: 0,
        ice: 0
      })
      : null;

    const horizonSample = horizonAggregate
      ? {
        r: horizonAggregate.r / horizonSamples.length,
        g: horizonAggregate.g / horizonSamples.length,
        b: horizonAggregate.b / horizonSamples.length,
        waterness: horizonAggregate.waterness / horizonSamples.length,
        vegetation: horizonAggregate.vegetation / horizonSamples.length,
        arid: horizonAggregate.arid / horizonSamples.length,
        ice: horizonAggregate.ice / horizonSamples.length
      }
      : centerSample;

    applySampleColor(sampledGroundBase, centerSample, 0x708676);
    sampledGroundBase.lerp(new THREE.Color(0x6f8578), 0.22);

    applySampleColor(sampledLandBase, horizonSample, 0x7d765d);
    sampledLandBase.lerp(new THREE.Color(0x7b755d), 0.26);

    applySampleColor(sampledBeachBase, centerSample ?? horizonSample, 0xdcc7a0);
    sampledBeachBase.lerp(new THREE.Color(0xe0c79f), 0.58);

    applySampleColor(sampledSeaBase, horizonSample ?? centerSample, 0x5f94b6);
    sampledSeaBase.lerp(new THREE.Color(0x5f94b6), 0.68 + (0.22 * (1 - (horizonSample?.waterness ?? 0.5))));

    applySampleColor(sampledHorizonBase, horizonSample ?? centerSample, 0xd7a36e);
    sampledHorizonBase.lerp(sampledSeaBase, horizonSample?.waterness ?? 0.4);
    sampledHorizonBase.lerp(new THREE.Color(0xd7a36e), 0.26);

    sampledGlowBase.copy(sampledHorizonBase).lerp(new THREE.Color(0xffb36f), 0.44);

    const centerWaterness = centerSample?.waterness ?? 0.45;
    const horizonWaterness = horizonSample?.waterness ?? centerWaterness;
    const horizonVegetation = horizonSample?.vegetation ?? 0.25;
    const horizonIce = horizonSample?.ice ?? 0;
    surfacePaletteCache.landOpacity = THREE.MathUtils.clamp(
      0.18 + ((1 - horizonWaterness) * 0.92) + (horizonIce * 0.08),
      0.14,
      0.96
    );
    surfacePaletteCache.beachOpacity = THREE.MathUtils.clamp(
      0.12 + ((1 - Math.abs(centerWaterness - 0.5) * 2) * 0.76),
      0.08,
      0.9
    );
    surfacePaletteCache.horizonLandPresence = THREE.MathUtils.clamp(
      (1 - horizonWaterness) * 0.82 + (horizonVegetation * 0.28) + (horizonIce * 0.2),
      0.08,
      1
    );

    return surfacePaletteCache;
  }

  function refreshGroundPatch(observerGeo) {
    const sampleVersion = getSurfaceSampleVersion?.() ?? 0;
    const latitudeDelta = Math.abs(observerGeo.latitudeDegrees - groundPatchCache.latitudeDegrees);
    const longitudeDelta = Math.abs(THREE.MathUtils.euclideanModulo(
      (observerGeo.longitudeDegrees - groundPatchCache.longitudeDegrees) + 180,
      360
    ) - 180);
    const shouldRedraw = (
      sampleVersion !== groundPatchCache.version
      || !Number.isFinite(groundPatchCache.latitudeDegrees)
      || !Number.isFinite(groundPatchCache.longitudeDegrees)
      || latitudeDelta > GROUND_PATCH_REDRAW_THRESHOLD_DEGREES
      || longitudeDelta > GROUND_PATCH_REDRAW_THRESHOLD_DEGREES
    );

    if (!shouldRedraw) {
      return;
    }

    const drewPatch = drawSurfacePatch?.(groundContext, groundCanvas.width, groundCanvas.height, {
      centerLatitudeDegrees: observerGeo.latitudeDegrees,
      centerLongitudeDegrees: observerGeo.longitudeDegrees,
      angularRadiusDegrees: GROUND_PATCH_RADIUS_DEGREES
    }) ?? false;

    if (!drewPatch) {
      drawGroundTexture(groundContext, groundCanvas.width);
    }

    groundPatchCache.latitudeDegrees = observerGeo.latitudeDegrees;
    groundPatchCache.longitudeDegrees = observerGeo.longitudeDegrees;
    groundPatchCache.version = sampleVersion;
    groundTexture.needsUpdate = true;

    const virtualCurvatureRadius = constants.FIRST_PERSON_WORLD_RADIUS * 11.5;
    const terrainReliefScale = scaleDimension(1.45);
    for (let index = 0; index < groundPositions.count; index += 1) {
      const baseX = groundBaseCoordinates[index * 2];
      const baseY = groundBaseCoordinates[(index * 2) + 1];
      const normalizedEast = baseX / constants.FIRST_PERSON_WORLD_RADIUS;
      const normalizedNorth = -baseY / constants.FIRST_PERSON_WORLD_RADIUS;
      const radialFactor = Math.min(Math.hypot(normalizedEast, normalizedNorth), 1.35);
      const eastOffsetDegrees = normalizedEast * GROUND_PATCH_RADIUS_DEGREES;
      const northOffsetDegrees = normalizedNorth * GROUND_PATCH_RADIUS_DEGREES;
      const distanceDegrees = Math.min(
        Math.hypot(eastOffsetDegrees, northOffsetDegrees),
        GROUND_PATCH_RADIUS_DEGREES * Math.SQRT2
      );
      const azimuthRadians = Math.atan2(eastOffsetDegrees, northOffsetDegrees);
      const sampleGeo = getOffsetGeoFromAzimuth(
        observerGeo,
        azimuthRadians,
        distanceDegrees
      );
      const sample = getSurfaceSample?.(
        sampleGeo.latitudeDegrees,
        sampleGeo.longitudeDegrees,
        THREE.MathUtils.lerp(0.18, 0.52, Math.min(radialFactor, 1))
      ) ?? null;
      const waterness = sample?.waterness ?? 0.42;
      const landness = 1 - waterness;
      const vegetation = sample?.vegetation ?? 0;
      const arid = sample?.arid ?? 0;
      const ice = sample?.ice ?? 0;
      const luminance = sample?.luminance ?? 0.5;
      const reliefProfile = (
        (landness * 0.92)
        + (vegetation * 0.34)
        + (arid * 0.22)
        + (ice * 0.4)
        + ((luminance - 0.5) * 0.28)
        - (waterness * 0.38)
      );
      const edgeFade = 1 - THREE.MathUtils.smoothstep(radialFactor, 0.9, 1.18);
      const reliefHeight = reliefProfile * terrainReliefScale * edgeFade;
      const planarRadius = Math.hypot(baseX, baseY);
      const curvatureSag = (planarRadius * planarRadius) / (2 * virtualCurvatureRadius);

      groundPositions.setZ(index, reliefHeight - curvatureSag);
    }

    groundPositions.needsUpdate = true;
    groundGeometry.computeVertexNormals();
  }

  function updateDistantLandFeatures(observerGeo, dayFactor, twilightFactor, nightFactor, surfacePalette) {
    for (const feature of distantLandFeatures) {
      const azimuthRadians = feature.angle;
      const horizonGeo = getOffsetGeoFromAzimuth(observerGeo, azimuthRadians, feature.horizonDistanceDegrees);
      const coastalGeo = getOffsetGeoFromAzimuth(observerGeo, azimuthRadians, feature.coastalDistanceDegrees);
      const horizonSample = getSurfaceSample?.(horizonGeo.latitudeDegrees, horizonGeo.longitudeDegrees, 4.4) ?? null;
      const coastalSample = getSurfaceSample?.(coastalGeo.latitudeDegrees, coastalGeo.longitudeDegrees, 2.8) ?? horizonSample;
      const waterness = horizonSample?.waterness ?? coastalSample?.waterness ?? 0.45;
      const vegetation = horizonSample?.vegetation ?? coastalSample?.vegetation ?? 0.2;
      const arid = horizonSample?.arid ?? coastalSample?.arid ?? 0.12;
      const ice = horizonSample?.ice ?? coastalSample?.ice ?? 0;
      const landPresence = THREE.MathUtils.clamp(
        ((1 - waterness) * 1.12) + (vegetation * 0.22) + (arid * 0.12) + (ice * 0.18),
        0,
        1
      );
      const coastalPresence = THREE.MathUtils.clamp(
        ((1 - Math.abs((coastalSample?.waterness ?? waterness) - 0.5) * 2) * 0.82) + (landPresence * 0.24),
        0,
        1
      );
      const radius = THREE.MathUtils.lerp(feature.baseRadius * 1.04, feature.baseRadius * 0.88, landPresence);
      const width = feature.baseWidth * THREE.MathUtils.lerp(0.24, 1.18, landPresence);
      const depth = feature.baseDepth * THREE.MathUtils.lerp(0.2, 1.14, landPresence);
      const height = feature.baseHeight * THREE.MathUtils.lerp(
        0.12,
        1.42 + (vegetation * 0.1) + (arid * 0.08) + (ice * 0.16),
        landPresence
      );
      const x = Math.cos(feature.angle) * radius;
      const z = Math.sin(feature.angle) * radius;

      feature.landMass.visible = landPresence > 0.14;
      feature.beach.visible = coastalPresence > 0.1;
      feature.landMass.scale.set(width, Math.max(height, 0.0001), depth);
      feature.landMass.position.set(x, constants.SURFACE_Y + (height * 0.33), z);
      feature.landMass.rotation.y = feature.baseRotation + (vegetation - arid) * 0.35;
      feature.beach.scale.set(
        Math.max(width * 0.82, 0.0001),
        Math.max(height * 0.18, scaleDimension(0.025)),
        Math.max(depth * 0.82, 0.0001)
      );
      feature.beach.position.set(x, constants.SURFACE_Y + scaleDimension(0.08), z);
      feature.beach.rotation.y = feature.landMass.rotation.y;

      applySampleColor(feature.landMaterial.color, horizonSample ?? coastalSample, 0x7d765d);
      feature.landMaterial.color
        .lerp(new THREE.Color(0x4f5f4b), dayFactor * (0.22 + (vegetation * 0.16)))
        .lerp(new THREE.Color(0x8f8f92), ice * 0.42)
        .lerp(new THREE.Color(0xa96d4c), twilightFactor * (0.12 + (arid * 0.24)))
        .lerp(new THREE.Color(0x30354a), nightFactor * 0.84);
      feature.landMaterial.opacity = THREE.MathUtils.clamp(
        landPresence * surfacePalette.horizonLandPresence * 1.08,
        0.06,
        0.96
      );

      applySampleColor(feature.beachMaterial.color, coastalSample ?? horizonSample, 0xdcc7a0);
      feature.beachMaterial.color
        .lerp(new THREE.Color(0xf5d1a4), 0.36 + (arid * 0.2))
        .lerp(new THREE.Color(0xdce8f6), ice * 0.34)
        .lerp(new THREE.Color(0xffc48e), twilightFactor * 0.24)
        .lerp(new THREE.Color(0x657a9a), nightFactor * 0.78);
      feature.beachMaterial.opacity = THREE.MathUtils.lerp(0.06, 0.86, coastalPresence);
    }

    distantLandGroup.visible = distantLandFeatures.some((feature) => feature.landMass.visible || feature.beach.visible);
  }

  function getObserverGeo() {
    return {
      latitudeDegrees: walkerState.latitudeDegrees ?? constants.WALKER_START_LATITUDE,
      longitudeDegrees: walkerState.longitudeDegrees ?? constants.WALKER_START_LONGITUDE
    };
  }

  function updateObserverFrame(observerGeo = getObserverGeo()) {
    const basis = getGlobeBasisFromGeo(
      observerGeo.latitudeDegrees,
      observerGeo.longitudeDegrees
    );
    tempObserverEast.set(basis.east.x, basis.east.y, basis.east.z).normalize();
    tempObserverUp.set(basis.up.x, basis.up.y, basis.up.z).normalize();
    tempObserverNorth.set(basis.north.x, basis.north.y, basis.north.z).normalize();
    tempObserverBasisMatrix.makeBasis(tempObserverEast, tempObserverUp, tempObserverNorth);
    tempObserverQuaternion.setFromRotationMatrix(tempObserverBasisMatrix);
    tempObserverQuaternionInverse.copy(tempObserverQuaternion).invert();
  }

  function syncSkyShader(dayFactor, twilightFactor, nightFactor) {
    topColor
      .setRGB(
        THREE.MathUtils.lerp(0.02, 0.31, dayFactor),
        THREE.MathUtils.lerp(0.03, 0.56, dayFactor),
        THREE.MathUtils.lerp(0.08, 0.92, dayFactor)
      )
      .lerp(new THREE.Color(0xff7c45), twilightFactor * 0.24)
      .lerp(new THREE.Color(0x040912), nightFactor * 0.9);
    horizonColor
      .setRGB(
        THREE.MathUtils.lerp(0.08, 0.84, dayFactor),
        THREE.MathUtils.lerp(0.12, 0.89, dayFactor),
        THREE.MathUtils.lerp(0.18, 0.98, dayFactor)
      )
      .lerp(new THREE.Color(0xff8a54), twilightFactor * 0.72)
      .lerp(new THREE.Color(0x13213e), nightFactor * 0.82);
    warmColor
      .setRGB(
        THREE.MathUtils.lerp(0.56, 1.0, twilightFactor),
        THREE.MathUtils.lerp(0.28, 0.64, twilightFactor),
        THREE.MathUtils.lerp(0.2, 0.42, twilightFactor)
      )
      .lerp(new THREE.Color(0xffd59d), dayFactor * 0.18);
    nightSkyColor
      .setRGB(
        THREE.MathUtils.lerp(0.03, 0.09, nightFactor),
        THREE.MathUtils.lerp(0.05, 0.14, nightFactor),
        THREE.MathUtils.lerp(0.1, 0.28, nightFactor)
      );

    skyDome.material.uniforms.uZenithColor.value.copy(topColor);
    skyDome.material.uniforms.uHorizonColor.value.copy(horizonColor);
    skyDome.material.uniforms.uWarmColor.value.copy(warmColor);
    skyDome.material.uniforms.uNightColor.value.copy(nightSkyColor);
    skyDome.material.uniforms.uDayFactor.value = dayFactor;
    skyDome.material.uniforms.uTwilightFactor.value = twilightFactor;
    skyDome.material.uniforms.uNightFactor.value = nightFactor;
    skyDome.material.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.72, 0.98, dayFactor + (twilightFactor * 0.3));
  }

  function update(snapshot) {
    const nowSeconds = performance.now() * 0.001;

    if (!walkerState.enabled || !snapshot) {
      root.visible = false;
      scene.background = topDownBackground;
      scene.fog.color.lerp(DEFAULT_FOG_COLOR, 0.08);
      ambient.color.lerp(new THREE.Color(0xc5d7ff), 0.08);
      keyLight.color.lerp(new THREE.Color(0xeaf4ff), 0.08);
      rimLight.color.lerp(new THREE.Color(0x8fd9ff), 0.08);
      // Restore sun opacity when leaving walker mode
      if (orbitSun) {
        orbitSun.traverse((child) => {
          if (child.isMesh && child.material && child.material._baseOpacity !== undefined) {
            child.material.opacity = child.material._baseOpacity;
          }
        });
      }
      return;
    }

    root.visible = true;
    const observerGeo = getObserverGeo();
    updateObserverFrame(observerGeo);
    const surfacePalette = refreshSurfacePalette(observerGeo);
    refreshGroundPatch(observerGeo);
    root.position.copy(walkerState.position).multiplyScalar(renderState.visualScale);
    root.quaternion.copy(tempObserverQuaternion);

    tempObserverModelPosition
      .copy(walkerState.position)
      .addScaledVector(tempObserverUp, observerEyeOffset);
    tempSunWorldDirection
      .copy(snapshot.sunRenderPosition ?? snapshot.sunPosition)
      .sub(tempObserverModelPosition)
      .normalize();
    tempSunDirection.copy(tempSunWorldDirection).applyQuaternion(tempObserverQuaternionInverse).normalize();
    const sunRenderPosition = snapshot.sunRenderPosition ?? snapshot.sunPosition;
    const sunAltitudeDegrees = THREE.MathUtils.radToDeg(Math.asin(
      THREE.MathUtils.clamp(tempSunDirection.y, -1, 1)
    ));
    const sunAltitudeRadians = THREE.MathUtils.degToRad(sunAltitudeDegrees);
    const solarEclipseReduction = THREE.MathUtils.clamp(snapshot.solarEclipse?.lightReduction ?? 0, 0, 1);
    const dayFactor = THREE.MathUtils.clamp(
      THREE.MathUtils.inverseLerp(0, 30, sunAltitudeDegrees) * (1 - (solarEclipseReduction * 0.55)),
      0,
      1
    );
    const twilightFactor = THREE.MathUtils.clamp(
      (1 - (Math.abs(sunAltitudeDegrees + 3) / 9)) + (solarEclipseReduction * 0.24),
      0,
      1
    );
    const nightFactor = THREE.MathUtils.clamp(
      ((-sunAltitudeDegrees - 5) / 20) + (solarEclipseReduction * 0.18),
      0,
      1
    );

    scene.background = null;

    fogTargetColor.copy(horizonColor).lerp(new THREE.Color(0x09111e), nightFactor * 0.68);
    scene.fog.color.lerp(fogTargetColor, 0.08);

    ground.material.color
      .setRGB(1, 1, 1)
      .lerp(sampledGroundBase, 0.18)
      .lerp(new THREE.Color(0x32404f), nightFactor * 0.7)
      .lerp(new THREE.Color(0xe1bc8b), twilightFactor * 0.14);
    oceanTexture.offset.x = nowSeconds * 0.0035;
    oceanTexture.offset.y = nowSeconds * 0.0022;
    shallowsTexture.offset.x = -nowSeconds * 0.0024;
    shallowsTexture.offset.y = nowSeconds * 0.0016;
    seaTargetColor.copy(sampledSeaBase)
      .lerp(new THREE.Color(0x6dc0cf), dayFactor * 0.28)
      .lerp(new THREE.Color(0x30506c), nightFactor * 0.82)
      .lerp(new THREE.Color(0xffa269), twilightFactor * 0.18);
    distantSea.material.color.lerp(
      seaTargetColor,
      0.08
    );
    distantSea.material.opacity = THREE.MathUtils.lerp(0.52, 0.88, 0.22 + dayFactor + (twilightFactor * 0.18));
    distantSea.material.emissive.lerp(
      seaTargetColor.clone().multiplyScalar(0.36),
      0.08
    );
    distantSea.material.emissiveIntensity = THREE.MathUtils.lerp(0.08, 0.26, twilightFactor + (dayFactor * 0.12));
    shallowsTargetColor.copy(sampledSeaBase)
      .lerp(new THREE.Color(0xa9dbe4), 0.42)
      .lerp(new THREE.Color(0x7cc5d4), dayFactor * 0.22)
      .lerp(new THREE.Color(0x4a6684), nightFactor * 0.86)
      .lerp(new THREE.Color(0xffc082), twilightFactor * 0.36);
    distantShallows.material.color.lerp(
      shallowsTargetColor,
      0.08
    );
    distantShallows.material.opacity = THREE.MathUtils.lerp(0.1, 0.28, dayFactor + (twilightFactor * 0.22));
    distantShallows.material.emissive.lerp(
      shallowsTargetColor.clone().multiplyScalar(0.28),
      0.08
    );
    distantShallows.material.emissiveIntensity = THREE.MathUtils.lerp(0.06, 0.18, dayFactor + twilightFactor);
    seaSheenColor.copy(sampledBeachBase)
      .lerp(new THREE.Color(0xffdfb0), 0.58)
      .lerp(new THREE.Color(0xff9b62), twilightFactor * 0.46)
      .lerp(new THREE.Color(0x7ea7d7), nightFactor * 0.82);
    seaSheen.material.color.lerp(seaSheenColor, 0.08);
    seaSheen.material.opacity = THREE.MathUtils.lerp(
      0.04,
      0.24,
      THREE.MathUtils.clamp((dayFactor * 0.7) + twilightFactor, 0, 1)
    );
    seaSheen.rotation.z = Math.sin(nowSeconds * 0.08) * 0.06;
    updateDistantLandFeatures(observerGeo, dayFactor, twilightFactor, nightFactor, surfacePalette);
    horizonWall.material.color.copy(sampledHorizonBase)
      .lerp(horizonColor, 0.58)
      .lerp(new THREE.Color(0x291922), twilightFactor * 0.24);
    horizonWall.material.opacity = THREE.MathUtils.lerp(0.2, 0.56, twilightFactor + (dayFactor * 0.25));
    horizonSilhouette.material.color.copy(sampledLandBase)
      .lerp(new THREE.Color(0x41362f), 0.42)
      .lerp(new THREE.Color(0x271f24), twilightFactor * 0.48)
      .lerp(new THREE.Color(0x10182b), nightFactor * 0.82);
    horizonSilhouette.material.opacity = THREE.MathUtils.lerp(
      0.18,
      0.96,
      surfacePalette.horizonLandPresence * (0.44 + twilightFactor + (nightFactor * 0.2))
    );
    horizonVeil.material.color.copy(sampledBeachBase)
      .lerp(new THREE.Color(0xffcc9d), 0.46)
      .lerp(new THREE.Color(0xff935f), twilightFactor * 0.58)
      .lerp(new THREE.Color(0x6f87bc), nightFactor * 0.86);
    horizonVeil.material.opacity = THREE.MathUtils.lerp(0.14, 0.58, twilightFactor + (nightFactor * 0.18));
    horizonGlow.material.color.copy(sampledGlowBase).lerp(new THREE.Color(0x6e89d8), nightFactor * 0.65);
    horizonGlow.material.opacity = THREE.MathUtils.lerp(0.05, 0.34, twilightFactor + (dayFactor * 0.22));

    syncSkyShader(dayFactor, twilightFactor, nightFactor);
    skyDome.material.uniforms.uSunDirection.value.copy(tempSunDirection);

    // --- FP Sun position (direction-based, rises from horizon) ---
    const sunAboveHorizon = tempSunDirection.y > -0.03;
    fpSunBody.visible = sunAboveHorizon;
    fpSunHalo.visible = sunAboveHorizon;
    if (sunAboveHorizon) {
      fpSunBody.position.copy(tempSunDirection).multiplyScalar(FP_SKY_BODY_DIST);
      fpSunHalo.position.copy(fpSunBody.position);
      // Fade near horizon
      const horizonFade = THREE.MathUtils.smoothstep(tempSunDirection.y, -0.03, 0.04);
      fpSunBody.material.opacity = horizonFade;
      fpSunHalo.material.opacity = 0.18 * horizonFade;
      // Eclipse dimming
      const eclipseRed = THREE.MathUtils.clamp(snapshot.solarEclipse?.lightReduction ?? 0, 0, 1);
      fpSunBody.material.color.lerpColors(
        new THREE.Color(0xfff4d6), new THREE.Color(0xff6633), eclipseRed * 0.7
      );
      fpSunHalo.material.opacity *= (1 - eclipseRed * 0.6);
    }

    // --- FP Moon position ---
    const moonPos = snapshot.moonRenderPosition ?? snapshot.moonPosition;
    tempMoonDirection
      .copy(moonPos)
      .sub(tempObserverModelPosition)
      .normalize()
      .applyQuaternion(tempObserverQuaternionInverse);
    const moonAboveHorizon = tempMoonDirection.y > -0.03;
    fpMoonBody.visible = moonAboveHorizon;
    fpMoonHalo.visible = moonAboveHorizon;
    if (moonAboveHorizon) {
      fpMoonBody.position.copy(tempMoonDirection).multiplyScalar(FP_SKY_BODY_DIST);
      fpMoonHalo.position.copy(fpMoonBody.position);
      const moonHorizonFade = THREE.MathUtils.smoothstep(tempMoonDirection.y, -0.03, 0.04);
      fpMoonBody.material.opacity = moonHorizonFade;
      fpMoonHalo.material.opacity = 0.12 * moonHorizonFade;
    }

    tempLightPosition.copy(root.position)
      .addScaledVector(tempSunWorldDirection, scaleDimension(56))
      .addScaledVector(tempObserverUp, observerEyeOffset * renderState.visualScale);
    tempLightPosition.addScaledVector(tempObserverUp, tempSunDirection.y * scaleDimension(42));
    keyLight.position.copy(tempLightPosition);
    keyLight.target.position.copy(root.position);

    tempLightPosition.copy(root.position)
      .addScaledVector(tempSunWorldDirection, scaleDimension(-34))
      .addScaledVector(tempObserverUp, scaleDimension(12));
    rimLight.position.copy(tempLightPosition);
    rimLight.target.position.copy(root.position).addScaledVector(tempObserverUp, scaleDimension(2));

    ambientTargetColor
      .setRGB(
        THREE.MathUtils.lerp(0.24, 0.86, dayFactor),
        THREE.MathUtils.lerp(0.28, 0.92, dayFactor),
        THREE.MathUtils.lerp(0.38, 1.0, dayFactor)
      )
      .lerp(new THREE.Color(0xffb184), twilightFactor * 0.22)
      .lerp(new THREE.Color(0x30476c), nightFactor * 0.86);
    keyTargetColor
      .setRGB(
        THREE.MathUtils.lerp(0.74, 1.0, dayFactor),
        THREE.MathUtils.lerp(0.54, 0.97, dayFactor),
        THREE.MathUtils.lerp(0.46, 0.92, dayFactor)
      )
      .lerp(new THREE.Color(0xff9b62), twilightFactor * 0.42)
      .lerp(new THREE.Color(0x698ec8), nightFactor * 0.76);
    rimTargetColor
      .setRGB(
        THREE.MathUtils.lerp(0.36, 0.62, dayFactor),
        THREE.MathUtils.lerp(0.46, 0.82, dayFactor),
        THREE.MathUtils.lerp(0.64, 1.0, dayFactor)
      )
      .lerp(new THREE.Color(0xffae74), twilightFactor * 0.28)
      .lerp(new THREE.Color(0x486aa8), nightFactor * 0.84);

    ambient.color.lerp(ambientTargetColor, 0.08);
    keyLight.color.lerp(keyTargetColor, 0.08);
    rimLight.color.lerp(rimTargetColor, 0.08);

    const glowDistance = constants.FIRST_PERSON_HORIZON_RADIUS * 0.88;
    sunsetGlow.position.copy(tempSunDirection).multiplyScalar(glowDistance);
    sunsetGlow.position.y = constants.SURFACE_Y + scaleDimension(6) + (Math.sin(sunAltitudeRadians) * scaleDimension(12));
    sunsetGlow.material.opacity = Math.max(0, (twilightFactor * 0.72) + (dayFactor * 0.08));
    sunsetGlow.visible = sunsetGlow.material.opacity > 0.01;

    // Fade out the sun mesh as it approaches/goes below the horizon
    if (orbitSun) {
      const sunOpacity = THREE.MathUtils.clamp(
        THREE.MathUtils.inverseLerp(-1.5, 3.0, sunAltitudeDegrees),
        0,
        1
      );
      orbitSun.traverse((child) => {
        if (child.isMesh && child.material) {
          if (child.material._baseOpacity === undefined) {
            child.material._baseOpacity = child.material.opacity ?? 1;
          }
          child.material.opacity = sunOpacity * child.material._baseOpacity;
        }
      });
    }
  }

  return {
    update
  };
}

