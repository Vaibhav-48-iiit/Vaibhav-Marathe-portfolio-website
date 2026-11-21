import {
  SITE_CONFIG,
  type MorphStateName,
  type QualityTierName,
  type SectionId,
} from './config';

export type { MorphStateName };

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

// Module-level session state so re-renders can never reset intro completion
let sessionIntroFinished = false;
let sessionIntroMountCount = 0;

/**
 * Returns true if the terminal intro has already finished (or been skipped) in this session.
 */
export function isIntroFinishedInSession(): boolean {
  return sessionIntroFinished;
}

/**
 * Marks the terminal intro as finished in this session and records the visit in localStorage.
 * Idempotent: returns true only on the first call that transitions from false -> true.
 */
export function markIntroFinishedInSession(
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): boolean {
  if (sessionIntroFinished) return false;
  sessionIntroFinished = true;
  markVisited(storage);
  return true;
}

/**
 * Increments and returns the number of times `<TerminalIntro />` has mounted in this session.
 * Used by the `?debug=1` diagnostics overlay.
 */
export function incrementIntroMountCount(): number {
  sessionIntroMountCount += 1;
  return sessionIntroMountCount;
}

/**
 * Returns the current number of times `<TerminalIntro />` has mounted in this session.
 */
export function getIntroMountCount(): number {
  return sessionIntroMountCount;
}

/**
 * Resets the module-level intro session flags (for unit tests only).
 */
export function resetIntroSessionStateForTests(): void {
  sessionIntroFinished = false;
  sessionIntroMountCount = 0;
}

/**
 * Determines whether the terminal intro should be skipped immediately on load:
 * - Already finished in this session
 * - URL has `?intro=0` or `?autostart=1`
 * - Initial route is under `/writeups`
 * - `prefers-reduced-motion` is enabled or `Plain view` / `saveData` is active
 */
export function shouldSkipIntroOnLoad(options: {
  pathname: string;
  search: string;
  prefersReducedMotion: boolean;
  plainView: boolean;
}): boolean {
  if (sessionIntroFinished) return true;
  if (options.pathname.startsWith(SITE_CONFIG.routing.writeupsBasePath)) {
    return true;
  }
  const params = new URLSearchParams(options.search);
  if (params.get('intro') === '0' || params.get('autostart') === '1') {
    return true;
  }
  if (options.prefersReducedMotion || options.plainView) {
    return true;
  }
  return false;
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

/**
 * Determines whether section-arrival animations must be completely disabled
 * (Plain view, prefers-reduced-motion, "low" quality tier, Save-Data mode, or print).
 */
export function shouldDisableSectionReveal(params: {
  plainView: boolean;
  prefersReducedMotion: boolean;
  qualityTier: QualityTierName;
  saveData: boolean;
  isPrint?: boolean;
}): boolean {
  return Boolean(
    params.plainView ||
      params.prefersReducedMotion ||
      params.qualityTier === 'low' ||
      params.saveData ||
      params.isPrint,
  );
}

/**
 * Computes the stagger delay in milliseconds for an ordered element inside a section,
 * capped at `staggerCap` items (indices 0..staggerCap-1) so the entire section
 * completes in about 400 ms.
 */
export function computeRevealStaggerDelayMs(
  itemIndex: number,
  staggerMs: number = SITE_CONFIG.sectionReveal.staggerMs,
  staggerCap: number = SITE_CONFIG.sectionReveal.staggerCap,
): number {
  const safeCap = Math.max(1, Math.floor(staggerCap));
  const clampedIndex = Math.max(0, Math.min(Math.floor(itemIndex), safeCap - 1));
  return clampedIndex * Math.max(0, staggerMs);
}

/**
 * Resolves a URL hash (e.g. "#Connect", "#connect", "#Projects") case-insensitively
 * to one of the portfolio's non-hero SectionIds, or null if none matches.
 */
export function resolveInitialHashSectionId(hash: string): SectionId | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#/, '').trim().toLowerCase();
  if (!cleaned) return null;
  for (const sec of SITE_CONFIG.sections) {
    if (sec.id !== 'home' && sec.id.toLowerCase() === cleaned) {
      return sec.id;
    }
  }
  return null;
}

/**
 * Pure decision function for whether a section should trigger its reveal animation.
 * - Plays at most ONCE (`alreadyRevealed` returns false).
 * - Normal scrolling (`isProgrammaticScroll === false`): reveals immediately as soon as
 *   at least `intersectionThreshold` (5%) intersects, with no velocity check or settle wait.
 * - Programmatic jumps (`isProgrammaticScroll === true`): suppresses sections passed over
 *   in transit; the landing section is revealed immediately when the jump finishes.
 */
