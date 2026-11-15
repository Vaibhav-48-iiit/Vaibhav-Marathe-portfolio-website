import { SITE_CONFIG, type QualityTierName } from './config';

export interface DeviceProfile {
  isMobile: boolean;
  isLowEnd: boolean;
  particleCount: number;
  ambientParticleCount: number;
  pixelRatio: number;
}

export interface QualityTierProfile {
  tier: QualityTierName;
  isMobile: boolean;
  particleCount: number;
  ambientParticleCount: number;
  pixelRatio: number;
  idleMotion: boolean;
  ambientField: boolean;
}

export interface DeltaNetworkData {
  /** Base XYZ positions of each node when fully formed into the Δ (length = count * 3) */
  basePositions: Float32Array;
  /** Deterministic dispersion velocity/drift vectors for each node when scrolling (length = count * 3) */
  driftVectors: Float32Array;
  /** Per-node phase offset in [0, 2π] for subtle depth turbulence during scroll */
  phases: Float32Array;
  /** Per-node colour RGB values (mostly #E8E4DA with sparse #4FD1D9 cyan highlights) */
  nodeColors: Float32Array;
  /** Pairs of node indices [i0, j0, i1, j1, ...] that are connected by thin lines in the Δ */
  edgeIndices: Uint16Array;
}

export interface AmbientFieldData {
  /** 3D positions distributed along the camera's forward depth corridor (length = count * 3) */
  positions: Float32Array;
  /** Per-particle phase in [0, 2π] for gentle ambient drift */
  phases: Float32Array;
  /** Per-particle RGB colours (muted bone-ivory and sparse subdued cyan) */
  colors: Float32Array;
}

export interface ScrollMetrics {
  /** Scroll progress through the entire document in [0, 1] (used for "depth %" HUD & camera travel) */
  pageProgress: number;
  /** Scroll progress through the hero dispersion zone in [0, 1] (used for Δ lattice dispersion) */
  heroProgress: number;
  /** Target camera Z position moving smoothly forward into depth as pageProgress increases */
  targetCameraZ: number;
  /** Visibility factor in [0, 1] for the sparse ambient particle field in later sections */
  ambientFieldVisibility: number;
}

/**
 * Safely checks whether the visitor has completed the intro before.
 * Wrapped in try/catch so private browsing, sandboxed iframes, or disabled
 * storage never throw an error.
 */
export function hasVisitedBefore(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): boolean {
  try {
    if (!storage) return false;
    return storage.getItem(SITE_CONFIG.timings.visitStorageKey) === '1';
  } catch {
    return false;
  }
}

/**
 * Safely records that the visitor has completed the intro.
 * Wrapped in try/catch so unavailable localStorage degrades gracefully.
 */
export function markVisited(
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): void {
  try {
    if (!storage) return;
    storage.setItem(SITE_CONFIG.timings.visitStorageKey, '1');
  } catch {
    // Storage unavailable or quota exceeded; ignore safely.
  }
}

/**
 * Safely reads whether `navigator.connection?.saveData` is enabled.
 */
export function isSaveDataEnabled(nav: unknown = typeof navigator !== 'undefined' ? navigator : null): boolean {
  try {
    if (!nav || typeof nav !== 'object') return false;
    const conn = (nav as { connection?: { saveData?: boolean } }).connection;
    return Boolean(conn && conn.saveData === true);
  } catch {
    return false;
  }
}

/**
 * Safely reads the user's "Plain view" preference from localStorage inside try/catch.
 * If no preference has been saved yet, defaults to `true` when `prefers-reduced-motion`
 * is active or `navigator.connection?.saveData` is `true`, or `false` otherwise.
 */
export function getInitialPlainView(
  prefersReducedMotion: boolean,
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
  saveData: boolean = isSaveDataEnabled(),
): boolean {
  try {
    if (storage) {
      const saved = storage.getItem(SITE_CONFIG.timings.plainViewStorageKey);
      if (saved === '1') return true;
      if (saved === '0') return false;
    }
  } catch {
    // Ignore storage errors and fall back to reducedMotion / saveData default
  }
  return Boolean(prefersReducedMotion || saveData);
}

