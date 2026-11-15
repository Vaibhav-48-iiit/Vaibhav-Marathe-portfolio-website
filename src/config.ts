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
    // DRAFT, replace with my own words
    introText:
      "I'm a Computer Science student at IIIT Surat who started in software engineering and full-stack development before shifting my focus to cybersecurity and ethical hacking. My development background helps me understand how web applications are structured, how client-server communication flows, and where weaknesses tend to appear.",
    tagline: 'Understanding systems. Finding weaknesses. Building better security.',
  },

  // Connect section configuration (06 // ACCESS GRANTED)
  connectConfig: {
    amberStatusLabel: 'ACCESS GRANTED',
    heading: 'Connect',
    introLine: "TODO: my own wording about internships and what I'm looking for.",
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

  fonts: {
    display: "'Instrument Serif', Georgia, serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  },

  timings: {
    // First visit terminal intro duration in milliseconds (~8 seconds total)
    firstVisitDurationMs: 8000,
    // Repeat visit terminal intro duration in milliseconds (~2 seconds total)
    repeatVisitDurationMs: 2000,
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

  idle: {
    // One full idle rotation cycle around the vertical axis (~20 seconds)
    rotationPeriodSec: 20.0,
    // Vertical-axis (Y) rotation amplitude in radians — kept bounded so the Δ never overlaps the title
    rotationAmplitudeY: 0.34,
    // Small tilt amplitude on the X axis in radians
    tiltAmplitudeX: 0.1,
    // Subtle axial roll on the Z axis in radians
    tiltAmplitudeZ: 0.04,
    // Subtle per-node breathing displacement amplitude in world units (GPU shader)
    nodeBreathingAmplitude: 0.03,
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
} as const;

export type SiteConfig = typeof SITE_CONFIG;
export type SectionId = (typeof SITE_CONFIG.sections)[number]['id'];
export type QualityTierName = keyof typeof SITE_CONFIG.qualityTiers.tiers;