export function shouldTriggerSectionArrival(params: {
  sectionId: SectionId;
  alreadyRevealed: boolean;
  isIntersecting: boolean;
  intersectionRatio: number;
  isProgrammaticScroll: boolean;
  inTransitTargetId?: SectionId | null;
  intersectionThreshold?: number;
}): boolean {
  if (params.alreadyRevealed) return false;
  if (!params.isIntersecting) return false;
  if (params.isProgrammaticScroll) return false;
  if (
    params.inTransitTargetId !== undefined &&
    params.inTransitTargetId !== null &&
    params.inTransitTargetId !== params.sectionId
  ) {
    return false;
  }
  const threshold =
    params.intersectionThreshold ?? SITE_CONFIG.sectionReveal.intersectionThreshold;
  return params.intersectionRatio >= threshold;
}

// Preserved arrival thresholds for the repeatable particle morph state machine (unchanged)
export const MORPH_ARRIVAL_INTERSECTION_THRESHOLD = 0.25;
export const MORPH_VELOCITY_THRESHOLD = 1.5;
export const MORPH_SETTLE_DURATION_MS = 120;

/**
 * Determines whether particle morph shapes must be disabled:
 * - Plain view is active
 * - `prefers-reduced-motion` is enabled
 * - Quality tier is `low`
 * - Save-Data mode is enabled
 * - Viewport width is `< 768px` and `MORPH_ON_MOBILE` is `false`
 */
export function shouldDisableMorph(params: {
  plainView: boolean;
  prefersReducedMotion: boolean;
  qualityTier: QualityTierName;
  saveData: boolean;
  viewportWidth: number;
  morphOnMobile?: boolean;
}): boolean {
  const allowMobile = params.morphOnMobile ?? SITE_CONFIG.morph.MORPH_ON_MOBILE;
  if (
    params.plainView ||
    params.prefersReducedMotion ||
    params.qualityTier === 'low' ||
    params.saveData
  ) {
    return true;
  }
  if (params.viewportWidth < 768 && !allowMobile) {
    return true;
  }
  return false;
}

/**
 * Returns the morph subset particle count for the active quality tier
 * (`1200` on `high`, `600` on `medium`, `0` on `low` or when morphs are disabled).
 */
export function resolveMorphParticleCount(
  tier: QualityTierName,
  morphDisabled: boolean,
): number {
  if (morphDisabled || tier === 'low') return 0;
  return SITE_CONFIG.morph.tierParticleCounts[tier] ?? 0;
}

export type SectionVisibilityMap = Record<
  SectionId,
  { isIntersecting: boolean; ratio: number }
>;

/**
 * Creates a clean initial visibility map for all 6 portfolio sections.
 */
export function createInitialSectionVisibilityMap(): SectionVisibilityMap {
  return {
    home: { isIntersecting: true, ratio: 1 },
    background: { isIntersecting: false, ratio: 0 },
    skills: { isIntersecting: false, ratio: 0 },
    projects: { isIntersecting: false, ratio: 0 },
    writeups: { isIntersecting: false, ratio: 0 },
    connect: { isIntersecting: false, ratio: 0 },
  };
}

/**
 * Pure helper that determines which section (if any) is currently the arrived section
 * for the repeatable particle morph state machine, reusing the exact same 25% visibility
 * + settled velocity + in-transit suppression rules as section reveal animations.
 *
 * Unlike one-time text reveals, leaving a section returns `null` (or the newly arrived
 * section) so particles return to `AMBIENT` and replay the morph when re-arriving.
 */
