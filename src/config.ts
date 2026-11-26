/**
 * Central Design System, Sections, Navigation, Write-ups, Lenis, Sound & Scene Configuration
 * Edit any value in this file to customize colours, typography, sections,
 * external URLs, write-up defaults, particle counts, intro timings, idle motion,
 * Lenis smooth scrolling, sound synthesis, or camera scroll behaviour.
 */

export interface SectionConfigItem {
  id: 'home' | 'background' | 'skills' | 'projects' | 'writeups' | 'connect';
  navLabel: string;
  kicker: string;
  title: string;
  placeholder: string;
  useAmberKicker?: boolean;
  /** Asymmetric left-column offset class for editorial rhythm (no card grids) */
  offsetClass?: string;
}

export type ShieldSymbolName = 'term' | 'hat' | 'code';
export type ShieldSymbolConfig = 'cycle' | ShieldSymbolName;

/**
 * Active interior symbol mode inside the hero 3D shield: "cycle" | "term" | "hat" | "code".
 * Default "cycle" loops continuously through SYMBOL_ORDER; a fixed value shows that symbol statically.
 */
export const SHIELD_SYMBOL: ShieldSymbolConfig = 'cycle';

/**
 * Ordered cycle of interior shield symbols. Starts on "term" and loops forever.
 */
export const SYMBOL_ORDER: readonly ShieldSymbolName[] = ['term', 'hat', 'code'] as const;

/**
 * Duration in milliseconds to hold each formed symbol before starting the morph to the next symbol.
 */
export const SYMBOL_HOLD_MS = 5000;

/**
 * Duration in milliseconds for symbol nodes to morph between shapes (ease-in-out).
 */
export const SYMBOL_MORPH_MS = 1200;

/**
 * Target height of the hero 3D shield as a fraction of viewport height at hero depth (z = 0).
 */
export const SHIELD_HEIGHT_VH = 0.42;

// Exact 48-node interior symbol geometry in the 100 x 120 shield coordinate box (y down).
// Node i of each symbol sits at a similar angle around centre (50, 58) so node i morphs directly
// to node i of the next symbol without tangling.
export const termNodes: readonly (readonly [number, number])[] = [
  [36, 48], [37, 48.7], [38.1, 49.4], [39.1, 50.1], [40.1, 50.7], [41.1, 51.4], [42.2, 52.1], [43.2, 52.8],
  [44.2, 53.5], [45.3, 54.2], [46.3, 54.9], [47.3, 55.5], [48.3, 56.2], [49.4, 56.9], [50.4, 57.6], [51.4, 58.3],
  [52.5, 59], [53.5, 59.7], [53.5, 60.3], [72, 75], [70.7, 75], [69.5, 75], [68.2, 75], [66.9, 75],
  [65.6, 75], [64.4, 75], [52.5, 61], [63.1, 75], [61.8, 75], [60.5, 75], [59.3, 75], [58, 75],
  [51.4, 61.7], [50.4, 62.4], [49.4, 63.1], [48.3, 63.8], [47.3, 64.5], [46.3, 65.1], [45.3, 65.8], [44.2, 66.5],
  [43.2, 67.2], [42.2, 67.9], [41.1, 68.6], [40.1, 69.3], [39.1, 69.9], [38.1, 70.6], [37, 71.3], [36, 72],
] as const;

export const termEdges: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
  [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 26], [19, 20],
  [20, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 27], [26, 32], [27, 28], [28, 29], [29, 30],
  [30, 31], [32, 33], [33, 34], [34, 35], [35, 36], [36, 37], [37, 38], [38, 39], [39, 40], [40, 41],
  [41, 42], [42, 43], [43, 44], [44, 45], [45, 46], [46, 47],
] as const;

