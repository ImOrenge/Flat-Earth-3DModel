import * as THREE from "../vendor/three.module.js";
import * as constants from "./constants.js";

const {
  DEFAULT_MAP_PATH,
  DEFAULT_MAP_LABEL,
  DEFAULT_MOON_TEXTURE_PATH,
  DEFAULT_MOON_TEXTURE_FALLBACK_PATH,
  MODEL_SCALE,
  scaleDimension,
  CELESTIAL_SIZE_SCALE,
  DISC_RADIUS,
  DISC_HEIGHT,
  CELESTIAL_ALTITUDE_SCALE,
  CELESTIAL_ALTITUDE_BASE_Y,
  scaleCelestialAltitude,
  RIM_THICKNESS,
  RIM_CLEARANCE,
  RIM_OUTER_RADIUS,
  RIM_INNER_RADIUS,
  RIM_HEIGHT,
  RIM_CENTER_Y,
  RIM_TOP_Y,
  RIM_BOTTOM_Y,
  DOME_RADIUS,
  DOME_BASE_Y,
  DOME_VERTICAL_SCALE,
  CELESTIAL_HEIGHT_DROP,
  CELESTIAL_ALTITUDE_DROP_DEGREES,
  CELESTIAL_ORBIT_Y_SPREAD_SCALE,
  POLARIS_ALTITUDE_OFFSET,
  POLARIS_CORE_RADIUS,
  POLARIS_GLOW_SIZE,
  POLARIS_HALO_SIZE,
  POLARIS_CORE_OPACITY,
  POLARIS_GLOW_OPACITY,
  POLARIS_HALO_OPACITY,
  TROPIC_LATITUDE,
  SUN_ORBIT_ALTITUDE_CONTRAST,
  MOON_ORBIT_ALTITUDE_CONTRAST,
  spreadOrbitHeight,
  RAW_ORBIT_TRACK_HEIGHT,
  RAW_ORBIT_SUN_BASE_OFFSET,
  RAW_ORBIT_SUN_NORTH_OFFSET,
  RAW_ORBIT_SUN_SOUTH_OFFSET,
  RAW_ORBIT_SUN_HEIGHT,
  RAW_ORBIT_SUN_HEIGHT_NORTH,
  RAW_ORBIT_SUN_HEIGHT_SOUTH,
  ORBIT_TRACK_HEIGHT,
  ORBIT_SUN_HEIGHT,
  ORBIT_SUN_HEIGHT_NORTH,
  ORBIT_SUN_HEIGHT_SOUTH,
  CELESTIAL_BODY_SIZE,
  ORBIT_SUN_SIZE,
  ORBIT_SUN_SPEED,
  ORBIT_DARK_SUN_SPEED,
  ORBIT_DARK_SUN_BAND_SPEED_FACTOR,
  ORBIT_DARK_SUN_SIZE,
  ORBIT_DARK_SUN_BODY_COLOR,
  ORBIT_DARK_SUN_DEBUG_COLOR,
  ORBIT_DARK_SUN_RIM_COLOR,
  ORBIT_SUN_HALO_SCALE,
  ORBIT_DARK_SUN_HALO_SCALE,
  ORBIT_DARK_SUN_DEBUG_RIM_COLOR,
  ORBIT_DARK_SUN_DEBUG_OPACITY,
  ORBIT_DARK_SUN_DEBUG_RIM_OPACITY,
  ORBIT_DARK_SUN_OCCLUSION_OPACITY,
  ORBIT_DARK_SUN_RIM_OPACITY,
  DARK_SUN_ATTRACTION_START_FACTOR,
  DARK_SUN_ATTRACTION_END_FACTOR,
  DARK_SUN_CAPTURE_RESPONSE,
  DARK_SUN_RELEASE_RESPONSE,
  DARK_SUN_TRANSIT_PERPENDICULAR_COMPRESSION,
  DARK_SUN_TRANSIT_ALONG_COMPRESSION,
  DARK_SUN_HOLD_DAMPING,
  DARK_SUN_CENTER_HOLD_FACTOR,
  DARK_SUN_ECLIPSE_TRANSIT_SLOW_FACTOR,
  DARK_SUN_ECLIPSE_RESPONSE_SLOW_FACTOR,
  DARK_SUN_ALTITUDE_LOCK_START,
  DARK_SUN_ALTITUDE_ALIGNMENT_TOLERANCE_FACTOR,
  DARK_SUN_STAGE_PRE_ECLIPSE_DISTANCE_FACTOR,
  STAGE_PRE_ECLIPSE_TARGET_VISIBLE_COVERAGE,
  STAGE_PRE_ECLIPSE_MAX_START_COVERAGE,
  DARK_SUN_STAGE_START_OFFSET_RADIANS,
  SOLAR_ECLIPSE_TRIGGER_MARGIN_PX,
  SOLAR_ECLIPSE_TRIGGER_MARGIN_FACTOR,
  SOLAR_ECLIPSE_APPROACH_DISTANCE_FACTOR,
  SOLAR_ECLIPSE_TOAST_DISTANCE_FACTOR,
  SOLAR_ECLIPSE_IDLE_DISTANCE_FACTOR,
  SOLAR_ECLIPSE_MIN_COVERAGE,
  SOLAR_ECLIPSE_TOTAL_COVERAGE,
  SOLAR_ECLIPSE_DIRECTION_EPSILON,
  SOLAR_ECLIPSE_CONTACT_START_PX,
  SOLAR_ECLIPSE_VISIBLE_CONTACT_PX,
  SOLAR_ECLIPSE_TIER_NONE,
  SOLAR_ECLIPSE_TIER_TOTAL,
  SOLAR_ECLIPSE_TIER_PARTIAL_2,
  SOLAR_ECLIPSE_TIER_PARTIAL_3,
  SOLAR_ECLIPSE_PARTIAL_LANE_2_CAP,
  SOLAR_ECLIPSE_PARTIAL_LANE_3_CAP,
  SOLAR_ECLIPSE_APPROACH_MIN_MS,
  SOLAR_ECLIPSE_PARTIAL_STAGE_MIN_MS,
  SOLAR_ECLIPSE_TOTALITY_MIN_MS,
  SOLAR_ECLIPSE_COMPLETE_FADE_MS,
  SOLAR_ECLIPSE_SLOW_LOOKAHEAD_FRAMES,
  SOLAR_ECLIPSE_TOAST_DURATION_MS,
  SOLAR_ECLIPSE_APPROACH_SLOW_FACTOR,
  SOLAR_ECLIPSE_TOTALITY_SLOW_FACTOR,
  SOLAR_ECLIPSE_COMPLETE_SLOW_FACTOR,
  SOLAR_ECLIPSE_ANIMATION_SLOW_RESPONSE,
  SOLAR_ECLIPSE_PRESENTATION_COVERAGE_RATE,
  SOLAR_ECLIPSE_COMPLETE_HOLD_FRAMES,
  STAGE_PRE_ECLIPSE_SEARCH_MAX_FRAMES,
  STAGE_PRE_ECLIPSE_REFINEMENT_FRAMES,
  DARK_SUN_STAGE_DURATION_SECONDS,
  DARK_SUN_STAGE_CONTACT_OFFSET_RADIANS,
  DARK_SUN_STAGE_CONTACT_MARGIN_RADIANS,
  DARK_SUN_STAGE_APPROACH_SHARE,
  DARK_SUN_STAGE_INGRESS_SHARE,
  DARK_SUN_STAGE_TOTALITY_SHARE,
  DARK_SUN_STAGE_EGRESS_SHARE,
  DARK_SUN_STAGE_COMPLETE_SHARE,
  ORBIT_SUN_SEASON_SPEED,
  ORBIT_MOON_BAND_SPEED_FACTOR,
  CELESTIAL_TRAIL_LENGTH_DEFAULT_PERCENT,
  CELESTIAL_SPEED_DEFAULT,
  ORBIT_SUN_HALO_OPACITY,
  ORBIT_SUN_LIGHT_INTENSITY,
  ORBIT_SUN_BODY_EMISSIVE_INTENSITY,
  ORBIT_SUN_CORONA_SCALE,
  ORBIT_SUN_AUREOLE_SCALE,
  ORBIT_SUN_CORONA_OPACITY,
  ORBIT_SUN_AUREOLE_OPACITY,
  ORBIT_SUN_PULSE_SPEED,
  SUN_COIL_TURNS,
  SUN_COIL_AMPLITUDE,
  SUN_COIL_PITCH,
  ORBIT_TRACK_TUBE_RADIUS,
  SUN_COIL_BASE_CLEARANCE,
  SUN_COIL_DOME_CLEARANCE,
  ORBIT_HEIGHT_GUIDE_RADIUS,
  ORBIT_HEIGHT_GUIDE_MARKER_SIZE,
  ORBIT_HEIGHT_GUIDE_ANGLES,
  RAW_ORBIT_MOON_BASE_OFFSET,
  RAW_ORBIT_MOON_NORTH_OFFSET,
  RAW_ORBIT_MOON_SOUTH_OFFSET,
  RAW_ORBIT_MOON_BASE_HEIGHT,
  RAW_ORBIT_MOON_HEIGHT_NORTH,
  RAW_ORBIT_MOON_HEIGHT_SOUTH,
  ORBIT_MOON_BASE_HEIGHT,
  ORBIT_MOON_HEIGHT_NORTH,
  ORBIT_MOON_HEIGHT_SOUTH,
  ORBIT_MOON_SIZE,
  ORBIT_MOON_HALO_OPACITY,
  ORBIT_MOON_LIGHT_INTENSITY,
  ORBIT_MOON_BODY_EMISSIVE_INTENSITY,
  ORBIT_MOON_SPEED,
  ORBIT_MOON_CORONA_SCALE,
  ORBIT_MOON_AUREOLE_SCALE,
  ORBIT_MOON_WARM_FRINGE_SCALE,
  ORBIT_MOON_CORONA_OPACITY,
  ORBIT_MOON_AUREOLE_OPACITY,
  ORBIT_MOON_WARM_FRINGE_OPACITY,
  ORBIT_MOON_PULSE_SPEED,
  ORBIT_MOON_LIGHT_COLOR_DAY,
  ORBIT_MOON_LIGHT_COLOR_NIGHT,
  ORBIT_MOON_HALO_COLOR_DAY,
  ORBIT_MOON_HALO_COLOR_NIGHT,
  ORBIT_MOON_EMISSIVE_COLOR_DAY,
  ORBIT_MOON_EMISSIVE_COLOR_NIGHT,
  ORBIT_MOON_COOL_GLOW_COLOR,
  ORBIT_MOON_COOL_GLOW_SCALE,
  ORBIT_SURFACE_LINE_WIDTH,
  SUN_TRAIL_MAX_POINTS,
  MOON_TRAIL_MAX_POINTS,
  REALITY_TRAIL_WINDOW_MS,
  REALITY_TRAIL_REFRESH_MS,
  DAY_NIGHT_TEXTURE_SIZE,
  DAY_NIGHT_UPDATE_EPSILON,
  ANALEMMA_SURFACE_OFFSET,
  SKY_ANALEMMA_RADIUS,
  MAP_TEXTURE_SIZE,
  CAMERA_DEFAULT_FOV,
  CAMERA_WALKER_FOV,
  CAMERA_TOPDOWN_DEFAULT_RADIUS,
  CAMERA_TOPDOWN_MIN_RADIUS,
  CAMERA_TOPDOWN_MAX_RADIUS,
  CAMERA_TRACKING_DEFAULT_DISTANCE,
  CAMERA_TRACKING_MIN_DISTANCE,
  CAMERA_TRACKING_MAX_DISTANCE,
  CAMERA_TRACKING_DEFAULT_AZIMUTH,
  CAMERA_TRACKING_DEFAULT_ELEVATION,
  CAMERA_TRACKING_MIN_ELEVATION,
  CAMERA_TRACKING_MAX_ELEVATION,
  TOPDOWN_STAGE_SCALE,
  FOG_DEFAULT_NEAR,
  FOG_DEFAULT_FAR,
  FOG_WALKER_NEAR,
  FOG_WALKER_FAR,
  FIRST_PERSON_STAGE_SCALE,
  FIRST_PERSON_WORLD_RADIUS,
  FIRST_PERSON_HORIZON_RADIUS,
  FIRST_PERSON_SKY_RADIUS,
  FIRST_PERSON_PREP_DURATION_MS,
  FIRST_PERSON_RETURN_DURATION_MS,
  FIRST_PERSON_CELESTIAL_NEAR_RADIUS,
  FIRST_PERSON_CELESTIAL_FAR_RADIUS,
  FIRST_PERSON_CELESTIAL_FADE_RANGE,
  FIRST_PERSON_HORIZON_OCCLUSION_RANGE,
  FIRST_PERSON_HORIZON_SINK,
  FIRST_PERSON_CELESTIAL_SCALE,
  FIRST_PERSON_SUN_SCALE,
  FIRST_PERSON_MOON_SCALE,
  FIRST_PERSON_SUN_RAY_LENGTH,
  FIRST_PERSON_SUN_RAY_WIDTH,
  FIRST_PERSON_SUN_RAY_SHORT_LENGTH,
  FIRST_PERSON_SUN_RAY_SHORT_WIDTH,
  FIRST_PERSON_SUN_RAY_ALIGNMENT_START,
  FIRST_PERSON_SUN_RAY_ALIGNMENT_END,
  SURFACE_Y,
  WALKER_SURFACE_OFFSET,
  WALKER_EYE_HEIGHT,
  WALKER_BODY_HEIGHT,
  WALKER_BODY_RADIUS,
  WALKER_SPEED,
  WALKER_LOOK_DISTANCE,
  WALKER_START_LATITUDE,
  WALKER_START_LONGITUDE,
  WALKER_PITCH_MAX,
  WALKER_PITCH_MIN,
  WALKER_GUIDE_Y,
  WALKER_GUIDE_HALF_WIDTH,
  WALKER_GUIDE_START,
  WALKER_GUIDE_LENGTH,
  WALKER_GUIDE_MARK_SIZE,
  WALKER_GUIDE_MARK_GAP,
  WALKER_HORIZON_SHIFT_PX,
  POLARIS_HEIGHT,
  TROPIC_CANCER_RADIUS,
  EQUATOR_RADIUS,
  TROPIC_CAPRICORN_RADIUS,
  ORBIT_RADIUS_MID,
  ORBIT_RADIUS_AMPLITUDE
} = constants;

