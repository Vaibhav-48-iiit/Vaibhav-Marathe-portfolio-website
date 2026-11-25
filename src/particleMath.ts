import {
  SITE_CONFIG,
  type MorphStateName,
  type QualityTierName,
  type SectionId,
  type ShieldSymbolConfig,
  type ShieldSymbolName,
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
  /** Base XYZ positions of each node particle when formed (length = count * 3) */
  basePositions: Float32Array;
  /** Deterministic dispersion velocity/drift vectors for each particle on scroll (length = count * 3) */
  driftVectors: Float32Array;
  /** Per-particle phase offset in [0, 2π] for subtle breathing & scroll turbulence */
  phases: Float32Array;
  /** Per-particle colour RGB values (muted node colour for shield, accent colour for symbol) */
  nodeColors: Float32Array;
  /** Per-particle flag: 0 = shield node, 1 = symbol node (length = count) */
  nodeIsSymbol: Uint8Array;
  /** Pairs of particle indices [i0, j0, i1, j1, ...] in [0, count - 1] along shield/symbol edges */
  edgeIndices: Uint16Array;
  /** Active shield symbol name */
  symbol: ShieldSymbolName;
  /** Complete 3-layer wireframe node base positions (length = wireframeNodeCount * 3) */
  wireframeBasePositions: Float32Array;
  /** Complete 3-layer wireframe node drift vectors (length = wireframeNodeCount * 3) */
  wireframeDriftVectors: Float32Array;
  /** Complete 3-layer wireframe node phases (length = wireframeNodeCount) */
  wireframePhases: Float32Array;
  /** Pairs of wireframe node indices for thin low-alpha shield outlines, radial links, and z-layer struts */
  wireframeShieldEdgeIndices: Uint16Array;
  /** Per-edge alpha weight for each shield wireframe edge (length = wireframeShieldEdgeIndices.length / 2) */
  wireframeShieldEdgeAlpha: Float32Array;
  /** Shield-only wireframe edges (outer, inner, radial links, inter-layer shield struts) for continuous shield packets */
  wireframeShieldPacketEdges: Uint16Array;
  /** Ready-to-draw accent symbol line segments [ax,ay,az, bx,by,bz, ...] including thick parallel strokes */
  wireframeSymbolSegments: Float32Array;
  /** Matching endpoint drift vectors for symbol line segments */
  wireframeSymbolDrifts: Float32Array;
  /** Matching endpoint phases for symbol line segments (2 per segment) */
  wireframeSymbolPhases: Float32Array;
  /** Per-vertex alpha weights for symbol line segments (2 per segment) */
  wireframeSymbolAlpha: Float32Array;
  /** All wireframe edges (shield + symbol centerlines + z-struts) for travelling packets */
  wireframePacketEdges: Uint16Array;
  /** Shield-only dot positions (muted colour, static during symbol cycling) */
  shieldOnlyPositions: Float32Array;
  /** Shield-only dot drift vectors */
  shieldOnlyDrifts: Float32Array;
  /** Shield-only dot phases */
  shieldOnlyPhases: Float32Array;
  /** Number of symbol nodes per z-layer (48) */
  symbolNodeCountPerLayer: number;
  /** Number of z-layers (3) */
  symbolLayerCount: number;
  /** Total symbol nodes across all 3 z-layers (144) */
  symbolNodeTotalCount: number;
  /** Starting 3-layer XYZ positions of all 144 symbol nodes */
  symbolNodeBasePositions: Float32Array;
  /** Deterministic drift vectors for the 144 symbol nodes */
  symbolNodeDriftVectors: Float32Array;
  /** Deterministic phases for the 144 symbol nodes */
  symbolNodePhases: Float32Array;
  /** Precomputed 3-layer XYZ target positions (length = 144 * 3) for every symbol in shield local space */
  symbolTargetPositions: Record<ShieldSymbolName, Float32Array>;
  /** 3-layer symbol packet edges (indexed 0..143) for each symbol */
  symbolPacketEdges: Record<ShieldSymbolName, Uint16Array>;
  /** World units per 100x120 box unit */
  unitScale: number;
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

interface Layer2DNode {
  x: number;
  y: number;
  kind: 'outer' | 'inner' | 'symbol';
  /** Original corner index (0..13) if this node is one of the 14 primary outer/inner shield corners, else -1 */
  cornerIndex: number;
  /** Index along the outer/inner loop or symbol vertex list */
  seqIndex: number;
  /** Subdivision depth priority: 0 = primary corner/vertex, 1 = midpoint, 2 = finer subdivision */
  subdivRank: number;
}

/**
 * Resolves the initial concrete symbol name (`"term" | "hat" | "code"`) from a `ShieldSymbolConfig`.
 */
export function resolveDefaultSymbolName(
  config: ShieldSymbolConfig = SITE_CONFIG.shield.SHIELD_SYMBOL,
): ShieldSymbolName {
  if (config === 'cycle') {
    return SITE_CONFIG.shield.SYMBOL_ORDER[0] ?? 'term';
  }
  return config;
}

/**
 * Computes the shield's 100 x 120 coordinate box transform to local 3D world space.
 */
export function getShieldBoxTransform(): {
  boxCenterX: number;
  boxCenterY: number;
  boxSpanY: number;
  unitScale: number;
} {
  const cfg = SITE_CONFIG.shield;
  const boxCenterX = cfg.boxWidth * 0.5;
  let minBoxY = Infinity;
  let maxBoxY = -Infinity;
  for (let i = 0; i < cfg.outerOutline.length; i++) {
    const by = cfg.outerOutline[i][1];
    if (by < minBoxY) minBoxY = by;
    if (by > maxBoxY) maxBoxY = by;
  }
  const boxCenterY = (minBoxY + maxBoxY) * 0.5;
  const boxSpanY = Math.max(1, maxBoxY - minBoxY);
  const unitScale = cfg.worldHeight / boxSpanY;
  return { boxCenterX, boxCenterY, boxSpanY, unitScale };
}

/**
 * Builds the 3-layer XYZ target position buffers (length = 3 * 48 * 3 = 432 floats each)
 * for all three symbols ("term", "hat", "code") in the exact same 100 x 120 shield coordinate transform.
 */
export function buildShieldSymbolTargets(): Record<ShieldSymbolName, Float32Array> {
  const cfg = SITE_CONFIG.shield;
  const { boxCenterX, boxCenterY, unitScale } = getShieldBoxTransform();
  const zFractions = cfg.zLayerFractions;
  const layerCount = zFractions.length;

  const buildFor = (sym: ShieldSymbolName): Float32Array => {
    const nodes = cfg.symbols[sym].nodes;
    const nPerLayer = nodes.length;
    const out = new Float32Array(layerCount * nPerLayer * 3);
    for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
      const zVal = zFractions[layerIdx] * cfg.worldHeight;
      const layerOff = layerIdx * nPerLayer;
      for (let i = 0; i < nPerLayer; i++) {
        const [bx, by] = nodes[i];
        const o3 = (layerOff + i) * 3;
        out[o3] = (bx - boxCenterX) * unitScale;
        out[o3 + 1] = (boxCenterY - by) * unitScale;
        out[o3 + 2] = zVal;
      }
    }
    return out;
  };

  return {
    term: buildFor('term'),
    hat: buildFor('hat'),
    code: buildFor('code'),
  };
}