/**
 * Safely persists the user's "Plain view" toggle choice in localStorage inside try/catch.
 */
export function savePlainViewPreference(
  enabled: boolean,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): void {
  try {
    if (!storage) return;
    storage.setItem(SITE_CONFIG.timings.plainViewStorageKey, enabled ? '1' : '0');
  } catch {
    // Ignore storage errors safely
  }
}

/**
 * Computes whole-page scroll progress, hero dispersion progress, camera Z position,
 * and sparse ambient particle field visibility from native browser scroll metrics.
 */
export function computeScrollMetrics(options: {
  scrollY: number;
  viewportHeight: number;
  documentScrollHeight: number;
}): ScrollMetrics {
  const vh = Math.max(1, options.viewportHeight);
  const maxPageScroll = Math.max(1, options.documentScrollHeight - vh);
  const clampedScrollY = Math.max(0, options.scrollY);

  // 1. Whole-page progress [0, 1] drives the "depth %" HUD and camera Z travel
  const pageProgress = Math.max(0, Math.min(1, clampedScrollY / maxPageScroll));

  // 2. Hero dispersion progress [0, 1] over the first `dispersionScrollVh` viewport heights
  const maxHeroScroll = Math.max(1, vh * SITE_CONFIG.scroll.dispersionScrollVh);
  const heroProgress = Math.max(0, Math.min(1, clampedScrollY / maxHeroScroll));

  // 3. Camera moves smoothly forward along -Z as the user scrolls down the page
  const targetCameraZ =
    SITE_CONFIG.scroll.cameraStartZ - pageProgress * SITE_CONFIG.scroll.cameraTravelDepth;

  // 4. Sparse ambient field fades in gently as the hero lattice disperses (heroProgress > 0.35)
  const ambientRamp = Math.max(0, Math.min(1, (heroProgress - 0.35) / 0.55));
  const ambientFieldVisibility = ambientRamp * ambientRamp * (3 - 2 * ambientRamp);

  return {
    pageProgress,
    heroProgress,
    targetCameraZ,
    ambientFieldVisibility,
  };
}

/**
 * Picks the starting quality tier (`high` | `medium` | `low`) from screen width,
 * `navigator.hardwareConcurrency`, and `navigator.deviceMemory` where available.
 * Phones (`viewportWidth < 768`) always start at `medium` or `low`.
 */
export function resolveStartingQualityTier(options: {
  viewportWidth: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}): QualityTierName {
  const isPhone = options.viewportWidth < 768;
  const cores =
    typeof options.hardwareConcurrency === 'number' && options.hardwareConcurrency > 0
      ? options.hardwareConcurrency
      : undefined;
  const memory =
    typeof options.deviceMemory === 'number' && options.deviceMemory > 0
      ? options.deviceMemory
      : undefined;

  const veryLowHardware =
    (cores !== undefined && cores <= 2) || (memory !== undefined && memory <= 2);
  const modestHardware =
    (cores !== undefined && cores <= 4) || (memory !== undefined && memory <= 4);

  if (isPhone) {
    if (veryLowHardware || (cores !== undefined && cores <= 4 && memory !== undefined && memory < 4)) {
      return 'low';
    }
    return 'medium';
  }

  if (veryLowHardware) {
    return 'low';
  }
  if (modestHardware) {
    return 'medium';
  }
  return 'high';
}

/**
 * Drops the quality tier by one step (`high -> medium -> low`).
 * Never upgrades during a session.
 */
export function downgradeQualityTier(current: QualityTierName): QualityTierName {
  if (current === 'high') return 'medium';
  if (current === 'medium') return 'low';
  return 'low';
}

/**
 * Builds the concrete rendering profile for a given `QualityTierName` and viewport.
 * Caps pixelRatio to <= 2 on desktop and <= 1.5 on mobile, and never higher than the tier's cap.
 */