export function setupScene({ canvas }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x06101d, FOG_DEFAULT_NEAR, FOG_DEFAULT_FAR);
  const firstPersonScene = new THREE.Scene();
  firstPersonScene.fog = new THREE.Fog(0x06101d, FOG_WALKER_NEAR, FOG_WALKER_FAR);
  
  const camera = new THREE.PerspectiveCamera(CAMERA_DEFAULT_FOV, 1, 0.1, scaleDimension(100));
  const defaultCameraLookTarget = new THREE.Vector3(0, SURFACE_Y * (5 / 6), 0);
  
  const cameraState = {
    lookTarget: defaultCameraLookTarget.clone(),
    mode: "free",
    radius: CAMERA_TOPDOWN_DEFAULT_RADIUS,
    theta: -0.55,
    phi: 1.12,
    targetLookTarget: defaultCameraLookTarget.clone(),
    targetTheta: -0.55,
    targetPhi: 1.12,
    targetRadius: CAMERA_TOPDOWN_DEFAULT_RADIUS,
    trackingAzimuth: CAMERA_TRACKING_DEFAULT_AZIMUTH,
    trackingDistance: CAMERA_TRACKING_DEFAULT_DISTANCE,
    trackingElevation: CAMERA_TRACKING_DEFAULT_ELEVATION,
    targetTrackingAzimuth: CAMERA_TRACKING_DEFAULT_AZIMUTH,
    targetTrackingDistance: CAMERA_TRACKING_DEFAULT_DISTANCE,
    targetTrackingElevation: CAMERA_TRACKING_DEFAULT_ELEVATION
  };
  
  const stage = new THREE.Group();
  scene.add(stage);
  const scalableStage = new THREE.Group();
  stage.add(scalableStage);
  
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
  scalableStage.add(disc);
  
  const transparentSurfaceMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  
  const dayNightOverlayMaterial = new THREE.ShaderMaterial({
    uniforms: {
      discRadius: { value: DISC_RADIUS },
      overlayOpacity: { value: 0.88 },
      sunLatitudeTrig: { value: new THREE.Vector2(0, 1) },
      sunLongitudeRadians: { value: 0 },
      nightLightsMap: { value: null }
    },
    vertexShader: `
      varying vec2 vUv;
  
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float discRadius;
      uniform float overlayOpacity;
      uniform vec2 sunLatitudeTrig;
      uniform float sunLongitudeRadians;
      uniform sampler2D nightLightsMap;
      varying vec2 vUv;
  
      void main() {
        float worldZ = (vUv.x - 0.5) * discRadius * 2.0;
        float worldX = (vUv.y - 0.5) * discRadius * 2.0;
        float projectedRadius = length(vec2(worldX, worldZ));
  
        if (projectedRadius > discRadius) {
          discard;
        }
  
        float latitudeRadians = radians(90.0 - ((projectedRadius / discRadius) * 180.0));
        float longitudeRadians = atan(worldZ, -worldX);
        float solarFactor = (
          (sin(latitudeRadians) * sunLatitudeTrig.x) +
          (cos(latitudeRadians) * sunLatitudeTrig.y * cos(longitudeRadians - sunLongitudeRadians))
        );
        float nightStrength = clamp((-solarFactor + 0.02) / 0.18, 0.0, 1.0);
        float twilightStrength = 1.0 - clamp(abs(solarFactor) / 0.06, 0.0, 1.0);
        float twilightMix = clamp(twilightStrength * (1.0 - (nightStrength * 0.35)), 0.0, 1.0);
        float deepNight = clamp((nightStrength - 0.14) / 0.86, 0.0, 1.0);
        float nightLightStrength = texture2D(nightLightsMap, vec2(vUv.x, 1.0 - vUv.y)).r * deepNight;
        float lightBoost = nightLightStrength * (0.82 + (deepNight * 0.68));
        vec3 baseColor = vec3(
          mix(12.0, 96.0, twilightMix),
          mix(20.0, 128.0, twilightMix),
          mix(34.0, 196.0, twilightMix)
        ) / 255.0;
        vec3 finalColor = clamp(baseColor + vec3(
          lightBoost,
          lightBoost * (208.0 / 255.0),
          lightBoost * (108.0 / 255.0)
        ), 0.0, 1.0);
        float alpha = clamp(
          ((nightStrength * 172.0) + (twilightMix * 52.0) + (lightBoost * 42.0)) / 255.0,
          0.0,
          232.0 / 255.0
        );
  
        gl_FragColor = vec4(finalColor, alpha * overlayOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const dayNightOverlay = new THREE.Mesh(
    new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, scaleDimension(0.008), 128, 1, false),
    [transparentSurfaceMaterial, dayNightOverlayMaterial, transparentSurfaceMaterial]
  );
  dayNightOverlay.position.y = (DISC_HEIGHT / 2) + scaleDimension(0.03);
  dayNightOverlay.renderOrder = 12;
  scalableStage.add(dayNightOverlay);
  
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
  northSeasonOverlay.position.y = (DISC_HEIGHT / 2) + scaleDimension(0.012);
  northSeasonOverlay.renderOrder = 8;
  scalableStage.add(northSeasonOverlay);
  
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
  southSeasonOverlay.position.y = (DISC_HEIGHT / 2) + scaleDimension(0.011);
  southSeasonOverlay.renderOrder = 7;
  scalableStage.add(southSeasonOverlay);
  
  const analemmaProjectionGeometry = new THREE.BufferGeometry();
  const analemmaProjectionMaterial = new THREE.LineBasicMaterial({
    color: 0xffb25d,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    depthTest: false
  });
  const analemmaProjection = new THREE.Line(analemmaProjectionGeometry, analemmaProjectionMaterial);
  analemmaProjection.renderOrder = 14;
  scalableStage.add(analemmaProjection);
  
  const analemmaProjectionPointsGeometry = new THREE.BufferGeometry();
  const analemmaProjectionPointsMaterial = new THREE.PointsMaterial({
    color: 0xfff1be,
    size: scaleDimension(0.048),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: false
  });
  const analemmaProjectionPoints = new THREE.Points(
    analemmaProjectionPointsGeometry,
    analemmaProjectionPointsMaterial
  );
  analemmaProjectionPoints.renderOrder = 15;
  scalableStage.add(analemmaProjectionPoints);
  
  const skyAnalemmaGeometry = new THREE.BufferGeometry();
  const skyAnalemmaMaterial = new THREE.LineBasicMaterial({
    color: 0x9ed9ff,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    depthTest: false
  });
  const skyAnalemma = new THREE.LineSegments(skyAnalemmaGeometry, skyAnalemmaMaterial);
  skyAnalemma.renderOrder = 16;
  scalableStage.add(skyAnalemma);
  
  const skyAnalemmaPointsGeometry = new THREE.BufferGeometry();
  const skyAnalemmaPointsMaterial = new THREE.PointsMaterial({
    color: 0xe9f7ff,
    size: scaleDimension(0.052),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    depthTest: false
  });
  const skyAnalemmaPoints = new THREE.Points(skyAnalemmaPointsGeometry, skyAnalemmaPointsMaterial);
  skyAnalemmaPoints.renderOrder = 17;
  scalableStage.add(skyAnalemmaPoints);
  
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
  scalableStage.add(iceWallOuter);
  
  const iceWallInner = new THREE.Mesh(
    new THREE.CylinderGeometry(RIM_INNER_RADIUS, RIM_INNER_RADIUS, RIM_HEIGHT, 128, 1, true),
    iceInnerMaterial
  );
  iceWallInner.position.y = RIM_CENTER_Y;
  scalableStage.add(iceWallInner);
  
  const iceTopCap = new THREE.Mesh(
    new THREE.RingGeometry(RIM_INNER_RADIUS, RIM_OUTER_RADIUS, 128),
    iceCapMaterial
  );
  iceTopCap.rotation.x = -Math.PI / 2;
  iceTopCap.position.y = RIM_TOP_Y;
  scalableStage.add(iceTopCap);
  
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
  scalableStage.add(iceBottomCap);
  
  const iceCrown = new THREE.Mesh(
    new THREE.TorusGeometry((RIM_OUTER_RADIUS + RIM_INNER_RADIUS) / 2, scaleDimension(0.05), 12, 128),
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
  scalableStage.add(iceCrown);
  
  function enhanceDomeMaterialWithSunGlow(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.sunLocalPosition = {
        value: new THREE.Vector3(0, DOME_RADIUS, 0)
      };
      shader.uniforms.sunPulse = { value: 0.5 };
      material.userData.shader = shader;
  
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
  varying vec3 vDomeLocalPosition;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
  vDomeLocalPosition = position;`
        );
  
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
  varying vec3 vDomeLocalPosition;
  uniform vec3 sunLocalPosition;
  uniform float sunPulse;`
        )
        .replace(
          "#include <opaque_fragment>",
          `vec3 domeSurfaceDirection = normalize(vDomeLocalPosition);
  vec3 sunDirection = normalize(sunLocalPosition);
  float sunArcDistance = distance(domeSurfaceDirection, sunDirection);
  float sunHaze = 1.0 - smoothstep(0.34, 1.14, sunArcDistance);
  float sunBloom = 1.0 - smoothstep(0.18, 0.94, sunArcDistance);
  float sunCore = 1.0 - smoothstep(0.06, 0.24, sunArcDistance);
  float upperDome = smoothstep(-0.04, 0.72, domeSurfaceDirection.y);
  float pulse = 0.92 + (sunPulse * 0.08);
  vec3 atmosphericBlue = mix(vec3(0.46, 0.76, 1.0), vec3(0.9, 0.97, 1.0), sunCore);
  outgoingLight += atmosphericBlue * ((sunHaze * 0.26) + (sunBloom * 0.44) + (sunCore * 0.38)) * upperDome * pulse;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.64, 0.84, 1.0), ((sunHaze * 0.22) + (sunBloom * 0.18)) * upperDome);
  diffuseColor.a = min(0.82, diffuseColor.a + (sunHaze * 0.06) + (sunBloom * 0.12) + (sunCore * 0.2));
  #include <opaque_fragment>`
        );
    };
    material.customProgramCacheKey = () => "dome-sun-atmosphere-v1";
  }
  
  function enhanceMoonMaterialWithPhase(material) {
    const existingPhaseState = material.userData.moonPhaseState ?? {};
    material.userData.moonPhaseState = {
      coolGlowStrength: 0,
      glowStrength: 1,
      illuminationFraction: 1,
      lunarEclipseTint: 0,
      lunarEclipseShadowStrength: 0,
      shadowAlpha: 0.08,
      waxing: 1,
      eclipseMaskCenterNdc: new THREE.Vector2(),
      eclipseMaskRadius: 0,
      eclipseMaskSoftnessPx: 32,
      eclipseMaskViewport: new THREE.Vector2(1, 1),
      surfaceTexture: existingPhaseState.surfaceTexture ?? null,
      surfaceTextureEnabled: existingPhaseState.surfaceTexture ? 1 : 0,
      surfaceTextureRotationRadians: existingPhaseState.surfaceTextureRotationRadians ?? 0
    };
  
    material.onBeforeCompile = (shader) => {
      const { moonPhaseState } = material.userData;
      shader.uniforms.moonCoolGlowStrength = { value: moonPhaseState.coolGlowStrength };
      shader.uniforms.moonGlowStrength = { value: moonPhaseState.glowStrength };
      shader.uniforms.moonIlluminationFraction = { value: moonPhaseState.illuminationFraction };
      shader.uniforms.moonLunarEclipseTint = { value: moonPhaseState.lunarEclipseTint };
      shader.uniforms.moonLunarEclipseShadowStrength = { value: moonPhaseState.lunarEclipseShadowStrength };
      shader.uniforms.moonShadowAlpha = { value: moonPhaseState.shadowAlpha };
      shader.uniforms.moonWaxing = { value: moonPhaseState.waxing };
      shader.uniforms.moonEclipseMaskCenterNdc = { value: moonPhaseState.eclipseMaskCenterNdc };
      shader.uniforms.moonEclipseMaskRadius = { value: moonPhaseState.eclipseMaskRadius };
      shader.uniforms.moonEclipseMaskSoftnessPx = { value: moonPhaseState.eclipseMaskSoftnessPx };
      shader.uniforms.moonEclipseMaskViewport = { value: moonPhaseState.eclipseMaskViewport };
      shader.uniforms.moonSurfaceMap = { value: moonPhaseState.surfaceTexture };
      shader.uniforms.moonSurfaceMapEnabled = { value: moonPhaseState.surfaceTextureEnabled };
      shader.uniforms.moonSurfaceTextureRotationRadians = { value: moonPhaseState.surfaceTextureRotationRadians };
      material.userData.phaseShader = shader;
  
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
  varying vec3 vMoonViewNormal;`
        )
        .replace(
          "#include <defaultnormal_vertex>",
          `#include <defaultnormal_vertex>
  vMoonViewNormal = normalize(transformedNormal);`
        );
  
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
  varying vec3 vMoonViewNormal;
  uniform float moonCoolGlowStrength;
  uniform float moonGlowStrength;
  uniform float moonIlluminationFraction;
  uniform float moonLunarEclipseTint;
  uniform float moonLunarEclipseShadowStrength;
  uniform float moonShadowAlpha;
  uniform float moonWaxing;
  uniform vec2 moonEclipseMaskCenterNdc;
  uniform float moonEclipseMaskRadius;
  uniform float moonEclipseMaskSoftnessPx;
  uniform vec2 moonEclipseMaskViewport;
  uniform sampler2D moonSurfaceMap;
  uniform float moonSurfaceMapEnabled;
  uniform float moonSurfaceTextureRotationRadians;

  vec2 rotateMoonDiscPoint(vec2 point, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(
      (point.x * c) - (point.y * s),
      (point.x * s) + (point.y * c)
    );
  }`
        )
        .replace(
          "#include <opaque_fragment>",
          `vec3 moonViewNormal = normalize(vMoonViewNormal);
  if (moonSurfaceMapEnabled > 0.5 && moonViewNormal.z > 0.0) {
    vec2 moonDiscPoint = rotateMoonDiscPoint(moonViewNormal.xy, moonSurfaceTextureRotationRadians);
    vec2 moonSurfaceUv = vec2(
      (moonDiscPoint.x * 0.5) + 0.5,
      (moonDiscPoint.y * 0.5) + 0.5
    );
    vec4 moonSurfaceTexel = texture2D(moonSurfaceMap, moonSurfaceUv);
    diffuseColor.rgb = moonSurfaceTexel.rgb;
  }
  float phaseCos = clamp((moonIlluminationFraction * 2.0) - 1.0, -1.0, 1.0);
  float phaseSin = sqrt(max(0.0, 1.0 - (phaseCos * phaseCos)));
  float phaseDirection = mix(-1.0, 1.0, moonWaxing);
  vec3 phaseLightDirection = normalize(vec3(phaseDirection * phaseSin, 0.0, phaseCos));
  float phaseDot = dot(moonViewNormal, phaseLightDirection);
  float phaseMask = smoothstep(-0.004, 0.02, phaseDot);
  phaseMask = mix(phaseMask, 1.0, max(phaseCos, 0.0));
  vec3 moonSurfaceColor = diffuseColor.rgb;
  float moonSurfaceLuma = dot(moonSurfaceColor, vec3(0.2126, 0.7152, 0.0722));
  moonSurfaceColor = clamp(
    ((moonSurfaceColor - vec3(moonSurfaceLuma)) * 1.18) + vec3((moonSurfaceLuma * 1.06) + 0.015),
    0.0,
    1.0
  );
  float shadowShade = mix(0.12, 0.24, moonGlowStrength);
  float litShade = mix(1.04, 1.22, pow(max(moonViewNormal.z, 0.0), 0.35));
  float phaseShade = mix(shadowShade, litShade, phaseMask);
  float phaseShadow = pow(max(1.0 - phaseMask, 0.0), 1.05);
  float shadowAlpha = mix(1.0, moonShadowAlpha, phaseShadow);
  float terminatorBand = (1.0 - smoothstep(0.0, 0.42, abs(phaseDot))) * moonCoolGlowStrength;
  float coolScatter = pow(max(1.0 - phaseMask, 0.0), 1.35) * pow(max(moonViewNormal.z, 0.0), 0.8) * moonCoolGlowStrength;
  float earthshine = pow(max(1.0 - phaseMask, 0.0), 1.08) * (0.08 + (moonCoolGlowStrength * 0.1));
  float selfGlow = mix(0.05, 0.16, moonGlowStrength);
  vec3 moonSurfaceLight = moonSurfaceColor * phaseShade;
  vec3 moonSelfGlow = totalEmissiveRadiance * selfGlow * mix(vec3(1.0), moonSurfaceColor, 0.72);
  outgoingLight = moonSurfaceLight + moonSelfGlow;
  outgoingLight += moonSurfaceColor * earthshine * 0.42;
  outgoingLight += vec3(0.02, 0.03, 0.05) * earthshine * 0.45;
  outgoingLight += vec3(0.28, 0.46, 0.88) * ((coolScatter * 0.24) + (terminatorBand * 0.12));
  // Lunar eclipse: tint the moon toward blood-red when dark sun overlaps
  vec3 bloodMoonColor = vec3(0.72, 0.04, 0.01);
  float eclipseSurface = max(phaseShade, 0.18);
  
  float lunarEclipseMask = 0.0;
  float lunarEclipseInfluence = max(moonLunarEclipseShadowStrength, moonLunarEclipseTint);
  if (lunarEclipseInfluence > 0.001) {
    vec2 moonEclipseFragNdc = vec2(
      ((gl_FragCoord.x / max(moonEclipseMaskViewport.x, 1.0)) * 2.0) - 1.0,
      ((gl_FragCoord.y / max(moonEclipseMaskViewport.y, 1.0)) * 2.0) - 1.0
    );
    vec2 moonEclipseDeltaPx = vec2(
      (moonEclipseFragNdc.x - moonEclipseMaskCenterNdc.x) * max(moonEclipseMaskViewport.x, 1.0) * 0.5,
      (moonEclipseFragNdc.y - moonEclipseMaskCenterNdc.y) * max(moonEclipseMaskViewport.y, 1.0) * 0.5
    );
    float eclipseDistPx = length(moonEclipseDeltaPx);
    // Expand the mask slightly so the red fully engulfs the moon before totality smoothly
    float eclipseRadiusPx = moonEclipseMaskRadius * max(moonEclipseMaskViewport.x, 1.0) * 0.52;
    
    // We want the red tint (lunarEclipseMask) to be 1.0 INSIDE the dark sun area, and 0.0 OUTSIDE.
    lunarEclipseMask = 1.0 - smoothstep(
      max(eclipseRadiusPx - moonEclipseMaskSoftnessPx, 0.0),
      eclipseRadiusPx + moonEclipseMaskSoftnessPx,
      eclipseDistPx
    );
  }
  
  float finalEclipseShadow = moonLunarEclipseShadowStrength * lunarEclipseMask;
  outgoingLight *= mix(1.0, 0.08, finalEclipseShadow);

  float finalEclipseTint = moonLunarEclipseTint * lunarEclipseMask;
  float eclipseDetailStrength = smoothstep(0.32, 1.0, finalEclipseTint);
  vec3 bloodMoonSurfaceColor = mix(
    bloodMoonColor * eclipseSurface,
    moonSurfaceColor * vec3(0.78, 0.14, 0.09) * mix(0.42, 0.9, moonSurfaceLuma),
    0.16 + (eclipseDetailStrength * 0.24)
  );
  outgoingLight = mix(outgoingLight, bloodMoonSurfaceColor, finalEclipseTint * 0.92);
  outgoingLight += vec3(0.2, 0.018, 0.008) * finalEclipseTint * (0.16 + terminatorBand * 0.18);
  outgoingLight += moonSurfaceColor * vec3(0.055, 0.01, 0.008) * eclipseDetailStrength * finalEclipseTint;
  diffuseColor.a = mix(
    diffuseColor.a * shadowAlpha,
    max(diffuseColor.a * shadowAlpha, 0.88),
    max(finalEclipseShadow * 0.35, finalEclipseTint)
  );
  
  #include <opaque_fragment>`
        );
    };
  
    material.customProgramCacheKey = () => "moon-phase-v7";
  }
  
  function setMoonMaterialPhase(material, {
    coolGlowStrength = 0,
    illuminationFraction = 1,
    lunarEclipseTint = 0,
    lunarEclipseShadowStrength = 0,
    shadowAlpha = 0.08,
    waxing = true,
    glowStrength = 1,
    eclipseMaskCenterNdc = null,
    eclipseMaskRadius = 0,
    eclipseMaskSoftnessPx = 32,
    eclipseMaskViewport = null,
    surfaceTextureRotationRadians = null
  }) {
    const phaseState = material.userData.moonPhaseState ?? {
      coolGlowStrength: 0,
      glowStrength: 1,
      illuminationFraction: 1,
      lunarEclipseTint: 0,
      lunarEclipseShadowStrength: 0,
      shadowAlpha: 0.08,
      waxing: 1,
      eclipseMaskCenterNdc: new THREE.Vector2(),
      eclipseMaskRadius: 0,
      eclipseMaskSoftnessPx: 32,
      eclipseMaskViewport: new THREE.Vector2(1, 1),
      surfaceTexture: null,
      surfaceTextureEnabled: 0,
      surfaceTextureRotationRadians: 0
    };
    
    if (eclipseMaskCenterNdc) phaseState.eclipseMaskCenterNdc.copy(eclipseMaskCenterNdc);
    if (eclipseMaskViewport) phaseState.eclipseMaskViewport.copy(eclipseMaskViewport);
    phaseState.eclipseMaskRadius = Math.max(eclipseMaskRadius, 0);
    phaseState.eclipseMaskSoftnessPx = Math.max(eclipseMaskSoftnessPx, 1);
  
    phaseState.coolGlowStrength = THREE.MathUtils.clamp(coolGlowStrength, 0, 1);
    phaseState.glowStrength = THREE.MathUtils.clamp(glowStrength, 0, 1);
    phaseState.illuminationFraction = THREE.MathUtils.clamp(illuminationFraction, 0, 1);
    phaseState.lunarEclipseTint = THREE.MathUtils.clamp(lunarEclipseTint, 0, 1);
    phaseState.lunarEclipseShadowStrength = THREE.MathUtils.clamp(lunarEclipseShadowStrength, 0, 1);
    phaseState.shadowAlpha = THREE.MathUtils.clamp(shadowAlpha, 0.01, 1);
    phaseState.waxing = waxing ? 1 : 0;
    if (Number.isFinite(surfaceTextureRotationRadians)) {
      phaseState.surfaceTextureRotationRadians = THREE.MathUtils.clamp(surfaceTextureRotationRadians, 0, Math.PI);
    }
    material.userData.moonPhaseState = phaseState;
  
    if (material.userData.phaseShader) {
      material.userData.phaseShader.uniforms.moonCoolGlowStrength.value = phaseState.coolGlowStrength;
      material.userData.phaseShader.uniforms.moonGlowStrength.value = phaseState.glowStrength;
      material.userData.phaseShader.uniforms.moonIlluminationFraction.value = phaseState.illuminationFraction;
      material.userData.phaseShader.uniforms.moonLunarEclipseTint.value = phaseState.lunarEclipseTint;
      material.userData.phaseShader.uniforms.moonLunarEclipseShadowStrength.value = phaseState.lunarEclipseShadowStrength;
      material.userData.phaseShader.uniforms.moonShadowAlpha.value = phaseState.shadowAlpha;
      material.userData.phaseShader.uniforms.moonWaxing.value = phaseState.waxing;
      material.userData.phaseShader.uniforms.moonEclipseMaskCenterNdc.value.copy(phaseState.eclipseMaskCenterNdc);
      material.userData.phaseShader.uniforms.moonEclipseMaskRadius.value = phaseState.eclipseMaskRadius;
      material.userData.phaseShader.uniforms.moonEclipseMaskSoftnessPx.value = phaseState.eclipseMaskSoftnessPx;
      material.userData.phaseShader.uniforms.moonEclipseMaskViewport.value.copy(phaseState.eclipseMaskViewport);
      material.userData.phaseShader.uniforms.moonSurfaceMap.value = phaseState.surfaceTexture;
      material.userData.phaseShader.uniforms.moonSurfaceMapEnabled.value = phaseState.surfaceTextureEnabled;
      material.userData.phaseShader.uniforms.moonSurfaceTextureRotationRadians.value = phaseState.surfaceTextureRotationRadians;
    }
  }
  
  function createSunAuraTexture() {
    const size = 512;
    const canvasEl = document.createElement("canvas");
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext("2d");
    const center = size / 2;
    const radius = size / 2;
  
    const baseGradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    baseGradient.addColorStop(0, "rgba(255,255,255,1)");
    baseGradient.addColorStop(0.08, "rgba(255,249,225,0.98)");
    baseGradient.addColorStop(0.22, "rgba(255,223,138,0.82)");
    baseGradient.addColorStop(0.42, "rgba(255,184,92,0.34)");
    baseGradient.addColorStop(0.68, "rgba(136,212,255,0.18)");
    baseGradient.addColorStop(1, "rgba(136,212,255,0)");
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, size, size);
  
    ctx.globalCompositeOperation = "lighter";
  
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const innerRadius = size * 0.1;
      const outerRadius = size * (0.32 + ((i % 4) * 0.035));
      const x0 = center + (Math.cos(angle) * innerRadius);
      const y0 = center + (Math.sin(angle) * innerRadius);
      const x1 = center + (Math.cos(angle) * outerRadius);
      const y1 = center + (Math.sin(angle) * outerRadius);
      const beamGradient = ctx.createLinearGradient(x0, y0, x1, y1);
      beamGradient.addColorStop(0, "rgba(255,246,210,0.3)");
      beamGradient.addColorStop(0.45, "rgba(255,208,118,0.16)");
      beamGradient.addColorStop(1, "rgba(145,214,255,0)");
      ctx.strokeStyle = beamGradient;
      ctx.lineWidth = 5 + ((i % 3) * 1.8);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeStyle = `rgba(154,220,255,${0.1 - (i * 0.018)})`;
      ctx.lineWidth = 10 - (i * 2);
      ctx.beginPath();
      ctx.arc(center, center, size * (0.17 + (i * 0.07)), 0, Math.PI * 2);
      ctx.stroke();
    }
  
    const texture = new THREE.CanvasTexture(canvasEl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
  
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_RADIUS, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x9fd8ff,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.72,
      transparent: true,
      opacity: 0.24,
      thickness: scaleDimension(0.18),
      ior: 1.22,
      side: THREE.DoubleSide
    })
  );
  enhanceDomeMaterialWithSunGlow(dome.material);
  dome.scale.y = DOME_VERTICAL_SCALE;
  dome.position.y = DOME_BASE_Y;
  scalableStage.add(dome);
  
  const domeRing = new THREE.Mesh(
    new THREE.TorusGeometry(DOME_RADIUS, scaleDimension(0.045), 12, 96),
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
  scalableStage.add(domeRing);
  
  const polarisTextureCanvas = document.createElement("canvas");
  polarisTextureCanvas.width = 256;
  polarisTextureCanvas.height = 256;
  const polarisTextureCtx = polarisTextureCanvas.getContext("2d");
  const polarisGlowGradient = polarisTextureCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  polarisGlowGradient.addColorStop(0, "rgba(255,255,255,1)");
  polarisGlowGradient.addColorStop(0.18, "rgba(214,238,255,0.98)");
  polarisGlowGradient.addColorStop(0.42, "rgba(120,184,255,0.42)");
  polarisGlowGradient.addColorStop(1, "rgba(120,184,255,0)");
  polarisTextureCtx.fillStyle = polarisGlowGradient;
  polarisTextureCtx.fillRect(0, 0, polarisTextureCanvas.width, polarisTextureCanvas.height);
  const polarisGlowTexture = new THREE.CanvasTexture(polarisTextureCanvas);
  polarisGlowTexture.colorSpace = THREE.SRGBColorSpace;
  
  const polaris = new THREE.Group();
  const polarisCore = new THREE.Mesh(
    new THREE.SphereGeometry(POLARIS_CORE_RADIUS, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf5fbff,
      transparent: true,
      opacity: POLARIS_CORE_OPACITY,
      depthTest: false,
      depthWrite: false
    })
  );
  polarisCore.renderOrder = 26;
  polaris.add(polarisCore);
  
  const polarisGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: polarisGlowTexture,
      color: 0xbfe0ff,
      transparent: true,
      opacity: POLARIS_GLOW_OPACITY,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    })
  );
  polarisGlow.scale.setScalar(POLARIS_GLOW_SIZE);
  polarisGlow.renderOrder = 25;
  polaris.add(polarisGlow);
  
  const polarisHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: polarisGlowTexture,
      color: 0x7ec6ff,
      transparent: true,
      opacity: POLARIS_HALO_OPACITY,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    })
  );
  polarisHalo.scale.setScalar(POLARIS_HALO_SIZE);
  polarisHalo.renderOrder = 24;
  polaris.add(polarisHalo);
  
  polaris.position.set(
    0,
    POLARIS_HEIGHT,
    0
  );
  scalableStage.add(polaris);
  
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(scaleDimension(6.7), 96),
    new THREE.MeshBasicMaterial({
      color: 0x123a67,
      transparent: true,
      opacity: 0.18
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = scaleDimension(-0.7);
  scalableStage.add(glow);
  
  const walker = new THREE.Group();
  const walkerBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(WALKER_BODY_RADIUS, WALKER_BODY_HEIGHT, 6, 12),
    new THREE.MeshStandardMaterial({
      color: 0xf6fbff,
      emissive: 0x69b7ff,
      emissiveIntensity: 0.55,
      roughness: 0.42,
      metalness: 0.08
    })
  );
  walkerBody.position.y = WALKER_SURFACE_OFFSET + scaleDimension(0.09);
  walker.add(walkerBody);
  
  const walkerHeading = new THREE.Mesh(
    new THREE.ConeGeometry(scaleDimension(0.045), scaleDimension(0.14), 18),
    new THREE.MeshStandardMaterial({
      color: 0xffd06e,
      emissive: 0xffb84d,
      emissiveIntensity: 0.75,
      roughness: 0.24,
      metalness: 0.05
    })
  );
  walkerHeading.rotation.x = Math.PI / 2;
  walkerHeading.position.set(0, WALKER_SURFACE_OFFSET + scaleDimension(0.1), scaleDimension(0.13));
  walker.add(walkerHeading);
  
  const walkerRing = new THREE.Mesh(
    new THREE.RingGeometry(scaleDimension(0.09), scaleDimension(0.11), 32),
    new THREE.MeshBasicMaterial({
      color: 0xb5e8ff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  walkerRing.rotation.x = -Math.PI / 2;
  walkerRing.position.y = WALKER_SURFACE_OFFSET;
  walker.add(walkerRing);
  stage.add(walker);
  
  function createWalkerGuideLine(color, opacity) {
    return new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false
      })
    );
  }
  
  const walkerGuideGroup = new THREE.Group();
  const walkerGuideLeft = createWalkerGuideLine(0xa5ddff, 0.5);
  const walkerGuideRight = createWalkerGuideLine(0xa5ddff, 0.5);
  const walkerGuideCenter = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xf3fbff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
  );
  walkerGuideGroup.add(walkerGuideLeft, walkerGuideRight, walkerGuideCenter);
  walkerGuideGroup.visible = false;
  scalableStage.add(walkerGuideGroup);
  
  const ambient = new THREE.AmbientLight(0xc5d7ff, 0.9);
  scene.add(ambient);
  
  const keyLight = new THREE.DirectionalLight(0xeaf4ff, 1.35);
  keyLight.position.set(5, 7, 6);
  scene.add(keyLight);
  
  const rimLight = new THREE.DirectionalLight(0x8fd9ff, 0.42);
  rimLight.position.set(-7, 4, -5);
  scene.add(rimLight);
  
  const firstPersonAmbient = new THREE.AmbientLight(0xc5d7ff, 0.9);
  firstPersonScene.add(firstPersonAmbient);
  
  const firstPersonKeyLight = new THREE.DirectionalLight(0xeaf4ff, 1.35);
  firstPersonKeyLight.position.set(5, 7, 6);
  firstPersonScene.add(firstPersonKeyLight);
  
  const firstPersonRimLight = new THREE.DirectionalLight(0x8fd9ff, 0.42);
  firstPersonRimLight.position.set(-7, 4, -5);
  firstPersonScene.add(firstPersonRimLight);
  
  const orbitSun = new THREE.Group();
  const orbitSunBody = new THREE.Mesh(
    new THREE.SphereGeometry(ORBIT_SUN_SIZE, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffd56f,
      emissive: 0xffb42f,
      emissiveIntensity: ORBIT_SUN_BODY_EMISSIVE_INTENSITY,
      roughness: 0.16,
      metalness: 0.02,
      transparent: true,
      opacity: 1
    })
  );
  orbitSunBody.renderOrder = 24;
  orbitSun.add(orbitSunBody);
  
  const orbitSunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(ORBIT_SUN_SIZE * ORBIT_SUN_HALO_SCALE, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffd781,
      transparent: true,
      opacity: ORBIT_SUN_HALO_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  orbitSunHalo.renderOrder = 23;
  orbitSun.add(orbitSunHalo);
  
  const orbitSunLight = new THREE.PointLight(0xffcf75, ORBIT_SUN_LIGHT_INTENSITY, scaleDimension(9.5), 1.4);
  orbitSun.add(orbitSunLight);
  scalableStage.add(orbitSun);
  
  const observerSun = orbitSun.clone(true);
  const observerSunBody = observerSun.children[0];
  observerSunBody.material = observerSunBody.material.clone();
  observerSunBody.renderOrder = orbitSunBody.renderOrder;
  const observerSunHalo = observerSun.children[1];
  observerSunHalo.material = observerSunHalo.material.clone();
  observerSunHalo.renderOrder = orbitSunHalo.renderOrder;
  const observerSunLight = observerSun.children[2];
  observerSun.visible = false;
  firstPersonScene.add(observerSun);
  enhanceSunMaterialWithEclipseMask(orbitSunBody.material);
  enhanceSunMaterialWithEclipseMask(observerSunBody.material);
  
  function createDarkSunGroup() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(ORBIT_DARK_SUN_SIZE, 32, 24),
      new THREE.MeshBasicMaterial({
        color: ORBIT_DARK_SUN_BODY_COLOR,
        transparent: true,
        opacity: ORBIT_DARK_SUN_DEBUG_OPACITY,
        depthTest: false,
        depthWrite: false
      })
    );
    body.renderOrder = 31;
    group.add(body);
  
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(ORBIT_DARK_SUN_SIZE * ORBIT_DARK_SUN_HALO_SCALE, 24, 16),
      new THREE.MeshBasicMaterial({
        color: ORBIT_DARK_SUN_RIM_COLOR,
        transparent: true,
        opacity: ORBIT_DARK_SUN_RIM_OPACITY,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false
      })
    );
    rim.renderOrder = 30;
    group.add(rim);
  
    group.visible = false;
    return group;
  }
  
  function enhanceDarkSunMaterialWithSunMask(material) {
    material.userData.darkSunMaskState = {
      active: 0,
      centerNdc: new THREE.Vector2(),
      radius: 0,
      viewport: new THREE.Vector2(1, 1)
    };
  
    material.onBeforeCompile = (shader) => {
      const { darkSunMaskState } = material.userData;
      shader.uniforms.darkSunMaskActive = { value: darkSunMaskState.active };
      shader.uniforms.darkSunMaskCenterNdc = { value: darkSunMaskState.centerNdc };
      shader.uniforms.darkSunMaskRadius = { value: darkSunMaskState.radius };
      shader.uniforms.darkSunMaskViewport = { value: darkSunMaskState.viewport };
      material.userData.darkSunMaskShader = shader;
      const darkSunMaskFragment = `if (darkSunMaskActive > 0.5) {
  vec2 darkSunMaskNdc = vec2(
    ((gl_FragCoord.x / max(darkSunMaskViewport.x, 1.0)) * 2.0) - 1.0,
    ((gl_FragCoord.y / max(darkSunMaskViewport.y, 1.0)) * 2.0) - 1.0
  );
  if (distance(darkSunMaskNdc, darkSunMaskCenterNdc) > darkSunMaskRadius) {
    discard;
  }
  }`;
  
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
  uniform float darkSunMaskActive;
  uniform vec2 darkSunMaskCenterNdc;
  uniform float darkSunMaskRadius;
  uniform vec2 darkSunMaskViewport;`
        )
      if (shader.fragmentShader.includes("#include <opaque_fragment>")) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `${darkSunMaskFragment}
  #include <opaque_fragment>`
        );
      } else {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <output_fragment>",
          `${darkSunMaskFragment}
  #include <output_fragment>`
        );
      }
    };
    material.customProgramCacheKey = () => "dark-sun-mask-v1";
  }
  
  function enhanceSunMaterialWithEclipseMask(material) {
    material.userData.sunEclipseMaskState = {
      active: 0,
      centerNdc: new THREE.Vector2(),
      radius: 0,
      softnessPx: 1,
      strength: 0,
      viewport: new THREE.Vector2(1, 1)
    };
  
    material.onBeforeCompile = (shader) => {
      const { sunEclipseMaskState } = material.userData;
      shader.uniforms.sunEclipseMaskActive = { value: sunEclipseMaskState.active };
      shader.uniforms.sunEclipseMaskCenterNdc = { value: sunEclipseMaskState.centerNdc };
      shader.uniforms.sunEclipseMaskRadius = { value: sunEclipseMaskState.radius };
      shader.uniforms.sunEclipseMaskSoftnessPx = { value: sunEclipseMaskState.softnessPx };
      shader.uniforms.sunEclipseMaskStrength = { value: sunEclipseMaskState.strength };
      shader.uniforms.sunEclipseMaskViewport = { value: sunEclipseMaskState.viewport };
      material.userData.sunEclipseMaskShader = shader;
  
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
  uniform float sunEclipseMaskActive;
  uniform vec2 sunEclipseMaskCenterNdc;
  uniform float sunEclipseMaskRadius;
  uniform float sunEclipseMaskSoftnessPx;
  uniform float sunEclipseMaskStrength;
  uniform vec2 sunEclipseMaskViewport;`
        )
        .replace(
          "#include <opaque_fragment>",
          `float sunEclipseMask = 0.0;
  if (sunEclipseMaskActive > 0.5 && sunEclipseMaskStrength > 0.5) {
    vec2 sunEclipseFragNdc = vec2(
      ((gl_FragCoord.x / max(sunEclipseMaskViewport.x, 1.0)) * 2.0) - 1.0,
      ((gl_FragCoord.y / max(sunEclipseMaskViewport.y, 1.0)) * 2.0) - 1.0
    );
    vec2 sunEclipseDeltaPx = vec2(
      (sunEclipseFragNdc.x - sunEclipseMaskCenterNdc.x) * max(sunEclipseMaskViewport.x, 1.0) * 0.5,
      (sunEclipseFragNdc.y - sunEclipseMaskCenterNdc.y) * max(sunEclipseMaskViewport.y, 1.0) * 0.5
    );
    float sunEclipseDistancePx = length(sunEclipseDeltaPx);
    float sunEclipseRadiusPx = sunEclipseMaskRadius * max(sunEclipseMaskViewport.x, 1.0) * 0.5;
    sunEclipseMask = 1.0 - smoothstep(
      sunEclipseRadiusPx - sunEclipseMaskSoftnessPx,
      sunEclipseRadiusPx + sunEclipseMaskSoftnessPx,
      sunEclipseDistancePx
    );
  }
  outgoingLight *= (1.0 - sunEclipseMask);
  #include <opaque_fragment>`
        );
    };
  
    material.customProgramCacheKey = () => "sun-eclipse-mask-v1";
  }
  
  const orbitDarkSun = createDarkSunGroup();
  scalableStage.add(orbitDarkSun);
  const orbitDarkSunBody = orbitDarkSun.children[0];
  const orbitDarkSunRim = orbitDarkSun.children[1];
  enhanceDarkSunMaterialWithSunMask(orbitDarkSunBody.material);
  enhanceDarkSunMaterialWithSunMask(orbitDarkSunRim.material);
  
  const observerDarkSun = orbitDarkSun.clone(true);
  const observerDarkSunBody = observerDarkSun.children[0];
  observerDarkSunBody.material = observerDarkSunBody.material.clone();
  observerDarkSunBody.renderOrder = orbitDarkSunBody.renderOrder;
  enhanceDarkSunMaterialWithSunMask(observerDarkSunBody.material);
  const observerDarkSunRim = observerDarkSun.children[1];
  observerDarkSunRim.material = observerDarkSunRim.material.clone();
  observerDarkSunRim.renderOrder = orbitDarkSunRim.renderOrder;
  enhanceDarkSunMaterialWithSunMask(observerDarkSunRim.material);
  observerDarkSun.visible = false;
  firstPersonScene.add(observerDarkSun);
  
  const sunAuraTexture = createSunAuraTexture();
  
  function createSunAuraSprite(scale, color, opacity, rotation = 0) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunAuraTexture,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false
      })
    );
    sprite.material.rotation = rotation;
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 22;
    return sprite;
  }
  
  function createMoonAuraSprite(scale, color, opacity, rotation = 0) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunAuraTexture,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false
      })
    );
    sprite.material.rotation = rotation;
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 21;
    return sprite;
  }
  
  const orbitSunCorona = createSunAuraSprite(ORBIT_SUN_CORONA_SCALE, 0xffdc8d, ORBIT_SUN_CORONA_OPACITY);
  const orbitSunAureole = createSunAuraSprite(ORBIT_SUN_AUREOLE_SCALE, 0x8fddff, ORBIT_SUN_AUREOLE_OPACITY, Math.PI / 6);
  orbitSun.add(orbitSunCorona);
  orbitSun.add(orbitSunAureole);
  
  function createSunRayTexture() {
    const width = 256;
    const height = 1024;
    const rayCanvas = document.createElement("canvas");
    rayCanvas.width = width;
    rayCanvas.height = height;
    const rayCtx = rayCanvas.getContext("2d");
    const rayImage = rayCtx.createImageData(width, height);
    const { data } = rayImage;
  
    for (let y = 0; y < height; y += 1) {
      const progress = y / (height - 1);
      const verticalFade = (1 - progress) ** 1.8;
      const beamHalfWidth = (width * 0.08) + ((1 - progress) * width * 0.16);
      const ripple = 0.84 + (Math.sin((progress * 17.5) + 0.35) * 0.16);
  
      for (let x = 0; x < width; x += 1) {
        const index = ((y * width) + x) * 4;
        const centeredX = Math.abs(x - (width / 2));
        const horizontalFade = Math.exp(-((centeredX / beamHalfWidth) ** 2) * 2.6);
        const glowBoost = Math.exp(-((centeredX / (width * 0.12)) ** 2) * 4.2);
        const edgeFactor = Math.min(Math.max((centeredX / beamHalfWidth) - 0.38, 0), 1);
        const coreFactor = Math.exp(-((centeredX / (width * 0.09)) ** 2) * 5.6);
        const alpha = THREE.MathUtils.clamp(
          (((verticalFade * horizontalFade * 255) + (glowBoost * verticalFade * 56)) * ripple),
          0,
          255
        );
  
        data[index] = Math.round((255 * (1 - (edgeFactor * 0.08))) + (242 * coreFactor * 0.08));
        data[index + 1] = Math.round((239 * (1 - (edgeFactor * 0.22))) + (252 * coreFactor * 0.18));
        data[index + 2] = Math.round((204 * (1 - (edgeFactor * 0.36))) + (255 * edgeFactor * 0.36));
        data[index + 3] = alpha;
      }
    }
  
    rayCtx.putImageData(rayImage, 0, 0);
    const texture = new THREE.CanvasTexture(rayCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
  
  const sunRayTexture = createSunRayTexture();
  const firstPersonSunRayGroup = new THREE.Group();
  firstPersonSunRayGroup.visible = false;
  firstPersonScene.add(firstPersonSunRayGroup);
  
  function createSunRayMesh(width, length, rotationZ, opacity, pulseOffset) {
    const geometry = new THREE.PlaneGeometry(width, length);
    geometry.translate(0, -(length * 0.5), 0);
    const material = new THREE.MeshBasicMaterial({
      map: sunRayTexture,
      color: 0xffe8ad,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = rotationZ;
    mesh.renderOrder = 26;
    mesh.userData.baseOpacity = opacity;
    mesh.userData.pulseOffset = pulseOffset;
    return mesh;
  }
  
  const firstPersonSunRayMeshes = [
    createSunRayMesh(FIRST_PERSON_SUN_RAY_WIDTH, FIRST_PERSON_SUN_RAY_LENGTH, 0, 0.18, 0),
    createSunRayMesh(FIRST_PERSON_SUN_RAY_WIDTH, FIRST_PERSON_SUN_RAY_LENGTH, Math.PI / 3, 0.14, 0.8),
    createSunRayMesh(FIRST_PERSON_SUN_RAY_WIDTH, FIRST_PERSON_SUN_RAY_LENGTH, (Math.PI * 2) / 3, 0.14, 1.6),
    createSunRayMesh(FIRST_PERSON_SUN_RAY_SHORT_WIDTH, FIRST_PERSON_SUN_RAY_SHORT_LENGTH, Math.PI / 6, 0.2, 0.35),
    createSunRayMesh(FIRST_PERSON_SUN_RAY_SHORT_WIDTH, FIRST_PERSON_SUN_RAY_SHORT_LENGTH, Math.PI / 2, 0.17, 1.15),
    createSunRayMesh(FIRST_PERSON_SUN_RAY_SHORT_WIDTH, FIRST_PERSON_SUN_RAY_SHORT_LENGTH, (Math.PI * 5) / 6, 0.17, 1.95)
  ];
  firstPersonSunRayGroup.add(...firstPersonSunRayMeshes);
  
  const orbitMoon = new THREE.Group();
  const orbitMoonBody = new THREE.Mesh(
    new THREE.SphereGeometry(ORBIT_MOON_SIZE, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf3f3f0,
      emissiveIntensity: ORBIT_MOON_BODY_EMISSIVE_INTENSITY,
      roughness: 0.68,
      metalness: 0.08,
      transparent: true,
      opacity: 1
    })
  );
  orbitMoon.add(orbitMoonBody);
  
  const orbitMoonHalo = new THREE.Mesh(
    new THREE.SphereGeometry(ORBIT_MOON_SIZE * 2.4, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xcfd8f7,
      transparent: true,
      opacity: ORBIT_MOON_HALO_OPACITY,
      side: THREE.DoubleSide
    })
  );
  orbitMoonHalo.visible = false;
  orbitMoon.add(orbitMoonHalo);
  
  const orbitMoonLight = new THREE.PointLight(0xdbe4ff, ORBIT_MOON_LIGHT_INTENSITY, scaleDimension(5.5), 1.9);
  orbitMoon.add(orbitMoonLight);
  const orbitMoonCoolGlow = new THREE.Mesh(
    new THREE.SphereGeometry(ORBIT_MOON_COOL_GLOW_SCALE, 24, 18),
    new THREE.MeshBasicMaterial({
      color: ORBIT_MOON_COOL_GLOW_COLOR,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    })
  );
  orbitMoonCoolGlow.renderOrder = 22;
  orbitMoonCoolGlow.visible = false;
  orbitMoon.add(orbitMoonCoolGlow);
  const orbitMoonCorona = createMoonAuraSprite(ORBIT_MOON_CORONA_SCALE, 0xf6f8ff, ORBIT_MOON_CORONA_OPACITY);
  const orbitMoonAureole = createMoonAuraSprite(
    ORBIT_MOON_AUREOLE_SCALE,
    ORBIT_MOON_COOL_GLOW_COLOR,
    ORBIT_MOON_AUREOLE_OPACITY,
    Math.PI / 7
  );
  orbitMoonAureole.visible = false;
  const orbitMoonWarmFringe = createMoonAuraSprite(
    ORBIT_MOON_WARM_FRINGE_SCALE,
    0xffefc5,
    ORBIT_MOON_WARM_FRINGE_OPACITY,
    Math.PI / 3
  );
  orbitMoon.add(orbitMoonCorona);
  orbitMoon.add(orbitMoonAureole);
  orbitMoon.add(orbitMoonWarmFringe);
  scalableStage.add(orbitMoon);
  
  const observerMoon = orbitMoon.clone(true);
  const observerMoonBody = observerMoon.children[0];
  observerMoonBody.material = observerMoonBody.material.clone();
  const observerMoonHalo = observerMoon.children[1];
  observerMoonHalo.material = observerMoonHalo.material.clone();
  observerMoonHalo.visible = false;
  const observerMoonLight = observerMoon.children[2];
  const observerMoonCoolGlow = observerMoon.children[3];
  observerMoonCoolGlow.material = observerMoonCoolGlow.material.clone();
  observerMoonCoolGlow.visible = false;
  const observerMoonCorona = observerMoon.children[4];
  observerMoonCorona.material = observerMoonCorona.material.clone();
  const observerMoonAureole = observerMoon.children[5];
  observerMoonAureole.material = observerMoonAureole.material.clone();
  observerMoonAureole.visible = false;
  const observerMoonWarmFringe = observerMoon.children[6];
  observerMoonWarmFringe.material = observerMoonWarmFringe.material.clone();

  function configureMoonSurfaceTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }

  function applyMoonSurfaceTextureToMaterial(material, texture) {
    const phaseState = material.userData.moonPhaseState ?? {
      coolGlowStrength: 0,
      glowStrength: 1,
      illuminationFraction: 1,
      lunarEclipseTint: 0,
      lunarEclipseShadowStrength: 0,
      shadowAlpha: 0.08,
      waxing: 1,
      eclipseMaskCenterNdc: new THREE.Vector2(),
      eclipseMaskRadius: 0,
      eclipseMaskSoftnessPx: 32,
      eclipseMaskViewport: new THREE.Vector2(1, 1),
      surfaceTexture: null,
      surfaceTextureEnabled: 0,
      surfaceTextureRotationRadians: 0
    };
    phaseState.surfaceTexture = texture;
    phaseState.surfaceTextureEnabled = texture ? 1 : 0;
    material.userData.moonPhaseState = phaseState;
    material.map = null;

    if (material.userData.phaseShader) {
      material.userData.phaseShader.uniforms.moonSurfaceMap.value = texture;
      material.userData.phaseShader.uniforms.moonSurfaceMapEnabled.value = phaseState.surfaceTextureEnabled;
    }

    material.needsUpdate = true;
  }

  function applyMoonSurfaceTexture(texture) {
    configureMoonSurfaceTexture(texture);
    applyMoonSurfaceTextureToMaterial(orbitMoonBody.material, texture);
    applyMoonSurfaceTextureToMaterial(observerMoonBody.material, texture);
  }

  const moonTextureLoader = new THREE.TextureLoader();
  moonTextureLoader.load(
    DEFAULT_MOON_TEXTURE_PATH,
    (texture) => {
      applyMoonSurfaceTexture(texture);
    },
    undefined,
    () => {
      moonTextureLoader.load(
        DEFAULT_MOON_TEXTURE_FALLBACK_PATH,
        (fallbackTexture) => {
          applyMoonSurfaceTexture(fallbackTexture);
        }
      );
    }
  );

  enhanceMoonMaterialWithPhase(orbitMoonBody.material);
  enhanceMoonMaterialWithPhase(observerMoonBody.material);
  observerMoon.visible = false;
  firstPersonScene.add(observerMoon);
  
  const sunFullTrailGeometry = new THREE.BufferGeometry();
  const sunFullTrailMaterial = new THREE.LineBasicMaterial({
    color: 0xffdc85,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    depthTest: false
  });
  const sunFullTrail = new THREE.Line(sunFullTrailGeometry, sunFullTrailMaterial);
  scalableStage.add(sunFullTrail);
  
  const sunFullTrailPointsGeometry = new THREE.BufferGeometry();
  const sunFullTrailPointsMaterial = new THREE.PointsMaterial({
    color: 0xffef9a,
    size: scaleDimension(0.05),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    depthTest: false
  });
  const sunFullTrailPointsCloud = new THREE.Points(sunFullTrailPointsGeometry, sunFullTrailPointsMaterial);
  scalableStage.add(sunFullTrailPointsCloud);
  
  const sunTrailGeometry = new THREE.BufferGeometry();
  const sunTrailMaterial = new THREE.LineBasicMaterial({
    color: 0xffdc85,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: false
  });
  const sunTrail = new THREE.Line(sunTrailGeometry, sunTrailMaterial);
  scalableStage.add(sunTrail);
  
  const sunTrailPointsGeometry = new THREE.BufferGeometry();
  const sunTrailPointsMaterial = new THREE.PointsMaterial({
    color: 0xffef9a,
    size: scaleDimension(0.09),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: false
  });
  const sunTrailPointsCloud = new THREE.Points(sunTrailPointsGeometry, sunTrailPointsMaterial);
  scalableStage.add(sunTrailPointsCloud);
  
  const moonFullTrailGeometry = new THREE.BufferGeometry();
  const moonFullTrailMaterial = new THREE.LineBasicMaterial({
    color: 0xd7def2,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    depthTest: false
  });
  const moonFullTrail = new THREE.Line(moonFullTrailGeometry, moonFullTrailMaterial);
  scalableStage.add(moonFullTrail);
  
  const moonFullTrailPointsGeometry = new THREE.BufferGeometry();
  const moonFullTrailPointsMaterial = new THREE.PointsMaterial({
    color: 0xf4f7ff,
    size: scaleDimension(0.04),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    depthTest: false
  });
  const moonFullTrailPointsCloud = new THREE.Points(moonFullTrailPointsGeometry, moonFullTrailPointsMaterial);
  scalableStage.add(moonFullTrailPointsCloud);
  
  const moonTrailGeometry = new THREE.BufferGeometry();
  const moonTrailMaterial = new THREE.LineBasicMaterial({
    color: 0xd7def2,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    depthTest: false
  });
  const moonTrail = new THREE.Line(moonTrailGeometry, moonTrailMaterial);
  scalableStage.add(moonTrail);
  
  const moonTrailPointsGeometry = new THREE.BufferGeometry();
  const moonTrailPointsMaterial = new THREE.PointsMaterial({
    color: 0xf4f7ff,
    size: scaleDimension(0.07),
    sizeAttenuation: true,
      depthTest: false
  });
  const moonTrailPointsCloud = new THREE.Points(moonTrailPointsGeometry, moonTrailPointsMaterial);
  scalableStage.add(moonTrailPointsCloud);
  
  const darkSunFullTrailGeometry = new THREE.BufferGeometry();
  const darkSunFullTrailMaterial = new THREE.LineBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    depthTest: false
  });
  const darkSunFullTrail = new THREE.Line(darkSunFullTrailGeometry, darkSunFullTrailMaterial);
  scalableStage.add(darkSunFullTrail);

  const darkSunFullTrailPointsGeometry = new THREE.BufferGeometry();
  const darkSunFullTrailPointsMaterial = new THREE.PointsMaterial({
    color: 0x4a4a4a,
    size: scaleDimension(0.04),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    depthTest: false
  });
  const darkSunFullTrailPointsCloud = new THREE.Points(darkSunFullTrailPointsGeometry, darkSunFullTrailPointsMaterial);
  scalableStage.add(darkSunFullTrailPointsCloud);

  const darkSunTrailGeometry = new THREE.BufferGeometry();
  const darkSunTrailMaterial = new THREE.LineBasicMaterial({
    color: 0x6e6e6e,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    depthTest: false
  });
  const darkSunTrail = new THREE.Line(darkSunTrailGeometry, darkSunTrailMaterial);
  scalableStage.add(darkSunTrail);

  const darkSunTrailPointsGeometry = new THREE.BufferGeometry();
  const darkSunTrailPointsMaterial = new THREE.PointsMaterial({
    color: 0x5a5a5a,
    size: scaleDimension(0.04),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    depthTest: false
  });
  const darkSunTrailPointsCloud = new THREE.Points(darkSunTrailPointsGeometry, darkSunTrailPointsMaterial);
  scalableStage.add(darkSunTrailPointsCloud);
  
  function createOrbitTrack(radius, color, opacity, height = ORBIT_TRACK_HEIGHT) {
    const trackGroup = new THREE.Group();
    const track = new THREE.Mesh(
      new THREE.TorusGeometry(radius, ORBIT_TRACK_TUBE_RADIUS, 16, 192),
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
    track.position.y = height;
    trackGroup.add(track);
  
    if (Math.abs(height - ORBIT_TRACK_HEIGHT) > scaleDimension(0.02)) {
      for (const angle of ORBIT_HEIGHT_GUIDE_ANGLES) {
        const guideHeight = Math.abs(height - ORBIT_TRACK_HEIGHT);
        const guide = new THREE.Mesh(
          new THREE.CylinderGeometry(ORBIT_HEIGHT_GUIDE_RADIUS, ORBIT_HEIGHT_GUIDE_RADIUS, guideHeight, 12, 1, false),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.65,
            transparent: true,
            opacity: opacity * 0.9,
            roughness: 0.24,
            metalness: 0.08
          })
        );
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(ORBIT_HEIGHT_GUIDE_MARKER_SIZE, 18, 14),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 1.1,
            transparent: true,
            opacity,
            roughness: 0.18,
            metalness: 0.05
          })
        );
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        guide.position.set(x, (height + ORBIT_TRACK_HEIGHT) / 2, z);
        marker.position.set(x, height, z);
        trackGroup.add(guide);
        trackGroup.add(marker);
      }
    }
  
    return trackGroup;
  }
  
  scalableStage.add(createOrbitTrack(TROPIC_CANCER_RADIUS, 0xffc96c, 0.88, ORBIT_SUN_HEIGHT_NORTH));
  scalableStage.add(createOrbitTrack(EQUATOR_RADIUS, 0x7fd8ff, 0.78, ORBIT_SUN_HEIGHT));
  scalableStage.add(createOrbitTrack(TROPIC_CAPRICORN_RADIUS, 0xff93b6, 0.88, ORBIT_SUN_HEIGHT_SOUTH));

  return {
    renderer,
    scene,
    firstPersonScene,
    camera,
    defaultCameraLookTarget,
    cameraState,
    stage,
    scalableStage,
    topMaterial,
    sideMaterial,
    bottomMaterial,
    disc,
    transparentSurfaceMaterial,
    dayNightOverlayMaterial,
    dayNightOverlay,
    northSeasonOverlay,
    southSeasonOverlay,
    analemmaProjectionGeometry,
    analemmaProjectionMaterial,
    analemmaProjection,
    analemmaProjectionPointsGeometry,
    analemmaProjectionPointsMaterial,
    analemmaProjectionPoints,
    skyAnalemmaGeometry,
    skyAnalemmaMaterial,
    skyAnalemma,
    skyAnalemmaPointsGeometry,
    skyAnalemmaPointsMaterial,
    skyAnalemmaPoints,
    iceOuterMaterial,
    iceInnerMaterial,
    iceCapMaterial,
    iceWallOuter,
    iceWallInner,
    iceTopCap,
    iceBottomCap,
    iceCrown,
    dome,
    domeRing,
    polarisTextureCanvas,
    polarisTextureCtx,
    polarisGlowGradient,
    polarisGlowTexture,
    polaris,
    polarisCore,
    polarisGlow,
    polarisHalo,
    glow,
    walker,
    walkerBody,
    walkerHeading,
    walkerRing,
    walkerGuideGroup,
    walkerGuideLeft,
    walkerGuideRight,
    walkerGuideCenter,
    ambient,
    keyLight,
    rimLight,
    firstPersonAmbient,
    firstPersonKeyLight,
    firstPersonRimLight,
    orbitSun,
    orbitSunBody,
    orbitSunHalo,
    orbitSunLight,
    observerSun,
    observerSunBody,
    observerSunHalo,
    observerSunLight,
    orbitDarkSun,
    orbitDarkSunBody,
    orbitDarkSunRim,
    observerDarkSun,
    observerDarkSunBody,
    observerDarkSunRim,
    sunAuraTexture,
    orbitSunCorona,
    orbitSunAureole,
    sunRayTexture,
    firstPersonSunRayGroup,
    firstPersonSunRayMeshes,
    orbitMoon,
    orbitMoonBody,
    orbitMoonHalo,
    orbitMoonLight,
    orbitMoonCoolGlow,
    orbitMoonCorona,
    orbitMoonAureole,
    orbitMoonWarmFringe,
    observerMoon,
    observerMoonBody,
    observerMoonHalo,
    observerMoonLight,
    observerMoonCoolGlow,
    observerMoonCorona,
    observerMoonAureole,
    observerMoonWarmFringe,
    sunFullTrailGeometry,
    sunFullTrailMaterial,
    sunFullTrail,
    sunFullTrailPointsGeometry,
    sunFullTrailPointsMaterial,
    sunFullTrailPointsCloud,
    sunTrailGeometry,
    sunTrailMaterial,
    sunTrail,
    sunTrailPointsGeometry,
    sunTrailPointsMaterial,
    sunTrailPointsCloud,
    moonFullTrailGeometry,
    moonFullTrailMaterial,
    moonFullTrail,
    moonFullTrailPointsGeometry,
    moonFullTrailPointsMaterial,
    moonFullTrailPointsCloud,
    moonTrailGeometry,
    moonTrailMaterial,
    moonTrail,
    moonTrailPointsGeometry,
    moonTrailPointsMaterial,
    moonTrailPointsCloud,
    darkSunFullTrailGeometry,
    darkSunFullTrailMaterial,
    darkSunFullTrail,
    darkSunFullTrailPointsGeometry,
    darkSunFullTrailPointsMaterial,
    darkSunFullTrailPointsCloud,
    darkSunTrailGeometry,
    darkSunTrailMaterial,
    darkSunTrail,
    darkSunTrailPointsGeometry,
    darkSunTrailPointsMaterial,
    darkSunTrailPointsCloud,
    enhanceDomeMaterialWithSunGlow,
    enhanceMoonMaterialWithPhase,
    setMoonMaterialPhase,
    createSunAuraTexture,
    createWalkerGuideLine,
    createDarkSunGroup,
    enhanceDarkSunMaterialWithSunMask,
    enhanceSunMaterialWithEclipseMask,
    createSunAuraSprite,
    createMoonAuraSprite,
    createSunRayTexture,
    createSunRayMesh,
    createOrbitTrack
  };
}