/**
 * Computes the maximum vertex count required by `writeSymbolSegmentsBuffer` across all 3 symbols,
 * so a single fixed-size GPU `BufferGeometry` can be reused with zero reallocations.
 */
export function computeMaxSymbolSegmentVertices(): number {
  const cfg = SITE_CONFIG.shield;
  const layerCount = cfg.zLayerFractions.length;
  let maxSegments = 0;
  for (const sym of ['term', 'hat', 'code'] as const) {
    const symCfg = cfg.symbols[sym];
    const edgeCount = symCfg.edges.length;
    const frontStrands = symCfg.thickStrokeOffsets.length;
    const inPlaneSegments = edgeCount * (frontStrands + Math.max(0, layerCount - 1));
    const zStrutSegments = symCfg.nodes.length * Math.max(0, layerCount - 1);
    const total = inPlaneSegments + zStrutSegments;
    if (total > maxSegments) maxSegments = total;
  }
  return maxSegments * 2;
}

/**
 * Writes the active symbol's 3-layer line segments (front thick parallel strands, mid/back centerlines,
 * and subtle inter-layer z-struts) directly from the current 144 symbol node positions into pre-allocated
 * Float32Arrays. Returns the number of vertices written (2 per segment).
 */
export function writeSymbolSegmentsBuffer(options: {
  symbol: ShieldSymbolName;
  symbolPositions: Float32Array;
  symbolDrifts: Float32Array;
  symbolPhases: Float32Array;
  unitScale: number;
  outPositions: Float32Array;
  outDrifts: Float32Array;
  outPhases: Float32Array;
  outAlphas: Float32Array;
}): number {
  const cfg = SITE_CONFIG.shield;
  const symCfg = cfg.symbols[options.symbol];
  const edges = symCfg.edges;
  const nPerLayer = symCfg.nodes.length;
  const layerCount = cfg.zLayerFractions.length;
  const {
    symbolPositions,
    symbolDrifts,
    symbolPhases,
    unitScale,
    outPositions,
    outDrifts,
    outPhases,
    outAlphas,
  } = options;

  let vCursor = 0;
  const pushSegment = (
    idxA: number,
    idxB: number,
    alphaW: number,
    offX = 0,
    offY = 0,
  ) => {
    const a3 = idxA * 3;
    const b3 = idxB * 3;
    const o3A = vCursor * 3;
    const o3B = (vCursor + 1) * 3;

    outPositions[o3A] = symbolPositions[a3] + offX;
    outPositions[o3A + 1] = symbolPositions[a3 + 1] + offY;
    outPositions[o3A + 2] = symbolPositions[a3 + 2];
    outPositions[o3B] = symbolPositions[b3] + offX;
    outPositions[o3B + 1] = symbolPositions[b3 + 1] + offY;
    outPositions[o3B + 2] = symbolPositions[b3 + 2];

    outDrifts[o3A] = symbolDrifts[a3];
    outDrifts[o3A + 1] = symbolDrifts[a3 + 1];
    outDrifts[o3A + 2] = symbolDrifts[a3 + 2];
    outDrifts[o3B] = symbolDrifts[b3];
    outDrifts[o3B + 1] = symbolDrifts[b3 + 1];
    outDrifts[o3B + 2] = symbolDrifts[b3 + 2];

    outPhases[vCursor] = symbolPhases[idxA];
    outPhases[vCursor + 1] = symbolPhases[idxB];

    outAlphas[vCursor] = alphaW;
    outAlphas[vCursor + 1] = alphaW;

    vCursor += 2;
  };

  const layerSymbolAlphaWeights = [0.22, 0.38, 0.95];
  for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
    const layerOff = layerIdx * nPerLayer;
    const alphaW = layerSymbolAlphaWeights[layerIdx] ?? 0.45;
    const offsets: readonly number[] =
      layerIdx === layerCount - 1 ? symCfg.thickStrokeOffsets : [0];

    for (let e = 0; e < edges.length; e++) {
      const idxA = layerOff + edges[e][0];
      const idxB = layerOff + edges[e][1];

      const ax = symbolPositions[idxA * 3];
      const ay = symbolPositions[idxA * 3 + 1];
      const bx = symbolPositions[idxB * 3];
      const by = symbolPositions[idxB * 3 + 1];
      const segLen = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / segLen;
      const ny = (bx - ax) / segLen;

      for (let o = 0; o < offsets.length; o++) {
        const offWorld = offsets[o] * unitScale;
        pushSegment(idxA, idxB, alphaW, nx * offWorld, ny * offWorld);
      }
    }
  }

  // Subtle inter-layer z-struts connecting matching symbol nodes on adjacent z-layers
  for (let layerIdx = 0; layerIdx < layerCount - 1; layerIdx++) {
    const offA = layerIdx * nPerLayer;
    const offB = (layerIdx + 1) * nPerLayer;
    for (let i = 0; i < nPerLayer; i++) {
      pushSegment(offA + i, offB + i, 0.16, 0, 0);
    }
  }

  return vCursor;
}

/**
 * Generates the deterministic 3-layer 3D Shield + interior Symbol node/edge network
 * from `SITE_CONFIG.shield`, distributing exactly `count` particles across the shield
 * and symbol nodes while preserving identical scroll dispersion & quality tier counts.
 */
