export type OpeningChoreographyMode =
  | 'assemble'
  | 'exploded'
  | 'vortex'
  | 'hyperdrive';

export type OpeningPaletteId = 'udaipur-gold' | 'emerald-palace' | 'midnight-cosmos';

export interface OpeningPaletteConfig {
  id: OpeningPaletteId;
  label: string;
  subtitle: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  fogHex: string;
  keyLightHex: string;
  rimLightHex: string;
}

export interface ModuleTransformTarget {
  id: string;
  label: string;
  layerIndex: number; // 0 = foundation, 1 = colonnade, 2 = banquet ring, 3 = royal mandap, 4 = chandelier crown
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export const OPENING_PALETTES: Record<OpeningPaletteId, OpeningPaletteConfig> = {
  'udaipur-gold': {
    id: 'udaipur-gold',
    label: 'Udaipur Imperial Gold',
    subtitle: 'Brushed 24K Gold · Sandstone & Warm Amber',
    primaryHex: '#D4AF37',
    secondaryHex: '#1E293B',
    accentHex: '#F59E0B',
    fogHex: '#070B14',
    keyLightHex: '#FFF3D1',
    rimLightHex: '#38BDF8',
  },
  'emerald-palace': {
    id: 'emerald-palace',
    label: 'Glasshouse Emerald',
    subtitle: 'Botanical Jade · Champagne Brass & Teal',
    primaryHex: '#10B981',
    secondaryHex: '#064E3B',
    accentHex: '#FBBF24',
    fogHex: '#041311',
    keyLightHex: '#ECFDF5',
    rimLightHex: '#F59E0B',
  },
  'midnight-cosmos': {
    id: 'midnight-cosmos',
    label: 'Midnight Sangeet',
    subtitle: 'Sapphire Velvet · Rose Gold & Starlight',
    primaryHex: '#38BDF8',
    secondaryHex: '#0F172A',
    accentHex: '#F43F5E',
    fogHex: '#050811',
    keyLightHex: '#E0F2FE',
    rimLightHex: '#FB7185',
  },
};

/**
 * Computes deterministic 3D target transforms for the 14 architectural modules
 * (1 foundation plinth, 1 royal mandap dome, 8 banquet table modules, 4 orbital chandelier rings)
 * based on the active choreography mode, explosion factor [0..1], and elapsed time.
 */
export function computeOpeningModuleTargets(
  mode: OpeningChoreographyMode,
  explosionFactor: number,
  elapsedTime: number
): ModuleTransformTarget[] {
  const clampedExp = Math.max(0, Math.min(1, explosionFactor));
  const targets: ModuleTransformTarget[] = [];

  // 1. Architectural Foundation Plinth (Layer 0)
  const plinthY =
    mode === 'exploded'
      ? -2.2 - clampedExp * 1.8
      : mode === 'vortex'
      ? -1.4 + Math.sin(elapsedTime * 1.6) * 0.25
      : mode === 'hyperdrive'
      ? -1.8
      : -1.2 - clampedExp * 0.9;

  targets.push({
    id: 'plinth-base',
    label: 'Octagonal Marble Courtyard Plinth',
    layerIndex: 0,
    position: [0, Number(plinthY.toFixed(3)), 0],
    rotation: [
      0,
      Number((elapsedTime * (mode === 'vortex' ? 0.65 : 0.18)).toFixed(3)),
      0,
    ],
    scale: mode === 'hyperdrive' ? 1.12 : 1,
  });

  // 2. Royal Mandap / Stage Core (Layer 3)
  const mandapY =
    mode === 'exploded'
      ? 0.65 + clampedExp * 1.15
      : mode === 'vortex'
      ? 0.5 + Math.cos(elapsedTime * 2.1) * 0.35
      : mode === 'hyperdrive'
      ? 0.35 + Math.sin(elapsedTime * 4) * 0.18
      : -0.15 + clampedExp * 0.95;

  targets.push({
    id: 'mandap-core',
    label: 'Royal Ceremonial Mandap Sanctuary',
    layerIndex: 3,
    position: [0, Number(mandapY.toFixed(3)), 0],
    rotation: [
      mode === 'vortex' ? Number((Math.sin(elapsedTime) * 0.22).toFixed(3)) : 0,
      Number((-elapsedTime * (mode === 'hyperdrive' ? 1.4 : 0.32)).toFixed(3)),
      0,
    ],
    scale: mode === 'exploded' ? 1.04 : 1,
  });

  // 3. 8 Modular 3D Banquet Table Pods (Layer 2)
  const tableCount = 8;
  for (let i = 0; i < tableCount; i++) {
    const baseAngle = (i / tableCount) * Math.PI * 2;
    const orbitSpeed = mode === 'vortex' ? 0.95 : mode === 'hyperdrive' ? 1.85 : 0.22;
    const angle = baseAngle + elapsedTime * orbitSpeed;

    let radius = 3.2 + clampedExp * 2.0;
    let y = -0.55 + Math.sin(elapsedTime * 2 + i * 0.8) * 0.12;
    let rx = 0;
    let rz = 0;

    if (mode === 'exploded') {
      radius = 4.2 + clampedExp * 2.2;
      y = (i % 2 === 0 ? 0.85 : -0.75) * (0.5 + clampedExp * 1.1);
      rx = 0.25 * (i % 2 === 0 ? 1 : -1);
      rz = 0.2;
    } else if (mode === 'vortex') {
      radius = 3.8 + Math.sin(elapsedTime * 1.5 + i) * 1.1;
      y = Math.sin(baseAngle * 2 + elapsedTime * 2.4) * 1.65;
      rx = Math.cos(elapsedTime + i) * 0.45;
      rz = Math.sin(elapsedTime + i) * 0.45;
    } else if (mode === 'hyperdrive') {
      radius = 4.2 + (i % 2) * 1.3;
      const zStream = (((elapsedTime * 6 + i * 2.2) % 14) - 7) * 0.85;
      y = Math.sin(i * 1.3 + elapsedTime * 3) * 1.2;
      targets.push({
        id: `table-pod-${i + 1}`,
        label: `Modular Banquet Pod 0${i + 1}`,
        layerIndex: 2,
        position: [
          Number((Math.cos(baseAngle) * radius).toFixed(3)),
          Number(y.toFixed(3)),
          Number(zStream.toFixed(3)),
        ],
        rotation: [
          Number((elapsedTime * 1.2 + i).toFixed(3)),
          Number(angle.toFixed(3)),
          0,
        ],
        scale: 0.95,
      });
      continue;
    }

    targets.push({
      id: `table-pod-${i + 1}`,
      label: `Modular Banquet Pod 0${i + 1}`,
      layerIndex: 2,
      position: [
        Number((Math.cos(angle) * radius).toFixed(3)),
        Number((y + clampedExp * (i % 2 === 0 ? 0.85 : -0.35)).toFixed(3)),
        Number((Math.sin(angle) * radius).toFixed(3)),
      ],
      rotation: [
        Number(rx.toFixed(3)),
        Number((-angle + Math.PI / 2).toFixed(3)),
        Number(rz.toFixed(3)),
      ],
      scale: 1,
    });
  }

  // 4. 4 Gyroscopic Acoustic & Chandelier Rings (Layer 4)
  for (let r = 0; r < 4; r++) {
    const ringElev =
      mode === 'exploded'
        ? 1.7 + r * 0.65 + clampedExp * 1.35
        : mode === 'vortex'
        ? 0.2 * (r - 1.5)
        : 1.75 + r * 0.32 + clampedExp * (r + 1) * 0.42;

    const tiltSpeed = mode === 'vortex' || mode === 'hyperdrive' ? 1.35 : 0.45;
    targets.push({
      id: `chandelier-ring-${r + 1}`,
      label: `Gyroscopic Chandelier Ring 0${r + 1}`,
      layerIndex: 4,
      position: [0, Number(ringElev.toFixed(3)), 0],
      rotation: [
        Number((Math.sin(elapsedTime * tiltSpeed + r * 0.9) * (mode === 'assemble' ? 0.22 : 0.85)).toFixed(3)),
        Number((elapsedTime * (0.3 + r * 0.15) * (r % 2 === 0 ? 1 : -1)).toFixed(3)),
        Number((Math.cos(elapsedTime * tiltSpeed + r * 1.1) * (mode === 'assemble' ? 0.18 : 0.75)).toFixed(3)),
      ],
      scale: Number((1 + r * 0.18 + clampedExp * 0.15).toFixed(3)),
    });
  }

  return targets;
}

/**
 * Computes camera position and look-at target for the 3D opening sequence,
 * combining active choreography mode, cursor parallax [-1..1], and explosion factor.
 */
export function computeOpeningCameraPose(
  mode: OpeningChoreographyMode,
  pointerX: number,
  pointerY: number,
  explosionFactor: number,
  elapsedTime: number
): {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
} {
  const px = Math.max(-1, Math.min(1, pointerX));
  const py = Math.max(-1, Math.min(1, pointerY));
  const exp = Math.max(0, Math.min(1, explosionFactor));

  const baseDist =
    mode === 'exploded'
      ? 13.5 + exp * 2.8
      : mode === 'vortex'
      ? 11.2
      : mode === 'hyperdrive'
      ? 9.2
      : 10.2 + exp * 2.2;

  const baseHeight =
    mode === 'exploded'
      ? 4.8 + exp * 1.5
      : mode === 'vortex'
      ? 3.8 + Math.sin(elapsedTime * 0.8) * 1.2
      : mode === 'hyperdrive'
      ? 2.6
      : 4.4 + exp * 1.1;

  const swayAngle = elapsedTime * (mode === 'vortex' ? 0.35 : 0.12) + px * 0.55;
  const x = Math.sin(swayAngle) * baseDist;
  const z = Math.cos(swayAngle) * baseDist;
  const y = baseHeight - py * 1.8;

  const fov = mode === 'hyperdrive' ? 62 : mode === 'exploded' ? 48 : 45;

  return {
    position: [Number(x.toFixed(3)), Number(y.toFixed(3)), Number(z.toFixed(3))],
    lookAt: [
      Number((px * 0.6).toFixed(3)),
      Number((mode === 'exploded' ? 0.6 : 0.2).toFixed(3)),
      0,
    ],
    fov,
  };
}

export interface SimpleOpeningTimelineState {
  progress: number; // 0 to 1
  progressPercent: number; // 0 to 100
  phaseLabel: string;
  archRiseY: number;
  ringScale: number;
  cameraZ: number;
  cameraY: number;
  isComplete: boolean;
}

/**
 * Computes a simple, smooth, automatic 3.2-second 3D opening animation curve
 * (rise -> golden halo bloom -> camera glide-in -> auto-enter).
 */
export function computeSimpleOpeningTimeline(
  elapsedSeconds: number,
  durationSeconds = 3.2
): SimpleOpeningTimelineState {
  const safeDuration = Math.max(0.5, durationSeconds);
  const rawProgress = Math.max(0, Math.min(1, elapsedSeconds / safeDuration));
  // Cubic ease-out for effortless, graceful motion
  const eased = 1 - Math.pow(1 - rawProgress, 3);

  const archRiseY = Number(((-0.85 + eased * 0.85)).toFixed(3));
  const ringScale = Number(((0.78 + eased * 0.22)).toFixed(3));
  const cameraZ = Number(((8.4 - eased * 2.8)).toFixed(3));
  const cameraY = Number(((2.5 - eased * 0.6)).toFixed(3));

  let phaseLabel = 'Illuminating Royal Courtyard';
  if (rawProgress >= 0.72) {
    phaseLabel = 'Entering Aura Atelier';
  } else if (rawProgress >= 0.35) {
    phaseLabel = 'Aligning 3D Spatial Architecture';
  }

  return {
    progress: Number(rawProgress.toFixed(3)),
    progressPercent: Math.round(rawProgress * 100),
    phaseLabel,
    archRiseY,
    ringScale,
    cameraZ,
    cameraY,
    isComplete: rawProgress >= 1,
  };
}

export const DEFAULT_GOOGLE_FLOW_VIDEO_PATH =
  '/assets/aistudio/Camera_gliding_into_botanical_ba__0ea57874_1080p_gwr_video_mvp_8c61f611.mp4';

export interface GoogleFlowPromptPreset {
  id: string;
  title: string;
  subtitle: string;
  cameraControl: string;
  aspectRatio: '16:9';
  durationRecommendation: string;
  prompt: string;
}

export const GOOGLE_FLOW_PROMPTS: GoogleFlowPromptPreset[] = [
  {
    id: 'glasshouse-lighting-morph-with-title',
    title: 'Option 3A · Botanical Glasshouse Morph + 3D "AURA ATELIER" Title Reveal (Updated)',
    subtitle: 'Your favorite conservatory video prompt enhanced with floating 24K gold 3D title letters',
    cameraControl: 'Centered Steadicam Glide Forward (24fps, 16:9)',
    aspectRatio: '16:9',
    durationRecommendation: '8s – 9s clip',
    prompt:
      'A centered, symmetrical Steadicam glide through tall wrought-iron and glass conservatory doors swinging open into a lavish botanical banquet hall. As the camera glides forward down the central white aisle, a seamless time-lapse lighting transition sweeps across the room: warm golden sunset rays streaming through the arched glass roof smoothly shift into a dramatic midnight gala atmosphere with glowing crystal chandeliers, suspended white floral installations, and warm candlelit banquet tables. Above the central floral arch at the end of the aisle, elegant 24K brushed-gold 3D serif letters spelling "AURA ATELIER" softly illuminate with warm golden light motes. Crisp architectural realism, silky motion blur, luxury editorial film look.',
  },
  {
    id: 'glasshouse-lighting-morph',
    title: 'Option 3B · Clean Botanical Glasshouse Morph (Currently Active Video)',
    subtitle: 'Clean camera glide with crisp vector "AURA ATELIER" title choreographed in code',
    cameraControl: 'Centered Steadicam Glide Forward (24fps, 16:9)',
    aspectRatio: '16:9',
    durationRecommendation: '8s – 9s clip',
    prompt:
      'A centered, symmetrical Steadicam glide through tall wrought-iron and glass conservatory doors into a lavish botanical banquet hall. As the camera glides forward down the central aisle, a seamless time-lapse lighting transition sweeps across the room: warm golden sunset rays streaming through the glass roof smoothly shift into a dramatic midnight gala atmosphere with glowing crystal chandeliers, suspended floral installations, and warm uplighting on ivory and gold banquet tables. Crisp architectural realism, silky motion blur, high-contrast luxury editorial film look.',
  },
  {
    id: 'hologram-to-palace',
    title: 'Option 1 · 3D Blueprint to Royal Udaipur Courtyard',
    subtitle: 'Architectural wireframe morphing into candlelit luxury venue with "AURA ATELIER" crest',
    cameraControl: 'Smooth Dolly-In + Slight Crane-Up (24fps, 16:9)',
    aspectRatio: '16:9',
    durationRecommendation: '5s – 8s clip',
    prompt:
      'Cinematic 8k architectural reveal of a grand royal sandstone courtyard in Udaipur at twilight. The shot begins with glowing 24K gold holographic 3D architectural grid lines and floating geometric blueprint rings assembling over a dark reflective obsidian pool. As the camera performs a smooth forward dolly-in and gentle crane-up, the glowing gold wireframe seamlessly solidifies into a real-world carved white marble and sandstone Lotus Mandap pavilion surrounded by circular banquet tables dressed in emerald silk linens, warm brass lanterns, floating marigold petals, and crystal chandeliers. Volumetric golden-hour sunbeams transition into a starlit indigo night sky, shallow depth of field, anamorphic lens flare, ultra-photorealistic luxury spatial design showreel.',
  },
];

export interface VideoOpeningProgressState {
  progressPercent: number;
  phaseLabel: string;
  lightingBadge: 'SUNSET WARMTH' | 'TWILIGHT MORPH' | 'MIDNIGHT GALA';
  titleOpacity: number;
  titleScale: number;
  subtitleVisible: boolean;
  isComplete: boolean;
}

/**
 * Computes progress percentage, lighting badge, and synchronized "Aura Atelier" website title
 * reveal state from a playing <video> element's currentTime and duration.
 */
export function computeVideoOpeningProgress(
  currentTime: number,
  duration: number
): VideoOpeningProgressState {
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      progressPercent: 12,
      phaseLabel: 'Opening Conservatory Gates · Sunset Warmth',
      lightingBadge: 'SUNSET WARMTH',
      titleOpacity: 1,
      titleScale: 1,
      subtitleVisible: true,
      isComplete: false,
    };
  }
  const clamped = Math.max(0, Math.min(1, currentTime / duration));
  const progressPercent = Math.round(clamped * 100);

  let phaseLabel = 'Opening Conservatory Gates · Sunset Warmth';
  let lightingBadge: 'SUNSET WARMTH' | 'TWILIGHT MORPH' | 'MIDNIGHT GALA' = 'SUNSET WARMTH';

  if (clamped >= 0.72) {
    phaseLabel = 'Midnight Gala Chandeliers Illuminated · Entering Studio';
    lightingBadge = 'MIDNIGHT GALA';
  } else if (clamped >= 0.35) {
    phaseLabel = 'Aligning 3D Spatial Architecture';
    lightingBadge = 'TWILIGHT MORPH';
  }

  // Smooth title fade-in as the wrought-iron gates swing open (between 6% and 22% of video)
  const fadeIn = Math.max(0, Math.min(1, (clamped - 0.04) / 0.16));
  const titleOpacity = Number((0.15 + fadeIn * 0.85).toFixed(3));
  const titleScale = Number((0.95 + clamped * 0.07).toFixed(3));
  const subtitleVisible = clamped >= 0.12;

  return {
    progressPercent,
    phaseLabel,
    lightingBadge,
    titleOpacity: 1,
    titleScale: 1,
    subtitleVisible: true,
    isComplete: clamped >= 0.995,
  };
}