export const hatNodes: readonly (readonly [number, number])[] = [
  [33.5, 56.6], [37, 55.2], [40, 54], [40.6, 54], [44.3, 54], [41, 50], [41.1, 49.7], [42.2, 45.4],
  [45.5, 50], [48.1, 54], [43.9, 41.6], [48, 39.9], [50, 50], [52, 39.9], [56.1, 41.6], [51.9, 54],
  [54.5, 50], [57.8, 45.4], [58.9, 49.7], [59, 50], [55.7, 54], [59.4, 54], [60, 54], [63, 55.2],
  [66.5, 56.6], [70, 58], [66.5, 59.4], [63, 60.8], [59.4, 62], [55.7, 62], [60, 72], [51.9, 62],
  [57, 77], [55, 72], [54, 82], [52.3, 77], [50, 72], [47.7, 77], [46, 82], [45, 72],
  [43, 77], [48.1, 62], [40, 72], [44.3, 62], [40.6, 62], [37, 60.8], [33.5, 59.4], [30, 58],
] as const;

export const hatEdges: readonly (readonly [number, number])[] = [
  [0, 1], [0, 47], [1, 3], [2, 6], [3, 4], [4, 9], [5, 8], [6, 7], [7, 10], [8, 12],
  [9, 15], [10, 11], [11, 13], [12, 16], [13, 14], [14, 17], [15, 20], [16, 19], [17, 18], [18, 22],
  [20, 21], [21, 23], [23, 24], [24, 25], [25, 26], [26, 27], [27, 28], [28, 29], [29, 31], [30, 33],
  [31, 41], [32, 35], [33, 36], [34, 38], [35, 37], [36, 39], [37, 40], [39, 42], [41, 43], [43, 44],
  [44, 45], [45, 46], [46, 47],
] as const;

export const codeNodes: readonly (readonly [number, number])[] = [
  [32.2, 56.3], [32.8, 52.9], [41, 55], [34.1, 49.8], [36, 47], [44, 52], [38.3, 44.5], [41, 42.4],
  [44.2, 41.1], [47.5, 40.3], [50.8, 40.1], [54.2, 40.6], [51.5, 54], [53, 50], [57.4, 41.8], [60.4, 43.5],
  [56, 52], [63, 45.6], [65.1, 48.3], [66.6, 51.4], [59, 55], [67.6, 54.6], [50, 58], [62, 58],
  [68, 58], [67.6, 61.4], [59, 61], [66.6, 64.6], [65.1, 67.7], [63, 70.4], [56, 64], [60.4, 72.5],
  [57.4, 74.2], [54.2, 75.4], [50.8, 75.9], [47.5, 75.7], [44.2, 74.9], [48.5, 62], [47, 66], [41, 73.6],
  [38.3, 71.5], [44, 64], [36, 69], [34.1, 66.2], [41, 61], [32.8, 63.1], [32.2, 59.7], [38, 58],
] as const;

export const codeEdges: readonly (readonly [number, number])[] = [
  [0, 1], [0, 46], [1, 3], [2, 5], [2, 47], [3, 4], [4, 6], [6, 7], [7, 8], [8, 9],
  [9, 10], [10, 11], [11, 14], [12, 13], [12, 22], [14, 15], [15, 17], [16, 20], [17, 18], [18, 19],
  [19, 21], [20, 23], [21, 24], [22, 37], [23, 26], [24, 25], [25, 27], [26, 30], [27, 28], [28, 29],
  [29, 31], [31, 32], [32, 33], [33, 34], [34, 35], [35, 36], [36, 39], [37, 38], [39, 40], [40, 42],
  [41, 44], [42, 43], [43, 45], [44, 47], [45, 46],
] as const;