export function generateShieldNetwork(
  count: number,
  symbol: ShieldSymbolName = resolveDefaultSymbolName(),
  seed = 42,
): DeltaNetworkData {
  const rand = createSeededRandom(seed);
  const cfg = SITE_CONFIG.shield;
  const symCfg = cfg.symbols[symbol];

  const { boxCenterX, boxCenterY, unitScale } = getShieldBoxTransform();

  const toLocalXY = (bx: number, by: number): [number, number] => [
    (bx - boxCenterX) * unitScale,
    (boxCenterY - by) * unitScale,
  ];

  // --- 1. Build single-layer 2D blueprint (outer outline, inner outline, radial links, 48-node symbol) ---
  const layerNodes: Layer2DNode[] = [];
  const layerShieldEdges: Array<[number, number]> = [];
  const layerSymbolEdges: Array<[number, number]> = [];

  const buildSubdividedClosedOutline = (
    outline: readonly (readonly [number, number])[],
    kind: 'outer' | 'inner',
  ): { cornerNodeIndices: number[]; loopNodeIndices: number[] } => {
    const cornerNodeIndices: number[] = [];
    const loopNodeIndices: number[] = [];
    const step = cfg.subdivideStepUnits;
    const n = outline.length;

    for (let i = 0; i < n; i++) {
      const [ax, ay] = outline[i];
      const [bx, by] = outline[(i + 1) % n];
      const [lx, ly] = toLocalXY(ax, ay);

      const cornerIdx = layerNodes.length;
      layerNodes.push({
        x: lx,
        y: ly,
        kind,
        cornerIndex: i,
        seqIndex: loopNodeIndices.length,
        subdivRank: 0,
      });
      cornerNodeIndices.push(cornerIdx);
      loopNodeIndices.push(cornerIdx);

      const segLen = Math.hypot(bx - ax, by - ay);
      const segments = Math.max(1, Math.round(segLen / step));
      const midStep = Math.floor(segments / 2);

      for (let s = 1; s < segments; s++) {
        const t = s / segments;
        const sx = ax + (bx - ax) * t;
        const sy = ay + (by - ay) * t;
        const [slx, sly] = toLocalXY(sx, sy);
        const subIdx = layerNodes.length;
        layerNodes.push({
          x: slx,
          y: sly,
          kind,
          cornerIndex: -1,
          seqIndex: loopNodeIndices.length,
          subdivRank: s === midStep ? 1 : 2,
        });
        loopNodeIndices.push(subIdx);
      }
    }

    for (let k = 0; k < loopNodeIndices.length; k++) {
      const a = loopNodeIndices[k];
      const b = loopNodeIndices[(k + 1) % loopNodeIndices.length];
      layerShieldEdges.push([a, b]);
    }

    return { cornerNodeIndices, loopNodeIndices };
  };

  const outer = buildSubdividedClosedOutline(cfg.outerOutline, 'outer');
  const inner = buildSubdividedClosedOutline(cfg.innerOutline, 'inner');
  const shieldNodeEnd = outer.loopNodeIndices.length + inner.loopNodeIndices.length;

  // Link each outer primary node to the inner primary node of the same index
  for (let i = 0; i < cfg.radialLinks.length; i++) {
    const [oi, ii] = cfg.radialLinks[i];
    const outerNodeIdx = outer.cornerNodeIndices[oi];
    const innerNodeIdx = inner.cornerNodeIndices[ii];
    if (outerNodeIdx !== undefined && innerNodeIdx !== undefined) {
      layerShieldEdges.push([outerNodeIdx, innerNodeIdx]);
    }
  }

  // Build exact 48 interior symbol nodes and edges
  const symNodes: readonly (readonly [number, number])[] = symCfg.nodes;
  const symEdges: readonly (readonly [number, number])[] = symCfg.edges;
  const symbolBaseNodeIndices: number[] = [];
  const symbolAllNodeIndices: number[] = [];
  for (let i = 0; i < symNodes.length; i++) {
    const [bx, by] = symNodes[i];
    const [lx, ly] = toLocalXY(bx, by);
    const idx = layerNodes.length;
    layerNodes.push({
      x: lx,
      y: ly,
      kind: 'symbol',
      cornerIndex: -1,
      seqIndex: symbolAllNodeIndices.length,
      subdivRank: 0,
    });
    symbolBaseNodeIndices.push(idx);
    symbolAllNodeIndices.push(idx);
  }

  for (let e = 0; e < symEdges.length; e++) {
    const [aLocal, bLocal] = symEdges[e];
    const aIdx = symbolBaseNodeIndices[aLocal];
    const bIdx = symbolBaseNodeIndices[bLocal];
    layerSymbolEdges.push([aIdx, bIdx]);
  }

  // --- 2. Duplicate across 3 z-layers (-0.15, 0, +0.15 of shield height) ---
  const zFractions = cfg.zLayerFractions;
  const layerCount = zFractions.length; // 3
  const layerNodeCount = layerNodes.length;
  const wireframeNodeCount = layerNodeCount * layerCount;

  const wireframeBasePositions = new Float32Array(wireframeNodeCount * 3);
  const wireframeDriftVectors = new Float32Array(wireframeNodeCount * 3);
  const wireframePhases = new Float32Array(wireframeNodeCount);

  for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
    const zVal = zFractions[layerIdx] * cfg.worldHeight;
    const baseOffset = layerIdx * layerNodeCount;

    for (let n = 0; n < layerNodeCount; n++) {
      const wfIdx = baseOffset + n;
      const i3 = wfIdx * 3;
      const node = layerNodes[n];

      const x = node.x;
      const y = node.y;
      const z = zVal;

      wireframeBasePositions[i3] = x;
      wireframeBasePositions[i3 + 1] = y;
      wireframeBasePositions[i3 + 2] = z;

      const radialLen = Math.hypot(x, y) || 1;
      const dirX = x / radialLen;
      const dirY = y / radialLen;
      const spread = SITE_CONFIG.scroll.radialSpreadFactor * (0.65 + rand() * 0.95);

      wireframeDriftVectors[i3] = dirX * spread + (rand() - 0.5) * 2.2;
      wireframeDriftVectors[i3 + 1] = dirY * spread + (rand() - 0.5) * 1.8;
      wireframeDriftVectors[i3 + 2] =
        -SITE_CONFIG.scroll.streamDepthDistance * (0.45 + rand() * 0.85);

      wireframePhases[wfIdx] = rand() * Math.PI * 2;
    }
  }

  // Extract dedicated 3 x 48 = 144 symbol node arrays (fixed drift & phase across all morphs)
  const symbolNodeCountPerLayer = symNodes.length;
  const symbolNodeTotalCount = layerCount * symbolNodeCountPerLayer;
  const symbolNodeBasePositions = new Float32Array(symbolNodeTotalCount * 3);
  const symbolNodeDriftVectors = new Float32Array(symbolNodeTotalCount * 3);
  const symbolNodePhases = new Float32Array(symbolNodeTotalCount);

  for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
    const wfLayerOff = layerIdx * layerNodeCount;
    const symLayerOff = layerIdx * symbolNodeCountPerLayer;
    for (let i = 0; i < symbolNodeCountPerLayer; i++) {
      const wfIdx = wfLayerOff + symbolBaseNodeIndices[i];
      const sIdx = symLayerOff + i;
      const wf3 = wfIdx * 3;
      const s3 = sIdx * 3;
      symbolNodeBasePositions[s3] = wireframeBasePositions[wf3];
      symbolNodeBasePositions[s3 + 1] = wireframeBasePositions[wf3 + 1];
      symbolNodeBasePositions[s3 + 2] = wireframeBasePositions[wf3 + 2];

      symbolNodeDriftVectors[s3] = wireframeDriftVectors[wf3];
      symbolNodeDriftVectors[s3 + 1] = wireframeDriftVectors[wf3 + 1];
      symbolNodeDriftVectors[s3 + 2] = wireframeDriftVectors[wf3 + 2];

      symbolNodePhases[sIdx] = wireframePhases[wfIdx];
    }
  }

  // Build 3-layer symbol packet edges (indexed 0..143) for each symbol
  const buildSymbolPacketEdges = (symName: ShieldSymbolName): Uint16Array => {
    const edges = cfg.symbols[symName].edges;
    const nPerLayer = cfg.symbols[symName].nodes.length;
    const list: number[] = [];
    for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
      const off = layerIdx * nPerLayer;
      for (let e = 0; e < edges.length; e++) {
        list.push(off + edges[e][0], off + edges[e][1]);
      }
    }
    for (let layerIdx = 0; layerIdx < layerCount - 1; layerIdx++) {
      const offA = layerIdx * nPerLayer;
      const offB = (layerIdx + 1) * nPerLayer;
      for (let i = 0; i < nPerLayer; i++) {
        list.push(offA + i, offB + i);
      }
    }
    return new Uint16Array(list);
  };

  const symbolPacketEdges: Record<ShieldSymbolName, Uint16Array> = {
    term: buildSymbolPacketEdges('term'),
    hat: buildSymbolPacketEdges('hat'),
    code: buildSymbolPacketEdges('code'),
  };

  const symbolTargetPositions = buildShieldSymbolTargets();

  // --- 3. Assemble 3-layer shield wireframe edges + inter-layer short edges ---
  const shieldEdgeList: number[] = [];
  const shieldEdgeAlphaList: number[] = [];
  const shieldPacketEdgeList: number[] = [];
  const shieldPacketEdgeSet = new Set<number>();
  const packetEdgeList: number[] = [];
  const packetEdgeSet = new Set<number>();

  const addShieldPacketEdge = (a: number, b: number) => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const key = min * wireframeNodeCount + max;
    if (!shieldPacketEdgeSet.has(key)) {
      shieldPacketEdgeSet.add(key);
      shieldPacketEdgeList.push(min, max);
    }
    if (!packetEdgeSet.has(key)) {
      packetEdgeSet.add(key);
      packetEdgeList.push(min, max);
    }
  };

  const addPacketEdge = (a: number, b: number) => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const key = min * wireframeNodeCount + max;
    if (packetEdgeSet.has(key)) return;
    packetEdgeSet.add(key);
    packetEdgeList.push(min, max);
  };

  const layerShieldAlphaWeights = [0.55, 0.80, 1.0];
  for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
    const offset = layerIdx * layerNodeCount;
    const alphaW = layerShieldAlphaWeights[layerIdx] ?? 0.8;
    for (let e = 0; e < layerShieldEdges.length; e++) {
      const a = offset + layerShieldEdges[e][0];
      const b = offset + layerShieldEdges[e][1];
      shieldEdgeList.push(a, b);
      shieldEdgeAlphaList.push(alphaW);
      addShieldPacketEdge(a, b);
    }
  }

  // Short edges between matching shield nodes on adjacent z-layers (0<->1 and 1<->2)
  for (let layerIdx = 0; layerIdx < layerCount - 1; layerIdx++) {
    const offA = layerIdx * layerNodeCount;
    const offB = (layerIdx + 1) * layerNodeCount;
    for (let n = 0; n < shieldNodeEnd; n++) {
      const a = offA + n;
      const b = offB + n;
      shieldEdgeList.push(a, b);
      shieldEdgeAlphaList.push(0.45);
      addShieldPacketEdge(a, b);
    }
  }

  // Add symbol edges to the combined packet edge list for legacy callers/tests
  for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
    const offset = layerIdx * layerNodeCount;
    for (let e = 0; e < layerSymbolEdges.length; e++) {
      addPacketEdge(offset + layerSymbolEdges[e][0], offset + layerSymbolEdges[e][1]);
    }
  }
  for (let layerIdx = 0; layerIdx < layerCount - 1; layerIdx++) {
    const offA = layerIdx * layerNodeCount;
    const offB = (layerIdx + 1) * layerNodeCount;
    for (let s = 0; s < symbolAllNodeIndices.length; s++) {
      addPacketEdge(offA + symbolAllNodeIndices[s], offB + symbolAllNodeIndices[s]);
    }
  }

  // --- 4. Assemble initial 3-layer accent symbol line segments via shared zero-alloc writer ---
  const maxSymVerts = computeMaxSymbolSegmentVertices();
  const tmpPos = new Float32Array(maxSymVerts * 3);
  const tmpDrift = new Float32Array(maxSymVerts * 3);
  const tmpPhase = new Float32Array(maxSymVerts);
  const tmpAlpha = new Float32Array(maxSymVerts);
  const writtenVerts = writeSymbolSegmentsBuffer({
    symbol,
    symbolPositions: symbolNodeBasePositions,
    symbolDrifts: symbolNodeDriftVectors,
    symbolPhases: symbolNodePhases,
    unitScale,
    outPositions: tmpPos,
    outDrifts: tmpDrift,
    outPhases: tmpPhase,
    outAlphas: tmpAlpha,
  });

  const wireframeSymbolSegments = tmpPos.slice(0, writtenVerts * 3);
  const wireframeSymbolDrifts = tmpDrift.slice(0, writtenVerts * 3);
  const wireframeSymbolPhases = tmpPhase.slice(0, writtenVerts);
  const wireframeSymbolAlpha = tmpAlpha.slice(0, writtenVerts);

  // --- 5A. Select dedicated shield-only dots (preserves exact shield dot density across all 3 tiers) ---
  const targetShieldDotCount = Math.max(28, Math.round(count * 0.78));
  const selectedShieldWfIndices: number[] = [];
  const selectedShieldSet = new Set<number>();

  const trySelectShieldOnly = (layerIdx: number, localIdx: number): boolean => {
    if (selectedShieldWfIndices.length >= targetShieldDotCount) return false;
    const wfIdx = layerIdx * layerNodeCount + localIdx;
    if (selectedShieldSet.has(wfIdx)) return false;
    selectedShieldSet.add(wfIdx);
    selectedShieldWfIndices.push(wfIdx);
    return true;
  };

  const layerOrderA = [2, 1, 0];
  const layerOrderB = [1, 2, 0];

  // Shield primary corners across 3 z-layers
  for (let c = 0; c < outer.cornerNodeIndices.length; c++) {
    trySelectShieldOnly(layerOrderA[c % 3], outer.cornerNodeIndices[c]);
  }
  for (let c = 0; c < inner.cornerNodeIndices.length; c++) {
    trySelectShieldOnly(layerOrderB[c % 3], inner.cornerNodeIndices[c]);
  }
  // Shield midpoints (subdivRank === 1)
  for (let k = 0; k < outer.loopNodeIndices.length; k++) {
    const localIdx = outer.loopNodeIndices[k];
    if (layerNodes[localIdx].subdivRank === 1) {
      trySelectShieldOnly(layerOrderA[k % 3], localIdx);
    }
  }
  for (let k = 0; k < inner.loopNodeIndices.length; k++) {
    const localIdx = inner.loopNodeIndices[k];
    if (layerNodes[localIdx].subdivRank === 1) {
      trySelectShieldOnly(layerOrderB[k % 3], localIdx);
    }
  }
  // Remaining subdivided shield outline positions (subdivRank === 2)
  for (let k = 0; k < outer.loopNodeIndices.length; k++) {
    const localIdx = outer.loopNodeIndices[k];
    if (layerNodes[localIdx].subdivRank === 2) {
      trySelectShieldOnly(layerOrderA[k % 3], localIdx);
    }
  }
  for (let k = 0; k < inner.loopNodeIndices.length; k++) {
    const localIdx = inner.loopNodeIndices[k];
    if (layerNodes[localIdx].subdivRank === 2) {
      trySelectShieldOnly(layerOrderB[k % 3], localIdx);
    }
  }
  // Extra depth corners on remaining z-layers
  for (let pass = 0; pass < 3 && selectedShieldWfIndices.length < targetShieldDotCount; pass++) {
    for (
      let c = 0;
      c < outer.cornerNodeIndices.length && selectedShieldWfIndices.length < targetShieldDotCount;
      c++
    ) {
      trySelectShieldOnly((pass + 2) % 3, outer.cornerNodeIndices[c]);
    }
    for (
      let c = 0;
      c < inner.cornerNodeIndices.length && selectedShieldWfIndices.length < targetShieldDotCount;
      c++
    ) {
      trySelectShieldOnly((pass + 1) % 3, inner.cornerNodeIndices[c]);
    }
  }

  const shieldDotCount = selectedShieldWfIndices.length;
  const shieldOnlyPositions = new Float32Array(shieldDotCount * 3);
  const shieldOnlyDrifts = new Float32Array(shieldDotCount * 3);
  const shieldOnlyPhases = new Float32Array(shieldDotCount);

  for (let p = 0; p < shieldDotCount; p++) {
    const wfIdx = selectedShieldWfIndices[p];
    const p3 = p * 3;
    const wf3 = wfIdx * 3;
    shieldOnlyPositions[p3] = wireframeBasePositions[wf3];
    shieldOnlyPositions[p3 + 1] = wireframeBasePositions[wf3 + 1];
    shieldOnlyPositions[p3 + 2] = wireframeBasePositions[wf3 + 2];

    shieldOnlyDrifts[p3] = wireframeDriftVectors[wf3];
    shieldOnlyDrifts[p3 + 1] = wireframeDriftVectors[wf3 + 1];
    shieldOnlyDrifts[p3 + 2] = wireframeDriftVectors[wf3 + 2];

    shieldOnlyPhases[p] = wireframePhases[wfIdx];
  }

  // --- 5B. Distribute EXACTLY `count` particles deterministically across shield & symbol nodes ---
  const selectedWfIndices: number[] = [];
  const selectedSet = new Set<number>();

  const trySelect = (layerIdx: number, localIdx: number): boolean => {
    if (selectedWfIndices.length >= count) return false;
    const wfIdx = layerIdx * layerNodeCount + localIdx;
    if (selectedSet.has(wfIdx)) return false;
    selectedSet.add(wfIdx);
    selectedWfIndices.push(wfIdx);
    return true;
  };

  // Priority 1: All 14 primary outer corners and 14 primary inner corners staggered across 3 z-layers
  for (let c = 0; c < outer.cornerNodeIndices.length; c++) {
    trySelect(layerOrderA[c % 3], outer.cornerNodeIndices[c]);
  }
  for (let c = 0; c < inner.cornerNodeIndices.length; c++) {
    trySelect(layerOrderB[c % 3], inner.cornerNodeIndices[c]);
  }

  // Priority 2: Front-layer (z = +0.15H) symbol nodes
  for (let s = 0; s < symbolAllNodeIndices.length; s++) {
    trySelect(2, symbolAllNodeIndices[s]);
  }

  // Priority 3: Midpoints (subdivRank === 1) around outer & inner outlines
  for (let k = 0; k < outer.loopNodeIndices.length; k++) {
    const localIdx = outer.loopNodeIndices[k];
    if (layerNodes[localIdx].subdivRank === 1) {
      trySelect(layerOrderA[k % 3], localIdx);
    }
  }
  for (let k = 0; k < inner.loopNodeIndices.length; k++) {
    const localIdx = inner.loopNodeIndices[k];
    if (layerNodes[localIdx].subdivRank === 1) {
      trySelect(layerOrderB[k % 3], localIdx);
    }
  }

  // Priority 4: Middle-layer (z = 0) symbol nodes on high tier
  if (count >= 140) {
    for (let s = 0; s < symbolAllNodeIndices.length; s++) {
      trySelect(1, symbolAllNodeIndices[s]);
    }
  }

  // Priority 5: Remaining subdivided outline positions (subdivRank === 2)
  for (let k = 0; k < outer.loopNodeIndices.length; k++) {
    const localIdx = outer.loopNodeIndices[k];
    if (layerNodes[localIdx].subdivRank === 2) {
      trySelect(layerOrderA[k % 3], localIdx);
    }
  }
  for (let k = 0; k < inner.loopNodeIndices.length; k++) {
    const localIdx = inner.loopNodeIndices[k];
    if (layerNodes[localIdx].subdivRank === 2) {
      trySelect(layerOrderB[k % 3], localIdx);
    }
  }

  // Priority 6: Back-layer (z = -0.15H) symbol nodes & any remaining blueprint nodes
  for (let s = 0; s < symbolAllNodeIndices.length; s++) {
    trySelect(0, symbolAllNodeIndices[s]);
  }
  for (let layerIdx = layerCount - 1; layerIdx >= 0 && selectedWfIndices.length < count; layerIdx--) {
    for (let n = 0; n < layerNodeCount && selectedWfIndices.length < count; n++) {
      trySelect(layerIdx, n);
    }
  }

  let fallbackCursor = 0;
  while (selectedWfIndices.length < count) {
    selectedWfIndices.push(fallbackCursor % wireframeNodeCount);
    fallbackCursor++;
  }

  const basePositions = new Float32Array(count * 3);
  const driftVectors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const nodeColors = new Float32Array(count * 3);
  const nodeIsSymbol = new Uint8Array(count);

  const mutedRgb = hexToRgbNormalized(SITE_CONFIG.colors.textMuted);
  const accentRgb = hexToRgbNormalized(SITE_CONFIG.colors.accent);

  const wfToParticle = new Map<number, number>();
  for (let p = 0; p < count; p++) {
    const wfIdx = selectedWfIndices[p];
    if (!wfToParticle.has(wfIdx)) {
      wfToParticle.set(wfIdx, p);
    }

    const p3 = p * 3;
    const wf3 = wfIdx * 3;
    basePositions[p3] = wireframeBasePositions[wf3];
    basePositions[p3 + 1] = wireframeBasePositions[wf3 + 1];
    basePositions[p3 + 2] = wireframeBasePositions[wf3 + 2];

    driftVectors[p3] = wireframeDriftVectors[wf3];
    driftVectors[p3 + 1] = wireframeDriftVectors[wf3 + 1];
    driftVectors[p3 + 2] = wireframeDriftVectors[wf3 + 2];

    phases[p] = wireframePhases[wfIdx];

    const localIdx = wfIdx % layerNodeCount;
    const isSym = layerNodes[localIdx].kind === 'symbol' ? 1 : 0;
    nodeIsSymbol[p] = isSym;

    const rgb = isSym ? accentRgb : mutedRgb;
    nodeColors[p3] = rgb[0];
    nodeColors[p3 + 1] = rgb[1];
    nodeColors[p3 + 2] = rgb[2];
  }

  // --- 6. Build particle-indexed edgeIndices (valid pairs in [0, count - 1]) ---
  const particleEdges: number[] = [];
  const particleEdgeSet = new Set<number>();
  const addParticleEdge = (a: number, b: number) => {
    if (a === b || a < 0 || b < 0 || a >= count || b >= count) return;
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const key = min * count + max;
    if (particleEdgeSet.has(key)) return;
    particleEdgeSet.add(key);
    particleEdges.push(min, max);
  };

  for (let i = 0; i < packetEdgeList.length; i += 2) {
    const pA = wfToParticle.get(packetEdgeList[i]);
    const pB = wfToParticle.get(packetEdgeList[i + 1]);
    if (pA !== undefined && pB !== undefined) {
      addParticleEdge(pA, pB);
    }
  }

  // Also link consecutive selected particles along the outer and inner shield outlines
  const outerSelectedBySeq: Array<{ seq: number; p: number }> = [];
  const innerSelectedBySeq: Array<{ seq: number; p: number }> = [];
  for (let p = 0; p < count; p++) {
    const localIdx = selectedWfIndices[p] % layerNodeCount;
    const node = layerNodes[localIdx];
    if (node.kind === 'outer') {
      outerSelectedBySeq.push({ seq: node.seqIndex, p });
    } else if (node.kind === 'inner') {
      innerSelectedBySeq.push({ seq: node.seqIndex, p });
    }
  }
  outerSelectedBySeq.sort((a, b) => a.seq - b.seq);
  innerSelectedBySeq.sort((a, b) => a.seq - b.seq);

  for (let i = 0; i < outerSelectedBySeq.length; i++) {
    const next = (i + 1) % outerSelectedBySeq.length;
    addParticleEdge(outerSelectedBySeq[i].p, outerSelectedBySeq[next].p);
  }
  for (let i = 0; i < innerSelectedBySeq.length; i++) {
    const next = (i + 1) % innerSelectedBySeq.length;
    addParticleEdge(innerSelectedBySeq[i].p, innerSelectedBySeq[next].p);
  }

  return {
    basePositions,
    driftVectors,
    phases,
    nodeColors,
    nodeIsSymbol,
    edgeIndices: new Uint16Array(particleEdges),
    symbol,
    wireframeBasePositions,
    wireframeDriftVectors,
    wireframePhases,
    wireframeShieldEdgeIndices: new Uint16Array(shieldEdgeList),
    wireframeShieldEdgeAlpha: new Float32Array(shieldEdgeAlphaList),
    wireframeShieldPacketEdges: new Uint16Array(shieldPacketEdgeList),
    wireframeSymbolSegments,
    wireframeSymbolDrifts,
    wireframeSymbolPhases,
    wireframeSymbolAlpha,
    wireframePacketEdges: new Uint16Array(packetEdgeList),
    shieldOnlyPositions,
    shieldOnlyDrifts,
    shieldOnlyPhases,
    symbolNodeCountPerLayer,
    symbolLayerCount: layerCount,
    symbolNodeTotalCount,
    symbolNodeBasePositions,
    symbolNodeDriftVectors,
    symbolNodePhases,
    symbolTargetPositions,
    symbolPacketEdges,
    unitScale,
  };
}