export function resolveDominantArrivedSection(params: {
  inViewMap: SectionVisibilityMap;
  heroProgress: number;
  pageProgress: number;
  inTransitTargetId: SectionId | null;
  isVelocitySettled: boolean;
  currentArrivedSection: SectionId | null;
  intersectionThreshold?: number;
}): SectionId | null {
  const threshold =
    params.intersectionThreshold ?? MORPH_ARRIVAL_INTERSECTION_THRESHOLD;

  // 1. While a programmatic nav jump (lenis.scrollTo) is in transit, suppress intermediate
  //    sections passed along the way so jumping Home -> Connect never flashes TOPOLOGY.
  if (params.inTransitTargetId !== null) {
    if (params.inTransitTargetId === 'home' && params.heroProgress < 0.35) {
      return 'home';
    }
    return null;
  }

  // 2. When near the top of the page (Home), recombine into HERO immediately
  if (
    params.heroProgress < 0.35 &&
    params.inViewMap.home.isIntersecting &&
    params.inViewMap.home.ratio >= threshold
  ) {
    return 'home';
  }

  // 3. Collect all sections currently at least `threshold` (25%) in view
  const qualifying: Array<{ id: SectionId; ratio: number }> = [];
  for (const sec of SITE_CONFIG.sections) {
    const entry = params.inViewMap[sec.id];
    if (entry && entry.isIntersecting && entry.ratio >= threshold) {
      qualifying.push({ id: sec.id, ratio: entry.ratio });
    }
  }

  if (qualifying.length === 0) {
    return null;
  }

  // Find the section with the highest visibility ratio (with bottom-of-page preference for Connect)
  let best = qualifying[0];
  for (let i = 1; i < qualifying.length; i++) {
    const cand = qualifying[i];
    if (cand.id === 'connect' && params.pageProgress >= 0.88 && cand.ratio >= threshold) {
      best = cand;
      break;
    }
    if (cand.ratio > best.ratio + 0.02) {
      best = cand;
    }
  }

  // 4. If a section was already arrived (`currentArrivedSection`), check if it is still in view
  if (params.currentArrivedSection) {
    const prevEntry = params.inViewMap[params.currentArrivedSection];
    const stillInView =
      prevEntry && prevEntry.isIntersecting && prevEntry.ratio >= threshold;
    if (!stillInView) {
      // Left the previously arrived section; if velocity is settled on a new section, arrive there, else null (AMBIENT)
      return params.isVelocitySettled ? best.id : null;
    }
    // If another section now strongly dominates by > 0.22 ratio, we have scrolled out of the previous section
    if (best.id !== params.currentArrivedSection && best.ratio > prevEntry.ratio + 0.22) {
      return params.isVelocitySettled ? best.id : null;
    }
    return params.currentArrivedSection;
  }

  // 5. Entering a new section requires scrolling to have settled
  if (!params.isVelocitySettled) {
    return null;
  }

  return best.id;
}

export interface MorphStateStepResult {
  state: MorphStateName;
  stateEnteredAtMs: number;
  dollarFormationCompleteMs: number;
}

/**
 * Pure state machine transition function for `HERO | AMBIENT | TOPOLOGY | DOLLAR | HASH`.
 * - `HERO`: at the top of the page (`heroProgress < 0.35` and no non-home section arrived).
 * - `TOPOLOGY`: when `arrivedSection === 'skills'` and morphs are enabled.
 * - `DOLLAR` -> `HASH`: when `arrivedSection === 'connect'`, glyphs are available, and morphs are enabled.
 *   `DOLLAR` forms over `formationDurationMs`, holds for `dollarHoldMs` (~700 ms), then transitions to `HASH`
 *   and holds `HASH` as long as `Connect` remains the arrived section.
 * - `AMBIENT`: everywhere else (or when leaving a section, or when morphs are disabled away from Home).
 */
