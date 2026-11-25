import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  SITE_CONFIG,
  type MorphStateName,
  type QualityTierName,
  type ShieldSymbolName,
  type ThemeMode,
} from './config';
import {
  buildPacketEdgeLoops,
  computeHashMorphProgress,
  computeHeroShieldPlacement,
  computeIdleMotionScale,
  computeMaxSymbolSegmentVertices,
  computeShapeEffectiveMaxOpacity,
  computeShapeScreenBoundingBox,
  computeTopologyNodePortScanIntensities,
  createSymbolCycleState,
  downgradeQualityTier,
  easeInOutCubic,
  generateAmbientDepthField,
  generateShieldNetwork,
  generateTopologyTargets,
  hexToRgbNormalized,
  isSaveDataEnabled,
  rasterizePairGlyphTargets,
  resolveMorphParticleCount,
  resolveQualityTierProfile,
  resolveStartingQualityTier,
  resolveStaticShieldSymbol,
  selectNonOverlappingLitLeafNodes,
  shouldDisableMorph,
  shouldDisableSymbolCycle,
  stepCriticallyDampedSpringBuffer,
  stepMorphStateMachine,
  stepSymbolCycleState,
  writeSymbolSegmentsBuffer,
  type GlyphPairTargetData,
  type PacketEdgeLoop,
  type QualityTierProfile,
  type ScreenBoxRect,
  type ScrollMetrics,
  type SymbolCycleState,
  type TopologyTargetData,
} from './particleMath';
import type { ScrollArrivalController } from './PortfolioSections';
import { getTheme, subscribeTheme } from './themeStore';

export interface SceneDebugStats {
  tier: QualityTierName;
  fps: number;
  particleCount: number;
  ambientParticleCount: number;
  pixelRatio: number;
  morphState: MorphStateName;
  morphParticleCount: number;
  clearAlpha: number;
  shieldSymbol: ShieldSymbolName;
  shieldSymbolNextSec: number | null;
  shieldSymbolPhase: 'HOLD' | 'MORPH' | 'STATIC';
}

export interface DeltaSceneProps {
  reducedMotion: boolean;
  /** Single source of truth for scroll progress, driven by Lenis (or native fallback in Plain/reducedMotion) */
  scrollMetricsRef: MutableRefObject<ScrollMetrics>;
  /** Shared arrival controller driven by IntersectionObserver (25%) + Lenis settled velocity */
  scrollArrivalRef?: MutableRefObject<ScrollArrivalController>;
  /** Optional callback for the `?debug=1` HUD overlay (updated twice per second and on state changes) */
  onDebugStatsChange?: (stats: SceneDebugStats) => void;
}

/**
 * Shared GLSL vertex math function injected into the Node, Edge, and Packet shaders.
 */
const SHARED_IDLE_SCROLL_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uScrollProgress;
  uniform float uIdleScale;
  uniform float uRotationPeriod;
  uniform float uRotAmpY;
  uniform float uTiltAmpX;
  uniform float uTiltAmpZ;
  uniform float uBreathAmp;

  vec3 computeBlendedPosition(vec3 basePos, vec3 drift, float phase) {
    float p = clamp(uScrollProgress, 0.0, 1.0);
    float smoothP = p * p * (3.0 - 2.0 * p);
    float depthP = pow(p, 1.25);

    // 1. Idle node breathing (fades to 0 as uIdleScale -> 0, or 0 on low tier)
    float breath = uBreathAmp * uIdleScale;
    vec3 localPos = basePos + vec3(
      sin(uTime * 1.3 + phase) * breath,
      cos(uTime * 1.1 + phase * 1.3) * breath,
      sin(uTime * 0.9 + phase * 0.7) * (breath * 0.6)
    );

    // 2. Continuous ~20s rotation around vertical Y axis with small X/Z tilt
    float omega = 6.28318530718 / max(0.001, uRotationPeriod);
    float angleY = sin(uTime * omega) * uRotAmpY * uIdleScale;
    float angleX = cos(uTime * omega) * uTiltAmpX * uIdleScale;
    float angleZ = sin(uTime * omega * 0.5) * uTiltAmpZ * uIdleScale;

    float cy = cos(angleY);
    float sy = sin(angleY);
    vec3 ry = vec3(
      localPos.x * cy + localPos.z * sy,
      localPos.y,
      -localPos.x * sy + localPos.z * cy
    );

    float cx = cos(angleX);
    float sx = sin(angleX);
    vec3 rx = vec3(
      ry.x,
      ry.y * cx - ry.z * sx,
      ry.y * sx + ry.z * cx
    );

    float cz = cos(angleZ);
    float sz = sin(angleZ);
    vec3 idlePos = vec3(
      rx.x * cz - rx.y * sz,
      rx.x * sz + rx.y * cz,
      rx.z
    );

    // 3. Scroll dispersion offset (0 at top of page; streams into -Z depth on scroll)
    float waveFactor = smoothP * 0.28 * step(0.0001, uIdleScale);
    float swirlX = sin(phase + uTime * 0.6 + p * 3.2) * waveFactor;
    float swirlY = cos(phase * 1.3 + uTime * 0.5 + p * 2.8) * waveFactor;

    return idlePos + vec3(
      drift.x * smoothP + swirlX,
      drift.y * smoothP + swirlY,
      drift.z * depthP
    );
  }
`;

interface MorphPoolRuntime {
  morphCount: number;
  curPos: Float32Array;
  vel: Float32Array;
  targetPos: Float32Array;
  ambientHomePos: Float32Array;
  curColors: Float32Array;
  posAttr: THREE.BufferAttribute;
  colorAttr: THREE.BufferAttribute;
  morphGeometry: THREE.BufferGeometry;
  morphMaterial: THREE.ShaderMaterial;
  morphPoints: THREE.Points;
  topoData: TopologyTargetData;
  topoEdgePos: Float32Array;
  topoEdgePosAttr: THREE.BufferAttribute;
  topoEdgeGeometry: THREE.BufferGeometry;
  topoEdgeMaterial: THREE.ShaderMaterial;
  topoEdgeLines: THREE.LineSegments;
  nodeCenterSums: Float32Array;
  glyphData: GlyphPairTargetData | null;
}

interface SymbolMorphRuntime {
  nodeTotalCount: number;
  unitScale: number;
  curPos: Float32Array;
  vel: Float32Array;
  morphStartPos: Float32Array;
  interpTarget: Float32Array;
  drifts: Float32Array;
  phases: Float32Array;
  targets: Record<ShieldSymbolName, Float32Array>;
  packetEdges: Record<ShieldSymbolName, Uint16Array>;
  posAttr: THREE.BufferAttribute;
  edgePosBuf: Float32Array;
  edgeDriftBuf: Float32Array;
  edgePhaseBuf: Float32Array;
  edgeAlphaBuf: Float32Array;
  edgePosAttr: THREE.BufferAttribute;
  edgeDriftAttr: THREE.BufferAttribute;
  edgePhaseAttr: THREE.BufferAttribute;
  edgeAlphaAttr: THREE.BufferAttribute;
  packetLoops: PacketEdgeLoop[];
  pktStartPos: Float32Array;
  pktEndPos: Float32Array;
  pktStartDrift: Float32Array;
  pktEndDrift: Float32Array;
  pktPhases: Float32Array;
  pktMeta: Float32Array;
  pktStartPosAttr: THREE.BufferAttribute;
  pktEndPosAttr: THREE.BufferAttribute;
  pktStartDriftAttr: THREE.BufferAttribute;
  pktEndDriftAttr: THREE.BufferAttribute;
  pktPhasesAttr: THREE.BufferAttribute;
  pktMetaAttr: THREE.BufferAttribute;
  symbolPacketCount: number;
  hopsPerLoop: number;
  trailSamplesPerPacket: number;
  isSettled: boolean;
  lastTargetSymbol: ShieldSymbolName;
  syncEdgeBuffer: (sym: ShieldSymbolName) => void;
  rebuildPackets: (sym: ShieldSymbolName) => void;
  refreshPacketEndpoints: () => void;
}

interface TierSceneMeshes {
  pointsGeometry: THREE.BufferGeometry;
  pointsMaterial: THREE.ShaderMaterial;
  pointsMesh: THREE.Points;
  symbolPointsGeometry: THREE.BufferGeometry;
  symbolPointsMesh: THREE.Points;
  lineGeometry: THREE.BufferGeometry;
  lineMaterial: THREE.ShaderMaterial;
  lineSegments: THREE.LineSegments;
  symbolLineGeometry: THREE.BufferGeometry;
  symbolLineMaterial: THREE.ShaderMaterial;
  symbolLineSegments: THREE.LineSegments;
  packetGeometry: THREE.BufferGeometry;
  packetMaterial: THREE.ShaderMaterial;
  packetPoints: THREE.Points;
  symbolPacketGeometry: THREE.BufferGeometry;
  symbolPacketMaterial: THREE.ShaderMaterial;
  symbolPacketPoints: THREE.Points;
  symbolRuntime: SymbolMorphRuntime;
  ambientGeometry: THREE.BufferGeometry;
  ambientMaterial: THREE.ShaderMaterial;
  ambientPoints: THREE.Points;
  morphPool: MorphPoolRuntime | null;
  dispose: () => void;
}

const MORPH_PLANE_DIST = SITE_CONFIG.scroll.cameraStartZ; // 7.6 units in front of camera

/**
 * Queries DOM text block bounding rects inside a given section ID for the runtime
 * readability overlap check. Called only on state entry / resize (never every frame).
 */
function measureSectionTextRects(
  sectionId: 'skills' | 'connect',
): { blockRects: ScreenBoxRect[]; rowRects: ScreenBoxRect[] } {
  if (typeof document === 'undefined') {
    return { blockRects: [], rowRects: [] };
  }
  const secEl = document.getElementById(sectionId);
  if (!secEl) {
    return { blockRects: [], rowRects: [] };
  }

  const blockRects: ScreenBoxRect[] = [];
  const rowRects: ScreenBoxRect[] = [];

  if (sectionId === 'connect') {
    // In Connect, the text lives in the left-aligned max-w-3xl container
    const cardEl = secEl.querySelector('.max-w-3xl') as HTMLElement | null;
    if (cardEl) {
      const r = cardEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        blockRects.push({
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        });
      }
    }
  } else {
    // In Skills, measure headings and list columns/rows
    const textEls = secEl.querySelectorAll('h2, h3, li, p');
    textEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const box = {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        };
        blockRects.push(box);
        rowRects.push(box);
      }
    });
  }

  return { blockRects, rowRects };
}

/**
 * Measures hero-top (scrollY = 0 invariant) DOM bounding boxes for the fixed top nav bar,
 * the hero name ("VAIBHAV MARATHE"), and the bottom border-t bar of #home.
 * Called only on mount / resize / fonts-ready (never per frame).
 */
function measureHeroClearanceBounds(): {
  nameRect: ScreenBoxRect | null;
  opaqueContainerRect: ScreenBoxRect | null;
  navBottomPx: number;
  heroBottomLineTopPx: number;
} {
  const vh = typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : 900;
  if (typeof document === 'undefined') {
    return {
      nameRect: null,
      opaqueContainerRect: null,
      navBottomPx: 56,
      heroBottomLineTopPx: vh - 68,
    };
  }

  const headerEl = document.querySelector('header') as HTMLElement | null;
  const navBottomPx = headerEl
    ? Math.max(0, headerEl.getBoundingClientRect().bottom)
    : 56;

  const homeEl = document.getElementById('home');
  const homeTop = homeEl ? homeEl.getBoundingClientRect().top : 0;

  let nameRect: ScreenBoxRect | null = null;
  let opaqueContainerRect: ScreenBoxRect | null = null;
  const titleEl = document.querySelector(
    '[data-testid="hero-main-title"]',
  ) as HTMLElement | null;
  if (titleEl) {
    // Measure actual rendered text glyphs of "VAIBHAV MARATHE" via Range (not empty block padding)
    let r = titleEl.getBoundingClientRect();
    try {
      const range = document.createRange();
      range.selectNodeContents(titleEl);
      const tight = range.getBoundingClientRect();
      if (tight.width > 0 && tight.height > 0) {
        r = tight;
      }
    } catch {
      // Fall back to element bounding rect if Range is unavailable
    }
    if (r.width > 0 && r.height > 0) {
      nameRect = {
        left: r.left,
        right: r.right,
        top: r.top - homeTop,
        bottom: r.bottom - homeTop,
      };
    }

    const parentEl = titleEl.parentElement;
    if (parentEl) {
      const pr = parentEl.getBoundingClientRect();
      if (pr.width > 0 && pr.height > 0) {
        opaqueContainerRect = {
          left: pr.left,
          right: pr.right,
          top: pr.top - homeTop,
          bottom: pr.bottom - homeTop,
        };
      }
    }
  }

  let heroBottomLineTopPx = vh - 68;
  const bottomBarEl = homeEl?.lastElementChild as HTMLElement | null;
  if (bottomBarEl) {
    const br = bottomBarEl.getBoundingClientRect();
    if (br.height > 0) {
      heroBottomLineTopPx = br.top - homeTop;
    }
  }

  return {
    nameRect,
    opaqueContainerRect,
    navBottomPx,
    heroBottomLineTopPx,
  };
}

/**
 * DeltaScene
 * ----------
 * Renders:
 * 1. The hero Δ lattice, connecting lines, and 4–6 travelling cyan packets on the GPU.
 * 2. A scroll-driven camera that glides forward into `-Z` depth across all 6 sections
 *    and reverses smoothly when scrolling back up.
 * 3. A sparse, low-opacity ambient particle field in the deeper `-Z` corridor for
 *    Sections 2–6 (Background through Connect) that never competes with text.
 * 4. A section-arrival particle morph system (`HERO`, `AMBIENT`, `TOPOLOGY`, `DOLLAR`, `HASH`)
 *    where the shared particle pool regroups into a hub-and-spoke network topology at `Skills`
 *    (with 3 sequential cyan port-scan leaf highlights) and a `"$"` -> `"#"` privilege
 *    escalation glyph morph (cyan `#4FD1D9` to rare amber `#E8A33D`) at `Connect`.
 * 5. Adaptive quality tiers (`high` / `medium` / `low`) with 2-second FPS monitoring,
 *    debounced resize handling, visibility pause, and full GPU resource disposal.
 */