/**
 * Generates the hero 3D Shield node/edge network and deterministic dispersion vectors.
 * Retained under the `generateDeltaNetwork` name for compatibility across existing callers and tests.
 */
export function generateDeltaNetwork(count: number, seed = 42): DeltaNetworkData {
  return generateShieldNetwork(count, resolveDefaultSymbolName(), seed);
}

export type SymbolCyclePhase = 'HOLD' | 'MORPH';

export interface SymbolCycleState {
  currentIndex: number;
  targetIndex: number;
  phase: SymbolCyclePhase;
  phaseElapsedMs: number;
  edgeFadeInElapsedMs: number;
  edgeSymbol: ShieldSymbolName;
  edgeAlpha: number;
  morphProgress: number;
  secondsUntilNext: number | null;
  isStatic: boolean;
}

export interface SymbolCycleStepResult {
  startedMorph: boolean;
  switchedEdgeSymbol: boolean;
  symbolChanged: boolean;
  activeSymbol: ShieldSymbolName;
  targetSymbol: ShieldSymbolName;
}

/**
 * Cubic ease-in-out curve for smooth symbol morphing.
 */
export function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/**
 * Returns true when the shield interior symbol cycle must be disabled
 * (fixed SHIELD_SYMBOL config, low quality tier, prefers-reduced-motion, Save-Data, or Plain view).
 */
