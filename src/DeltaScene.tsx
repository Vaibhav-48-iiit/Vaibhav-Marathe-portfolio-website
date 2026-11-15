import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { SITE_CONFIG, type QualityTierName } from './config';
import {
  buildPacketEdgeLoops,
  computeIdleMotionScale,
  downgradeQualityTier,
  generateAmbientDepthField,
  generateDeltaNetwork,
  resolveQualityTierProfile,
  resolveStartingQualityTier,
  type QualityTierProfile,
  type ScrollMetrics,
} from './particleMath';

export interface SceneDebugStats {
  tier: QualityTierName;
  fps: number;
  particleCount: number;
  ambientParticleCount: number;
  pixelRatio: number;
}

export interface DeltaSceneProps {
  reducedMotion: boolean;
  /** Single source of truth for scroll progress, driven by Lenis (or native fallback in Plain/reducedMotion) */
  scrollMetricsRef: MutableRefObject<ScrollMetrics>;
  /** Optional callback for the `?debug=1` HUD overlay (updated twice per second) */
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

interface TierSceneMeshes {
  pointsGeometry: THREE.BufferGeometry;
  pointsMaterial: THREE.ShaderMaterial;
  pointsMesh: THREE.Points;
  lineGeometry: THREE.BufferGeometry;
  lineMaterial: THREE.ShaderMaterial;
  lineSegments: THREE.LineSegments;
  packetGeometry: THREE.BufferGeometry;
  packetMaterial: THREE.ShaderMaterial;
  packetPoints: THREE.Points;
  ambientGeometry: THREE.BufferGeometry;
  ambientMaterial: THREE.ShaderMaterial;
  ambientPoints: THREE.Points;
  dispose: () => void;
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
 * 4. Adaptive quality tiers (`high` / `medium` / `low`) with 2-second FPS monitoring,
 *    debounced resize handling, visibility pause, and full GPU resource disposal.
 */
export function DeltaScene({
  reducedMotion,
  scrollMetricsRef,
  onDebugStatsChange,
}: DeltaSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const debugCallbackRef = useRef<typeof onDebugStatsChange>(onDebugStatsChange);

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

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SITE_CONFIG.colors.background);

    // 2. Camera (starts at cameraStartZ and moves forward into -Z as the user scrolls through sections)
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      70,
    );
    camera.position.set(0, 0, SITE_CONFIG.scroll.cameraStartZ);

    // 3. Renderer (pixel ratio capped by tier: <=2 on desktop, <=1.5 on mobile)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: currentProfile.tier !== 'low',
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(currentProfile.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const deltaGroup = new THREE.Group();
    scene.add(deltaGroup);

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
      uFogColor: { value: new THREE.Color(SITE_CONFIG.colors.background) },
      uAccentColor: { value: new THREE.Color(SITE_CONFIG.colors.accent) },
      uAmbientVisibility: { value: 0 },
      uMaxNodePointSizePx: { value: SITE_CONFIG.performance.maxNodePointSizePx },
      uMaxAmbientPointSizePx: { value: SITE_CONFIG.performance.maxAmbientPointSizePx },
      uMaxNearCameraAlpha: { value: SITE_CONFIG.performance.maxNearCameraAlpha },
    };

    const buildTierMeshes = (profile: QualityTierProfile): TierSceneMeshes => {
      const network = generateDeltaNetwork(profile.particleCount, 42);

      // --- A. LATTICE NODES (GPU ShaderMaterial with capped point size & near-camera alpha) ---
      const pointsGeometry = new THREE.BufferGeometry();
      pointsGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(network.basePositions, 3),
      );
      pointsGeometry.setAttribute(
        'aDrift',
        new THREE.BufferAttribute(network.driftVectors, 3),
      );
      pointsGeometry.setAttribute(
        'aPhase',
        new THREE.BufferAttribute(network.phases, 1),
      );
      pointsGeometry.setAttribute(
        'aColor',
        new THREE.BufferAttribute(network.nodeColors, 3),
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
          attribute vec3 aColor;

          uniform float uBasePointSize;
          uniform float uPixelRatio;
          uniform float uViewportHeight;
          uniform float uEnableScanPulse;
          uniform float uScanPulsePeriod;
          uniform float uScanPulseIntensity;
          uniform float uMaxNodePointSizePx;
          uniform vec3 uAccentColor;

          varying vec3 vColor;
          varying float vDepthAlpha;

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
              float scanY = mix(2.6, -1.8, scanPhase);
              float band = smoothstep(0.55, 0.0, abs(position.y - scanY));
              pulseBoost = band * uScanPulseIntensity * uIdleScale;
            }