export function resolveQualityTierProfile(options: {
  tier: QualityTierName;
  viewportWidth: number;
  devicePixelRatio: number;
}): QualityTierProfile {
  const isMobile = options.viewportWidth < 768;
  const tierConfig = SITE_CONFIG.qualityTiers.tiers[options.tier];

  const rawDpr =
    Number.isFinite(options.devicePixelRatio) && options.devicePixelRatio > 0
      ? options.devicePixelRatio
      : 1;

  const deviceMaxDpr = isMobile
    ? SITE_CONFIG.qualityTiers.mobileMaxPixelRatio
    : SITE_CONFIG.qualityTiers.desktopMaxPixelRatio;

  const pixelRatio = Math.min(rawDpr, deviceMaxDpr, tierConfig.pixelRatioCap);

  return {
    tier: options.tier,
    isMobile,
    particleCount: tierConfig.particleCount,
    ambientParticleCount: tierConfig.ambientParticleCount,
    pixelRatio,
    idleMotion: tierConfig.idleMotion,
    ambientField: tierConfig.ambientField,
  };
}

/**
 * Determines the appropriate particle counts and capped pixel ratio for the current device.
 */
export function resolveDeviceProfile(options: {
  viewportWidth: number;
  devicePixelRatio: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  isSoftwareRenderer?: boolean;
}): DeviceProfile {
  const isMobile = options.viewportWidth < 768;
  const lowCores =
    typeof options.hardwareConcurrency === 'number' && options.hardwareConcurrency <= 4;
  const isLowEnd = Boolean(options.isSoftwareRenderer) || lowCores;

  let particleCount: number = SITE_CONFIG.particles.desktopCount;
  let ambientParticleCount: number = SITE_CONFIG.particles.ambientDesktopCount;
  if (isLowEnd) {
    particleCount = SITE_CONFIG.particles.lowEndCount;
    ambientParticleCount = SITE_CONFIG.particles.ambientLowEndCount;
  } else if (isMobile) {
    particleCount = SITE_CONFIG.particles.mobileCount;
    ambientParticleCount = SITE_CONFIG.particles.ambientMobileCount;
  }

  const rawDpr = Number.isFinite(options.devicePixelRatio) && options.devicePixelRatio > 0
    ? options.devicePixelRatio
    : 1;
  const pixelRatio = options.isSoftwareRenderer
    ? 1
    : Math.min(rawDpr, SITE_CONFIG.particles.maxPixelRatio);

  return {
    isMobile,
    isLowEnd,
    particleCount,
    ambientParticleCount,
    pixelRatio,
  };
}

/**
 * Deterministic pseudo-random generator (mulberry32) so the Δ node network
 * is reproducible and unit-testable without jumps across re-renders.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hex colour to normalized [r, g, b] tuple.
 */
export function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [r, g, b];
}

/**
 * Generates the sparse, low-opacity ambient particle field distributed along the
 * camera's forward depth corridor for Sections 2–6 (Background through Connect).
 * Particles are biased toward the right half and outer periphery of the corridor
 * so they provide subtle depth parallax without competing with left-aligned text.
 */
export function generateAmbientDepthField(
  count: number,
  seed = 707,
): AmbientFieldData {
  const rand = createSeededRandom(seed);
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const mutedRgb = hexToRgbNormalized(SITE_CONFIG.colors.textMuted);
  const cyanRgb = hexToRgbNormalized(SITE_CONFIG.colors.accent);

  const startZ = SITE_CONFIG.scroll.cameraStartZ - 3.5;
  const totalDepthSpan = SITE_CONFIG.scroll.cameraTravelDepth + 9.0;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // Bias X gently toward the right / periphery so the left text column stays extra calm
    const rawX = (rand() - 0.38) * 10.5;
    const rawY = (rand() - 0.5) * 6.8;
    const z = startZ - rand() * totalDepthSpan;

    positions[i3] = rawX;
    positions[i3 + 1] = rawY;
    positions[i3 + 2] = z;

    phases[i] = rand() * Math.PI * 2;

    const useCyan = rand() < 0.16;
    const rgb = useCyan ? cyanRgb : mutedRgb;
    colors[i3] = rgb[0];
    colors[i3 + 1] = rgb[1];
    colors[i3 + 2] = rgb[2];
  }

  return { positions, phases, colors };
}