export function shouldDisableSymbolCycle(params: {
  shieldSymbolConfig?: ShieldSymbolConfig;
  plainView: boolean;
  prefersReducedMotion: boolean;
  qualityTier: QualityTierName;
  saveData: boolean;
}): boolean {
  const cfgMode = params.shieldSymbolConfig ?? SITE_CONFIG.shield.SHIELD_SYMBOL;
  if (cfgMode !== 'cycle') return true;
  return Boolean(
    params.plainView ||
      params.prefersReducedMotion ||
      params.qualityTier === 'low' ||
      params.saveData,
  );
}

/**
 * Resolves the static symbol to display when symbol cycling is disabled.
 * In low quality tier, prefers-reduced-motion, Save-Data mode, or Plain view, always shows static "term".
 */
export function resolveStaticShieldSymbol(params: {
  shieldSymbolConfig?: ShieldSymbolConfig;
  plainView: boolean;
  prefersReducedMotion: boolean;
  qualityTier: QualityTierName;
  saveData: boolean;
}): ShieldSymbolName {
  if (
    params.plainView ||
    params.prefersReducedMotion ||
    params.qualityTier === 'low' ||
    params.saveData
  ) {
    return 'term';
  }
  const cfgMode = params.shieldSymbolConfig ?? SITE_CONFIG.shield.SHIELD_SYMBOL;
  if (cfgMode !== 'cycle') return cfgMode;
  return SITE_CONFIG.shield.SYMBOL_ORDER[0] ?? 'term';
}