            float rawSize = (uBasePointSize * (1.0 + pulseBoost * 0.35) * uViewportHeight * 0.55 * uPixelRatio) / dist;
            gl_PointSize = clamp(rawSize, 1.5 * uPixelRatio, uMaxNodePointSizePx * uPixelRatio);

            vColor = mix(aColor, uAccentColor, clamp(pulseBoost, 0.0, 1.0));
            float fogDist = length(mvPosition.xyz);
            // Dim dispersed hero particles so they never pass behind body text at high brightness
            float scrollDim = mix(1.0, 0.22, clamp(uScrollProgress, 0.0, 1.0));
            vDepthAlpha = clamp(exp(-0.0045 * fogDist * fogDist), 0.0, 1.0) * nearFade * scrollDim;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uMaxNearCameraAlpha;
          varying vec3 vColor;
          varying float vDepthAlpha;

          void main() {
            if (vDepthAlpha < 0.01) discard;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r2 = dot(cxy, cxy);
            if (r2 > 1.0) discard;
            float softEdge = smoothstep(1.0, 0.3, r2);
            float alpha = min(uMaxNearCameraAlpha, 0.90 * softEdge * vDepthAlpha);
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
      });

      const pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);
      pointsMesh.frustumCulled = false;
      deltaGroup.add(pointsMesh);

      // --- B. CONNECTING LATTICE EDGES ---
      const edgeCount = network.edgeIndices.length / 2;
      const edgePositions = new Float32Array(edgeCount * 6);
      const edgeDrifts = new Float32Array(edgeCount * 6);
      const edgePhases = new Float32Array(edgeCount * 2);

      for (let e = 0; e < edgeCount; e++) {
        const idxA = network.edgeIndices[e * 2];
        const idxB = network.edgeIndices[e * 2 + 1];

        const a3 = idxA * 3;
        const b3 = idxB * 3;
        const out6 = e * 6;

        edgePositions[out6] = network.basePositions[a3];
        edgePositions[out6 + 1] = network.basePositions[a3 + 1];
        edgePositions[out6 + 2] = network.basePositions[a3 + 2];
        edgePositions[out6 + 3] = network.basePositions[b3];
        edgePositions[out6 + 4] = network.basePositions[b3 + 1];
        edgePositions[out6 + 5] = network.basePositions[b3 + 2];

        edgeDrifts[out6] = network.driftVectors[a3];
        edgeDrifts[out6 + 1] = network.driftVectors[a3 + 1];
        edgeDrifts[out6 + 2] = network.driftVectors[a3 + 2];
        edgeDrifts[out6 + 3] = network.driftVectors[b3];
        edgeDrifts[out6 + 4] = network.driftVectors[b3 + 1];
        edgeDrifts[out6 + 5] = network.driftVectors[b3 + 2];

        edgePhases[e * 2] = network.phases[idxA];
        edgePhases[e * 2 + 1] = network.phases[idxB];
      }

      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
      lineGeometry.setAttribute('aDrift', new THREE.BufferAttribute(edgeDrifts, 3));
      lineGeometry.setAttribute('aPhase', new THREE.BufferAttribute(edgePhases, 1));

      const lineMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...sharedUniforms,
        },
        vertexShader: /* glsl */ `
          attribute vec3 aDrift;
          attribute float aPhase;

          varying float vLineAlpha;

          ${SHARED_IDLE_SCROLL_GLSL}

          void main() {
            vec3 blendedPos = computeBlendedPosition(position, aDrift, aPhase);
            vec4 mvPosition = modelViewMatrix * vec4(blendedPos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float p = clamp(uScrollProgress, 0.0, 1.0);
            float smoothP = p * p * (3.0 - 2.0 * p);
            vLineAlpha = 0.22 * pow(1.0 - smoothP, 2.2);
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

      const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
      lineSegments.frustumCulled = false;
      deltaGroup.add(lineSegments);

      // --- C. TRAVELLING EDGE PACKETS ---
      const packetLoops = buildPacketEdgeLoops(
        network.edgeIndices,
        profile.particleCount,
        SITE_CONFIG.idle.packetCount,
        SITE_CONFIG.idle.packetPathHops,
      );
      const hopsPerLoop = SITE_CONFIG.idle.packetPathHops;
      const trailSamplesPerPacket = 6;
      const totalPacketVertices = packetLoops.length * hopsPerLoop * trailSamplesPerPacket;

      const pktStartPos = new Float32Array(totalPacketVertices * 3);
      const pktEndPos = new Float32Array(totalPacketVertices * 3);
      const pktStartDrift = new Float32Array(totalPacketVertices * 3);
      const pktEndDrift = new Float32Array(totalPacketVertices * 3);
      const pktPhases = new Float32Array(totalPacketVertices * 2);
      const pktMeta = new Float32Array(totalPacketVertices * 3);

      let vCursor = 0;
      for (let pIdx = 0; pIdx < packetLoops.length; pIdx++) {
        const loop = packetLoops[pIdx];
        for (let h = 0; h < hopsPerLoop; h++) {
          const nodeA = loop.hopNodePairs[h * 2];
          const nodeB = loop.hopNodePairs[h * 2 + 1];
          const a3 = nodeA * 3;
          const b3 = nodeB * 3;

          for (let tSample = 0; tSample < trailSamplesPerPacket; tSample++) {
            const v3 = vCursor * 3;
            const v2 = vCursor * 2;
            const trailFrac = tSample / Math.max(1, trailSamplesPerPacket - 1);

            pktStartPos[v3] = network.basePositions[a3];
            pktStartPos[v3 + 1] = network.basePositions[a3 + 1];
            pktStartPos[v3 + 2] = network.basePositions[a3 + 2];

            pktEndPos[v3] = network.basePositions[b3];
            pktEndPos[v3 + 1] = network.basePositions[b3 + 1];
            pktEndPos[v3 + 2] = network.basePositions[b3 + 2];

            pktStartDrift[v3] = network.driftVectors[a3];
            pktStartDrift[v3 + 1] = network.driftVectors[a3 + 1];
            pktStartDrift[v3 + 2] = network.driftVectors[a3 + 2];

            pktEndDrift[v3] = network.driftVectors[b3];
            pktEndDrift[v3 + 1] = network.driftVectors[b3 + 1];
            pktEndDrift[v3 + 2] = network.driftVectors[b3 + 2];

            pktPhases[v2] = network.phases[nodeA];
            pktPhases[v2 + 1] = network.phases[nodeB];

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
          uniform float uPixelRatio;
          uniform float uViewportHeight;
          uniform float uMaxNodePointSizePx;

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
            float rawPktSize = (uPacketSize * sizeFalloff * uViewportHeight * 0.55 * uPixelRatio) / dist;
            gl_PointSize = clamp(rawPktSize, 1.5 * uPixelRatio, uMaxNodePointSizePx * uPixelRatio);

            vPacketAlpha = (1.0 - trailFrac * 0.82) * uIdleScale;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uAccentColor;
          varying float vPacketAlpha;

          void main() {
            if (vPacketAlpha < 0.01) discard;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r2 = dot(cxy, cxy);
            if (r2 > 1.0) discard;

            float core = smoothstep(0.45, 0.0, r2);
            float halo = smoothstep(1.0, 0.2, r2);
            vec3 pulseColor = mix(uAccentColor, vec3(0.92, 0.99, 1.0), core * 0.65);
            gl_FragColor = vec4(pulseColor, halo * vPacketAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const packetPoints = new THREE.Points(packetGeometry, packetMaterial);
      packetPoints.frustumCulled = false;
      packetPoints.visible = profile.idleMotion;
      deltaGroup.add(packetPoints);

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
          uniform float uPixelRatio;
          uniform float uViewportHeight;
          uniform float uAmbientVisibility;
          uniform float uAmbientMaxOpacity;
          uniform float uMaxAmbientPointSizePx;

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
            float rawAmbientSize = (0.052 * uViewportHeight * 0.55 * uPixelRatio) / dist;
            gl_PointSize = clamp(rawAmbientSize, 1.2 * uPixelRatio, uMaxAmbientPointSizePx * uPixelRatio);

            vColor = aColor;
            vAlpha = min(uAmbientMaxOpacity, uAmbientMaxOpacity * uAmbientVisibility * nearFade * farFade);
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

      return {
        pointsGeometry,
        pointsMaterial,
        pointsMesh,
        lineGeometry,
        lineMaterial,
        lineSegments,
        packetGeometry,
        packetMaterial,
        packetPoints,
        ambientGeometry,
        ambientMaterial,
        ambientPoints,
        dispose: () => {
          deltaGroup.remove(pointsMesh);
          deltaGroup.remove(lineSegments);
          deltaGroup.remove(packetPoints);
          scene.remove(ambientPoints);
          pointsGeometry.dispose();
          pointsMaterial.dispose();
          lineGeometry.dispose();
          lineMaterial.dispose();
          packetGeometry.dispose();
          packetMaterial.dispose();
          ambientGeometry.dispose();
          ambientMaterial.dispose();
        },
      };
    };

    let activeMeshes = buildTierMeshes(currentProfile);

    // Position the Δ group so no part of it ever overlaps "VAIBHAV MARATHE" at any width
    let lastLayoutWidth = window.innerWidth;
    let lastLayoutHeight = Math.max(1, window.innerHeight);

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

      if (width < 768) {
        // Mobile (<768px): title is top-aligned, lattice sits cleanly in the lower half
        deltaGroup.position.set(0, -1.12, 0);
        deltaGroup.scale.setScalar(0.48);
      } else if (width < 1024) {
        // Tablet / compact desktop (768px–1023px): keep lattice strictly in the right half
        deltaGroup.position.set(1.88, -0.05, 0);
        deltaGroup.scale.setScalar(0.60);
      } else if (width < 1280) {
        // Medium desktop (1024px–1279px)
        deltaGroup.position.set(2.18, 0.02, 0);
        deltaGroup.scale.setScalar(0.76);
      } else {
        // Wide desktop (>=1280px)
        deltaGroup.position.set(2.38, 0.05, 0);
        deltaGroup.scale.setScalar(0.90);
      }
    };
    updateLayoutPlacement(true);

    // Debounce resize handling (~150ms)
    let resizeTimeoutId = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimeoutId);
      resizeTimeoutId = window.setTimeout(() => {
        updateLayoutPlacement(false);
      }, SITE_CONFIG.performance.resizeDebounceMs);
    };
    window.addEventListener('resize', onResize);

    // Pause rendering when the canvas is not visible or the tab is hidden
    let isTabHidden = document.hidden;
    let isCanvasVisible = true;
    let frameId = 0;
    let isLoopRunning = false;
    let lastTimestamp = performance.now();
    let elapsedSec = 0;

    // Adaptive FPS downgrade state (first 2s window + optional second 2s window)
    let downgradeChecksCompleted = 0;
    let windowFrames = 0;
    let windowElapsedSec = 0;

    // Half-second debug HUD FPS reporting state
    let debugFrames = 0;
    let debugElapsedSec = 0;
    let currentMeasuredFps = 60;

    const emitDebugStats = (fpsVal: number) => {
      if (debugCallbackRef.current) {
        debugCallbackRef.current({
          tier: currentProfile.tier,
          fps: Math.round(fpsVal),
          particleCount: currentProfile.particleCount,
          ambientParticleCount: currentProfile.ambientField
            ? currentProfile.ambientParticleCount
            : 0,
          pixelRatio: currentProfile.pixelRatio,
        });
      }
    };
    emitDebugStats(60);

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

        // Adaptive downgrade check over each 2-second sampling window (up to 2 checks)
        if (
          downgradeChecksCompleted < SITE_CONFIG.qualityTiers.maxDowngradeChecks &&
          windowElapsedSec >= SITE_CONFIG.qualityTiers.sampleWindowSec
        ) {
          const avgFps = windowFrames / windowElapsedSec;
          downgradeChecksCompleted += 1;
          windowFrames = 0;
          windowElapsedSec = 0;

          if (
            avgFps < SITE_CONFIG.qualityTiers.fpsDowngradeThreshold &&
            currentProfile.tier !== 'low'
          ) {
            const nextTier = downgradeQualityTier(currentProfile.tier);
            applyTierDowngrade(nextTier);
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

      // Update GPU uniforms directly without extra scene damping
      sharedUniforms.uTime.value = elapsedSec;
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
  }, [scrollMetricsRef]);

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