/**
 * Generates the 3D Δ (Delta) node network and deterministic dispersion vectors.
 */
export function generateDeltaNetwork(count: number, seed = 42): DeltaNetworkData {
  const rand = createSeededRandom(seed);
  const R = SITE_CONFIG.particles.deltaRadius;
  const thickness = SITE_CONFIG.particles.deltaThickness;

  // Equilateral Δ vertices in local structure space (centered near origin)
  const vTop = { x: 0, y: R * 0.96 };
  const vLeft = { x: -R * 0.866, y: -R * 0.54 };
  const vRight = { x: R * 0.866, y: -R * 0.54 };
  const vertices = [vTop, vLeft, vRight];

  const basePositions = new Float32Array(count * 3);
  const driftVectors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const nodeColors = new Float32Array(count * 3);

  const ivoryRgb = hexToRgbNormalized(SITE_CONFIG.colors.text);
  const cyanRgb = hexToRgbNormalized(SITE_CONFIG.colors.accent);

  const perimeterCount = Math.max(9, Math.floor(count * 0.75));
  const nodesPerEdge = Math.floor(perimeterCount / 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    let x = 0;
    let y = 0;
    let z = 0;

    if (i < nodesPerEdge * 3) {
      const edgeIdx = Math.floor(i / nodesPerEdge);
      const stepIdx = i % nodesPerEdge;
      const a = vertices[edgeIdx];
      const b = vertices[(edgeIdx + 1) % 3];
      const baseT = stepIdx / nodesPerEdge;
      const jitterT = stepIdx === 0 ? 0 : (rand() - 0.5) * (0.65 / nodesPerEdge);
      const t = Math.max(0, Math.min(1, baseT + jitterT));

      const inwardRing = stepIdx % 2 === 0 ? 0.0 : 0.075 + rand() * 0.05;
      const edgeX = a.x + (b.x - a.x) * t;
      const edgeY = a.y + (b.y - a.y) * t;

      x = edgeX * (1 - inwardRing) + (rand() - 0.5) * 0.06;
      y = edgeY * (1 - inwardRing) + (rand() - 0.5) * 0.06;
      z = stepIdx === 0 ? 0 : (rand() - 0.5) * thickness;
    } else {
      let u = rand();
      let v = rand();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const w = 1 - u - v;
      x = (u * vTop.x + v * vLeft.x + w * vRight.x) * 0.82;
      y = (u * vTop.y + v * vLeft.y + w * vRight.y) * 0.82;
      z = (rand() - 0.5) * (thickness * 1.3);
    }

    basePositions[i3] = x;
    basePositions[i3 + 1] = y;
    basePositions[i3 + 2] = z;

    const radialLen = Math.hypot(x, y) || 1;
    const dirX = x / radialLen;
    const dirY = y / radialLen;
    const spread = SITE_CONFIG.scroll.radialSpreadFactor * (0.65 + rand() * 0.95);

    driftVectors[i3] = dirX * spread + (rand() - 0.5) * 2.2;
    driftVectors[i3 + 1] = dirY * spread + (rand() - 0.5) * 1.8;
    driftVectors[i3 + 2] = -SITE_CONFIG.scroll.streamDepthDistance * (0.45 + rand() * 0.85);

    phases[i] = rand() * Math.PI * 2;

    const isCorner = i < nodesPerEdge * 3 && i % nodesPerEdge === 0;
    const isCyanAccent = isCorner || rand() < 0.15;
    const rgb = isCyanAccent ? cyanRgb : ivoryRgb;
    nodeColors[i3] = rgb[0];
    nodeColors[i3 + 1] = rgb[1];
    nodeColors[i3 + 2] = rgb[2];
  }

  const maxDistSq =
    SITE_CONFIG.particles.maxConnectionDistance *
    SITE_CONFIG.particles.maxConnectionDistance;
  const maxPerNode = SITE_CONFIG.particles.maxConnectionsPerNode;
  const connectionCounts = new Uint8Array(count);
  const edges: number[] = [];
  const edgeSet = new Set<number>();

  const addEdge = (a: number, b: number) => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const key = min * count + max;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push(min, max);
    connectionCounts[min]++;
    connectionCounts[max]++;
  };

  const totalPerimeter = nodesPerEdge * 3;
  for (let i = 0; i < totalPerimeter; i++) {
    const nextOnPerimeter = (i + 1) % totalPerimeter;
    addEdge(i, nextOnPerimeter);
    if (totalPerimeter >= 12) {
      const skipOne = (i + 2) % totalPerimeter;
      addEdge(i, skipOne);
    }
  }

  for (let i = 0; i < count; i++) {
    if (connectionCounts[i] >= maxPerNode) continue;
    const ix = basePositions[i * 3];
    const iy = basePositions[i * 3 + 1];
    const iz = basePositions[i * 3 + 2];

    for (let j = i + 1; j < count; j++) {
      if (connectionCounts[j] >= maxPerNode) continue;
      const dx = ix - basePositions[j * 3];
      const dy = iy - basePositions[j * 3 + 1];
      const dz = iz - basePositions[j * 3 + 2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq <= maxDistSq) {
        addEdge(i, j);
        if (connectionCounts[i] >= maxPerNode) break;
      }
    }
  }

  return {
    basePositions,
    driftVectors,
    phases,
    nodeColors,
    edgeIndices: new Uint16Array(edges),
  };
}