/**
 * Initializes the ref-backed state object for the shield interior symbol cycle.
 */
export function createSymbolCycleState(params: {
  shieldSymbolConfig?: ShieldSymbolConfig;
  plainView: boolean;
  prefersReducedMotion: boolean;
  qualityTier: QualityTierName;
  saveData: boolean;
}): SymbolCycleState {
  const order = SITE_CONFIG.shield.SYMBOL_ORDER;
  const isStatic = shouldDisableSymbolCycle(params);
  const startSym = isStatic
    ? resolveStaticShieldSymbol(params)
    : (order[0] ?? 'term');
  const startIdx = Math.max(0, order.indexOf(startSym));

  return {
    currentIndex: startIdx,
    targetIndex: startIdx,
    phase: 'HOLD',
    phaseElapsedMs: 0,
    edgeFadeInElapsedMs: SITE_CONFIG.shield.symbolEdgeFadeInMs,
    edgeSymbol: startSym,
    edgeAlpha: 1,
    morphProgress: 0,
    secondsUntilNext: isStatic ? null : SITE_CONFIG.shield.SYMBOL_HOLD_MS / 1000,
    isStatic,
  };
}

/**
 * Advances the symbol cycle state machine in place (zero allocations per frame).
 * Pauses completely when `isActive` is false (dispersed/scrolled away, tab hidden, or canvas off-screen).
 */