export function stepMorphStateMachine(params: {
  currentState: MorphStateName;
  stateEnteredAtMs: number;
  dollarFormationCompleteMs: number;
  nowMs: number;
  morphDisabled: boolean;
  heroProgress: number;
  arrivedSection: SectionId | null;
  glyphsAvailable: boolean;
  formationDurationMs?: number;
  dollarHoldMs?: number;
}): MorphStateStepResult {
  const formationMs =
    params.formationDurationMs ?? SITE_CONFIG.morph.formationDurationMs;
  const holdMs = params.dollarHoldMs ?? SITE_CONFIG.morph.dollarHoldMs;

  const isAtHero =
    params.heroProgress < 0.35 &&
    (params.arrivedSection === 'home' || params.arrivedSection === null);

  if (isAtHero) {
    if (params.currentState === 'HERO') {
      return {
        state: 'HERO',
        stateEnteredAtMs: params.stateEnteredAtMs,
        dollarFormationCompleteMs: 0,
      };
    }
    return {
      state: 'HERO',
      stateEnteredAtMs: params.nowMs,
      dollarFormationCompleteMs: 0,
    };
  }

  if (params.morphDisabled) {
    if (params.currentState === 'AMBIENT') {
      return {
        state: 'AMBIENT',
        stateEnteredAtMs: params.stateEnteredAtMs,
        dollarFormationCompleteMs: 0,
      };
    }
    return {
      state: 'AMBIENT',
      stateEnteredAtMs: params.nowMs,
      dollarFormationCompleteMs: 0,
    };
  }

  if (params.arrivedSection === 'skills') {
    if (params.currentState === 'TOPOLOGY') {
      return {
        state: 'TOPOLOGY',
        stateEnteredAtMs: params.stateEnteredAtMs,
        dollarFormationCompleteMs: 0,
      };
    }
    return {
      state: 'TOPOLOGY',
      stateEnteredAtMs: params.nowMs,
      dollarFormationCompleteMs: 0,
    };
  }

  if (params.arrivedSection === 'connect' && params.glyphsAvailable) {
    if (params.currentState === 'HASH') {
      return {
        state: 'HASH',
        stateEnteredAtMs: params.stateEnteredAtMs,
        dollarFormationCompleteMs: params.dollarFormationCompleteMs,
      };
    }
    if (params.currentState === 'DOLLAR') {
      const switchToHashAtMs = params.dollarFormationCompleteMs + holdMs;
      if (params.nowMs >= switchToHashAtMs) {
        return {
          state: 'HASH',
          stateEnteredAtMs: params.nowMs,
          dollarFormationCompleteMs: params.dollarFormationCompleteMs,
        };
      }
      return {
        state: 'DOLLAR',
        stateEnteredAtMs: params.stateEnteredAtMs,
        dollarFormationCompleteMs: params.dollarFormationCompleteMs,
      };
    }
    // Just arrived at Connect: enter DOLLAR
    return {
      state: 'DOLLAR',
      stateEnteredAtMs: params.nowMs,
      dollarFormationCompleteMs: params.nowMs + formationMs,
    };
  }

  if (params.currentState === 'AMBIENT') {
    return {
      state: 'AMBIENT',
      stateEnteredAtMs: params.stateEnteredAtMs,
      dollarFormationCompleteMs: 0,
    };
  }
  return {
    state: 'AMBIENT',
    stateEnteredAtMs: params.nowMs,
    dollarFormationCompleteMs: 0,
  };
}