export interface PacketEdgeLoop {
  /** Staggered start offset in [0, 1) so pulses do not move in lockstep */
  staggerOffset: number;
  /** Sequence of node index pairs [from0, to0, from1, to1, ...] forming a continuous edge-to-edge walk */
  hopNodePairs: Uint16Array;
}

/**
 * Builds continuous edge-to-edge walks across the existing Δ lattice edges for
 * the 4–6 travelling cyan packets.
 */
export function buildPacketEdgeLoops(
  edgeIndices: Uint16Array,
  nodeCount: number,
  packetCount: number = SITE_CONFIG.idle.packetCount,
  hopsPerLoop: number = SITE_CONFIG.idle.packetPathHops,
  seed = 1337,
): PacketEdgeLoop[] {
  const rand = createSeededRandom(seed);

  const adjacency: number[][] = Array.from({ length: nodeCount }, () => []);
  for (let i = 0; i < edgeIndices.length; i += 2) {
    const a = edgeIndices[i];
    const b = edgeIndices[i + 1];
    if (a < nodeCount && b < nodeCount) {
      adjacency[a].push(b);
      adjacency[b].push(a);
    }
  }

  const connectedNodes = adjacency
    .map((neighbors, idx) => (neighbors.length > 0 ? idx : -1))
    .filter((idx) => idx >= 0);

  const loops: PacketEdgeLoop[] = [];
  if (connectedNodes.length === 0) return loops;

  for (let p = 0; p < packetCount; p++) {
    const hopNodePairs = new Uint16Array(hopsPerLoop * 2);
    const startCandidateIdx =
      Math.floor((p / Math.max(1, packetCount)) * connectedNodes.length) %
      connectedNodes.length;
    let current = connectedNodes[startCandidateIdx];
    let previous = -1;

    for (let h = 0; h < hopsPerLoop; h++) {
      const neighbors = adjacency[current];
      let next = current;
      if (neighbors && neighbors.length > 0) {
        const forwardNeighbors =
          neighbors.length > 1
            ? neighbors.filter((n) => n !== previous)
            : neighbors;
        const pickIdx = Math.floor(rand() * forwardNeighbors.length);
        next = forwardNeighbors[pickIdx];
      }

      hopNodePairs[h * 2] = current;
      hopNodePairs[h * 2 + 1] = next;
      previous = current;
      current = next;
    }

    const staggerOffset =
      (p / Math.max(1, packetCount) + rand() * (0.35 / Math.max(1, packetCount))) % 1;

    loops.push({
      staggerOffset,
      hopNodePairs,
    });
  }

  return loops;
}