export function stepSymbolCycleState(
  state: SymbolCycleState,
  params: {
    dtMs: number;
    isActive: boolean;
    disableCycle: boolean;
    staticSymbol: ShieldSymbolName;
    order?: readonly ShieldSymbolName[];
    holdMs?: number;
    morphMs?: number;
    fadeOutMs?: number;
    fadeInMs?: number;
  },
): SymbolCycleStepResult {
  const order = params.order ?? SITE_CONFIG.shield.SYMBOL_ORDER;
  const holdMs = Math.max(1, params.holdMs ?? SITE_CONFIG.shield.SYMBOL_HOLD_MS);
  const morphMs = Math.max(1, params.morphMs ?? SITE_CONFIG.shield.SYMBOL_MORPH_MS);
  const fadeOutMs = Math.max(1, params.fadeOutMs ?? SITE_CONFIG.shield.symbolEdgeFadeOutMs);
  const fadeInMs = Math.max(1, params.fadeInMs ?? SITE_CONFIG.shield.symbolEdgeFadeInMs);

  if (params.disableCycle) {
    const targetIdx = Math.max(0, order.indexOf(params.staticSymbol));
    const switchedEdgeSymbol = state.edgeSymbol !== params.staticSymbol;
    const symbolChanged = switchedEdgeSymbol || !state.isStatic;
    state.isStatic = true;
    state.phase = 'HOLD';
    state.phaseElapsedMs = 0;
    state.edgeFadeInElapsedMs = fadeInMs;
    state.currentIndex = targetIdx;
    state.targetIndex = targetIdx;
    state.edgeSymbol = params.staticSymbol;
    state.edgeAlpha = 1;
    state.morphProgress = 0;
    state.secondsUntilNext = null;
    return {
      startedMorph: false,
      switchedEdgeSymbol,
      symbolChanged,
      activeSymbol: params.staticSymbol,
      targetSymbol: params.staticSymbol,
    };
  }

  const wasStatic = state.isStatic;
  state.isStatic = false;

  const currentSym = order[state.currentIndex] ?? 'term';
  const targetSym = order[state.targetIndex] ?? currentSym;

  if (!params.isActive) {
    if (wasStatic) {
      state.secondsUntilNext =
        state.phase === 'HOLD'
          ? Math.max(0, (holdMs - state.phaseElapsedMs) / 1000)
          : Math.max(0, (morphMs - state.phaseElapsedMs) / 1000);
    }
    return {
      startedMorph: false,
      switchedEdgeSymbol: false,
      symbolChanged: wasStatic,
      activeSymbol: currentSym,
      targetSymbol: state.phase === 'MORPH' ? targetSym : currentSym,
    };
  }

  const safeDtMs = Math.max(0, Math.min(100, params.dtMs));

  if (state.phase === 'HOLD') {
    state.phaseElapsedMs += safeDtMs;
    state.edgeFadeInElapsedMs = Math.min(fadeInMs, state.edgeFadeInElapsedMs + safeDtMs);
    state.edgeAlpha = Math.max(0, Math.min(1, state.edgeFadeInElapsedMs / fadeInMs));
    state.morphProgress = 0;

    if (state.phaseElapsedMs >= holdMs) {
      const overflow = Math.min(safeDtMs, state.phaseElapsedMs - holdMs);
      state.phase = 'MORPH';
      state.targetIndex = (state.currentIndex + 1) % order.length;
      state.phaseElapsedMs = overflow;
      state.edgeAlpha = Math.max(0, 1 - state.phaseElapsedMs / fadeOutMs);
      state.morphProgress = easeInOutCubic(state.phaseElapsedMs / morphMs);
      state.secondsUntilNext = Math.max(0, (morphMs - state.phaseElapsedMs) / 1000);
      const nextSym = order[state.targetIndex] ?? 'term';
      return {
        startedMorph: true,
        switchedEdgeSymbol: false,
        symbolChanged: true,
        activeSymbol: currentSym,
        targetSymbol: nextSym,
      };
    }

    state.secondsUntilNext = Math.max(0, (holdMs - state.phaseElapsedMs) / 1000);
    return {
      startedMorph: false,
      switchedEdgeSymbol: false,
      symbolChanged: wasStatic,
      activeSymbol: currentSym,
      targetSymbol: currentSym,
    };
  }

  // state.phase === 'MORPH'
  state.phaseElapsedMs += safeDtMs;
  if (state.phaseElapsedMs >= morphMs) {
    state.currentIndex = state.targetIndex;
    const landedSym = order[state.currentIndex] ?? 'term';
    state.phase = 'HOLD';
    state.phaseElapsedMs = 0;
    state.edgeFadeInElapsedMs = 0;
    state.edgeSymbol = landedSym;
    state.edgeAlpha = 0;
    state.morphProgress = 0;
    state.secondsUntilNext = holdMs / 1000;
    return {
      startedMorph: false,
      switchedEdgeSymbol: true,
      symbolChanged: true,
      activeSymbol: landedSym,
      targetSymbol: landedSym,
    };
  }

  state.edgeAlpha = Math.max(0, 1 - state.phaseElapsedMs / fadeOutMs);
  state.morphProgress = easeInOutCubic(state.phaseElapsedMs / morphMs);
  state.secondsUntilNext = Math.max(0, (morphMs - state.phaseElapsedMs) / 1000);
  return {
    startedMorph: false,
    switchedEdgeSymbol: false,
    symbolChanged: wasStatic,
    activeSymbol: currentSym,
    targetSymbol: targetSym,
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

export interface HeroShieldPlacement {
  /** World-space anchor X (same centre point as before) */
  anchorX: number;
  /** World-space anchor Y (same centre point as before) */
  anchorY: number;
  /** Desired height in CSS pixels before obstacle clearance scaling */
  targetHeightPx: number;
  /** Final rendered shield height in CSS pixels at hero depth (z = 0) */
  finalHeightPx: number;
  /** Uniform 3D scale applied to deltaGroup (scales width, height, and 3 z-layer offsets proportionally) */
  scale: number;
  /** Projected conservative screen-space envelope (including 3 z-layers and +/-15 deg sway) */
  screenBox: ScreenBoxRect;
}

/**
 * Projected outer envelope ratios relative to the shield's z = 0 CSS pixel height.
 * Outer shield is 84 x 108 in the 100 x 120 box (aspect 0.7778) with 3 z-layers at +/-0.15H,
 * +/-15 deg yaw sway, +/-3.4 deg tilt, and front-layer perspective magnification.
 */
const SHIELD_ENVELOPE_HALF_WIDTH_RATIO = 0.45;
const SHIELD_ENVELOPE_HALF_HEIGHT_RATIO = 0.54;

/**
 * Computes the hero shield's placement and uniform 3D scale at hero depth (z = 0):
 * - Keeps the exact same centre point / anchor per breakpoint as before.
 * - Desktop (>= 768px): targets SHIELD_HEIGHT_VH (42% vh), clamped to [260px, 480px].
 * - Mobile (< 768px): targets 30% of viewport height.
 * - Short windows: scales down if needed so it never overlaps the top nav bar or hero bottom line.
 * - Name clearance: scales down just enough so it always clears "VAIBHAV MARATHE" by >= 40px.
 */
export function computeHeroShieldPlacement(options: {
  viewportWidth: number;
  viewportHeight: number;
  fovDeg?: number;
  cameraZ?: number;
  nameRect?: ScreenBoxRect | null;
  opaqueContainerRect?: ScreenBoxRect | null;
  navBottomPx?: number;
  heroBottomLineTopPx?: number;
}): HeroShieldPlacement {
  const vw = Math.max(1, options.viewportWidth);
  const vh = Math.max(1, options.viewportHeight);
  const fovDeg = options.fovDeg ?? 45;
  const cameraZ = options.cameraZ ?? SITE_CONFIG.scroll.cameraStartZ;
  const cfg = SITE_CONFIG.shield;

  // Preserve the exact same centre point / anchor per breakpoint
  let anchorX: number;
  let anchorY: number;
  if (vw < 768) {
    anchorX = 0;
    anchorY = -0.78;
  } else if (vw < 1024) {
    anchorX = 1.88;
    anchorY = -0.05;
  } else if (vw < 1280) {
    anchorX = 2.18;
    anchorY = 0.02;
  } else {
    anchorX = 2.38;
    anchorY = 0.05;
  }

  const visibleWorldHeight = 2 * cameraZ * Math.tan((fovDeg * Math.PI) / 360);
  const pxPerWorld = vh / visibleWorldHeight;

  const centerPxX = vw * 0.5 + anchorX * pxPerWorld;
  const centerPxY = vh * 0.5 - anchorY * pxPerWorld;

  const isMobile = vw < 768;
  const targetHeightPx = isMobile
    ? vh * cfg.mobileHeightVh
    : Math.max(
        cfg.desktopMinHeightPx,
        Math.min(cfg.desktopMaxHeightPx, vh * cfg.SHIELD_HEIGHT_VH),
      );

  const vMargin = cfg.verticalClearanceMarginPx;
  const navBottom = options.navBottomPx ?? 56;
  const heroBottomTop = options.heroBottomLineTopPx ?? vh - 68;

  // Vertical fit between top nav bar and hero bottom line
  const maxHeightAboveCenter = Math.max(
    0,
    (centerPxY - (navBottom + vMargin)) / SHIELD_ENVELOPE_HALF_HEIGHT_RATIO,
  );
  const maxHeightBelowCenter = Math.max(
    0,
    (heroBottomTop - vMargin - centerPxY) / SHIELD_ENVELOPE_HALF_HEIGHT_RATIO,
  );
  let maxAllowedHeightPx = Math.min(maxHeightAboveCenter, maxHeightBelowCenter);

  // Horizontal viewport edge safety so the enlarged shield stays in frame
  const edgeMargin = 12;
  const maxHeightLeftEdge = Math.max(
    0,
    (centerPxX - edgeMargin) / SHIELD_ENVELOPE_HALF_WIDTH_RATIO,
  );
  const maxHeightRightEdge = Math.max(
    0,
    (vw - edgeMargin - centerPxX) / SHIELD_ENVELOPE_HALF_WIDTH_RATIO,
  );
  maxAllowedHeightPx = Math.min(
    maxAllowedHeightPx,
    maxHeightLeftEdge,
    maxHeightRightEdge,
  );

  const computeMaxHeightClearingRect = (
    rect: ScreenBoxRect,
    gapPx: number,
  ): number => {
    const forbLeft = rect.left - gapPx;
    const forbRight = rect.right + gapPx;
    const forbTop = rect.top - gapPx;
    const forbBottom = rect.bottom + gapPx;

    const hClearRight =
      centerPxX > forbRight
        ? (centerPxX - forbRight) / SHIELD_ENVELOPE_HALF_WIDTH_RATIO
        : 0;
    const hClearLeft =
      centerPxX < forbLeft
        ? (forbLeft - centerPxX) / SHIELD_ENVELOPE_HALF_WIDTH_RATIO
        : 0;
    const hClearBelow =
      centerPxY > forbBottom
        ? (centerPxY - forbBottom) / SHIELD_ENVELOPE_HALF_HEIGHT_RATIO
        : 0;
    const hClearAbove =
      centerPxY < forbTop
        ? (forbTop - centerPxY) / SHIELD_ENVELOPE_HALF_HEIGHT_RATIO
        : 0;

    return Math.max(hClearRight, hClearLeft, hClearBelow, hClearAbove);
  };

  // Enforce >= 40px clearance gap from "VAIBHAV MARATHE" at any viewport width
  if (
    options.nameRect &&
    options.nameRect.right > options.nameRect.left &&
    options.nameRect.bottom > options.nameRect.top
  ) {
    maxAllowedHeightPx = Math.min(
      maxAllowedHeightPx,
      computeMaxHeightClearingRect(options.nameRect, cfg.nameClearanceGapPx),
    );
  }

  // Also ensure the opaque hero text backing container never clips the shield's wireframe
  if (
    options.opaqueContainerRect &&
    options.opaqueContainerRect.right > options.opaqueContainerRect.left &&
    options.opaqueContainerRect.bottom > options.opaqueContainerRect.top
  ) {
    maxAllowedHeightPx = Math.min(
      maxAllowedHeightPx,
      computeMaxHeightClearingRect(options.opaqueContainerRect, 4),
    );
  }

  const finalHeightPx = Math.max(0, Math.min(targetHeightPx, maxAllowedHeightPx));
  const finalWorldHeight = (finalHeightPx / vh) * visibleWorldHeight;
  const scale = finalWorldHeight / Math.max(0.001, cfg.worldHeight);

  const halfW = finalHeightPx * SHIELD_ENVELOPE_HALF_WIDTH_RATIO;
  const halfH = finalHeightPx * SHIELD_ENVELOPE_HALF_HEIGHT_RATIO;

  return {
    anchorX,
    anchorY,
    targetHeightPx,
    finalHeightPx,
    scale,
    screenBox: {
      left: centerPxX - halfW,
      right: centerPxX + halfW,
      top: centerPxY - halfH,
      bottom: centerPxY + halfH,
    },
  };
}