export interface TopologyTargetData {
  /** Normalized positions in [-0.5, +0.5] for each morph particle (length = count * 3) */
  normalizedPositions: Float32Array;
  /** Which topology node index (0..14) each particle belongs to (length = count) */
  nodeAssignments: Uint8Array;
  /** Number of particles assigned to each topology node (length = nodeCount) */
  nodeParticleCounts: Uint16Array;
  /** Bounding box in normalized shape space [-0.5, +0.5] */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Generates deterministic hub-and-spoke network topology cluster targets from
 * the hand-authored node coordinates in `SITE_CONFIG.morph.topology`.
 */
export function generateTopologyTargets(
  count: number,
  seed = 303,
): TopologyTargetData {
  const rand = createSeededRandom(seed);
  const nodes = SITE_CONFIG.morph.topology.nodes;
  const nodeCount = nodes.length;

  const normalizedPositions = new Float32Array(count * 3);
  const nodeAssignments = new Uint8Array(count);
  const nodeParticleCounts = new Uint16Array(nodeCount);

  // Weight distribution: gateway gets ~14%, each subhub gets ~9%, each leaf gets ~5.3%
  const weights: number[] = nodes.map((n) =>
    n.role === 'gateway' ? 2.6 : n.role === 'subhub' ? 1.7 : 1.0,
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const cumulative: number[] = [];
  let acc = 0;
  for (let i = 0; i < nodeCount; i++) {
    acc += weights[i] / totalWeight;
    cumulative.push(acc);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < count; i++) {
    // First `nodeCount` particles sit exactly at the node centers so every cluster is anchored
    let nodeIdx = i < nodeCount ? i : nodeCount - 1;
    if (i >= nodeCount) {
      const u = (i - nodeCount + 0.5) / Math.max(1, count - nodeCount);
      for (let n = 0; n < nodeCount; n++) {
        if (u <= cumulative[n]) {
          nodeIdx = n;
          break;
        }
      }
    }

    const host = nodes[nodeIdx];
    nodeAssignments[i] = nodeIdx;
    nodeParticleCounts[nodeIdx] += 1;

    // Tight dense cluster around the host node
    const r = i < nodeCount ? 0 : Math.pow(rand(), 0.65) * host.radius;
    const theta = rand() * Math.PI * 2;
    const zJitter = (rand() - 0.5) * host.radius * 0.7;

    const px = host.x + Math.cos(theta) * r;
    const py = host.y + Math.sin(theta) * r;
    const pz = host.z + zJitter;

    const i3 = i * 3;
    normalizedPositions[i3] = px;
    normalizedPositions[i3 + 1] = py;
    normalizedPositions[i3 + 2] = pz;

    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  if (!Number.isFinite(minX)) {
    minX = -0.45;
    maxX = 0.45;
    minY = -0.45;
    maxY = 0.45;
  }

  return {
    normalizedPositions,
    nodeAssignments,
    nodeParticleCounts,
    bounds: { minX, maxX, minY, maxY },
  };
}

/**
 * Computes the per-node cyan highlight factor in [0, 1] for each topology node on arrival.
 * The 3 chosen leaf nodes light up cyan (`#4FD1D9`) one after another `intervalMs` (~400 ms)
 * apart like open ports found by a scan, while all other nodes stay 0 (dim off-white).
 */
export function computeTopologyNodePortScanIntensities(
  nodeCount: number,
  elapsedInTopologyMs: number,
  litLeafIndices: readonly number[],
  intervalMs: number = SITE_CONFIG.morph.topologyPortScanIntervalMs,
): Float32Array {
  const intensities = new Float32Array(nodeCount);
  const rampDurationMs = 240;

  for (let s = 0; s < litLeafIndices.length; s++) {
    const nodeIdx = litLeafIndices[s];
    if (nodeIdx < 0 || nodeIdx >= nodeCount) continue;
    // Port 0 lights at 1 * intervalMs (400ms), Port 1 at 800ms, Port 2 at 1200ms
    const startMs = (s + 1) * intervalMs;
    if (elapsedInTopologyMs <= startMs) {
      intensities[nodeIdx] = 0;
    } else {
      const raw = (elapsedInTopologyMs - startMs) / rampDurationMs;
      const clamped = Math.max(0, Math.min(1, raw));
      intensities[nodeIdx] = clamped * clamped * (3 - 2 * clamped);
    }
  }

  return intensities;
}

/**
 * Computes the smooth colour and target interpolation factor in [0, 1] when morphing
 * from `DOLLAR` ("$", cyan) to `HASH` ("#", amber) over `hashMorphDurationMs` (~1,000 ms).
 */
export function computeHashMorphProgress(
  elapsedInHashMs: number,
  durationMs: number = SITE_CONFIG.morph.hashMorphDurationMs,
): number {
  const safeDuration = Math.max(1, durationMs);
  const t = Math.max(0, Math.min(1, elapsedInHashMs / safeDuration));
  // Cubic ease-out
  return 1 - Math.pow(1 - t, 3);
}

export interface GlyphPairTargetData {
  /** Normalized positions in [-0.5, +0.5] for "$" (length = count * 3) */
  dollarPositions: Float32Array;
  /** Normalized positions in [-0.5, +0.5] for "#" ordered 1-to-1 by nearest neighbour to dollarPositions (length = count * 3) */
  hashPositions: Float32Array;
  /** Normalized bounding box covering both glyphs */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Given binary/alpha pixel buffers (`Uint8ClampedArray` RGBA of size `width * height * 4`)
 * for two glyphs ("$" and "#"), samples `count` filled pixels on a jittered grid for each
 * glyph (normalizing height to `[-0.5, +0.5]`) and orders the "#" points by nearest-neighbour
 * matching (plus 2-opt untangling passes) so "$" maps 1-to-1 onto "#" without tangling.
 *
 * Returns `null` if either buffer has too few filled pixels.
 */
export function sampleAndMatchGlyphPairFromRgba(options: {
  dollarRgba: Uint8ClampedArray | Uint8Array;
  hashRgba: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  count: number;
  seed?: number;
}): GlyphPairTargetData | null {
  const { dollarRgba, hashRgba, width, height, count } = options;
  if (count <= 0 || width <= 0 || height <= 0) return null;

  const rand = createSeededRandom(options.seed ?? 909);

  const extractNormalizedPoints = (
    rgba: Uint8ClampedArray | Uint8Array,
  ): Float32Array | null => {
    const filledX: number[] = [];
    const filledY: number[] = [];
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        const alpha = rgba[rowOffset + x * 4 + 3];
        if (alpha > 110) {
          filledX.push(x);
          filledY.push(y);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const totalFilled = filledX.length;
    if (totalFilled < 20) return null;

    const spanY = Math.max(8, maxY - minY);
    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;

    // Sample on a jittered grid across the filled ink pixels
    const gridStep = Math.max(1, Math.floor(Math.sqrt(totalFilled / count)));
    const candidates: Array<{ x: number; y: number }> = [];

    for (let y = minY; y <= maxY; y += gridStep) {
      for (let x = minX; x <= maxX; x += gridStep) {
        const jx = Math.min(
          width - 1,
          Math.max(0, Math.round(x + (rand() - 0.5) * gridStep)),
        );
        const jy = Math.min(
          height - 1,
          Math.max(0, Math.round(y + (rand() - 0.5) * gridStep)),
        );
        if (rgba[(jy * width + jx) * 4 + 3] > 110) {
          const nx = (jx - centerX + (rand() - 0.5) * 0.85) / spanY;
          const ny = (centerY - jy + (rand() - 0.5) * 0.85) / spanY;
          candidates.push({ x: nx, y: ny });
        }
      }
    }

    const out = new Float32Array(count * 3);
    if (candidates.length >= count) {
      // Pick `count` evenly spaced points across the jittered grid candidates
      for (let i = 0; i < count; i++) {
        const idx = Math.min(
          candidates.length - 1,
          Math.floor(((i + 0.5) * candidates.length) / count),
        );
        const pt = candidates[idx];
        out[i * 3] = pt.x;
        out[i * 3 + 1] = pt.y;
        out[i * 3 + 2] = (rand() - 0.5) * 0.018;
      }
    } else {
      // Copy all grid candidates first, then fill remainder from filled pixels with sub-pixel jitter
      let cursor = 0;
      for (; cursor < candidates.length && cursor < count; cursor++) {
        out[cursor * 3] = candidates[cursor].x;
        out[cursor * 3 + 1] = candidates[cursor].y;
        out[cursor * 3 + 2] = (rand() - 0.5) * 0.018;
      }
      for (; cursor < count; cursor++) {
        const pick = Math.floor(rand() * totalFilled);
        const nx = (filledX[pick] - centerX + (rand() - 0.5) * 0.95) / spanY;
        const ny = (centerY - filledY[pick] + (rand() - 0.5) * 0.95) / spanY;
        out[cursor * 3] = nx;
        out[cursor * 3 + 1] = ny;
        out[cursor * 3 + 2] = (rand() - 0.5) * 0.018;
      }
    }

    return out;
  };

  const dollarPts = extractNormalizedPoints(dollarRgba);
  const rawHashPts = extractNormalizedPoints(hashRgba);
  if (!dollarPts || !rawHashPts) return null;

  // Order dollarPts from outer periphery inward so outer contour points claim nearest neighbours first
  const dollarOrder = Array.from({ length: count }, (_, i) => i);
  dollarOrder.sort((a, b) => {
    const ra =
      dollarPts[a * 3] * dollarPts[a * 3] +
      dollarPts[a * 3 + 1] * dollarPts[a * 3 + 1];
    const rb =
      dollarPts[b * 3] * dollarPts[b * 3] +
      dollarPts[b * 3 + 1] * dollarPts[b * 3 + 1];
    return rb - ra;
  });

  // 1-to-1 greedy nearest-neighbour assignment from dollarPts to rawHashPts
  const usedHash = new Uint8Array(count);
  const matchedHashIdx = new Int32Array(count);

  for (let k = 0; k < count; k++) {
    const dIdx = dollarOrder[k];
    const dx = dollarPts[dIdx * 3];
    const dy = dollarPts[dIdx * 3 + 1];

    let bestH = -1;
    let bestDistSq = Infinity;
    for (let h = 0; h < count; h++) {
      if (usedHash[h]) continue;
      const hx = rawHashPts[h * 3] - dx;
      const hy = rawHashPts[h * 3 + 1] - dy;
      const dSq = hx * hx + hy * hy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestH = h;
      }
    }
    if (bestH < 0) bestH = 0;
    usedHash[bestH] = 1;
    matchedHashIdx[dIdx] = bestH;
  }

  // Local 2-opt swap pass to untangle any crossing trajectories
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < count; i++) {
      const j = (i * 73 + 19) % count;
      if (i === j) continue;
      const hi = matchedHashIdx[i];
      const hj = matchedHashIdx[j];

      const dix = dollarPts[i * 3];
      const diy = dollarPts[i * 3 + 1];
      const djx = dollarPts[j * 3];
      const djy = dollarPts[j * 3 + 1];

      const hix = rawHashPts[hi * 3];
      const hiy = rawHashPts[hi * 3 + 1];
      const hjx = rawHashPts[hj * 3];
      const hjy = rawHashPts[hj * 3 + 1];

      const curCost =
        (dix - hix) * (dix - hix) +
        (diy - hiy) * (diy - hiy) +
        (djx - hjx) * (djx - hjx) +
        (djy - hjy) * (djy - hjy);
      const swapCost =
        (dix - hjx) * (dix - hjx) +
        (diy - hjy) * (diy - hjy) +
        (djx - hix) * (djx - hix) +
        (djy - hiy) * (djy - hiy);

      if (swapCost < curCost) {
        matchedHashIdx[i] = hj;
        matchedHashIdx[j] = hi;
      }
    }
  }

  const hashPositions = new Float32Array(count * 3);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < count; i++) {
    const hIdx = matchedHashIdx[i];
    const i3 = i * 3;
    const h3 = hIdx * 3;
    hashPositions[i3] = rawHashPts[h3];
    hashPositions[i3 + 1] = rawHashPts[h3 + 1];
    hashPositions[i3 + 2] = rawHashPts[h3 + 2];

    const dx = dollarPts[i3];
    const dy = dollarPts[i3 + 1];
    const hx = hashPositions[i3];
    const hy = hashPositions[i3 + 1];

    if (dx < minX) minX = dx;
    if (dx > maxX) maxX = dx;
    if (dy < minY) minY = dy;
    if (dy > maxY) maxY = dy;
    if (hx < minX) minX = hx;
    if (hx > maxX) maxX = hx;
    if (hy < minY) minY = hy;
    if (hy > maxY) maxY = hy;
  }

  return {
    dollarPositions: dollarPts,
    hashPositions,
    bounds: { minX, maxX, minY, maxY },
  };
}

/**
 * Rasterises the "$" and "#" glyphs to an offscreen `<canvas>` after `document.fonts.ready`
 * using the loaded `JetBrains Mono` bold font, and produces 1-to-1 nearest-neighbour
 * matched particle targets. Returns `null` if canvas rasterising fails so the Connect
 * morph can be skipped silently.
 */
export async function rasterizePairGlyphTargets(
  count: number,
  seed = 909,
): Promise<GlyphPairTargetData | null> {
  if (count <= 0 || typeof document === 'undefined') return null;

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch {
    // Continue even if document.fonts rejects
  }

  try {
    const size = SITE_CONFIG.morph.glyph.canvasSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const renderGlyphRgba = (char: string): Uint8ClampedArray | null => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${SITE_CONFIG.morph.glyph.fontWeight} ${Math.round(size * 0.78)}px "${SITE_CONFIG.morph.glyph.fontFamily}", monospace`;
      ctx.fillText(char, size * 0.5, size * 0.52);
      const img = ctx.getImageData(0, 0, size, size);
      return img.data;
    };

    const dollarRgba = renderGlyphRgba(SITE_CONFIG.morph.glyph.dollarChar);
    const hashRgba = renderGlyphRgba(SITE_CONFIG.morph.glyph.hashChar);
    if (!dollarRgba || !hashRgba) return null;

    return sampleAndMatchGlyphPairFromRgba({
      dollarRgba,
      hashRgba,
      width: size,
      height: size,
      count,
      seed,
    });
  } catch {
    return null;
  }
}

/**
 * Steps a `Float32Array` of 3D particle positions and velocities toward `targetPos`
 * using an exact analytical critically damped spring:
 *   x(t + dt) = target + (d0 + (v0 + omega * d0) * dt) * exp(-omega * dt)
 *   v(t + dt) = (v0 - (v0 + omega * d0) * omega * dt) * exp(-omega * dt)
 *
 * Unconditionally stable for any `dt`, never overshoots or snaps on mid-flight retargeting,
 * and updates 1,200 particles (3,600 floats) in ~0.03 ms per frame.
 * Returns the maximum squared displacement from target across all particles.
 */
export function stepCriticallyDampedSpringBuffer(
  curPos: Float32Array,
  vel: Float32Array,
  targetPos: Float32Array,
  dtSec: number,
  omega: number = SITE_CONFIG.morph.springOmega,
): number {
  const len = Math.min(curPos.length, vel.length, targetPos.length);
  const safeDt = Math.max(0.0005, Math.min(0.1, dtSec));
  const w = Math.max(0.1, omega);
  const expTerm = Math.exp(-w * safeDt);
  let maxDistSq = 0;

  for (let i = 0; i < len; i++) {
    const target = targetPos[i];
    const d0 = curPos[i] - target;
    const v0 = vel[i];
    const temp = v0 + w * d0;
    const d1 = (d0 + temp * safeDt) * expTerm;
    const v1 = (v0 - temp * w * safeDt) * expTerm;

    curPos[i] = target + d1;
    vel[i] = v1;

    const dSq = d1 * d1;
    if (dSq > maxDistSq) {
      maxDistSq = dSq;
    }
  }

  return maxDistSq;
}

export interface ScreenBoxRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Returns true if two screen-space bounding boxes overlap.
 */
export function doScreenBoxesOverlap(a: ScreenBoxRect, b: ScreenBoxRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Computes the screen-space bounding box of a morph shape from its normalized bounds
 * and per-shape config (`anchorX`, `anchorY`, `scale`).
 */
export function computeShapeScreenBoundingBox(options: {
  anchorX: number;
  anchorY: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}): ScreenBoxRect {
  const centerX = options.anchorX * options.viewportWidth;
  const centerY = options.anchorY * options.viewportHeight;
  const spanPx = options.scale * options.viewportHeight;

  return {
    left: centerX + options.bounds.minX * spanPx,
    right: centerX + options.bounds.maxX * spanPx,
    // In normalized shape space +Y is up, while in screen space +Y is down
    top: centerY - options.bounds.maxY * spanPx,
    bottom: centerY - options.bounds.minY * spanPx,
  };
}

/**
 * Runtime readability helper: if a morph shape's screen-space bounding box overlaps
 * any text block bounding box in the active section on desktop, caps its opacity to
 * `overlapCap` (`<= 0.18`).
 */
export function computeShapeEffectiveMaxOpacity(options: {
  shapeBox: ScreenBoxRect;
  textRects: readonly ScreenBoxRect[];
  configMaxOpacity: number;
  overlapCap?: number;
}): { effectiveMaxOpacity: number; overlapsText: boolean } {
  const cap = options.overlapCap ?? SITE_CONFIG.morph.overlapMaxOpacityCap;
  for (let i = 0; i < options.textRects.length; i++) {
    const r = options.textRects[i];
    if (r.right - r.left <= 0 || r.bottom - r.top <= 0) continue;
    if (doScreenBoxesOverlap(options.shapeBox, r)) {
      return {
        effectiveMaxOpacity: Math.min(options.configMaxOpacity, cap),
        overlapsText: true,
      };
    }
  }
  return {
    effectiveMaxOpacity: options.configMaxOpacity,
    overlapsText: false,
  };
}

/**
 * Picks up to `litLeafCount` (3) leaf node indices for the topology port-scan animation,
 * keeping lit nodes off text rows by filtering out any leaf node whose screen-space disc
 * overlaps a text row bounding box in the Skills section.
 */
export function selectNonOverlappingLitLeafNodes(options: {
  anchorX: number;
  anchorY: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  textRowRects: readonly ScreenBoxRect[];
  litLeafCount?: number;
}): number[] {
  const countWanted = options.litLeafCount ?? SITE_CONFIG.morph.topology.litLeafCount;
  const nodes = SITE_CONFIG.morph.topology.nodes;
  const preferred = SITE_CONFIG.morph.topology.preferredLitLeafNodeIndices;

  const centerX = options.anchorX * options.viewportWidth;
  const centerY = options.anchorY * options.viewportHeight;
  const spanPx = options.scale * options.viewportHeight;

  const isNodeClearOfTextRows = (nodeIdx: number): boolean => {
    const node = nodes[nodeIdx];
    if (!node || node.role !== 'leaf') return false;
    const nx = centerX + node.x * spanPx;
    const ny = centerY - node.y * spanPx;
    const rPx = Math.max(8, node.radius * spanPx);
    const nodeBox: ScreenBoxRect = {
      left: nx - rPx,
      right: nx + rPx,
      top: ny - rPx,
      bottom: ny + rPx,
    };
    for (let i = 0; i < options.textRowRects.length; i++) {
      if (doScreenBoxesOverlap(nodeBox, options.textRowRects[i])) {
        return false;
      }
    }
    return true;
  };

  const chosen: number[] = [];
  for (const idx of preferred) {
    if (chosen.length >= countWanted) break;
    if (isNodeClearOfTextRows(idx)) {
      chosen.push(idx);
    }
  }

  if (chosen.length < countWanted) {
    for (let i = 0; i < nodes.length; i++) {
      if (chosen.length >= countWanted) break;
      if (nodes[i].role === 'leaf' && !chosen.includes(i) && isNodeClearOfTextRows(i)) {
        chosen.push(i);
      }
    }
  }

  return chosen;
}