/**
 * Computes the idle motion attenuation factor in [0, 1] as a function of hero scroll progress
 * and prefers-reduced-motion.
 */
export function computeIdleMotionScale(
  scrollProgress: number,
  reducedMotion = false,
): number {
  if (reducedMotion) return 0;
  const p = Math.max(0, Math.min(1, scrollProgress));
  const smoothP = p * p * (3 - 2 * p);
  return Math.pow(1 - smoothP, 1.6);
}

/**
 * CPU reference mirror of the GPU vertex shader's idle + scroll blend equation.
 */
export function updateParticlesForScroll(
  network: DeltaNetworkData,
  outPositions: Float32Array,
  scrollProgress: number,
  elapsedTimeSec = 0,
  reducedMotion = false,
): { lineOpacityScale: number; idleMotionScale: number } {
  const p = Math.max(0, Math.min(1, scrollProgress));
  const smoothP = p * p * (3 - 2 * p);
  const depthP = Math.pow(p, 1.25);
  const idleScale = computeIdleMotionScale(p, reducedMotion);

  const omega = (Math.PI * 2) / SITE_CONFIG.idle.rotationPeriodSec;
  const angleY = Math.sin(elapsedTimeSec * omega) * SITE_CONFIG.idle.rotationAmplitudeY * idleScale;
  const angleX = Math.cos(elapsedTimeSec * omega) * SITE_CONFIG.idle.tiltAmplitudeX * idleScale;
  const angleZ = Math.sin(elapsedTimeSec * omega * 0.5) * SITE_CONFIG.idle.tiltAmplitudeZ * idleScale;

  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);
  const cosZ = Math.cos(angleZ);
  const sinZ = Math.sin(angleZ);

  const { basePositions, driftVectors, phases } = network;
  const count = phases.length;
  const breathAmp = SITE_CONFIG.idle.nodeBreathingAmplitude * idleScale;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const phase = phases[i];

    let lx = basePositions[i3] + Math.sin(elapsedTimeSec * 1.3 + phase) * breathAmp;
    let ly = basePositions[i3 + 1] + Math.cos(elapsedTimeSec * 1.1 + phase * 1.3) * breathAmp;
    let lz = basePositions[i3 + 2] + Math.sin(elapsedTimeSec * 0.9 + phase * 0.7) * (breathAmp * 0.6);

    const ryX = lx * cosY + lz * sinY;
    const ryY = ly;
    const ryZ = -lx * sinY + lz * cosY;

    const rxX = ryX;
    const rxY = ryY * cosX - ryZ * sinX;
    const rxZ = ryY * sinX + ryZ * cosX;

    const idleX = rxX * cosZ - rxY * sinZ;
    const idleY = rxX * sinZ + rxY * cosZ;
    const idleZ = rxZ;

    const waveFactor = reducedMotion ? 0 : smoothP * 0.28;
    const swirlX = Math.sin(phase + elapsedTimeSec * 0.6 + p * 3.2) * waveFactor;
    const swirlY = Math.cos(phase * 1.3 + elapsedTimeSec * 0.5 + p * 2.8) * waveFactor;

    outPositions[i3] = idleX + driftVectors[i3] * smoothP + swirlX;
    outPositions[i3 + 1] = idleY + driftVectors[i3 + 1] * smoothP + swirlY;
    outPositions[i3 + 2] = idleZ + driftVectors[i3 + 2] * depthP;
  }

  const lineOpacityScale = Math.pow(1 - smoothP, 2.2);

  return { lineOpacityScale, idleMotionScale: idleScale };
}