export function DeltaScene({
  reducedMotion,
  scrollMetricsRef,
  scrollArrivalRef,
  onDebugStatsChange,
}: DeltaSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const debugCallbackRef = useRef<typeof onDebugStatsChange>(onDebugStatsChange);
  const symbolCycleRef = useRef<SymbolCycleState>(
    createSymbolCycleState({
      plainView: false,
      prefersReducedMotion: reducedMotion,
      qualityTier: 'high',
      saveData: isSaveDataEnabled(),
    }),
  );

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    debugCallbackRef.current = onDebugStatsChange;
  }, [onDebugStatsChange]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Ensure container has no leftover canvas elements before mounting
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const navWithMem = navigator as Navigator & { deviceMemory?: number };
    const startingTier = resolveStartingQualityTier({
      viewportWidth: window.innerWidth,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navWithMem.deviceMemory,
    });

    let currentProfile: QualityTierProfile = resolveQualityTierProfile({
      tier: startingTier,
      viewportWidth: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
    });

    const saveData = isSaveDataEnabled();
    const isMorphCurrentlyDisabled = () =>
      shouldDisableMorph({
        plainView: false,
        prefersReducedMotion: reducedMotionRef.current,
        qualityTier: currentProfile.tier,
        saveData,
        viewportWidth: window.innerWidth,
      });

    symbolCycleRef.current = createSymbolCycleState({
      plainView: false,
      prefersReducedMotion: reducedMotionRef.current,
      qualityTier: currentProfile.tier,
      saveData,
    });

    const initialThemeMode: ThemeMode = getTheme();
    const buildPaletteForTheme = (mode: ThemeMode) => {
      const t = SITE_CONFIG.theme.themes[mode];
      return {
        mode,
        clearColorHex: t.background,
        clearRgb: hexToRgbNormalized(t.background),
        nodeBaseRgb: hexToRgbNormalized(t.sceneNodeColor),
        mutedNodeRgb: hexToRgbNormalized(t.textMuted),
        ambientBaseRgb:
          mode === 'light'
            ? hexToRgbNormalized(t.sceneNodeColor)
            : hexToRgbNormalized(t.textMuted),
        accentRgb: hexToRgbNormalized(t.sceneHighlightColor),
        amberRgb: hexToRgbNormalized(t.sceneAmberColor),
        lineRgb: hexToRgbNormalized(t.sceneLineColor),
        lineBaseAlpha: t.sceneLineAlpha as number,
        pointSizeScale: t.scenePointSizeScale as number,
        packetCoreRgb:
          mode === 'light'
            ? hexToRgbNormalized(t.sceneHighlightColor)
            : ([0.92, 0.99, 1.0] as [number, number, number]),
        useNormalBlending: !t.scenePacketAdditiveBlending,
      };
    };

    const PALETTES = {
      dark: buildPaletteForTheme('dark'),
      light: buildPaletteForTheme('light'),
    };

    let currentThemeMode: ThemeMode = initialThemeMode;
    const initPal = PALETTES[initialThemeMode];

    // Mutable current RGB tuples used by CPU morph particle colours and GPU uniforms
    const ivoryRgb: [number, number, number] = [
      initPal.nodeBaseRgb[0],
      initPal.nodeBaseRgb[1],
      initPal.nodeBaseRgb[2],
    ];
    const cyanRgb: [number, number, number] = [
      initPal.accentRgb[0],
      initPal.accentRgb[1],
      initPal.accentRgb[2],
    ];
    const amberRgb: [number, number, number] = [
      initPal.amberRgb[0],
      initPal.amberRgb[1],
      initPal.amberRgb[2],
    ];

    // 1. Scene (transparent background so page background comes solely from CSS var(--bg))
    const scene = new THREE.Scene();
    scene.background = null;

    // 2. Camera (starts at cameraStartZ and moves forward into -Z as the user scrolls through sections)
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      70,
    );
    camera.position.set(0, 0, SITE_CONFIG.scroll.cameraStartZ);

    // 3. Renderer (transparent alpha: true, clearAlpha 0, pixel ratio capped by tier)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: currentProfile.tier !== 'low',
        powerPreference: 'high-performance',
        alpha: true,
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(currentProfile.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const deltaGroup = new THREE.Group();
    scene.add(deltaGroup);

    // Camera-anchored group for morph shapes so `(anchorX, anchorY)` in viewport fractions
    // stays locked to the viewport plane `MORPH_PLANE_DIST` in front of the camera.
    const cameraAnchorGroup = new THREE.Group();
    cameraAnchorGroup.position.set(0, 0, camera.position.z);
    scene.add(cameraAnchorGroup);

    const sharedUniforms = {
      uTime: { value: 0 },
      uScrollProgress: { value: 0 },
      uIdleScale: { value: reducedMotionRef.current || !currentProfile.idleMotion ? 0 : 1 },
      uRotationPeriod: { value: SITE_CONFIG.idle.rotationPeriodSec },
      uRotAmpY: { value: SITE_CONFIG.idle.rotationAmplitudeY },
      uTiltAmpX: { value: SITE_CONFIG.idle.tiltAmplitudeX },
      uTiltAmpZ: { value: SITE_CONFIG.idle.tiltAmplitudeZ },
      uBreathAmp: { value: SITE_CONFIG.idle.nodeBreathingAmplitude },
      uPixelRatio: { value: currentProfile.pixelRatio },
      uViewportHeight: { value: window.innerHeight },
      uEnableScanPulse: { value: SITE_CONFIG.idle.enableScanPulse ? 1.0 : 0.0 },
      uScanPulsePeriod: { value: SITE_CONFIG.idle.scanPulsePeriodSec },
      uScanPulseIntensity: { value: SITE_CONFIG.idle.scanPulseIntensity },
      uNodeBaseColor: {
        value: new THREE.Vector3(
          initPal.nodeBaseRgb[0],
          initPal.nodeBaseRgb[1],
          initPal.nodeBaseRgb[2],
        ),
      },
      uShieldNodeColor: {
        value: new THREE.Vector3(
          initPal.mutedNodeRgb[0],
          initPal.mutedNodeRgb[1],
          initPal.mutedNodeRgb[2],
        ),
      },
      uAmbientBaseColor: {
        value: new THREE.Vector3(
          initPal.ambientBaseRgb[0],
          initPal.ambientBaseRgb[1],
          initPal.ambientBaseRgb[2],
        ),
      },
      uAccentColor: {
        value: new THREE.Vector3(
          initPal.accentRgb[0],
          initPal.accentRgb[1],
          initPal.accentRgb[2],
        ),
      },
      uLineColor: {
        value: new THREE.Vector3(
          initPal.lineRgb[0],
          initPal.lineRgb[1],
          initPal.lineRgb[2],
        ),
      },
      uLineBaseAlpha: { value: initPal.lineBaseAlpha },
      uPacketCoreColor: {
        value: new THREE.Vector3(
          initPal.packetCoreRgb[0],
          initPal.packetCoreRgb[1],
          initPal.packetCoreRgb[2],
        ),
      },
      uThemePointSizeScale: { value: initPal.pointSizeScale },
      uAmbientVisibility: { value: 0 },
      uMorphDim: { value: 1.0 },
      uMaxNodePointSizePx: { value: SITE_CONFIG.performance.maxNodePointSizePx },
      uMaxAmbientPointSizePx: { value: SITE_CONFIG.performance.maxAmbientPointSizePx },
      uMaxNearCameraAlpha: { value: SITE_CONFIG.performance.maxNearCameraAlpha },
      uShieldVisualScale: { value: SITE_CONFIG.shield.visualScaleFactor },
      uHeroSizeTrim: { value: 1.0 },
      uHeroAlphaTrim: { value: 1.0 },
      uSymbolEdgeAlpha: { value: 1.0 },
      uSymbolPacketTime: { value: 0.0 },
    };

    let isDisposed = false;

    const buildTierMeshes = (profile: QualityTierProfile): TierSceneMeshes => {
      const cycleState = symbolCycleRef.current;
      const startSymbol: ShieldSymbolName = shouldDisableSymbolCycle({
        plainView: false,
        prefersReducedMotion: reducedMotionRef.current,
        qualityTier: profile.tier,
        saveData,
      })
        ? resolveStaticShieldSymbol({
            plainView: false,
            prefersReducedMotion: reducedMotionRef.current,
            qualityTier: profile.tier,
            saveData,
          })
        : cycleState.edgeSymbol;

      const network = generateShieldNetwork(profile.particleCount, startSymbol, 42);

      // --- A1. SHIELD NODES (muted colour, static during symbol cycling) ---
      const shieldDotCount = network.shieldOnlyPhases.length;
      const shieldIsSymbolAttr = new Float32Array(shieldDotCount); // all 0

      const pointsGeometry = new THREE.BufferGeometry();
      pointsGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(network.shieldOnlyPositions, 3),
      );
      pointsGeometry.setAttribute(
        'aDrift',
        new THREE.BufferAttribute(network.shieldOnlyDrifts, 3),
      );
      pointsGeometry.setAttribute(
        'aPhase',
        new THREE.BufferAttribute(network.shieldOnlyPhases, 1),
      );
      pointsGeometry.setAttribute(
        'aIsSymbol',
        new THREE.BufferAttribute(shieldIsSymbolAttr, 1),
      );

      const baseNodeSize = profile.isMobile ? 0.09 : 0.082;
      const pointsMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedUniforms,
          uBasePointSize: { value: baseNodeSize },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aDrift;
          attribute float aPhase;
          attribute float aIsSymbol;

          uniform float uBasePointSize;
          uniform float uThemePointSizeScale;
          uniform float uPixelRatio;
          uniform float uViewportHeight;
          uniform float uEnableScanPulse;
          uniform float uScanPulsePeriod;
          uniform float uScanPulseIntensity;
          uniform float uMaxNodePointSizePx;
          uniform float uMorphDim;
          uniform float uShieldVisualScale;
          uniform float uHeroSizeTrim;
          uniform vec3 uShieldNodeColor;
          uniform vec3 uAccentColor;

          varying vec3 vColor;
          varying float vDepthAlpha;
          varying float vIsSymbol;

          ${SHARED_IDLE_SCROLL_GLSL}

          void main() {
            vec3 blendedPos = computeBlendedPosition(position, aDrift, aPhase);
            vec4 mvPosition = modelViewMatrix * vec4(blendedPos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float viewZ = -mvPosition.z;
            float dist = max(1.4, viewZ);
            // Smoothly fade out any particle approaching the camera so no large soft discs appear
            float nearFade = smoothstep(1.4, 3.4, viewZ);
            float pulseBoost = 0.0;

            if (uEnableScanPulse > 0.5 && uIdleScale > 0.01) {
              float scanPhase = fract(uTime / max(0.1, uScanPulsePeriod));
              float scanY = mix(1.0, -1.0, scanPhase);
              float band = smoothstep(0.35, 0.0, abs(position.y - scanY));
              pulseBoost = band * uScanPulseIntensity * uIdleScale;
            }

            float nodeScale = uShieldVisualScale * uHeroSizeTrim;
            float rawSize = (uBasePointSize * nodeScale * uThemePointSizeScale * (1.0 + pulseBoost * 0.35) * uViewportHeight * 0.55 * uPixelRatio) / dist;
            gl_PointSize = clamp(rawSize, 1.5 * uPixelRatio, uMaxNodePointSizePx * nodeScale * uThemePointSizeScale * uPixelRatio);

            vec3 baseNodeCol = mix(uShieldNodeColor, uAccentColor, aIsSymbol);
            vColor = mix(baseNodeCol, uAccentColor, clamp(pulseBoost, 0.0, 1.0));
            vIsSymbol = aIsSymbol;
            float fogDist = length(mvPosition.xyz);
            // Dim dispersed hero particles so they never pass behind body text at high brightness
            float scrollDim = mix(1.0, 0.22, clamp(uScrollProgress, 0.0, 1.0));
            vDepthAlpha = clamp(exp(-0.0045 * fogDist * fogDist), 0.0, 1.0) * nearFade * scrollDim * uMorphDim;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uMaxNearCameraAlpha;
          uniform float uHeroAlphaTrim;
          varying vec3 vColor;
          varying float vDepthAlpha;
          varying float vIsSymbol;

          void main() {
            if (vDepthAlpha < 0.01) discard;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r2 = dot(cxy, cxy);
            if (r2 > 1.0) discard;
            float softEdge = smoothstep(1.0, 0.3, r2);
            float maxCap = mix(uMaxNearCameraAlpha, 0.92, vIsSymbol);
            float alpha = min(maxCap, 0.90 * softEdge * vDepthAlpha) * uHeroAlphaTrim;
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
      });

      const pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);
      pointsMesh.frustumCulled = false;
      deltaGroup.add(pointsMesh);

      // --- A2. INTERIOR SYMBOL NODES (48 per z-layer x 3 z-layers = 144 nodes, accent colour, morph together) ---
      const symNodeTotal = network.symbolNodeTotalCount;
      const symbolCurPos = new Float32Array(network.symbolNodeBasePositions);
      const symbolVel = new Float32Array(symNodeTotal * 3);
      const symbolMorphStartPos = new Float32Array(network.symbolNodeBasePositions);
      const symbolInterpTarget = new Float32Array(network.symbolNodeBasePositions);
      const symbolIsSymbolAttr = new Float32Array(symNodeTotal);
      symbolIsSymbolAttr.fill(1.0);

      const symbolPointsGeometry = new THREE.BufferGeometry();
      const symbolPosAttr = new THREE.BufferAttribute(symbolCurPos, 3);
      symbolPosAttr.setUsage(THREE.DynamicDrawUsage);
      symbolPointsGeometry.setAttribute('position', symbolPosAttr);
      symbolPointsGeometry.setAttribute(
        'aDrift',
        new THREE.BufferAttribute(network.symbolNodeDriftVectors, 3),
      );
      symbolPointsGeometry.setAttribute(
        'aPhase',
        new THREE.BufferAttribute(network.symbolNodePhases, 1),
      );
      symbolPointsGeometry.setAttribute(
        'aIsSymbol',
        new THREE.BufferAttribute(symbolIsSymbolAttr, 1),
      );

      const symbolPointsMesh = new THREE.Points(symbolPointsGeometry, pointsMaterial);
      symbolPointsMesh.frustumCulled = false;
      deltaGroup.add(symbolPointsMesh);

      // --- B1. SHIELD WIREFRAME EDGES (thin low-alpha line style across 3 z-layers, scaled ~1.25x for larger shield) ---
      const shieldEdgeCount = network.wireframeShieldEdgeIndices.length / 2;
      const shieldUnitScale = SITE_CONFIG.shield.worldHeight / 108;
      const frontTwinOffsetWorld = 0.075 * shieldUnitScale;

      const edgePosList: number[] = [];
      const edgeDriftList: number[] = [];
      const edgePhaseList: number[] = [];
      const edgeAlphaList: number[] = [];

      const pushShieldEdgeSegment = (
        a3: number,
        b3: number,
        idxA: number,
        idxB: number,
        alphaW: number,
        offX = 0,
        offY = 0,
      ) => {
        edgePosList.push(
          network.wireframeBasePositions[a3] + offX,
          network.wireframeBasePositions[a3 + 1] + offY,
          network.wireframeBasePositions[a3 + 2],
          network.wireframeBasePositions[b3] + offX,
          network.wireframeBasePositions[b3 + 1] + offY,
          network.wireframeBasePositions[b3 + 2],
        );
        edgeDriftList.push(
          network.wireframeDriftVectors[a3],
          network.wireframeDriftVectors[a3 + 1],
          network.wireframeDriftVectors[a3 + 2],
          network.wireframeDriftVectors[b3],
          network.wireframeDriftVectors[b3 + 1],
          network.wireframeDriftVectors[b3 + 2],
        );
        edgePhaseList.push(network.wireframePhases[idxA], network.wireframePhases[idxB]);
        edgeAlphaList.push(alphaW, alphaW);
      };

      for (let e = 0; e < shieldEdgeCount; e++) {
        const idxA = network.wireframeShieldEdgeIndices[e * 2];
        const idxB = network.wireframeShieldEdgeIndices[e * 2 + 1];

        const a3 = idxA * 3;
        const b3 = idxB * 3;
        const az = network.wireframeBasePositions[a3 + 2];
        const bz = network.wireframeBasePositions[b3 + 2];
        const w = network.wireframeShieldEdgeAlpha[e] ?? 1.0;

        // Front in-plane shield outline & radial edges get a tight sub-pixel twin strand (~1.25x visual thickness)
        if (az > 0.01 && bz > 0.01) {
          const ax = network.wireframeBasePositions[a3];
          const ay = network.wireframeBasePositions[a3 + 1];
          const bx = network.wireframeBasePositions[b3];
          const by = network.wireframeBasePositions[b3 + 1];
          const segLen = Math.hypot(bx - ax, by - ay) || 1;
          const nx = (-(by - ay) / segLen) * frontTwinOffsetWorld;
          const ny = ((bx - ax) / segLen) * frontTwinOffsetWorld;
          const twinAlpha = w * 0.72;
          pushShieldEdgeSegment(a3, b3, idxA, idxB, twinAlpha, -nx, -ny);
          pushShieldEdgeSegment(a3, b3, idxA, idxB, twinAlpha, nx, ny);
        } else {
          pushShieldEdgeSegment(a3, b3, idxA, idxB, w);
        }
      }

      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(edgePosList), 3),
      );
      lineGeometry.setAttribute(
        'aDrift',
        new THREE.BufferAttribute(new Float32Array(edgeDriftList), 3),
      );
      lineGeometry.setAttribute(
        'aPhase',
        new THREE.BufferAttribute(new Float32Array(edgePhaseList), 1),
      );
      lineGeometry.setAttribute(
        'aEdgeAlpha',
        new THREE.BufferAttribute(new Float32Array(edgeAlphaList), 1),
      );

      const lineMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedUniforms,
        },
        vertexShader: /* glsl */ `
          attribute vec3 aDrift;
          attribute float aPhase;
          attribute float aEdgeAlpha;
          uniform float uMorphDim;
          uniform float uLineBaseAlpha;
          uniform float uShieldVisualScale;
          uniform float uHeroAlphaTrim;

          varying float vLineAlpha;

          ${SHARED_IDLE_SCROLL_GLSL}

          void main() {
            vec3 blendedPos = computeBlendedPosition(position, aDrift, aPhase);
            vec4 mvPosition = modelViewMatrix * vec4(blendedPos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float p = clamp(uScrollProgress, 0.0, 1.0);
            float smoothP = p * p * (3.0 - 2.0 * p);
            vLineAlpha = min(0.55, uLineBaseAlpha * uShieldVisualScale * aEdgeAlpha) * pow(1.0 - smoothP, 2.2) * uMorphDim * uHeroAlphaTrim;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uLineColor;
          varying float vLineAlpha;

          void main() {
            if (vLineAlpha < 0.005) discard;
            gl_FragColor = vec4(uLineColor, vLineAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
      });

      const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
      lineSegments.frustumCulled = false;
      deltaGroup.add(lineSegments);

      // --- B2. INTERIOR SYMBOL EDGES (pre-allocated dynamic buffer, fades out/in cleanly on morph) ---
      const maxSymVerts = computeMaxSymbolSegmentVertices();
      const edgePosBuf = new Float32Array(maxSymVerts * 3);
      const edgeDriftBuf = new Float32Array(maxSymVerts * 3);
      const edgePhaseBuf = new Float32Array(maxSymVerts);
      const edgeAlphaBuf = new Float32Array(maxSymVerts);

      const edgePosAttr = new THREE.BufferAttribute(edgePosBuf, 3);
      edgePosAttr.setUsage(THREE.DynamicDrawUsage);
      const edgeDriftAttr = new THREE.BufferAttribute(edgeDriftBuf, 3);
      edgeDriftAttr.setUsage(THREE.DynamicDrawUsage);
      const edgePhaseAttr = new THREE.BufferAttribute(edgePhaseBuf, 1);
      edgePhaseAttr.setUsage(THREE.DynamicDrawUsage);
      const edgeAlphaAttr = new THREE.BufferAttribute(edgeAlphaBuf, 1);
      edgeAlphaAttr.setUsage(THREE.DynamicDrawUsage);

      const symbolLineGeometry = new THREE.BufferGeometry();
      symbolLineGeometry.setAttribute('position', edgePosAttr);
      symbolLineGeometry.setAttribute('aDrift', edgeDriftAttr);
      symbolLineGeometry.setAttribute('aPhase', edgePhaseAttr);
      symbolLineGeometry.setAttribute('aEdgeAlpha', edgeAlphaAttr);

      const syncEdgeBuffer = (sym: ShieldSymbolName) => {
        const vertCount = writeSymbolSegmentsBuffer({
          symbol: sym,
          symbolPositions: symbolCurPos,
          symbolDrifts: network.symbolNodeDriftVectors,
          symbolPhases: network.symbolNodePhases,
          unitScale: network.unitScale,
          outPositions: edgePosBuf,
          outDrifts: edgeDriftBuf,
          outPhases: edgePhaseBuf,
          outAlphas: edgeAlphaBuf,
        });
        symbolLineGeometry.setDrawRange(0, vertCount);
        edgePosAttr.needsUpdate = true;
        edgeDriftAttr.needsUpdate = true;
        edgePhaseAttr.needsUpdate = true;
        edgeAlphaAttr.needsUpdate = true;
      };
      syncEdgeBuffer(startSymbol);

      const symbolLineMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedUniforms,
        },
        vertexShader: /* glsl */ `
          attribute vec3 aDrift;
          attribute float aPhase;
          attribute float aEdgeAlpha;
          uniform float uMorphDim;
          uniform float uSymbolEdgeAlpha;
          uniform float uHeroAlphaTrim;

          varying float vLineAlpha;

          ${SHARED_IDLE_SCROLL_GLSL}

          void main() {
            vec3 blendedPos = computeBlendedPosition(position, aDrift, aPhase);
            vec4 mvPosition = modelViewMatrix * vec4(blendedPos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float p = clamp(uScrollProgress, 0.0, 1.0);
            float smoothP = p * p * (3.0 - 2.0 * p);
            vLineAlpha = aEdgeAlpha * uSymbolEdgeAlpha * pow(1.0 - smoothP, 2.2) * uMorphDim * uHeroAlphaTrim;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uAccentColor;
          varying float vLineAlpha;

          void main() {
            if (vLineAlpha < 0.005) discard;
            gl_FragColor = vec4(uAccentColor, vLineAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
      });

      const symbolLineSegments = new THREE.LineSegments(
        symbolLineGeometry,
        symbolLineMaterial,
      );
      symbolLineSegments.frustumCulled = false;
      deltaGroup.add(symbolLineSegments);

      // --- C1. TRAVELLING SHIELD EDGE PACKETS (continue uninterrupted throughout symbol morphs) ---
      const wfNodeCount = network.wireframePhases.length;
      const shieldPacketCount = Math.max(3, SITE_CONFIG.idle.packetCount - 2);
      const symbolPacketCount = Math.max(1, SITE_CONFIG.idle.packetCount - shieldPacketCount);
      const hopsPerLoop = SITE_CONFIG.idle.packetPathHops;
      const trailSamplesPerPacket = 6;

      const shieldPacketLoops = buildPacketEdgeLoops(
        network.wireframeShieldPacketEdges,
        wfNodeCount,
        shieldPacketCount,
        hopsPerLoop,
        1337,
      );
      const totalPacketVertices = shieldPacketLoops.length * hopsPerLoop * trailSamplesPerPacket;

      const pktStartPos = new Float32Array(totalPacketVertices * 3);
      const pktEndPos = new Float32Array(totalPacketVertices * 3);
      const pktStartDrift = new Float32Array(totalPacketVertices * 3);
      const pktEndDrift = new Float32Array(totalPacketVertices * 3);
      const pktPhases = new Float32Array(totalPacketVertices * 2);
      const pktMeta = new Float32Array(totalPacketVertices * 3);

      let vCursor = 0;
      for (let pIdx = 0; pIdx < shieldPacketLoops.length; pIdx++) {
        const loop = shieldPacketLoops[pIdx];
        for (let h = 0; h < hopsPerLoop; h++) {
          const nodeA = loop.hopNodePairs[h * 2];
          const nodeB = loop.hopNodePairs[h * 2 + 1];
          const a3 = nodeA * 3;
          const b3 = nodeB * 3;

          for (let tSample = 0; tSample < trailSamplesPerPacket; tSample++) {
            const v3 = vCursor * 3;
            const v2 = vCursor * 2;
            const trailFrac = tSample / Math.max(1, trailSamplesPerPacket - 1);

            pktStartPos[v3] = network.wireframeBasePositions[a3];
            pktStartPos[v3 + 1] = network.wireframeBasePositions[a3 + 1];
            pktStartPos[v3 + 2] = network.wireframeBasePositions[a3 + 2];

            pktEndPos[v3] = network.wireframeBasePositions[b3];
            pktEndPos[v3 + 1] = network.wireframeBasePositions[b3 + 1];
            pktEndPos[v3 + 2] = network.wireframeBasePositions[b3 + 2];

            pktStartDrift[v3] = network.wireframeDriftVectors[a3];
            pktStartDrift[v3 + 1] = network.wireframeDriftVectors[a3 + 1];
            pktStartDrift[v3 + 2] = network.wireframeDriftVectors[a3 + 2];

            pktEndDrift[v3] = network.wireframeDriftVectors[b3];
            pktEndDrift[v3 + 1] = network.wireframeDriftVectors[b3 + 1];
            pktEndDrift[v3 + 2] = network.wireframeDriftVectors[b3 + 2];

            pktPhases[v2] = network.wireframePhases[nodeA];
            pktPhases[v2 + 1] = network.wireframePhases[nodeB];

            pktMeta[v3] = h;
            pktMeta[v3 + 1] = trailFrac;
            pktMeta[v3 + 2] = loop.staggerOffset;

            vCursor++;
          }
        }
      }

      const packetGeometry = new THREE.BufferGeometry();
      packetGeometry.setAttribute('position', new THREE.BufferAttribute(pktStartPos, 3));
      packetGeometry.setAttribute('aEndPos', new THREE.BufferAttribute(pktEndPos, 3));
      packetGeometry.setAttribute('aDrift', new THREE.BufferAttribute(pktStartDrift, 3));
      packetGeometry.setAttribute('aEndDrift', new THREE.BufferAttribute(pktEndDrift, 3));
      packetGeometry.setAttribute('aPhases', new THREE.BufferAttribute(pktPhases, 2));
      packetGeometry.setAttribute('aPacketMeta', new THREE.BufferAttribute(pktMeta, 3));

      const packetMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedUniforms,
          uHopsPerLoop: { value: hopsPerLoop },
          uPacketSpeed: { value: SITE_CONFIG.idle.packetSpeedHopsPerSec },
          uPacketTailLen: { value: SITE_CONFIG.idle.packetTailLength },
          uPacketSize: { value: SITE_CONFIG.idle.packetSize },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aEndPos;
          attribute vec3 aDrift;
          attribute vec3 aEndDrift;
          attribute vec2 aPhases;
          attribute vec3 aPacketMeta;

          uniform float uHopsPerLoop;
          uniform float uPacketSpeed;
          uniform float uPacketTailLen;
          uniform float uPacketSize;
          uniform float uThemePointSizeScale;
          uniform float uPixelRatio;
          uniform float uViewportHeight;
          uniform float uMaxNodePointSizePx;
          uniform float uMorphDim;
          uniform float uShieldVisualScale;
          uniform float uHeroSizeTrim;

          varying float vPacketAlpha;

          ${SHARED_IDLE_SCROLL_GLSL}

          void main() {
            float hopIdx = aPacketMeta.x;
            float trailFrac = aPacketMeta.y;
            float stagger = aPacketMeta.z;

            float rawLoopPos = uTime * uPacketSpeed + stagger * uHopsPerLoop - trailFrac * uPacketTailLen;
            float loopPos = mod(rawLoopPos, uHopsPerLoop);
            float activeHop = floor(loopPos);

            if (abs(hopIdx - activeHop) > 0.25 || uIdleScale < 0.01) {
              vPacketAlpha = 0.0;
              gl_PointSize = 0.0;
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
              return;
            }

            float edgeT = fract(loopPos);
            vec3 startWorld = computeBlendedPosition(position, aDrift, aPhases.x);
            vec3 endWorld = computeBlendedPosition(aEndPos, aEndDrift, aPhases.y);
            vec3 packetWorld = mix(startWorld, endWorld, edgeT);

            vec4 mvPosition = modelViewMatrix * vec4(packetWorld, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float dist = max(1.4, -mvPosition.z);
            float sizeFalloff = mix(1.0, 0.48, trailFrac);
            float pktScale = uShieldVisualScale * uHeroSizeTrim;
            float rawPktSize = (uPacketSize * pktScale * uThemePointSizeScale * sizeFalloff * uViewportHeight * 0.55 * uPixelRatio) / dist;
            gl_PointSize = clamp(rawPktSize, 1.5 * uPixelRatio, uMaxNodePointSizePx * pktScale * uThemePointSizeScale * uPixelRatio);

            vPacketAlpha = (1.0 - trailFrac * 0.82) * uIdleScale * uMorphDim;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uAccentColor;
          uniform vec3 uPacketCoreColor;
          varying float vPacketAlpha;

          void main() {
            if (vPacketAlpha < 0.01) discard;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r2 = dot(cxy, cxy);
            if (r2 > 1.0) discard;

            float core = smoothstep(0.45, 0.0, r2);
            float halo = smoothstep(1.0, 0.2, r2);
            vec3 pulseColor = mix(uAccentColor, uPacketCoreColor, core * 0.65);
            gl_FragColor = vec4(pulseColor, halo * vPacketAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: PALETTES[currentThemeMode].useNormalBlending
          ? THREE.NormalBlending
          : THREE.AdditiveBlending,
      });

      const packetPoints = new THREE.Points(packetGeometry, packetMaterial);
      packetPoints.frustumCulled = false;
      packetPoints.visible = profile.idleMotion;
      deltaGroup.add(packetPoints);

      // --- C2. TRAVELLING SYMBOL EDGE PACKETS (fade out over 250ms, pause while faded, switch on settle) ---
      const symPktTotalVerts = symbolPacketCount * hopsPerLoop * trailSamplesPerPacket;
      const symPktStartPos = new Float32Array(symPktTotalVerts * 3);
      const symPktEndPos = new Float32Array(symPktTotalVerts * 3);
      const symPktStartDrift = new Float32Array(symPktTotalVerts * 3);
      const symPktEndDrift = new Float32Array(symPktTotalVerts * 3);
      const symPktPhases = new Float32Array(symPktTotalVerts * 2);
      const symPktMeta = new Float32Array(symPktTotalVerts * 3);

      const symPktStartPosAttr = new THREE.BufferAttribute(symPktStartPos, 3);
      symPktStartPosAttr.setUsage(THREE.DynamicDrawUsage);
      const symPktEndPosAttr = new THREE.BufferAttribute(symPktEndPos, 3);
      symPktEndPosAttr.setUsage(THREE.DynamicDrawUsage);
      const symPktStartDriftAttr = new THREE.BufferAttribute(symPktStartDrift, 3);
      symPktStartDriftAttr.setUsage(THREE.DynamicDrawUsage);
      const symPktEndDriftAttr = new THREE.BufferAttribute(symPktEndDrift, 3);
      symPktEndDriftAttr.setUsage(THREE.DynamicDrawUsage);
      const symPktPhasesAttr = new THREE.BufferAttribute(symPktPhases, 2);
      symPktPhasesAttr.setUsage(THREE.DynamicDrawUsage);
      const symPktMetaAttr = new THREE.BufferAttribute(symPktMeta, 3);
      symPktMetaAttr.setUsage(THREE.DynamicDrawUsage);

      const symbolPacketGeometry = new THREE.BufferGeometry();
      symbolPacketGeometry.setAttribute('position', symPktStartPosAttr);
      symbolPacketGeometry.setAttribute('aEndPos', symPktEndPosAttr);
      symbolPacketGeometry.setAttribute('aDrift', symPktStartDriftAttr);
      symbolPacketGeometry.setAttribute('aEndDrift', symPktEndDriftAttr);
      symbolPacketGeometry.setAttribute('aPhases', symPktPhasesAttr);
      symbolPacketGeometry.setAttribute('aPacketMeta', symPktMetaAttr);

      let currentSymPacketLoops: PacketEdgeLoop[] = [];
      const symbolPacketSeeds: Record<ShieldSymbolName, number> = {
        term: 2111,
        hat: 2221,
        code: 2333,
      };

      const rebuildSymbolPackets = (sym: ShieldSymbolName) => {
        currentSymPacketLoops = buildPacketEdgeLoops(
          network.symbolPacketEdges[sym],
          symNodeTotal,
          symbolPacketCount,
          hopsPerLoop,
          symbolPacketSeeds[sym],
        );
        let cursor = 0;
        for (let pIdx = 0; pIdx < currentSymPacketLoops.length; pIdx++) {
          const loop = currentSymPacketLoops[pIdx];
          for (let h = 0; h < hopsPerLoop; h++) {
            const nodeA = loop.hopNodePairs[h * 2];
            const nodeB = loop.hopNodePairs[h * 2 + 1];
            const a3 = nodeA * 3;
            const b3 = nodeB * 3;

            for (let tSample = 0; tSample < trailSamplesPerPacket; tSample++) {
              const v3 = cursor * 3;
              const v2 = cursor * 2;
              const trailFrac = tSample / Math.max(1, trailSamplesPerPacket - 1);

              symPktStartPos[v3] = symbolCurPos[a3];
              symPktStartPos[v3 + 1] = symbolCurPos[a3 + 1];
              symPktStartPos[v3 + 2] = symbolCurPos[a3 + 2];

              symPktEndPos[v3] = symbolCurPos[b3];
              symPktEndPos[v3 + 1] = symbolCurPos[b3 + 1];
              symPktEndPos[v3 + 2] = symbolCurPos[b3 + 2];

              symPktStartDrift[v3] = network.symbolNodeDriftVectors[a3];
              symPktStartDrift[v3 + 1] = network.symbolNodeDriftVectors[a3 + 1];
              symPktStartDrift[v3 + 2] = network.symbolNodeDriftVectors[a3 + 2];

              symPktEndDrift[v3] = network.symbolNodeDriftVectors[b3];
              symPktEndDrift[v3 + 1] = network.symbolNodeDriftVectors[b3 + 1];
              symPktEndDrift[v3 + 2] = network.symbolNodeDriftVectors[b3 + 2];

              symPktPhases[v2] = network.symbolNodePhases[nodeA];
              symPktPhases[v2 + 1] = network.symbolNodePhases[nodeB];

              symPktMeta[v3] = h;
              symPktMeta[v3 + 1] = trailFrac;
              symPktMeta[v3 + 2] = loop.staggerOffset;

              cursor++;
            }
          }
        }
        symbolPacketGeometry.setDrawRange(0, cursor);
        symPktStartPosAttr.needsUpdate = true;
        symPktEndPosAttr.needsUpdate = true;
        symPktStartDriftAttr.needsUpdate = true;
        symPktEndDriftAttr.needsUpdate = true;
        symPktPhasesAttr.needsUpdate = true;
        symPktMetaAttr.needsUpdate = true;
      };

      const refreshSymbolPacketEndpoints = () => {
        let cursor = 0;
        for (let pIdx = 0; pIdx < currentSymPacketLoops.length; pIdx++) {
          const loop = currentSymPacketLoops[pIdx];
          for (let h = 0; h < hopsPerLoop; h++) {
            const a3 = loop.hopNodePairs[h * 2] * 3;
            const b3 = loop.hopNodePairs[h * 2 + 1] * 3;
            const ax = symbolCurPos[a3];
            const ay = symbolCurPos[a3 + 1];
            const az = symbolCurPos[a3 + 2];
            const bx = symbolCurPos[b3];
            const by = symbolCurPos[b3 + 1];
            const bz = symbolCurPos[b3 + 2];

            for (let tSample = 0; tSample < trailSamplesPerPacket; tSample++) {
              const v3 = cursor * 3;
              symPktStartPos[v3] = ax;
              symPktStartPos[v3 + 1] = ay;
              symPktStartPos[v3 + 2] = az;
              symPktEndPos[v3] = bx;
              symPktEndPos[v3 + 1] = by;
              symPktEndPos[v3 + 2] = bz;
              cursor++;
            }
          }
        }
        symPktStartPosAttr.needsUpdate = true;
        symPktEndPosAttr.needsUpdate = true;
      };

      rebuildSymbolPackets(startSymbol);

      const symbolPacketMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedUniforms,
          uHopsPerLoop: { value: hopsPerLoop },
          uPacketSpeed: { value: SITE_CONFIG.idle.packetSpeedHopsPerSec },
          uPacketTailLen: { value: SITE_CONFIG.idle.packetTailLength },
          uPacketSize: { value: SITE_CONFIG.idle.packetSize },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aEndPos;
          attribute vec3 aDrift;
          attribute vec3 aEndDrift;
          attribute vec2 aPhases;
          attribute vec3 aPacketMeta;

          uniform float uHopsPerLoop;
          uniform float uPacketSpeed;
          uniform float uPacketTailLen;
          uniform float uPacketSize;
          uniform float uThemePointSizeScale;
          uniform float uPixelRatio;
          uniform float uViewportHeight;
          uniform float uMaxNodePointSizePx;
          uniform float uMorphDim;
          uniform float uShieldVisualScale;
          uniform float uHeroSizeTrim;
          uniform float uSymbolEdgeAlpha;
          uniform float uSymbolPacketTime;

          varying float vPacketAlpha;

          ${SHARED_IDLE_SCROLL_GLSL}

          void main() {
            float hopIdx = aPacketMeta.x;
            float trailFrac = aPacketMeta.y;
            float stagger = aPacketMeta.z;

            if (uSymbolEdgeAlpha < 0.005 || uIdleScale < 0.01) {
              vPacketAlpha = 0.0;
              gl_PointSize = 0.0;
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
              return;
            }

            float rawLoopPos = uSymbolPacketTime * uPacketSpeed + stagger * uHopsPerLoop - trailFrac * uPacketTailLen;
            float loopPos = mod(rawLoopPos, uHopsPerLoop);
            float activeHop = floor(loopPos);

            if (abs(hopIdx - activeHop) > 0.25) {
              vPacketAlpha = 0.0;
              gl_PointSize = 0.0;
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
              return;
            }

            float edgeT = fract(loopPos);
            vec3 startWorld = computeBlendedPosition(position, aDrift, aPhases.x);
            vec3 endWorld = computeBlendedPosition(aEndPos, aEndDrift, aPhases.y);
            vec3 packetWorld = mix(startWorld, endWorld, edgeT);

            vec4 mvPosition = modelViewMatrix * vec4(packetWorld, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float dist = max(1.4, -mvPosition.z);
            float sizeFalloff = mix(1.0, 0.48, trailFrac);
            float pktScale = uShieldVisualScale * uHeroSizeTrim;
            float rawPktSize = (uPacketSize * pktScale * uThemePointSizeScale * sizeFalloff * uViewportHeight * 0.55 * uPixelRatio) / dist;
            gl_PointSize = clamp(rawPktSize, 1.5 * uPixelRatio, uMaxNodePointSizePx * pktScale * uThemePointSizeScale * uPixelRatio);

            vPacketAlpha = (1.0 - trailFrac * 0.82) * uIdleScale * uMorphDim * uSymbolEdgeAlpha;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uAccentColor;
          uniform vec3 uPacketCoreColor;
          varying float vPacketAlpha;

          void main() {
            if (vPacketAlpha < 0.01) discard;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r2 = dot(cxy, cxy);
            if (r2 > 1.0) discard;

            float core = smoothstep(0.45, 0.0, r2);
            float halo = smoothstep(1.0, 0.2, r2);
            vec3 pulseColor = mix(uAccentColor, uPacketCoreColor, core * 0.65);
            gl_FragColor = vec4(pulseColor, halo * vPacketAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: PALETTES[currentThemeMode].useNormalBlending
          ? THREE.NormalBlending
          : THREE.AdditiveBlending,
      });

      const symbolPacketPoints = new THREE.Points(symbolPacketGeometry, symbolPacketMaterial);
      symbolPacketPoints.frustumCulled = false;
      symbolPacketPoints.visible = profile.idleMotion;
      deltaGroup.add(symbolPacketPoints);

      const symbolRuntime: SymbolMorphRuntime = {
        nodeTotalCount: symNodeTotal,
        unitScale: network.unitScale,
        curPos: symbolCurPos,
        vel: symbolVel,
        morphStartPos: symbolMorphStartPos,
        interpTarget: symbolInterpTarget,
        drifts: network.symbolNodeDriftVectors,
        phases: network.symbolNodePhases,
        targets: network.symbolTargetPositions,
        packetEdges: network.symbolPacketEdges,
        posAttr: symbolPosAttr,
        edgePosBuf,
        edgeDriftBuf,
        edgePhaseBuf,
        edgeAlphaBuf,
        edgePosAttr,
        edgeDriftAttr,
        edgePhaseAttr,
        edgeAlphaAttr,
        packetLoops: currentSymPacketLoops,
        pktStartPos: symPktStartPos,
        pktEndPos: symPktEndPos,
        pktStartDrift: symPktStartDrift,
        pktEndDrift: symPktEndDrift,
        pktPhases: symPktPhases,
        pktMeta: symPktMeta,
        pktStartPosAttr: symPktStartPosAttr,
        pktEndPosAttr: symPktEndPosAttr,
        pktStartDriftAttr: symPktStartDriftAttr,
        pktEndDriftAttr: symPktEndDriftAttr,
        pktPhasesAttr: symPktPhasesAttr,
        pktMetaAttr: symPktMetaAttr,
        symbolPacketCount,
        hopsPerLoop,
        trailSamplesPerPacket,
        isSettled: true,
        lastTargetSymbol: startSymbol,
        syncEdgeBuffer,
        rebuildPackets: rebuildSymbolPackets,
        refreshPacketEndpoints: refreshSymbolPacketEndpoints,
      };

      // --- D. SPARSE AMBIENT DEPTH FIELD FOR SECTIONS 2–6 (Capped size & alpha) ---
      const ambientData = generateAmbientDepthField(
        profile.ambientField ? profile.ambientParticleCount : 0,
        707,
      );
      const ambientGeometry = new THREE.BufferGeometry();
      ambientGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(ambientData.positions, 3),
      );
      ambientGeometry.setAttribute(
        'aPhase',
        new THREE.BufferAttribute(ambientData.phases, 1),
      );
      ambientGeometry.setAttribute(
        'aColor',
        new THREE.BufferAttribute(ambientData.colors, 3),
      );

      const ambientMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedUniforms,
          uAmbientMaxOpacity: { value: SITE_CONFIG.particles.ambientOpacity },
        },
        vertexShader: /* glsl */ `
          attribute float aPhase;
          attribute vec3 aColor;

          uniform float uTime;
          uniform float uThemePointSizeScale;
          uniform float uPixelRatio;
          uniform float uViewportHeight;
          uniform float uAmbientVisibility;
          uniform float uAmbientMaxOpacity;
          uniform float uMaxAmbientPointSizePx;
          uniform float uMorphDim;
          uniform vec3 uAmbientBaseColor;
          uniform vec3 uAccentColor;

          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            // Subtle slow drift in the background depth corridor
            vec3 pos = position + vec3(
              sin(uTime * 0.35 + aPhase) * 0.12,
              cos(uTime * 0.28 + aPhase * 1.4) * 0.12,
              0.0
            );

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float viewZ = -mvPosition.z;
            // Fade completely before reaching near-camera plane so no large soft discs ever appear
            float nearFade = smoothstep(2.4, 5.5, viewZ);
            float farFade = smoothstep(22.0, 7.0, viewZ);

            float dist = max(2.4, viewZ);
            float rawAmbientSize = (0.052 * uThemePointSizeScale * uViewportHeight * 0.55 * uPixelRatio) / dist;
            gl_PointSize = clamp(rawAmbientSize, 1.2 * uPixelRatio, uMaxAmbientPointSizePx * uThemePointSizeScale * uPixelRatio);

            float isAccent = 1.0 - step(0.45, aColor.r);
            vColor = mix(uAmbientBaseColor, uAccentColor, isAccent);
            vAlpha = min(uAmbientMaxOpacity, uAmbientMaxOpacity * uAmbientVisibility * nearFade * farFade * uMorphDim);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            if (vAlpha < 0.005) discard;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r2 = dot(cxy, cxy);
            if (r2 > 1.0) discard;
            float soft = smoothstep(1.0, 0.35, r2);
            gl_FragColor = vec4(vColor, vAlpha * soft);
          }
        `,
        transparent: true,
        depthWrite: false,
      });

      const ambientPoints = new THREE.Points(ambientGeometry, ambientMaterial);
      ambientPoints.frustumCulled = false;
      ambientPoints.visible = profile.ambientField && profile.ambientParticleCount > 0;
      scene.add(ambientPoints);

      // --- E. SHARED MORPH PARTICLE POOL (TOPOLOGY & DOLLAR -> HASH) ---
      const morphDisabled = shouldDisableMorph({
        plainView: false,
        prefersReducedMotion: reducedMotionRef.current,
        qualityTier: profile.tier,
        saveData,
        viewportWidth: window.innerWidth,
      });
      const morphCount = resolveMorphParticleCount(profile.tier, morphDisabled);

      let morphPool: MorphPoolRuntime | null = null;
      if (morphCount > 0) {
        const curPos = new Float32Array(morphCount * 3);
        const vel = new Float32Array(morphCount * 3);
        const targetPos = new Float32Array(morphCount * 3);
        const ambientHomePos = new Float32Array(morphCount * 3);
        const curColors = new Float32Array(morphCount * 3);

        // Initialize ambient home positions in camera-relative space around the Δ / ambient corridor
        const coreCount = profile.particleCount;
        for (let i = 0; i < morphCount; i++) {
          const i3 = i * 3;
          const srcIdx = (i % coreCount) * 3;
          // Spread dispersed/ambient home slots across the camera view corridor
          const bx = network.basePositions[srcIdx] + network.driftVectors[srcIdx] * 0.48;
          const by = network.basePositions[srcIdx + 1] + network.driftVectors[srcIdx + 1] * 0.48;
          const bz = -MORPH_PLANE_DIST + ((i * 17) % 100) * 0.03 - 1.5;

          ambientHomePos[i3] = bx;
          ambientHomePos[i3 + 1] = by;
          ambientHomePos[i3 + 2] = bz;

          curPos[i3] = bx;
          curPos[i3 + 1] = by;
          curPos[i3 + 2] = bz;

          targetPos[i3] = bx;
          targetPos[i3 + 1] = by;
          targetPos[i3 + 2] = bz;

          curColors[i3] = ivoryRgb[0];
          curColors[i3 + 1] = ivoryRgb[1];
          curColors[i3 + 2] = ivoryRgb[2];
        }

        const morphGeometry = new THREE.BufferGeometry();
        const posAttr = new THREE.BufferAttribute(curPos, 3);
        posAttr.setUsage(THREE.DynamicDrawUsage);
        const colorAttr = new THREE.BufferAttribute(curColors, 3);
        colorAttr.setUsage(THREE.DynamicDrawUsage);

        morphGeometry.setAttribute('position', posAttr);
        morphGeometry.setAttribute('aColor', colorAttr);

        const morphMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uPixelRatio: sharedUniforms.uPixelRatio,
            uViewportHeight: sharedUniforms.uViewportHeight,
            uMaxNodePointSizePx: sharedUniforms.uMaxNodePointSizePx,
            uThemePointSizeScale: sharedUniforms.uThemePointSizeScale,
            uMorphOpacity: { value: 0.0 },
            uPointScale: { value: 0.048 },
          },
          vertexShader: /* glsl */ `
            attribute vec3 aColor;
            uniform float uPixelRatio;
            uniform float uViewportHeight;
            uniform float uMaxNodePointSizePx;
            uniform float uThemePointSizeScale;
            uniform float uPointScale;

            varying vec3 vColor;

            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              float dist = max(1.8, -mvPosition.z);
              float rawSize = (uPointScale * uThemePointSizeScale * uViewportHeight * 0.55 * uPixelRatio) / dist;
              gl_PointSize = clamp(rawSize, 1.5 * uPixelRatio, (uMaxNodePointSizePx - 1.5) * uThemePointSizeScale * uPixelRatio);
              vColor = aColor;
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uMorphOpacity;
            varying vec3 vColor;

            void main() {
              if (uMorphOpacity < 0.005) discard;
              vec2 cxy = 2.0 * gl_PointCoord - 1.0;
              float r2 = dot(cxy, cxy);
              if (r2 > 1.0) discard;
              float soft = smoothstep(1.0, 0.15, r2);
              gl_FragColor = vec4(vColor, uMorphOpacity * soft);
            }
          `,
          transparent: true,
          depthWrite: false,
        });

        const morphPoints = new THREE.Points(morphGeometry, morphMaterial);
        morphPoints.frustumCulled = false;
        morphPoints.visible = false;
        cameraAnchorGroup.add(morphPoints);

        // Topology targets & thin connecting edges
        const topoData = generateTopologyTargets(morphCount, 303);
        const topoEdges = SITE_CONFIG.morph.topology.edges;
        const topoEdgePos = new Float32Array(topoEdges.length * 6);
        const topoEdgeGeometry = new THREE.BufferGeometry();
        const topoEdgePosAttr = new THREE.BufferAttribute(topoEdgePos, 3);
        topoEdgePosAttr.setUsage(THREE.DynamicDrawUsage);
        topoEdgeGeometry.setAttribute('position', topoEdgePosAttr);

        const topoEdgeMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uLineColor: sharedUniforms.uLineColor,
            uLineOpacity: { value: 0.0 },
          },
          vertexShader: /* glsl */ `
            void main() {
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform vec3 uLineColor;
            uniform float uLineOpacity;

            void main() {
              if (uLineOpacity < 0.005) discard;
              gl_FragColor = vec4(uLineColor, uLineOpacity);
            }
          `,
          transparent: true,
          depthWrite: false,
        });

        const topoEdgeLines = new THREE.LineSegments(
          topoEdgeGeometry,
          topoEdgeMaterial,
        );
        topoEdgeLines.frustumCulled = false;
        topoEdgeLines.visible = false;
        cameraAnchorGroup.add(topoEdgeLines);

        const nodeCenterSums = new Float32Array(
          SITE_CONFIG.morph.topology.nodes.length * 3,
        );

        morphPool = {
          morphCount,
          curPos,
          vel,
          targetPos,
          ambientHomePos,
          curColors,
          posAttr,
          colorAttr,
          morphGeometry,
          morphMaterial,
          morphPoints,
          topoData,
          topoEdgePos,
          topoEdgePosAttr,
          topoEdgeGeometry,
          topoEdgeMaterial,
          topoEdgeLines,
          nodeCenterSums,
          glyphData: null,
        };

        // Asynchronously rasterise "$" and "#" glyphs after document.fonts.ready
        void rasterizePairGlyphTargets(morphCount, 909).then((glyphTargets) => {
          if (isDisposed || !morphPool) return;
          morphPool.glyphData = glyphTargets;
        });
      }

      return {
        pointsGeometry,
        pointsMaterial,
        pointsMesh,
        symbolPointsGeometry,
        symbolPointsMesh,
        lineGeometry,
        lineMaterial,
        lineSegments,
        symbolLineGeometry,
        symbolLineMaterial,
        symbolLineSegments,
        packetGeometry,
        packetMaterial,
        packetPoints,
        symbolPacketGeometry,
        symbolPacketMaterial,
        symbolPacketPoints,
        symbolRuntime,
        ambientGeometry,
        ambientMaterial,
        ambientPoints,
        morphPool,
        dispose: () => {
          deltaGroup.remove(pointsMesh);
          deltaGroup.remove(symbolPointsMesh);
          deltaGroup.remove(lineSegments);
          deltaGroup.remove(symbolLineSegments);
          deltaGroup.remove(packetPoints);
          deltaGroup.remove(symbolPacketPoints);
          scene.remove(ambientPoints);
          pointsGeometry.dispose();
          pointsMaterial.dispose();
          symbolPointsGeometry.dispose();
          lineGeometry.dispose();
          lineMaterial.dispose();
          symbolLineGeometry.dispose();
          symbolLineMaterial.dispose();
          packetGeometry.dispose();
          packetMaterial.dispose();
          symbolPacketGeometry.dispose();
          symbolPacketMaterial.dispose();
          ambientGeometry.dispose();
          ambientMaterial.dispose();
          if (morphPool) {
            cameraAnchorGroup.remove(morphPool.morphPoints);
            cameraAnchorGroup.remove(morphPool.topoEdgeLines);
            morphPool.morphGeometry.dispose();
            morphPool.morphMaterial.dispose();
            morphPool.topoEdgeGeometry.dispose();
            morphPool.topoEdgeMaterial.dispose();
          }
        },
      };
    };

    let activeMeshes = buildTierMeshes(currentProfile);

    // Morph state machine runtime state
    let currentMorphState: MorphStateName = 'HERO';
    let stateEnteredAtMs = performance.now();
    let dollarFormationCompleteMs = 0;
    let morphVisualAlpha = 0;
    let activeEffectiveMaxOpacity = 0;
    let activeLitLeafNodes: number[] = [
      ...SITE_CONFIG.morph.topology.preferredLitLeafNodeIndices,
    ];

    /**
     * Projects normalized `[-0.5, +0.5]` shape coordinates into camera-relative 3D targets
     * anchored at `(anchorX, anchorY)` in viewport fractions with height `scale * planeHeight`.
     */
    const updatePoolTargetsForState = (
      pool: MorphPoolRuntime,
      state: MorphStateName,
      hashProgress = 0,
    ) => {
      const planeHalfH =
        MORPH_PLANE_DIST * Math.tan((camera.fov * Math.PI) / 360);
      const planeH = planeHalfH * 2;
      const planeW = planeH * camera.aspect;

      if (state === 'TOPOLOGY') {
        const cfg = SITE_CONFIG.morph.topology;
        const cx = (cfg.anchorX - 0.5) * planeW;
        const cy = (0.5 - cfg.anchorY) * planeH;
        const span = cfg.scale * planeH;
        const src = pool.topoData.normalizedPositions;

        for (let i = 0; i < pool.morphCount; i++) {
          const i3 = i * 3;
          pool.targetPos[i3] = cx + src[i3] * span;
          pool.targetPos[i3 + 1] = cy + src[i3 + 1] * span;
          pool.targetPos[i3 + 2] = -MORPH_PLANE_DIST + src[i3 + 2] * span;
        }
      } else if ((state === 'DOLLAR' || state === 'HASH') && pool.glyphData) {
        const cfg = SITE_CONFIG.morph.glyph;
        const cx = (cfg.anchorX - 0.5) * planeW;
        const cy = (0.5 - cfg.anchorY) * planeH;
        const span = cfg.scale * planeH;
        const dSrc = pool.glyphData.dollarPositions;
        const hSrc = pool.glyphData.hashPositions;

        if (state === 'DOLLAR') {
          for (let i = 0; i < pool.morphCount; i++) {
            const i3 = i * 3;
            pool.targetPos[i3] = cx + dSrc[i3] * span;
            pool.targetPos[i3 + 1] = cy + dSrc[i3 + 1] * span;
            pool.targetPos[i3 + 2] = -MORPH_PLANE_DIST + dSrc[i3 + 2] * span;
          }
        } else {
          const t = Math.max(0, Math.min(1, hashProgress));
          const invT = 1 - t;
          for (let i = 0; i < pool.morphCount; i++) {
            const i3 = i * 3;
            const nx = dSrc[i3] * invT + hSrc[i3] * t;
            const ny = dSrc[i3 + 1] * invT + hSrc[i3 + 1] * t;
            const nz = dSrc[i3 + 2] * invT + hSrc[i3 + 2] * t;
            pool.targetPos[i3] = cx + nx * span;
            pool.targetPos[i3 + 1] = cy + ny * span;
            pool.targetPos[i3 + 2] = -MORPH_PLANE_DIST + nz * span;
          }
        }
      } else {
        // HERO or AMBIENT: return smoothly to ambient / Δ corridor slots
        for (let i = 0; i < pool.morphCount * 3; i++) {
          pool.targetPos[i] = pool.ambientHomePos[i];
        }
      }
    };

    /**
     * Measures active section text bounding boxes at runtime and caps shape opacity to <= 0.18
     * if the shape's screen-space bounding box overlaps a text block on desktop.
     */
    const evaluateReadabilityAndOpacityCap = (
      pool: MorphPoolRuntime,
      state: MorphStateName,
    ) => {
      const vw = window.innerWidth;
      const vh = Math.max(1, window.innerHeight);

      if (state === 'TOPOLOGY') {
        const cfg = SITE_CONFIG.morph.topology;
        const shapeBox = computeShapeScreenBoundingBox({
          anchorX: cfg.anchorX,
          anchorY: cfg.anchorY,
          scale: cfg.scale,
          viewportWidth: vw,
          viewportHeight: vh,
          bounds: pool.topoData.bounds,
        });
        const { blockRects, rowRects } = measureSectionTextRects('skills');
        const { effectiveMaxOpacity } = computeShapeEffectiveMaxOpacity({
          shapeBox,
          textRects: blockRects,
          configMaxOpacity: cfg.maxOpacity,
        });
        activeEffectiveMaxOpacity = effectiveMaxOpacity;
        activeLitLeafNodes = selectNonOverlappingLitLeafNodes({
          anchorX: cfg.anchorX,
          anchorY: cfg.anchorY,
          scale: cfg.scale,
          viewportWidth: vw,
          viewportHeight: vh,
          textRowRects: rowRects,
        });
      } else if ((state === 'DOLLAR' || state === 'HASH') && pool.glyphData) {
        const cfg = SITE_CONFIG.morph.glyph;
        const shapeBox = computeShapeScreenBoundingBox({
          anchorX: cfg.anchorX,
          anchorY: cfg.anchorY,
          scale: cfg.scale,
          viewportWidth: vw,
          viewportHeight: vh,
          bounds: pool.glyphData.bounds,
        });
        const { blockRects } = measureSectionTextRects('connect');
        const { effectiveMaxOpacity } = computeShapeEffectiveMaxOpacity({
          shapeBox,
          textRects: blockRects,
          configMaxOpacity: cfg.maxOpacity,
        });
        activeEffectiveMaxOpacity = effectiveMaxOpacity;
      } else {
        activeEffectiveMaxOpacity = 0;
      }

      container.setAttribute(
        'data-morph-max-opacity',
        activeEffectiveMaxOpacity.toFixed(2),
      );
    };

    // Position the Δ group so no part of it ever overlaps "VAIBHAV MARATHE" at any width
    let lastLayoutWidth = window.innerWidth;
    let lastLayoutHeight = Math.max(1, window.innerHeight);

    // Pause rendering when the canvas is not visible or the tab is hidden
    let isTabHidden = document.hidden;
    let isCanvasVisible = true;
    let frameId = 0;
    let isLoopRunning = false;
    let lastTimestamp = performance.now();
    let elapsedSec = 0;
    let symbolPacketElapsedSec = 0;

    // Adaptive FPS downgrade state (first 2s window + optional second 2s window)
    let downgradeChecksCompleted = 0;
    let heroFillTrimApplied = false;
    let windowFrames = 0;
    let windowElapsedSec = 0;

    // Half-second debug HUD FPS reporting state
    let debugFrames = 0;
    let debugElapsedSec = 0;
    let currentMeasuredFps = 60;

    const getActiveMorphParticleCount = () =>
      activeMeshes.morphPool ? activeMeshes.morphPool.morphCount : 0;

    // Theme colour lerp state (~300ms on toggle without rebuilding geometries, materials, or particle pool)
    let isThemeLerping = false;
    let themeLerpStartMs = 0;
    let fromPalette = buildPaletteForTheme(currentThemeMode);
    let toPalette = PALETTES[currentThemeMode];

    const lerpScalar = (a: number, b: number, t: number) => a + (b - a) * t;
    const lerpRgbTuple = (
      a: [number, number, number],
      b: [number, number, number],
      t: number,
    ): [number, number, number] => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];

    const THEME_SNAP_EPSILON = 0.005;

    const applyThemeInterpolation = (rawT: number) => {
      // Snap to exact target colours when within a small epsilon of completion
      const snappedToEnd = rawT >= 1 - THEME_SNAP_EPSILON;
      const clamped = snappedToEnd ? 1 : Math.max(0, Math.min(1, rawT));
      // Smoothstep easing over the 300ms colour transition
      const t = snappedToEnd ? 1 : clamped * clamped * (3 - 2 * clamped);

      const nodeBase: [number, number, number] = snappedToEnd
        ? [
            toPalette.nodeBaseRgb[0],
            toPalette.nodeBaseRgb[1],
            toPalette.nodeBaseRgb[2],
          ]
        : lerpRgbTuple(fromPalette.nodeBaseRgb, toPalette.nodeBaseRgb, t);
      const mutedNode: [number, number, number] = snappedToEnd
        ? [
            toPalette.mutedNodeRgb[0],
            toPalette.mutedNodeRgb[1],
            toPalette.mutedNodeRgb[2],
          ]
        : lerpRgbTuple(fromPalette.mutedNodeRgb, toPalette.mutedNodeRgb, t);
      const ambBase: [number, number, number] = snappedToEnd
        ? [
            toPalette.ambientBaseRgb[0],
            toPalette.ambientBaseRgb[1],
            toPalette.ambientBaseRgb[2],
          ]
        : lerpRgbTuple(fromPalette.ambientBaseRgb, toPalette.ambientBaseRgb, t);
      const accent: [number, number, number] = snappedToEnd
        ? [
            toPalette.accentRgb[0],
            toPalette.accentRgb[1],
            toPalette.accentRgb[2],
          ]
        : lerpRgbTuple(fromPalette.accentRgb, toPalette.accentRgb, t);
      const amber: [number, number, number] = snappedToEnd
        ? [
            toPalette.amberRgb[0],
            toPalette.amberRgb[1],
            toPalette.amberRgb[2],
          ]
        : lerpRgbTuple(fromPalette.amberRgb, toPalette.amberRgb, t);
      const lineCol: [number, number, number] = snappedToEnd
        ? [toPalette.lineRgb[0], toPalette.lineRgb[1], toPalette.lineRgb[2]]
        : lerpRgbTuple(fromPalette.lineRgb, toPalette.lineRgb, t);
      const pktCore: [number, number, number] = snappedToEnd
        ? [
            toPalette.packetCoreRgb[0],
            toPalette.packetCoreRgb[1],
            toPalette.packetCoreRgb[2],
          ]
        : lerpRgbTuple(fromPalette.packetCoreRgb, toPalette.packetCoreRgb, t);

      sharedUniforms.uNodeBaseColor.value.set(
        nodeBase[0],
        nodeBase[1],
        nodeBase[2],
      );
      sharedUniforms.uShieldNodeColor.value.set(
        mutedNode[0],
        mutedNode[1],
        mutedNode[2],
      );
      sharedUniforms.uAmbientBaseColor.value.set(
        ambBase[0],
        ambBase[1],
        ambBase[2],
      );
      sharedUniforms.uAccentColor.value.set(accent[0], accent[1], accent[2]);
      sharedUniforms.uLineColor.value.set(lineCol[0], lineCol[1], lineCol[2]);
      sharedUniforms.uLineBaseAlpha.value = snappedToEnd
        ? toPalette.lineBaseAlpha
        : lerpScalar(fromPalette.lineBaseAlpha, toPalette.lineBaseAlpha, t);
      sharedUniforms.uPacketCoreColor.value.set(
        pktCore[0],
        pktCore[1],
        pktCore[2],
      );
      sharedUniforms.uThemePointSizeScale.value = snappedToEnd
        ? toPalette.pointSizeScale
        : lerpScalar(fromPalette.pointSizeScale, toPalette.pointSizeScale, t);

      ivoryRgb[0] = nodeBase[0];
      ivoryRgb[1] = nodeBase[1];
      ivoryRgb[2] = nodeBase[2];

      cyanRgb[0] = accent[0];
      cyanRgb[1] = accent[1];
      cyanRgb[2] = accent[2];

      amberRgb[0] = amber[0];
      amberRgb[1] = amber[1];
      amberRgb[2] = amber[2];

      const pool = activeMeshes.morphPool;
      if (pool && currentMorphState === 'DOLLAR') {
        for (let i = 0; i < pool.morphCount; i++) {
          const i3 = i * 3;
          pool.curColors[i3] = cyanRgb[0];
          pool.curColors[i3 + 1] = cyanRgb[1];
          pool.curColors[i3 + 2] = cyanRgb[2];
        }
        pool.colorAttr.needsUpdate = true;
      }

      if (snappedToEnd) {
        isThemeLerping = false;
      }
    };

    const syncContainerDataAttrs = () => {
      const cycle = symbolCycleRef.current;
      const activeSym =
        SITE_CONFIG.shield.SYMBOL_ORDER[cycle.currentIndex] ?? cycle.edgeSymbol;
      const phaseLabel: 'HOLD' | 'MORPH' | 'STATIC' = cycle.isStatic
        ? 'STATIC'
        : cycle.phase;

      container.setAttribute('data-morph-state', currentMorphState);
      container.setAttribute(
        'data-morph-particles',
        String(getActiveMorphParticleCount()),
      );
      container.setAttribute('data-shield-symbol', activeSym);
      container.setAttribute('data-shield-symbol-phase', phaseLabel);
      container.setAttribute('data-shield-symbol-edge', cycle.edgeSymbol);
      container.setAttribute(
        'data-shield-symbol-edge-alpha',
        cycle.edgeAlpha.toFixed(2),
      );
      container.setAttribute(
        'data-shield-symbol-next-sec',
        cycle.secondsUntilNext === null
          ? 'static'
          : cycle.secondsUntilNext.toFixed(1),
      );
      container.setAttribute('data-scene-theme', currentThemeMode);
      container.setAttribute(
        'data-scene-clear-color',
        PALETTES[currentThemeMode].clearColorHex,
      );
      container.setAttribute(
        'data-clear-alpha',
        String(renderer.getClearAlpha()),
      );
      container.setAttribute(
        'data-scene-blending',
        PALETTES[currentThemeMode].useNormalBlending ? 'normal' : 'additive',
      );
    };

    const unsubscribeTheme = subscribeTheme((nextTheme) => {
      if (isDisposed) return;
      fromPalette = {
        mode: currentThemeMode,
        clearColorHex: PALETTES[currentThemeMode].clearColorHex,
        clearRgb: PALETTES[currentThemeMode].clearRgb,
        nodeBaseRgb: [ivoryRgb[0], ivoryRgb[1], ivoryRgb[2]],
        mutedNodeRgb: [
          sharedUniforms.uShieldNodeColor.value.x,
          sharedUniforms.uShieldNodeColor.value.y,
          sharedUniforms.uShieldNodeColor.value.z,
        ],
        ambientBaseRgb: [
          sharedUniforms.uAmbientBaseColor.value.x,
          sharedUniforms.uAmbientBaseColor.value.y,
          sharedUniforms.uAmbientBaseColor.value.z,
        ],
        accentRgb: [cyanRgb[0], cyanRgb[1], cyanRgb[2]],
        amberRgb: [amberRgb[0], amberRgb[1], amberRgb[2]],
        lineRgb: [
          sharedUniforms.uLineColor.value.x,
          sharedUniforms.uLineColor.value.y,
          sharedUniforms.uLineColor.value.z,
        ],
        lineBaseAlpha: sharedUniforms.uLineBaseAlpha.value,
        pointSizeScale: sharedUniforms.uThemePointSizeScale.value,
        packetCoreRgb: [
          sharedUniforms.uPacketCoreColor.value.x,
          sharedUniforms.uPacketCoreColor.value.y,
          sharedUniforms.uPacketCoreColor.value.z,
        ],
        useNormalBlending: PALETTES[currentThemeMode].useNormalBlending,
      };
      currentThemeMode = nextTheme;
      toPalette = PALETTES[nextTheme];

      // Switch packet blending between AdditiveBlending (dark) and NormalBlending (light) without rebuilding materials
      const nextBlending = toPalette.useNormalBlending
        ? THREE.NormalBlending
        : THREE.AdditiveBlending;
      activeMeshes.packetMaterial.blending = nextBlending;
      activeMeshes.symbolPacketMaterial.blending = nextBlending;

      syncContainerDataAttrs();

      if (reducedMotionRef.current) {
        isThemeLerping = false;
        applyThemeInterpolation(1);
      } else {
        themeLerpStartMs = performance.now();
        isThemeLerping = true;
      }
    });

    const emitDebugStats = (fpsVal: number) => {
      syncContainerDataAttrs();
      if (debugCallbackRef.current) {
        const cycle = symbolCycleRef.current;
        const activeSym =
          SITE_CONFIG.shield.SYMBOL_ORDER[cycle.currentIndex] ?? cycle.edgeSymbol;
        debugCallbackRef.current({
          tier: currentProfile.tier,
          fps: Math.round(fpsVal),
          particleCount: currentProfile.particleCount,
          ambientParticleCount: currentProfile.ambientField
            ? currentProfile.ambientParticleCount
            : 0,
          pixelRatio: currentProfile.pixelRatio,
          morphState: currentMorphState,
          morphParticleCount: getActiveMorphParticleCount(),
          clearAlpha: renderer.getClearAlpha(),
          shieldSymbol: activeSym,
          shieldSymbolNextSec: cycle.secondsUntilNext,
          shieldSymbolPhase: cycle.isStatic ? 'STATIC' : cycle.phase,
        });
      }
    };

    const updateLayoutPlacement = (force = false) => {
      const width = window.innerWidth;
      const height = Math.max(1, window.innerHeight);

      // Ignore mobile address-bar height-only resizes so the scene is not rebuilt/jiggled
      const isAddressBarOnlyChange =
        !force &&
        width === lastLayoutWidth &&
        Math.abs(height - lastLayoutHeight) <
          SITE_CONFIG.performance.mobileAddressBarDeltaThresholdPx;

      if (isAddressBarOnlyChange) {
        return;
      }

      const prevIsMobile = lastLayoutWidth < 768;
      const nextIsMobile = width < 768;
      lastLayoutWidth = width;
      lastLayoutHeight = height;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      // Recompute pixel ratio cap when crossing mobile/desktop breakpoint (never upgrading tier)
      currentProfile = resolveQualityTierProfile({
        tier: currentProfile.tier,
        viewportWidth: width,
        devicePixelRatio: window.devicePixelRatio || 1,
      });
      renderer.setPixelRatio(currentProfile.pixelRatio);
      renderer.setSize(width, height);
      sharedUniforms.uPixelRatio.value = currentProfile.pixelRatio;
      sharedUniforms.uViewportHeight.value = height;

      if (prevIsMobile !== nextIsMobile) {
        activeMeshes.dispose();
        activeMeshes = buildTierMeshes(currentProfile);
      }

      const clearanceBounds = measureHeroClearanceBounds();
      const shieldPlacement = computeHeroShieldPlacement({
        viewportWidth: width,
        viewportHeight: height,
        fovDeg: camera.fov,
        cameraZ: SITE_CONFIG.scroll.cameraStartZ,
        nameRect: clearanceBounds.nameRect,
        opaqueContainerRect: clearanceBounds.opaqueContainerRect,
        navBottomPx: clearanceBounds.navBottomPx,
        heroBottomLineTopPx: clearanceBounds.heroBottomLineTopPx,
      });

      deltaGroup.position.set(shieldPlacement.anchorX, shieldPlacement.anchorY, 0);
      deltaGroup.scale.setScalar(shieldPlacement.scale);
      container.setAttribute(
        'data-shield-height-px',
        String(Math.round(shieldPlacement.finalHeightPx)),
      );
      container.setAttribute(
        'data-shield-scale',
        shieldPlacement.scale.toFixed(3),
      );

      if (activeMeshes.morphPool) {
        evaluateReadabilityAndOpacityCap(activeMeshes.morphPool, currentMorphState);
        updatePoolTargetsForState(activeMeshes.morphPool, currentMorphState, 1);
      }
      emitDebugStats(currentMeasuredFps);
    };
    updateLayoutPlacement(true);

    // Re-measure once web fonts finish loading so hero name clearance uses final glyph metrics
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!isDisposed) {
          updateLayoutPlacement(true);
        }
      });
    }

    // Debounce resize handling (~150ms)
    let resizeTimeoutId = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimeoutId);
      resizeTimeoutId = window.setTimeout(() => {
        updateLayoutPlacement(false);
      }, SITE_CONFIG.performance.resizeDebounceMs);
    };
    window.addEventListener('resize', onResize);

    const applyTierDowngrade = (nextTier: QualityTierName) => {
      if (nextTier === currentProfile.tier) return;
      currentProfile = resolveQualityTierProfile({
        tier: nextTier,
        viewportWidth: window.innerWidth,
        devicePixelRatio: window.devicePixelRatio || 1,
      });
      renderer.setPixelRatio(currentProfile.pixelRatio);
      sharedUniforms.uPixelRatio.value = currentProfile.pixelRatio;
      activeMeshes.dispose();
      activeMeshes = buildTierMeshes(currentProfile);
      emitDebugStats(currentMeasuredFps);
    };

    const tick = () => {
      if (isTabHidden || !isCanvasVisible) {
        isLoopRunning = false;
        return;
      }
      isLoopRunning = true;

      const now = performance.now();
      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      // Step 300ms theme colour lerp if active
      if (isThemeLerping) {
        const lerpDur = Math.max(1, SITE_CONFIG.theme.sceneColorLerpDurationMs);
        const rawT = reducedMotionRef.current
          ? 1
          : (now - themeLerpStartMs) / lerpDur;
        if (rawT >= 1) {
          applyThemeInterpolation(1);
          isThemeLerping = false;
        } else {
          applyThemeInterpolation(rawT);
        }
      }

      // Ignore huge pauses from tab switching when measuring FPS
      if (rawDt > 0 && rawDt < 0.25) {
        windowFrames += 1;
        windowElapsedSec += rawDt;
        debugFrames += 1;
        debugElapsedSec += rawDt;

        // Update debug HUD twice per second (~0.5s)
        if (debugElapsedSec >= 0.5) {
          currentMeasuredFps = debugFrames / debugElapsedSec;
          emitDebugStats(currentMeasuredFps);
          debugFrames = 0;
          debugElapsedSec = 0;
        }

        // Adaptive FPS check over each 2-second sampling window:
        // On desktop high tier, if FPS falls below 55 fps from larger fill area, trim hero node size/alpha
        // before reducing node count via quality tier downgrade.
        if (
          downgradeChecksCompleted < SITE_CONFIG.qualityTiers.maxDowngradeChecks &&
          windowElapsedSec >= SITE_CONFIG.qualityTiers.sampleWindowSec
        ) {
          const avgFps = windowFrames / windowElapsedSec;
          windowFrames = 0;
          windowElapsedSec = 0;

          if (
            !heroFillTrimApplied &&
            !currentProfile.isMobile &&
            currentProfile.tier === 'high' &&
            avgFps < SITE_CONFIG.shield.highTierFpsTrimThreshold
          ) {
            heroFillTrimApplied = true;
            sharedUniforms.uHeroSizeTrim.value = 0.85;
            sharedUniforms.uHeroAlphaTrim.value = 0.88;
          } else {
            downgradeChecksCompleted += 1;
            if (
              avgFps < SITE_CONFIG.qualityTiers.fpsDowngradeThreshold &&
              currentProfile.tier !== 'low'
            ) {
              const nextTier = downgradeQualityTier(currentProfile.tier);
              applyTierDowngrade(nextTier);
            }
          }
        }
      }

      const dt = Math.min(0.1, Math.max(0.001, rawDt));
      if (!reducedMotionRef.current && currentProfile.idleMotion) {
        elapsedSec += dt;
      }

      // Read directly from the single Lenis-driven scroll metrics ref (no double-smoothing)
      const metrics = scrollMetricsRef.current;

      // Move camera along Z depth directly from the single scroll source
      camera.position.z = metrics.targetCameraZ;
      cameraAnchorGroup.position.z = camera.position.z;

      // Step the section-arrival morph state machine
      const arrivedSection = scrollArrivalRef?.current?.arrivedSectionId ?? null;
      const morphDisabled = isMorphCurrentlyDisabled();
      const pool = activeMeshes.morphPool;
      const glyphsReady = Boolean(pool && pool.glyphData);

      const stepResult = stepMorphStateMachine({
        currentState: currentMorphState,
        stateEnteredAtMs,
        dollarFormationCompleteMs,
        nowMs: now,
        morphDisabled,
        heroProgress: metrics.heroProgress,
        arrivedSection,
        glyphsAvailable: glyphsReady,
      });

      const prevState = currentMorphState;
      currentMorphState = stepResult.state;
      stateEnteredAtMs = stepResult.stateEnteredAtMs;
      dollarFormationCompleteMs = stepResult.dollarFormationCompleteMs;

      if (currentMorphState !== prevState) {
        if (pool) {
          evaluateReadabilityAndOpacityCap(pool, currentMorphState);
          updatePoolTargetsForState(pool, currentMorphState, 0);

          if (currentMorphState === 'DOLLAR') {
            // Set initial glyph colour to current theme's accent (#4FD1D9 in dark, #0B6F78 in light)
            for (let i = 0; i < pool.morphCount; i++) {
              const i3 = i * 3;
              pool.curColors[i3] = cyanRgb[0];
              pool.curColors[i3 + 1] = cyanRgb[1];
              pool.curColors[i3 + 2] = cyanRgb[2];
            }
            pool.colorAttr.needsUpdate = true;
            pool.morphMaterial.uniforms.uPointScale.value = 0.056;
          } else if (currentMorphState === 'TOPOLOGY') {
            pool.morphMaterial.uniforms.uPointScale.value = 0.048;
          }
        }
        emitDebugStats(currentMeasuredFps);
      }

      // Update morph pool particles on typed Float32Array (< 0.1 ms per frame)
      const isShapeActive =
        currentMorphState === 'TOPOLOGY' ||
        currentMorphState === 'DOLLAR' ||
        currentMorphState === 'HASH';

      const targetVisualAlpha = isShapeActive ? activeEffectiveMaxOpacity : 0;
      const alphaRate = isShapeActive ? 3.8 : 4.5;
      morphVisualAlpha += (targetVisualAlpha - morphVisualAlpha) * Math.min(1, dt * alphaRate);
      if (!isShapeActive && morphVisualAlpha < 0.004) {
        morphVisualAlpha = 0;
      }

      if (pool && (isShapeActive || morphVisualAlpha > 0)) {
        pool.morphPoints.visible = true;

        const omega =
          currentMorphState === 'HASH'
            ? SITE_CONFIG.morph.hashSpringOmega
            : SITE_CONFIG.morph.springOmega;

        if (currentMorphState === 'HASH' && pool.glyphData) {
          const elapsedHashMs = Math.max(0, now - stateEnteredAtMs);
          const hashProg = computeHashMorphProgress(
            elapsedHashMs,
            SITE_CONFIG.morph.hashMorphDurationMs,
          );
          updatePoolTargetsForState(pool, 'HASH', hashProg);

          // Colour lerps smoothly from theme accent to theme amber over ~1,000 ms
          const r = cyanRgb[0] + (amberRgb[0] - cyanRgb[0]) * hashProg;
          const g = cyanRgb[1] + (amberRgb[1] - cyanRgb[1]) * hashProg;
          const b = cyanRgb[2] + (amberRgb[2] - cyanRgb[2]) * hashProg;
          for (let i = 0; i < pool.morphCount; i++) {
            const i3 = i * 3;
            pool.curColors[i3] = r;
            pool.curColors[i3 + 1] = g;
            pool.curColors[i3 + 2] = b;
          }
          pool.colorAttr.needsUpdate = true;
        } else if (currentMorphState === 'TOPOLOGY') {
          const elapsedTopoMs = Math.max(0, now - stateEnteredAtMs);
          const nodeCount = SITE_CONFIG.morph.topology.nodes.length;
          const portScan = computeTopologyNodePortScanIntensities(
            nodeCount,
            elapsedTopoMs,
            activeLitLeafNodes,
            SITE_CONFIG.morph.topologyPortScanIntervalMs,
          );
          const assignments = pool.topoData.nodeAssignments;
          for (let i = 0; i < pool.morphCount; i++) {
            const nodeIdx = assignments[i];
            const cyanFactor = portScan[nodeIdx] ?? 0;
            const i3 = i * 3;
            pool.curColors[i3] =
              ivoryRgb[0] + (cyanRgb[0] - ivoryRgb[0]) * cyanFactor;
            pool.curColors[i3 + 1] =
              ivoryRgb[1] + (cyanRgb[1] - ivoryRgb[1]) * cyanFactor;
            pool.curColors[i3 + 2] =
              ivoryRgb[2] + (cyanRgb[2] - ivoryRgb[2]) * cyanFactor;
          }
          pool.colorAttr.needsUpdate = true;
        }

        // Critically damped spring step across all morph particles
        stepCriticallyDampedSpringBuffer(
          pool.curPos,
          pool.vel,
          pool.targetPos,
          dt,
          omega,
        );
        pool.posAttr.needsUpdate = true;
        pool.morphMaterial.uniforms.uMorphOpacity.value = morphVisualAlpha;

        // Update topology edges if visible
        if (currentMorphState === 'TOPOLOGY' || pool.topoEdgeLines.visible) {
          const topoAlpha =
            currentMorphState === 'TOPOLOGY' ? morphVisualAlpha * 0.85 : 0;
          if (topoAlpha > 0.005) {
            pool.topoEdgeLines.visible = true;
            pool.topoEdgeMaterial.uniforms.uLineOpacity.value = topoAlpha;

            const nodes = SITE_CONFIG.morph.topology.nodes;
            const nodeCount = nodes.length;
            const sums = pool.nodeCenterSums;
            sums.fill(0);

            const assignments = pool.topoData.nodeAssignments;
            const counts = pool.topoData.nodeParticleCounts;
            for (let i = 0; i < pool.morphCount; i++) {
              const nIdx = assignments[i] * 3;
              const i3 = i * 3;
              sums[nIdx] += pool.curPos[i3];
              sums[nIdx + 1] += pool.curPos[i3 + 1];
              sums[nIdx + 2] += pool.curPos[i3 + 2];
            }
            for (let n = 0; n < nodeCount; n++) {
              const c = Math.max(1, counts[n]);
              const n3 = n * 3;
              sums[n3] /= c;
              sums[n3 + 1] /= c;
              sums[n3 + 2] /= c;
            }

            const edges = SITE_CONFIG.morph.topology.edges;
            const edgeBuf = pool.topoEdgePos;
            for (let e = 0; e < edges.length; e++) {
              const a3 = edges[e][0] * 3;
              const b3 = edges[e][1] * 3;
              const e6 = e * 6;
              edgeBuf[e6] = sums[a3];
              edgeBuf[e6 + 1] = sums[a3 + 1];
              edgeBuf[e6 + 2] = sums[a3 + 2];
              edgeBuf[e6 + 3] = sums[b3];
              edgeBuf[e6 + 4] = sums[b3 + 1];
              edgeBuf[e6 + 5] = sums[b3 + 2];
            }
            pool.topoEdgePosAttr.needsUpdate = true;
          } else {
            pool.topoEdgeLines.visible = false;
            pool.topoEdgeMaterial.uniforms.uLineOpacity.value = 0;
          }
        }
      } else if (pool) {
        pool.morphPoints.visible = false;
        pool.topoEdgeLines.visible = false;
      }

      // --- HERO SHIELD INTERIOR SYMBOL CYCLE & MORPH (48 nodes x 3 z-layers) ---
      const cycle = symbolCycleRef.current;
      const symRt = activeMeshes.symbolRuntime;
      const disableSymbolCycle = shouldDisableSymbolCycle({
        plainView: false,
        prefersReducedMotion: reducedMotionRef.current,
        qualityTier: currentProfile.tier,
        saveData,
      });
      const staticSymbol = resolveStaticShieldSymbol({
        plainView: false,
        prefersReducedMotion: reducedMotionRef.current,
        qualityTier: currentProfile.tier,
        saveData,
      });
      // Pause whenever hero is not in its formed state (dispersed/scrolled away), tab hidden, or canvas invisible
      const isHeroFormed = metrics.heroProgress <= 0.05 && currentMorphState === 'HERO';
      const isCycleActive = isHeroFormed && !isTabHidden && isCanvasVisible;

      const cycleRes = stepSymbolCycleState(cycle, {
        dtMs: dt * 1000,
        isActive: isCycleActive,
        disableCycle: disableSymbolCycle,
        staticSymbol,
      });

      if (disableSymbolCycle) {
        const dest = symRt.targets[staticSymbol];
        if (cycleRes.switchedEdgeSymbol || !symRt.isSettled) {
          symRt.curPos.set(dest);
          symRt.vel.fill(0);
          symRt.morphStartPos.set(dest);
          symRt.interpTarget.set(dest);
          symRt.posAttr.needsUpdate = true;
          symRt.lastTargetSymbol = staticSymbol;
          symRt.isSettled = true;
          symRt.syncEdgeBuffer(staticSymbol);
          symRt.rebuildPackets(staticSymbol);
        }
        sharedUniforms.uSymbolEdgeAlpha.value = 1.0;
        activeMeshes.symbolLineSegments.visible = true;
        activeMeshes.symbolPacketPoints.visible = currentProfile.idleMotion && !reducedMotionRef.current;
        if (activeMeshes.symbolPacketPoints.visible) {
          symbolPacketElapsedSec += dt;
        }
      } else {
        const morphMs = Math.max(1, SITE_CONFIG.shield.SYMBOL_MORPH_MS);
        const symbolSpringOmega = 16.0 / (morphMs / 1000);

        // Retarget smoothly from current positions (preserving velocity, never snapping)
        if (cycleRes.startedMorph || cycleRes.targetSymbol !== symRt.lastTargetSymbol) {
          symRt.morphStartPos.set(symRt.curPos);
          symRt.lastTargetSymbol = cycleRes.targetSymbol;
          symRt.isSettled = false;
        }

        let symbolMovedThisFrame = false;

        if (isCycleActive && cycle.phase === 'MORPH') {
          const dest = symRt.targets[cycleRes.targetSymbol];
          const rampMs = morphMs * 0.80;
          const eased = easeInOutCubic(Math.min(1, cycle.phaseElapsedMs / Math.max(1, rampMs)));
          const invEased = 1 - eased;
          const len = symRt.curPos.length;
          for (let i = 0; i < len; i++) {
            symRt.interpTarget[i] = symRt.morphStartPos[i] * invEased + dest[i] * eased;
          }
          stepCriticallyDampedSpringBuffer(
            symRt.curPos,
            symRt.vel,
            symRt.interpTarget,
            dt,
            symbolSpringOmega,
          );
          symRt.posAttr.needsUpdate = true;
          symRt.isSettled = false;
          symbolMovedThisFrame = true;
        } else if (isCycleActive && !symRt.isSettled) {
          // Finish final tiny settling after morph completes while new symbol edges fade in
          const dest = symRt.targets[cycle.edgeSymbol];
          const maxDistSq = stepCriticallyDampedSpringBuffer(
            symRt.curPos,
            symRt.vel,
            dest,
            dt,
            symbolSpringOmega,
          );
          symRt.posAttr.needsUpdate = true;
          symbolMovedThisFrame = true;
          if (maxDistSq < 1e-8) {
            symRt.curPos.set(dest);
            symRt.vel.fill(0);
            symRt.posAttr.needsUpdate = true;
            symRt.isSettled = true;
          }
        }

        if (cycleRes.switchedEdgeSymbol) {
          symRt.syncEdgeBuffer(cycle.edgeSymbol);
          symRt.rebuildPackets(cycle.edgeSymbol);
        } else if (symbolMovedThisFrame && cycle.edgeAlpha > 0.001) {
          // Keep fading-out / fading-in edges and packets anchored to the moving nodes
          symRt.syncEdgeBuffer(cycle.edgeSymbol);
          symRt.refreshPacketEndpoints();
        }

        sharedUniforms.uSymbolEdgeAlpha.value = cycle.edgeAlpha;
        const symbolEdgesVisible = cycle.edgeAlpha > 0.004;
        activeMeshes.symbolLineSegments.visible = symbolEdgesVisible;
        activeMeshes.symbolPacketPoints.visible =
          symbolEdgesVisible && currentProfile.idleMotion && !reducedMotionRef.current;

        // Advance symbol packet clock only while symbol edges are visible (never spawn while faded out)
        if (activeMeshes.symbolPacketPoints.visible && isHeroFormed) {
          symbolPacketElapsedSec += dt;
        }
      }

      if (cycleRes.symbolChanged) {
        emitDebugStats(currentMeasuredFps);
      }

      // Dim background ambient/dispersed particles when morph pool has regrouped into a shape
      const morphEngagement =
        activeEffectiveMaxOpacity > 0
          ? Math.min(1, morphVisualAlpha / activeEffectiveMaxOpacity)
          : 0;
      sharedUniforms.uMorphDim.value = 1.0 - morphEngagement * 0.85;

      // Update GPU uniforms directly without extra scene damping
      sharedUniforms.uTime.value = elapsedSec;
      sharedUniforms.uSymbolPacketTime.value = symbolPacketElapsedSec;
      sharedUniforms.uScrollProgress.value = metrics.heroProgress;
      sharedUniforms.uIdleScale.value = currentProfile.idleMotion
        ? computeIdleMotionScale(metrics.heroProgress, reducedMotionRef.current)
        : 0;
      sharedUniforms.uAmbientVisibility.value = currentProfile.ambientField
        ? metrics.ambientFieldVisibility
        : 0;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(tick);
    };

    const resumeLoopIfNeeded = () => {
      if (!isTabHidden && isCanvasVisible && !isLoopRunning) {
        lastTimestamp = performance.now();
        frameId = window.requestAnimationFrame(tick);
      }
    };

    const onVisibilityChange = () => {
      isTabHidden = document.hidden;
      if (isTabHidden) {
        window.cancelAnimationFrame(frameId);
        isLoopRunning = false;
      } else {
        resumeLoopIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            isCanvasVisible = entry.isIntersecting;
            if (!isCanvasVisible) {
              window.cancelAnimationFrame(frameId);
              isLoopRunning = false;
            } else {
              resumeLoopIfNeeded();
            }
          }
        },
        { threshold: 0 },
      );
      intersectionObserver.observe(container);
    }

    frameId = window.requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      unsubscribeTheme();
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(resizeTimeoutId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }
      activeMeshes.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [scrollMetricsRef, scrollArrivalRef]);

  return (
    <div
      ref={mountRef}
      data-testid="delta-canvas-container"
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    />
  );
}

export default DeltaScene;