export const SITE_CONFIG = {
  identity: {
    owner: 'VAIBHAV MARATHE',
    siteTitleSuffix: 'Vaibhav Marathe',
    defaultDocumentTitle: 'Vaibhav Marathe — Cybersecurity Portfolio',
    defaultMetaDescription:
      'Personal cybersecurity portfolio of Vaibhav Marathe featuring a recon terminal intro, scroll-driven 3D Delta network, and lab write-ups.',
    handle: 'vaibhav.marathe',
    role: 'IIIT Surat · Cybersecurity',
    mark: 'Δ',
    placeholderText: 'Placeholder, content in a later phase',
  },

  // Hero-specific configurable labels
  hero: {
    roleLabel: 'IIIT Surat · Cybersecurity',
    scrollPromptText: 'scroll to traverse depth',
    plainViewPromptText: 'plain view active — static layout',
    // Replaces the former "Δ lattice locked" text; default blank as requested
    latticeStatusText: '',
  },

  // Lenis smooth scrolling configuration (single source of truth for scroll progress)
  lenis: {
    duration: 1.05,
    // Exponential ease-out curve for responsive, non-laggy smooth scrolling
    easing: (t: number): number => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // Keep syncTouch OFF so touch devices use native scrolling
    syncTouch: false,
    // Offset in pixels for fixed top bar when scrolling to sections
    headerOffsetPx: -56,
  },

  // Optional synthesised Web Audio API sound configuration (OFF by default)
  sound: {
    // If false, the mute/unmute toggle in the top bar is hidden entirely
    SOUND_ENABLED: false,
    defaultMuted: true,
    storageKey: 'vm_portfolio_sound_muted_v1',
    keyClickFrequencyHz: 1180,
    keyClickDurationSec: 0.014,
    keyClickGain: 0.025,
  },

  // External profile & document links (synced with src/content.js)
  externalLinks: {
    // TODO: confirm the file exists in /public
    resume: '/Vaibhav_Marathe_Resume.pdf',
    github: 'https://github.com/Vaibhav-48-iiit',
    linkedin: 'https://www.linkedin.com/in/cyber-vaibhav',
    tryhackme: 'https://tryhackme.com/p/CyberVaibhav',
    x: 'https://x.com/whoami_vaibhav',
    email: 'vaibhavashokm123@gmail.com',
    mailto: 'mailto:vaibhavashokm123@gmail.com',
  },

  // Background config fields (referenced alongside src/content.js)
  backgroundConfig: {
    introText:
      "I'm a Computer Science student at IIIT Surat. I started in software development with React, Node.js and MongoDB, then moved to security because I want to work on the offensive side. I'm learning penetration testing and web application testing through TryHackMe and PortSwigger's Web Security Academy, and I've completed Pre Security, Cyber Security 101 and the Mr Robot CTF. Right now I'm working through the Junior Penetration Tester path and learning Burp Suite.",
    tagline: 'Understanding systems. Finding weaknesses. Building better security.',
  },

  // Connect section configuration (06 // ACCESS GRANTED)
  connectConfig: {
    amberStatusLabel: 'ACCESS GRANTED',
    heading: 'Connect',
    introLine:
      "I'm looking for penetration testing, VAPT and web application security internships, in India or remote. Email is the quickest way to reach me.",
    statusLine: 'Open to internships, Summer 2027 · Surat, India',
    copyEmailLabel: 'Copy email',
    copiedConfirmationLabel: 'copied',
    backToTopLabel: 'Back to top ↑',
  },

  // Write-ups configuration (empty state line, guided lab banner, and default summaries)
  writeupsConfig: {
    emptyStateLine:
      'Write-ups are in progress. First up: Mr Robot CTF (TryHackMe).',
    emptyStateProfileLabel: 'TryHackMe profile',
    viewAllLabel: 'View all write-ups',
    backToAllLabel: 'Back to all write-ups',
    guidedLabBanner:
      'Guided TryHackMe lab: this is my own walkthrough of a published room, not original research.',
    originalResearchBanner:
      'Original research & independent analysis.',
    mrRobotDefaultSummary:
      'Nmap recon, Gobuster enumeration, WordPress enumeration, shell access, hash cracking, and privilege escalation through an SUID Nmap binary.',
  },

  // Ordered scroll skeleton sections
  sections: [
    {
      id: 'home',
      navLabel: 'Home',
      kicker: '01 // RECON',
      title: 'VAIBHAV MARATHE',
      placeholder: 'Placeholder, content in a later phase',
      offsetClass: 'md:pl-0',
    },
    {
      id: 'background',
      navLabel: 'Background',
      kicker: '02 // ENUMERATION',
      title: 'Background',
      placeholder: 'Placeholder, content in a later phase',
      offsetClass: 'md:pl-8',
    },
    {
      id: 'skills',
      navLabel: 'Skills',
      kicker: '03 // SCANNING',
      title: 'Skills',
      placeholder: 'Placeholder, content in a later phase',
      offsetClass: 'md:pl-16',
    },
    {
      id: 'projects',
      navLabel: 'Projects / CTFs',
      kicker: '04 // EXPLOITATION',
      title: 'Projects / CTFs',
      placeholder: 'Placeholder, content in a later phase',
      offsetClass: 'md:pl-4',
    },
    {
      id: 'writeups',
      navLabel: 'Writeups',
      kicker: '05 // REPORT',
      title: 'Writeups',
      placeholder: 'Placeholder, content in a later phase',
      offsetClass: 'md:pl-12',
    },
    {
      id: 'connect',
      navLabel: 'Connect',
      kicker: '06 // ACCESS GRANTED',
      title: 'Connect',
      placeholder: 'Placeholder, content in a later phase',
      useAmberKicker: true, // Uses reserved #E8A33D amber for "ACCESS GRANTED" status line
      offsetClass: 'md:pl-0',
    },
  ] satisfies readonly SectionConfigItem[],

  // Client-side routing configuration
  // NOTE FOR DEPLOY PHASE: The hosting provider must be configured to serve `index.html`
  // for unknown paths (SPA fallback) so direct loads of `/writeups` and `/writeups/:slug` work.
  routing: {
    basePath: '/',
    writeupsBasePath: '/writeups',
    plannedWriteupSlugs: ['mr-robot'] as const,
  },

  colors: {
    background: '#0B0D10', // Deep carbon-slate, never pure black
    text: '#E8E4DA', // Warm bone-ivory for high-contrast readability
    textMuted: '#9A968E', // Subdued warm neutral for secondary labels
    accent: '#4FD1D9', // Cyan, used sparingly for active markers & subtle node highlights
    amber: '#E8A33D', // Reserved strictly for "ACCESS GRANTED" status line and warnings only
    lineSubtle: '#262C36', // Hairline structural border colour
  },

  /**
   * Dark & Light Theme Configuration (In-memory only; always starts in 'dark' on every load)
   *
   * MEASURED WCAG 2.1 CONTRAST RATIOS (every text/background pair >= 4.5:1):
   * ------------------------------------------------------------------------
   * DARK THEME (Page & solid text backing layer: #0B0D10, relative luminance L = 0.00402):
   *   1. Primary text (#E8E4DA) on background (#0B0D10)       -> 15.10 : 1  (>= 4.5:1 PASS)
   *   2. Muted text (#9A968E) on background (#0B0D10)         ->  6.56 : 1  (>= 4.5:1 PASS)
   *   3. Accent cyan (#4FD1D9) on background (#0B0D10)        -> 10.94 : 1  (>= 4.5:1 PASS)
   *   4. "ACCESS GRANTED" amber (#E8A33D) on bg (#0B0D10)     ->  9.00 : 1  (>= 4.5:1 PASS)
   *
   * LIGHT THEME (Page & solid text backing layer: #F4F1EA, relative luminance L = 0.8753):
   *   1. Primary ink text (#14161A) on background (#F4F1EA)   -> 16.17 : 1  (>= 4.5:1 PASS)
   *   2. Muted text (#5B5F66) on background (#F4F1EA)         ->  5.69 : 1  (>= 4.5:1 PASS)
   *   3. Accent teal (#0B6F78) on background (#F4F1EA)        ->  4.94 : 1  (>= 4.5:1 PASS)
   *   4. "ACCESS GRANTED" amber (#9A5500) on bg (#F4F1EA)     ->  5.22 : 1  (>= 4.5:1 PASS)
   *   5. Write-up code block text (#E8E4DA) on dark (#0B0D10) -> 15.10 : 1  (>= 4.5:1 PASS)
   *   6. Write-up code block muted (#9A968E) on dark (#0B0D10)->  6.56 : 1  (>= 4.5:1 PASS)
   */
  theme: {
    defaultTheme: 'dark' as const,
    // Keep code blocks on write-up pages dark in both themes
    CODE_BLOCKS_ALWAYS_DARK: true,
    // CSS background/text colour transition duration in milliseconds (skipped under prefers-reduced-motion)
    cssTransitionDurationMs: 250,
    // 3D scene colour lerp duration in milliseconds on theme toggle
    sceneColorLerpDurationMs: 300,
    themes: {
      dark: {
        colorScheme: 'dark',
        metaThemeColor: '#0B0D10',
        background: '#0B0D10',
        text: '#E8E4DA',
        textMuted: '#9A968E',
        accent: '#4FD1D9',
        amber: '#E8A33D',
        lineSubtle: '#262C36',
        scrollbarTrack: '#1A1D22',
        scrollbarThumb: '#3A3F47',
        // 3D scene specific values in dark theme
        sceneNodeColor: '#E8E4DA',
        sceneLineColor: '#4FD1D9',
        sceneLineAlpha: 0.26,
        sceneHighlightColor: '#4FD1D9',
        sceneAmberColor: '#E8A33D',
        scenePointSizeScale: 1.0,
        scenePacketAdditiveBlending: true,
      },
      light: {
        colorScheme: 'light',
        metaThemeColor: '#F4F1EA',
        background: '#F4F1EA',
        text: '#14161A',
        textMuted: '#5B5F66',
        accent: '#0B6F78',
        amber: '#9A5500',
        lineSubtle: '#D8D3C7',
        scrollbarTrack: '#E6E1D6',
        scrollbarThumb: '#B2ACA0',
        // 3D scene specific values in light theme: ink nodes/lines, ~0.35 line alpha, teal accent, normal blending, slightly larger particles
        sceneNodeColor: '#14161A',
        sceneLineColor: '#14161A',
        sceneLineAlpha: 0.35,
        sceneHighlightColor: '#0B6F78',
        sceneAmberColor: '#9A5500',
        scenePointSizeScale: 1.18,
        scenePacketAdditiveBlending: false,
      },
    },
  },

  fonts: {
    display: "'Instrument Serif', Georgia, serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  },

  timings: {
    // First visit terminal intro duration in milliseconds (~5 seconds total)
    firstVisitDurationMs: 5000,
    // Repeat visit terminal intro duration in milliseconds (~2 seconds total)
    repeatVisitDurationMs: 2000,
    // Hard failsafe timeouts so the intro is guaranteed to end even if timers are interrupted
    firstVisitFailsafeMs: 7000,
    repeatVisitFailsafeMs: 3000,
    // Delay after the final line before clearing the terminal and resolving the hero
    clearHoldMs: 550,
    // LocalStorage key used to detect repeat visits
    visitStorageKey: 'vm_portfolio_visited_v1',
    // LocalStorage key used to remember the "Plain view" toggle preference
    plainViewStorageKey: 'vm_portfolio_plain_view_v1',
  },

  particles: {
    // Adaptive node counts based on viewport width and GPU capability
    desktopCount: 190,
    mobileCount: 95,
    lowEndCount: 65,
    // Sparse ambient depth particles for sections after Home (low density, low opacity)
    ambientDesktopCount: 85,
    ambientMobileCount: 45,
    ambientLowEndCount: 30,
    ambientOpacity: 0.18,
    // Faint static particle layer count & opacity on write-up reading pages
    writeupStaticCount: 36,
    writeupStaticOpacity: 0.12,
    // Maximum devicePixelRatio cap
    maxPixelRatio: 2,
    // Maximum distance between two nodes in the Δ lattice to draw a connecting edge
    maxConnectionDistance: 0.72,
    // Maximum connections per node to keep the network crisp and un-cluttered
    maxConnectionsPerNode: 4,
    // Slow ambient rotation speed (radians per second) when at top of page
    ambientRotationSpeed: 0.14,
    // Triangle (Δ) radius in 3D world units
    deltaRadius: 2.35,
    // Depth thickness of the Δ lattice when formed
    deltaThickness: 0.36,
  },

  // Hero 3D shield structure & interior symbol definitions (coordinates in a 100 x 120 box, y down)
  shield: {
    SHIELD_SYMBOL,
    SYMBOL_ORDER,
    SYMBOL_HOLD_MS,
    SYMBOL_MORPH_MS,
    SHIELD_HEIGHT_VH,
    // Under 768px viewport width, use 30% of viewport height
    mobileHeightVh: 0.30,
    // Desktop final rendered height clamp in CSS pixels
    desktopMinHeightPx: 260,
    desktopMaxHeightPx: 480,
    // Minimum clearance gap in CSS pixels from "VAIBHAV MARATHE" at any viewport width
    nameClearanceGapPx: 40,
    // Safe vertical margin in CSS pixels from top nav bar and hero bottom line on short windows
    verticalClearanceMarginPx: 16,
    // Dot size, line thickness, and packet scaling factor relative to the smaller hero shield
    visualScaleFactor: 1.25,
    // Desktop high-tier FPS threshold below which hero node size/alpha trim applies before node count reduction
    highTierFpsTrimThreshold: 55,
    boxWidth: 100,
    boxHeight: 120,
    // Base shield outline world height (~42% of visible world height 6.296 at cameraStartZ = 7.6, fov = 45)
    worldHeight: 2.64,
    // Subdivide outline edges so nodes sit about every 5 units in the 100 x 120 coordinate box
    subdivideStepUnits: 5,
    // 3 z-layers at -0.15, 0, +0.15 of the shield height (scales proportionally with shield height)
    zLayerFractions: [-0.15, 0, 0.15] as const,
    // Closed outer shield outline (14 vertices)
    outerOutline: [
      [50, 6],
      [72, 12],
      [92, 16],
      [92, 40],
      [90, 62],
      [80, 84],
      [66, 102],
      [50, 114],
      [34, 102],
      [20, 84],
      [10, 62],
      [8, 40],
      [8, 16],
      [28, 12],
    ] as const,
    // Closed inner shield outline (14 vertices, matching index order with outerOutline)
    innerOutline: [
      [50, 16],
      [68, 21],
      [84, 24],
      [84, 42],
      [82, 60],
      [73, 78],
      [61, 93],
      [50, 102],
      [39, 93],
      [27, 78],
      [18, 60],
      [16, 42],
      [16, 24],
      [32, 21],
    ] as const,
    // Short radial links pairing each outer node index to the inner node of the same index
    radialLinks: [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [7, 7],
      [8, 8],
      [9, 9],
      [10, 10],
      [11, 11],
      [12, 12],
      [13, 13],
    ] as const,
    // Symbol edge fade timings during morph transitions
    symbolEdgeFadeOutMs: 250,
    symbolEdgeFadeInMs: 300,
    // Direct references to the exact 48-node symbol arrays
    termNodes,
    termEdges,
    hatNodes,
    hatEdges,
    codeNodes,
    codeEdges,
    // Interior symbol definitions in the 100 x 120 box (48 nodes per symbol, pure nodes and edges)
    symbols: {
      term: {
        nodes: termNodes,
        edges: termEdges,
        subdivideStepUnits: 0,
        // Thick stroke bundle (~1.25x scaled for 260-480px shield height; adjacent strands < 1px apart so solid lines, no fills/glow)
        thickStrokeOffsets: [-0.42, -0.21, 0, 0.21, 0.42] as const,
      },
      hat: {
        nodes: hatNodes,
        edges: hatEdges,
        subdivideStepUnits: 0,
        thickStrokeOffsets: [-0.24, 0, 0.24] as const,
      },
      code: {
        nodes: codeNodes,
        edges: codeEdges,
        subdivideStepUnits: 0,
        thickStrokeOffsets: [-0.24, 0, 0.24] as const,
      },
    },
  },

  idle: {
    // Gentle yaw sway cycle around vertical axis (~14 seconds, +/-15 degrees, never goes edge-on)
    rotationPeriodSec: 14.0,
    // Vertical-axis (Y) sway amplitude in radians (~15 degrees = 0.2618 rad)
    rotationAmplitudeY: 0.2618,
    // Very slight tilt amplitude on the X axis in radians (~3.4 degrees)
    tiltAmplitudeX: 0.06,
    // Very slight axial roll on the Z axis in radians (~1.4 degrees)
    tiltAmplitudeZ: 0.025,
    // Subtle per-node breathing displacement amplitude in world units (GPU shader)
    nodeBreathingAmplitude: 0.014,
    // Number of bright cyan pulses (4 to 6) travelling along existing lattice edges
    packetCount: 5,
    // Number of connected edge hops in each packet's continuous loop
    packetPathHops: 24,
    // Speed of travelling packets in edge-hops per second
    packetSpeedHopsPerSec: 1.75,
    // Length of the glowing pulse trail along an edge (in hop units)
    packetTailLength: 0.38,
    // Point size of the bright cyan travelling packet pulses
    packetSize: 0.15,
    // Optional scan pulse flag (default OFF): faint brightness wave through nodes every ~12s
    enableScanPulse: false,
    // Period of the optional scan pulse wave in seconds (~12 seconds)
    scanPulsePeriodSec: 12.0,
    // Peak brightness boost of the optional scan pulse wave
    scanPulseIntensity: 0.35,
  },

  // Adaptive 3D quality tiers (high / medium / low) and FPS downgrade thresholds
  qualityTiers: {
    fpsDowngradeThreshold: 45,
    sampleWindowSec: 2.0,
    maxDowngradeChecks: 2,
    desktopMaxPixelRatio: 2.0,
    mobileMaxPixelRatio: 1.5,
    tiers: {
      high: {
        particleCount: 190,
        ambientParticleCount: 85,
        pixelRatioCap: 2.0,
        idleMotion: true,
        ambientField: true,
      },
      medium: {
        particleCount: 95,
        ambientParticleCount: 45,
        pixelRatioCap: 1.5,
        idleMotion: true,
        ambientField: true,
      },
      low: {
        // Low tier shows a static lattice with simple dispersal and no ambient field
        particleCount: 65,
        ambientParticleCount: 0,
        pixelRatioCap: 1.0,
        idleMotion: false,
        ambientField: false,
      },
    },
  },

  // Performance, resize debouncing, and active section threshold configuration
  performance: {
    resizeDebounceMs: 150,
    // Ignore mobile address-bar height-only changes smaller than this threshold
    mobileAddressBarDeltaThresholdPx: 140,
    // Switch active-section highlight in nav when a section's heading is ~40% down the viewport
    activeSectionHeadingViewportRatio: 0.4,
    // Cap particle sizes in screen pixels so no large soft discs appear near camera
    maxNodePointSizePx: 6.5,
    maxAmbientPointSizePx: 3.8,
    maxNearCameraAlpha: 0.72,
  },

  scroll: {
    // Scroll distance (in viewport heights) over which the hero Δ fully disperses into depth
    dispersionScrollVh: 1.15,
    // How far along -Z (into camera depth) hero particles stream during dispersion
    streamDepthDistance: 11.5,
    // Radial outward expansion factor during hero scroll dispersion
    radialSpreadFactor: 2.4,
    // Starting Z position of the 3D camera at the top of the page (Home)
    cameraStartZ: 7.6,
    // Total forward depth travel (along -Z) of the camera from Home (top) to Connect (bottom)
    cameraTravelDepth: 18.0,
  },

  // Section-arrival reveal animation configuration (home page sections after Hero only)
  sectionReveal: {
    // Fade and translateY duration in milliseconds
    durationMs: 300,
    // CSS timing function for section-arrival transitions
    easing: 'ease-out',
    // Vertical upward translation distance in pixels (8px -> 0px)
    translateYDistancePx: 8,
    // Stagger step between ordered elements inside a section in milliseconds
    staggerMs: 20,
    // Maximum number of staggered items per section (0..80ms delay; ~380ms total)
    staggerCap: 5,
    // Minimum fraction of a section that must be in view to trigger normal-scroll reveal (5%)
    intersectionThreshold: 0.05,
    // Root margin so normal-scroll fade begins just as the section comes into view
    rootMargin: '0px 0px 12% 0px',
    // Failsafe delay in milliseconds if a section is >= 5% in view and has not animated
    failsafeTimeoutMs: 200,
  },

  // Particle morph system configuration (HERO -> AMBIENT -> TOPOLOGY / DOLLAR -> HASH)
  morph: {
    // Under 768px width, morphs are off by default; particles stay ambient
    MORPH_ON_MOBILE: false,
    // Morph subset particle counts per quality tier (shared pool)
    tierParticleCounts: {
      high: 1200,
      medium: 600,
      low: 0,
    },
    // Formation duration in milliseconds (~1,000 to 1,400 ms ease-out)
    formationDurationMs: 1150,
    // Critically damped spring angular frequency (rad/s) for smooth retargeting without overshoot
    springOmega: 4.6,
    hashSpringOmega: 5.2,
    // Hold time in milliseconds for the "$" glyph after formation before morphing to "#"
    dollarHoldMs: 700,
    // Duration in milliseconds for "$" -> "#" morph and cyan (#4FD1D9) -> amber (#E8A33D) colour lerp
    hashMorphDurationMs: 1000,
    // Interval in milliseconds between the 3 leaf nodes lighting up cyan (#4FD1D9) on Skills arrival
    topologyPortScanIntervalMs: 400,
    // Runtime readability opacity cap if a shape's bounding box overlaps a text block on desktop
    overlapMaxOpacityCap: 0.18,

    // Skills section: Hub-and-spoke network topology (1 gateway hub, 3 sub-hubs, 11 leaf hosts)
    topology: {
      anchorX: 0.72,
      anchorY: 0.5,
      scale: 0.42,
      maxOpacity: 0.22,
      litLeafCount: 3,
      preferredLitLeafNodeIndices: [4, 9, 13] as const,
      // Coordinates in normalized shape space [-0.5, +0.5]
      nodes: [
        // 0: Gateway hub (center)
        { id: 0, role: 'gateway', x: 0.0, y: 0.0, z: 0.0, radius: 0.034 },
        // 1..3: 3 Sub-hubs
        { id: 1, role: 'subhub', x: -0.17, y: 0.18, z: 0.02, radius: 0.026 },
        { id: 2, role: 'subhub', x: 0.21, y: 0.12, z: -0.02, radius: 0.026 },
        { id: 3, role: 'subhub', x: 0.04, y: -0.22, z: 0.015, radius: 0.026 },
        // 4..14: 11 Leaf hosts (connected to sub-hubs 1, 2, 3)
        { id: 4, role: 'leaf', x: -0.08, y: 0.43, z: 0.01, radius: 0.02 },
        { id: 5, role: 'leaf', x: -0.35, y: 0.33, z: -0.02, radius: 0.02 },
        { id: 6, role: 'leaf', x: -0.39, y: 0.08, z: 0.025, radius: 0.02 },
        { id: 7, role: 'leaf', x: 0.16, y: 0.41, z: -0.015, radius: 0.02 },
        { id: 8, role: 'leaf', x: 0.40, y: 0.30, z: 0.02, radius: 0.02 },
        { id: 9, role: 'leaf', x: 0.46, y: 0.07, z: -0.02, radius: 0.02 },
        { id: 10, role: 'leaf', x: 0.37, y: -0.11, z: 0.015, radius: 0.02 },
        { id: 11, role: 'leaf', x: -0.24, y: -0.32, z: -0.02, radius: 0.02 },
        { id: 12, role: 'leaf', x: -0.07, y: -0.45, z: 0.02, radius: 0.02 },
        { id: 13, role: 'leaf', x: 0.20, y: -0.42, z: -0.015, radius: 0.02 },
        { id: 14, role: 'leaf', x: 0.35, y: -0.27, z: 0.02, radius: 0.02 },
      ] as const,
      // Hand-authored undirected edges [nodeA, nodeB]
      edges: [
        // Gateway to 3 sub-hubs
        [0, 1],
        [0, 2],
        [0, 3],
        // Sub-hub ring links
        [1, 2],
        [2, 3],
        // Sub-hub 1 to leaves 4..6
        [1, 4],
        [1, 5],
        [1, 6],
        // Sub-hub 2 to leaves 7..10
        [2, 7],
        [2, 8],
        [2, 9],
        [2, 10],
        // Sub-hub 3 to leaves 11..14
        [3, 11],
        [3, 12],
        [3, 13],
        [3, 14],
      ] as const,
    },

    // Connect section: "$" -> "#" privilege escalation glyph morph
    glyph: {
      anchorX: 0.78,
      anchorY: 0.5,
      // Glyph height is ~40% of the viewport height
      scale: 0.4,
      maxOpacity: 0.9,
      dollarChar: '$',
      hashChar: '#',
      fontFamily: 'JetBrains Mono',
      fontWeight: '700',
      canvasSize: 256,
    },
  },
} as const;

export type SiteConfig = typeof SITE_CONFIG;
export type SectionId = (typeof SITE_CONFIG.sections)[number]['id'];
export type QualityTierName = keyof typeof SITE_CONFIG.qualityTiers.tiers;
export type MorphStateName = 'HERO' | 'AMBIENT' | 'TOPOLOGY' | 'DOLLAR' | 'HASH';
export type ThemeMode = keyof typeof SITE_CONFIG.theme.themes;


