import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDeltaNetwork,
  generateAmbientDepthField,
  updateParticlesForScroll,
  computeIdleMotionScale,
  computeScrollMetrics,
  buildPacketEdgeLoops,
  resolveDeviceProfile,
  resolveStartingQualityTier,
  resolveQualityTierProfile,
  downgradeQualityTier,
  isSaveDataEnabled,
  hasVisitedBefore,
  markVisited,
  getInitialPlainView,
  savePlainViewPreference,
  isIntroFinishedInSession,
  markIntroFinishedInSession,
  incrementIntroMountCount,
  getIntroMountCount,
  resetIntroSessionStateForTests,
  shouldSkipIntroOnLoad,
  shouldDisableSectionReveal,
  computeRevealStaggerDelayMs,
  resolveInitialHashSectionId,
  shouldTriggerSectionArrival,
  shouldDisableMorph,
  resolveMorphParticleCount,
  createInitialSectionVisibilityMap,
  resolveDominantArrivedSection,
  stepMorphStateMachine,
  generateTopologyTargets,
  computeTopologyNodePortScanIntensities,
  computeHashMorphProgress,
  sampleAndMatchGlyphPairFromRgba,
  stepCriticallyDampedSpringBuffer,
  computeShapeEffectiveMaxOpacity,
  selectNonOverlappingLitLeafNodes,
} from './particleMath';
import { buildWriteupHref, resolveRoute } from './router';
import {
  estimateWriteupReadingTime,
  getActiveWriteupEntries,
  getConfirmedPortfolioContent,
  getPublishedWriteups,
  getRenderableWriteupSections,
  getWriteupBySlug,
  isRenderableText,
  isWriteupUrlPublished,
} from './contentFilter';
import {
  getInitialSoundMuted,
  saveSoundMutedPreference,
} from './soundEngine';
import { SITE_CONFIG } from './config';
import { PORTFOLIO_CONTENT } from './content.js';

test('Intro stability: ?intro=0 skips immediately, session completion is idempotent, mount counter increments once, and failsafe timings are configured', () => {
  resetIntroSessionStateForTests();

  // 1. Failsafe timings: 10s on first visit, 3s on repeat visit
  assert.equal(SITE_CONFIG.timings.firstVisitFailsafeMs, 10000);
  assert.equal(SITE_CONFIG.timings.repeatVisitFailsafeMs, 3000);

  // 2. Normal first load at / does not skip
  assert.equal(
    shouldSkipIntroOnLoad({
      pathname: '/',
      search: '',
      prefersReducedMotion: false,
      plainView: false,
    }),
    false,
  );
  assert.equal(
    shouldSkipIntroOnLoad({
      pathname: '/',
      search: '?debug=1',
      prefersReducedMotion: false,
      plainView: false,
    }),
    false,
  );

  // 3. ?intro=0 skips immediately
  assert.equal(
    shouldSkipIntroOnLoad({
      pathname: '/',
      search: '?intro=0',
      prefersReducedMotion: false,
      plainView: false,
    }),
    true,
  );
  assert.equal(
    shouldSkipIntroOnLoad({
      pathname: '/',
      search: '?intro=0&debug=1',
      prefersReducedMotion: false,
      plainView: false,
    }),
    true,
  );

  // 4. Mount counter increments once per mount
  assert.equal(getIntroMountCount(), 0);
  assert.equal(incrementIntroMountCount(), 1);
  assert.equal(getIntroMountCount(), 1);

  // 5. Session completion flag is set once and cannot be reset by re-renders
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
  assert.equal(isIntroFinishedInSession(), false);
  assert.equal(markIntroFinishedInSession(mockStorage), true);
  assert.equal(isIntroFinishedInSession(), true);
  assert.equal(hasVisitedBefore(mockStorage), true);
  // Second call returns false (idempotent)
  assert.equal(markIntroFinishedInSession(mockStorage), false);
  // Once finished in session, shouldSkipIntroOnLoad is always true
  assert.equal(
    shouldSkipIntroOnLoad({
      pathname: '/',
      search: '',
      prefersReducedMotion: false,
      plainView: false,
    }),
    true,
  );

  resetIntroSessionStateForTests();
});

test('Phase 6: quality tiers, pixel-ratio caps, saveData Plain view default, TODO stripping, and published-only write-up links', () => {
  // 1. Updated background intro and connect intro lines render in full, while TODO strings remain stripped
  const defaultContent = getConfirmedPortfolioContent('');
  assert.equal(
    defaultContent.background.introDraft,
    "I'm a Computer Science student at IIIT Surat. I started in software development with React, Node.js and MongoDB, then moved to security because I want to work on the offensive side. I'm learning penetration testing and web application testing through TryHackMe and PortSwigger's Web Security Academy, and I've completed Pre Security, Cyber Security 101 and the Mr Robot CTF. Right now I'm working through the Junior Penetration Tester path and learning Burp Suite.",
  );
  assert.equal(
    defaultContent.connect.introLine,
    "I'm looking for penetration testing, VAPT and web application security internships, in India or remote. Email is the quickest way to reach me.",
  );
  assert.equal(isRenderableText('TODO: placeholder'), false);

  // 2. Links to a write-up page (e.g. Mr Robot in Broken lane) render ONLY when published:true
  const defaultMrRobotLab = defaultContent.projectsAndCtfs.broken.find(
    (item) => item.id === 'broken-mr-robot',
  );
  assert.ok(defaultMrRobotLab, 'Expected Mr Robot CTF in broken lane');
  assert.equal(
    defaultMrRobotLab.writeupUrl,
    '',
    'Unpublished write-up link must be stripped when published:false',
  );
  assert.equal(isWriteupUrlPublished('/writeups/mr-robot'), false);

  const publishedContent = getConfirmedPortfolioContent('?demo=published');
  const publishedMrRobotLab = publishedContent.projectsAndCtfs.broken.find(
    (item) => item.id === 'broken-mr-robot',
  );
  assert.ok(publishedMrRobotLab);
  assert.equal(
    publishedMrRobotLab.writeupUrl,
    '/writeups/mr-robot',
    'Published write-up link must render when published:true',
  );

  // 3. Starting quality tier selection (phones start at medium or low; desktop starts at high/medium/low)
  assert.equal(
    resolveStartingQualityTier({
      viewportWidth: 1440,
      hardwareConcurrency: 8,
      deviceMemory: 8,
    }),
    'high',
  );
  assert.equal(
    resolveStartingQualityTier({
      viewportWidth: 375,
      hardwareConcurrency: 8,
      deviceMemory: 8,
    }),
    'medium',
    'Phones must start at medium or low, never high',
  );
  assert.equal(
    resolveStartingQualityTier({
      viewportWidth: 375,
      hardwareConcurrency: 2,
      deviceMemory: 2,
    }),
    'low',
  );

  // 4. Adaptive tier downgrade: high -> medium -> low (never upgrades)
  assert.equal(downgradeQualityTier('high'), 'medium');
  assert.equal(downgradeQualityTier('medium'), 'low');
  assert.equal(downgradeQualityTier('low'), 'low');

  // 5. Pixel ratio caps: <= 2 on desktop, <= 1.5 on mobile, and low tier disables idleMotion & ambientField
  const highDesktop = resolveQualityTierProfile({
    tier: 'high',
    viewportWidth: 1280,
    devicePixelRatio: 3.0,
  });
  assert.equal(highDesktop.pixelRatio, 2.0);
  assert.equal(highDesktop.idleMotion, true);
  assert.equal(highDesktop.ambientField, true);

  const medMobile = resolveQualityTierProfile({
    tier: 'medium',
    viewportWidth: 390,
    devicePixelRatio: 3.0,
  });
  assert.equal(medMobile.pixelRatio, 1.5);
  assert.equal(medMobile.isMobile, true);

  const lowTier = resolveQualityTierProfile({
    tier: 'low',
    viewportWidth: 360,
    devicePixelRatio: 3.0,
  });
  assert.equal(lowTier.pixelRatio, 1.0);
  assert.equal(lowTier.idleMotion, false);
  assert.equal(lowTier.ambientField, false);
  assert.equal(lowTier.ambientParticleCount, 0);

  // 6. navigator.connection?.saveData defaults to Plain view
  assert.equal(isSaveDataEnabled({ connection: { saveData: true } }), true);
  assert.equal(isSaveDataEnabled({ connection: { saveData: false } }), false);
  assert.equal(getInitialPlainView(false, null, true), true);
});

test('Phase 5: Lenis config, Connect section channels, hero labels, and sound storage work as specified', () => {
  // 1. Lenis config
  assert.equal(SITE_CONFIG.lenis.smoothWheel, true);
  assert.equal(SITE_CONFIG.lenis.syncTouch, false);
  assert.ok(SITE_CONFIG.lenis.duration > 0);
  assert.ok(SITE_CONFIG.lenis.easing(0) >= 0 && SITE_CONFIG.lenis.easing(0) < 0.01);
  assert.equal(SITE_CONFIG.lenis.easing(1), 1);

  // 2. Hero config labels
  assert.equal(SITE_CONFIG.hero.roleLabel, 'IIIT Surat · Cybersecurity');
  assert.equal(SITE_CONFIG.hero.latticeStatusText, '');

  // 3. Sound config & safe storage
  assert.equal(SITE_CONFIG.sound.SOUND_ENABLED, false);
  assert.equal(getInitialSoundMuted(), true);
  const brokenStorage = {
    getItem: () => {
      throw new Error('Blocked');
    },
    setItem: () => {
      throw new Error('Blocked');
    },
  };
  assert.equal(getInitialSoundMuted(brokenStorage), true);
  assert.doesNotThrow(() => saveSoundMutedPreference(false, brokenStorage));

  // 4. Connect section data
  const content = getConfirmedPortfolioContent();
  assert.equal(content.connect.amberStatusLabel, 'ACCESS GRANTED');
  assert.equal(content.connect.heading, 'Connect');
  assert.equal(
    content.connect.introLine,
    "I'm looking for penetration testing, VAPT and web application security internships, in India or remote. Email is the quickest way to reach me.",
  );
  assert.equal(
    content.connect.statusLine,
    'Open to internships, Summer 2027 · Surat, India',
  );
  assert.deepEqual(
    content.connect.channels.map((c) => c.label),
    ['Email', 'LinkedIn', 'GitHub', 'TryHackMe', 'X', 'Resume (PDF)'],
  );
  assert.equal(content.connect.channels[0].copyValue, 'vaibhavashokm123@gmail.com');
});

test('writeup filtering: published:false shows empty list; published:true with partial sections renders only filled sections and enforces screenshot alt text', () => {
  // 1. Default seed state: mr-robot has published: false and all 9 sections empty
  const defaultPublished = getPublishedWriteups();
  assert.equal(defaultPublished.length, 0, 'Expected 0 published write-ups by default');

  const seedMrRobot = getWriteupBySlug('mr-robot');
  assert.ok(seedMrRobot, 'Expected mr-robot seed entry to exist');
  assert.equal(seedMrRobot.published, false);
  assert.equal(seedMrRobot.type, 'guided-lab');
  assert.equal(
    getRenderableWriteupSections(seedMrRobot).length,
    0,
    'Seed mr-robot with empty TODO sections must render 0 body sections',
  );
  assert.equal(estimateWriteupReadingTime(seedMrRobot), null);

  // 2. Published preview state (?demo=published): mr-robot has published: true and 3 of 9 sections filled
  const demoEntries = getActiveWriteupEntries('?demo=published');
  const demoPublished = getPublishedWriteups(demoEntries);
  assert.equal(demoPublished.length, 1);
  assert.equal(demoPublished[0].slug, 'mr-robot');

  const demoSections = getRenderableWriteupSections(demoPublished[0]);
  assert.deepEqual(
    demoSections.map((s) => s.key),
    ['goal', 'reconnaissance', 'privilegeEscalation'],
    'Only non-empty sections must render in exact order',
  );
  assert.ok(
    estimateWriteupReadingTime(demoPublished[0])?.endsWith('min read'),
    'Expected estimated reading time when sections are populated',
  );

  // 3. Screenshot without alt text must be rejected
  const customEntry = {
    ...seedMrRobot,
    published: true,
    sections: {
      ...seedMrRobot.sections,
      enumeration: {
        paragraphs: [],
        steps: [],
        codeBlocks: [],
        screenshots: [
          { src: '/img/no-alt.png', alt: '', caption: 'Missing alt must not render' },
          {
            src: '/img/valid.png',
            alt: 'Gobuster directory scan terminal output',
            caption: 'Valid screenshot with alt text',
          },
        ],
      },
    },
  };
  const customRendered = getRenderableWriteupSections(customEntry);
  assert.equal(customRendered.length, 1);
  assert.equal(customRendered[0].key, 'enumeration');
  assert.equal(customRendered[0].screenshots.length, 1);
  assert.equal(
    customRendered[0].screenshots[0].alt,
    'Gobuster directory scan terminal output',
  );
});

test('contentFilter excludes all confirmed:false items and empty/TODO strings', () => {
  assert.equal(isRenderableText(''), false);
  assert.equal(isRenderableText('   '), false);
  assert.equal(isRenderableText('TODO: confirm status'), false);
  assert.equal(isRenderableText('completed'), true);

  const content = getConfirmedPortfolioContent();

  // Verify unconfirmed skills never appear in the filtered view
  const allRenderedSkillNames = content.skills.groups.flatMap((g) =>
    g.items.map((i) => i.name),
  );
  const bannedUnconfirmedSkills = [
    'Wireshark',
    'Nikto',
    'Hydra / WPScan',
    'LinPEAS',
    'Bash scripting',
    'TypeScript',
    'Next.js',
    'FastAPI',
    'Docker',
    'VMware',
    'AWS S3 / IAM',
  ];
  for (const unconfirmed of bannedUnconfirmedSkills) {
    assert.ok(
      !allRenderedSkillNames.includes(unconfirmed),
      `Unconfirmed skill "${unconfirmed}" must not be included in rendered content`,
    );
  }

  // Verify confirmed skills are present and split into usedInLab and learning
  assert.ok(allRenderedSkillNames.includes('Nmap'));
  assert.ok(allRenderedSkillNames.includes('Snort'));
  assert.ok(allRenderedSkillNames.includes('Burp Suite'));

  // Verify unconfirmed Built project ("Decentralized Maritime Communication Network") is excluded
  const builtTitles = content.projectsAndCtfs.built.map((p) => p.title);
  assert.deepEqual(builtTitles, [
    'DEXA AI',
    'CCTV Detection, The Distributed Eye',
  ]);
  assert.equal(
    isRenderableText(content.projectsAndCtfs.built[0].status),
    false,
    'DEXA AI empty status must not render',
  );
});

test('generateDeltaNetwork creates deterministic Δ structure with negative-Z depth drift', () => {
  const count = 80;
  const netA = generateDeltaNetwork(count, 42);
  const netB = generateDeltaNetwork(count, 42);

  assert.equal(netA.basePositions.length, count * 3);
  assert.deepEqual(Array.from(netA.basePositions), Array.from(netB.basePositions));
  assert.ok(netA.edgeIndices.length > 0, 'Expected connecting edges in Δ network');

  for (let i = 0; i < count; i++) {
    const dz = netA.driftVectors[i * 3 + 2];
    assert.ok(dz < 0, `Expected particle ${i} Z drift (${dz}) to be negative (into depth)`);
  }
});

test('idle motion moves lattice at scroll=0 and stays static when prefers-reduced-motion is set', () => {
  const count = 60;
  const net = generateDeltaNetwork(count, 99);
  const posT0 = new Float32Array(count * 3);
  const posT5 = new Float32Array(count * 3);
  const posReduced = new Float32Array(count * 3);

  updateParticlesForScroll(net, posT0, 0, 0, false);
  const stateT5 = updateParticlesForScroll(net, posT5, 0, 5.0, false);
  assert.equal(stateT5.idleMotionScale, 1);

  let movedDistance = 0;
  for (let i = 0; i < posT0.length; i++) {
    movedDistance += Math.abs(posT5[i] - posT0[i]);
  }
  assert.ok(movedDistance > 2.0, 'Expected visible idle rotation & breathing at scroll=0');

  const reducedState = updateParticlesForScroll(net, posReduced, 0, 5.0, true);
  assert.equal(reducedState.idleMotionScale, 0);
  for (let i = 0; i < posReduced.length; i++) {
    assert.ok(
      Math.abs(posReduced[i] - net.basePositions[i]) < 1e-6,
      `Expected static base position under reducedMotion at index ${i}`,
    );
  }
});

test('scroll progress smoothly fades idle motion to 0 while dispersing and recombines at scroll=0', () => {
  const count = 60;
  const net = generateDeltaNetwork(count, 99);
  const currentPositions = new Float32Array(count * 3);
  const referenceIdleAtT = new Float32Array(count * 3);

  assert.equal(computeIdleMotionScale(0, false), 1);
  assert.ok(computeIdleMotionScale(0.5, false) < 0.45);
  assert.equal(computeIdleMotionScale(1, false), 0);

  const midState = updateParticlesForScroll(net, currentPositions, 0.85, 4.0, false);
  assert.ok(midState.lineOpacityScale < 0.15, 'Lines should fade as particles disperse');
  assert.ok(midState.idleMotionScale < 0.05, 'Idle motion amplitude should fade near full scroll');

  let totalZShift = 0;
  for (let i = 0; i < count; i++) {
    totalZShift += currentPositions[i * 3 + 2] - net.basePositions[i * 3 + 2];
  }
  assert.ok(totalZShift < -100, 'Particles should stream into negative Z depth on scroll');

  updateParticlesForScroll(net, referenceIdleAtT, 0, 6.2, false);
  const returnState = updateParticlesForScroll(net, currentPositions, 0, 6.2, false);
  assert.equal(returnState.lineOpacityScale, 1);
  assert.equal(returnState.idleMotionScale, 1);
  for (let i = 0; i < currentPositions.length; i++) {
    assert.ok(
      Math.abs(currentPositions[i] - referenceIdleAtT[i]) < 1e-6,
      `Index ${i} failed to recombine smoothly at scroll=0`,
    );
  }
});

test('computeScrollMetrics drives whole-page depth %, hero dispersion, and reversible camera Z travel', () => {
  const vh = 900;
  const docHeight = 6 * vh; // 6 full-viewport sections

  const top = computeScrollMetrics({
    scrollY: 0,
    viewportHeight: vh,
    documentScrollHeight: docHeight,
  });
  assert.equal(top.pageProgress, 0);
  assert.equal(top.heroProgress, 0);
  assert.equal(top.targetCameraZ, SITE_CONFIG.scroll.cameraStartZ);
  assert.equal(top.ambientFieldVisibility, 0);

  const mid = computeScrollMetrics({
    scrollY: 2.5 * vh,
    viewportHeight: vh,
    documentScrollHeight: docHeight,
  });
  assert.equal(mid.pageProgress, 0.5);
  assert.equal(mid.heroProgress, 1);
  assert.ok(mid.targetCameraZ < SITE_CONFIG.scroll.cameraStartZ);
  assert.equal(mid.ambientFieldVisibility, 1);

  const bottom = computeScrollMetrics({
    scrollY: 5 * vh,
    viewportHeight: vh,
    documentScrollHeight: docHeight,
  });
  assert.equal(bottom.pageProgress, 1);
  assert.equal(
    bottom.targetCameraZ,
    SITE_CONFIG.scroll.cameraStartZ - SITE_CONFIG.scroll.cameraTravelDepth,
  );
});

test('generateAmbientDepthField creates sparse ambient particles along the forward depth corridor', () => {
  const field = generateAmbientDepthField(45, 707);
  assert.equal(field.positions.length, 45 * 3);
  assert.equal(field.phases.length, 45);
  assert.equal(field.colors.length, 45 * 3);
});

test('Plain view preference defaults to reducedMotion and persists safely via try/catch', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  assert.equal(getInitialPlainView(false, mockStorage), false);
  assert.equal(getInitialPlainView(true, mockStorage), true);

  savePlainViewPreference(true, mockStorage);
  assert.equal(getInitialPlainView(false, mockStorage), true);

  savePlainViewPreference(false, mockStorage);
  assert.equal(getInitialPlainView(true, mockStorage), false);

  const brokenStorage = {
    getItem: () => {
      throw new Error('Blocked');
    },
    setItem: () => {
      throw new Error('Blocked');
    },
  };
  assert.equal(getInitialPlainView(true, brokenStorage), true);
  assert.doesNotThrow(() => savePlainViewPreference(true, brokenStorage));
});

test('router resolves portfolio root, /writeups index, and /writeups/:slug paths cleanly', () => {
  assert.deepEqual(resolveRoute('/'), { kind: 'portfolio' });
  assert.deepEqual(resolveRoute('/writeups'), { kind: 'writeups-index' });
  assert.deepEqual(resolveRoute('/writeups/'), { kind: 'writeups-index' });
  assert.deepEqual(resolveRoute('/writeups/mr-robot'), {
    kind: 'writeup-detail',
    slug: 'mr-robot',
  });
  assert.equal(buildWriteupHref('mr-robot'), '/writeups/mr-robot');
});

test('buildPacketEdgeLoops creates 4 to 6 staggered edge-to-edge network routes along existing edges', () => {
  const count = 75;
  const net = generateDeltaNetwork(count, 42);
  const loops = buildPacketEdgeLoops(net.edgeIndices, count);

  assert.ok(
    loops.length >= 4 && loops.length <= 6,
    `Expected 4 to 6 packet loops, got ${loops.length}`,
  );

  const validEdges = new Set<string>();
  for (let i = 0; i < net.edgeIndices.length; i += 2) {
    const a = net.edgeIndices[i];
    const b = net.edgeIndices[i + 1];
    validEdges.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
  }

  for (let p = 0; p < loops.length; p++) {
    const { hopNodePairs, staggerOffset } = loops[p];
    assert.ok(staggerOffset >= 0 && staggerOffset < 1, 'Expected staggerOffset in [0, 1)');
    const hops = hopNodePairs.length / 2;
    assert.equal(hops, SITE_CONFIG.idle.packetPathHops);

    for (let h = 0; h < hops; h++) {
      const from = hopNodePairs[h * 2];
      const to = hopNodePairs[h * 2 + 1];
      const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
      assert.ok(validEdges.has(key), `Packet ${p} hop ${h} (${from}->${to}) must be an existing edge`);
      if (h + 1 < hops) {
        const nextFrom = hopNodePairs[(h + 1) * 2];
        assert.equal(to, nextFrom, 'Consecutive hops must share a connected junction node');
      }
    }
  }
});

test('resolveDeviceProfile caps pixelRatio at 2 and lowers particle count on mobile and low-end GPUs', () => {
  const desktop = resolveDeviceProfile({
    viewportWidth: 1440,
    devicePixelRatio: 3.5,
    hardwareConcurrency: 8,
    isSoftwareRenderer: false,
  });
  assert.equal(desktop.pixelRatio, 2);
  assert.equal(desktop.particleCount, SITE_CONFIG.particles.desktopCount);

  const mobile = resolveDeviceProfile({
    viewportWidth: 375,
    devicePixelRatio: 3,
    hardwareConcurrency: 6,
    isSoftwareRenderer: false,
  });
  assert.equal(mobile.isMobile, true);
  assert.equal(mobile.pixelRatio, 2);
  assert.equal(mobile.particleCount, SITE_CONFIG.particles.mobileCount);

  const lowEnd = resolveDeviceProfile({
    viewportWidth: 1440,
    devicePixelRatio: 2,
    hardwareConcurrency: 2,
    isSoftwareRenderer: true,
  });
  assert.equal(lowEnd.isLowEnd, true);
  assert.equal(lowEnd.pixelRatio, 1);
  assert.equal(lowEnd.particleCount, SITE_CONFIG.particles.lowEndCount);
});

test('hasVisitedBefore and markVisited handle working and throwing storage safely', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  assert.equal(hasVisitedBefore(mockStorage), false);
  markVisited(mockStorage);
  assert.equal(hasVisitedBefore(mockStorage), true);

  const brokenStorage = {
    getItem: () => {
      throw new Error('SecurityError: storage disabled');
    },
    setItem: () => {
      throw new Error('SecurityError: storage disabled');
    },
  };
  assert.equal(hasVisitedBefore(brokenStorage), false);
  assert.doesNotThrow(() => markVisited(brokenStorage));
});

test('Section-arrival reveal: config timings, 8-item stagger cap (<900ms), transit suppression, hash resolution, and disable conditions', () => {
  // 1. Config values
  assert.equal(SITE_CONFIG.sectionReveal.durationMs, 500);
  assert.equal(SITE_CONFIG.sectionReveal.easing, 'ease-out');
  assert.equal(SITE_CONFIG.sectionReveal.translateYDistancePx, 12);
  assert.equal(SITE_CONFIG.sectionReveal.staggerMs, 40);
  assert.equal(SITE_CONFIG.sectionReveal.staggerCap, 8);
  assert.equal(SITE_CONFIG.sectionReveal.intersectionThreshold, 0.25);
  assert.equal(SITE_CONFIG.sectionReveal.settleDurationMs, 120);
  assert.equal(SITE_CONFIG.sectionReveal.failsafeTimeoutMs, 3000);

  // 2. Stagger delay capped at 8 items (indices 0..7 -> max delay 280ms; 280 + 500 = 780ms < 900ms)
  assert.equal(computeRevealStaggerDelayMs(0), 0);
  assert.equal(computeRevealStaggerDelayMs(1), 40);
  assert.equal(computeRevealStaggerDelayMs(7), 280);
  assert.equal(computeRevealStaggerDelayMs(8), 280);
  assert.equal(computeRevealStaggerDelayMs(25), 280);
  assert.ok(
    computeRevealStaggerDelayMs(99) + SITE_CONFIG.sectionReveal.durationMs < 900,
    'Entire section stagger + duration must finish in under 900ms',
  );

  // 3. Initial hash case-insensitive resolution (e.g. #Connect -> 'connect')
  assert.equal(resolveInitialHashSectionId('#Connect'), 'connect');
  assert.equal(resolveInitialHashSectionId('#connect'), 'connect');
  assert.equal(resolveInitialHashSectionId('#Background'), 'background');
  assert.equal(resolveInitialHashSectionId('#home'), null);
  assert.equal(resolveInitialHashSectionId(''), null);

  // 4. Arrival trigger: 25% threshold, settled velocity, once-only, and nav-glide transit suppression
  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: false,
      isIntersecting: true,
      intersectionRatio: 0.2,
      inTransitTargetId: null,
      isVelocitySettled: true,
    }),
    false,
    'Below 25% visibility must not trigger arrival',
  );

  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: false,
      isIntersecting: true,
      intersectionRatio: 0.4,
      inTransitTargetId: 'connect',
      isVelocitySettled: true,
    }),
    false,
    'Section passed in transit to #connect must not animate while passing',
  );

  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: false,
      isIntersecting: true,
      intersectionRatio: 0.3,
      inTransitTargetId: null,
      isVelocitySettled: false,
    }),
    false,
    'Unsettled scroll velocity must wait until settled',
  );

  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: false,
      isIntersecting: true,
      intersectionRatio: 0.25,
      inTransitTargetId: null,
      isVelocitySettled: true,
    }),
    true,
    'Settled velocity at >= 25% visibility triggers arrival',
  );

  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: true,
      isIntersecting: true,
      intersectionRatio: 0.8,
      inTransitTargetId: null,
      isVelocitySettled: true,
    }),
    false,
    'Already revealed section never re-animates',
  );

  // 5. Disable conditions: Plain view, reduced motion, low tier, Save-Data, print
  assert.equal(
    shouldDisableSectionReveal({
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: false,
    }),
    false,
  );
  assert.equal(
    shouldDisableSectionReveal({
      plainView: true,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: false,
    }),
    true,
  );
  assert.equal(
    shouldDisableSectionReveal({
      plainView: false,
      prefersReducedMotion: true,
      qualityTier: 'high',
      saveData: false,
    }),
    true,
  );
  assert.equal(
    shouldDisableSectionReveal({
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'low',
      saveData: false,
    }),
    true,
  );
  assert.equal(
    shouldDisableSectionReveal({
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'medium',
      saveData: true,
    }),
    true,
  );
});

test('Particle morph system: state machine transitions, tier particle counts, topology targets, port scan, glyph matching, spring solver, and overlap cap', () => {
  // 1. Tier particle counts & disable conditions
  assert.equal(
    shouldDisableMorph({
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: false,
      viewportWidth: 1440,
    }),
    false,
  );
  assert.equal(resolveMorphParticleCount('high', false), 1200);
  assert.equal(resolveMorphParticleCount('medium', false), 600);
  assert.equal(resolveMorphParticleCount('low', false), 0);
  assert.equal(resolveMorphParticleCount('high', true), 0);

  // Mobile (< 768px) disables morphs by default (MORPH_ON_MOBILE = false)
  assert.equal(
    shouldDisableMorph({
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: false,
      viewportWidth: 375,
    }),
    true,
  );

  // 2. Dominant arrived section & in-transit suppression
  const visMap = createInitialSectionVisibilityMap();
  visMap.home = { isIntersecting: false, ratio: 0 };
  visMap.skills = { isIntersecting: true, ratio: 0.65 };
  assert.equal(
    resolveDominantArrivedSection({
      inViewMap: visMap,
      heroProgress: 1,
      pageProgress: 0.4,
      inTransitTargetId: 'connect',
      isVelocitySettled: true,
      currentArrivedSection: null,
    }),
    null,
    'While in transit to #connect, intermediate sections like #skills must not trigger arrival',
  );
  assert.equal(
    resolveDominantArrivedSection({
      inViewMap: visMap,
      heroProgress: 1,
      pageProgress: 0.4,
      inTransitTargetId: null,
      isVelocitySettled: true,
      currentArrivedSection: null,
    }),
    'skills',
    'Once velocity settles and not in transit, #skills becomes arrived section',
  );

  // 3. State machine: HERO -> AMBIENT -> TOPOLOGY -> AMBIENT -> TOPOLOGY (replay) -> DOLLAR -> HASH
  let state = stepMorphStateMachine({
    currentState: 'HERO',
    stateEnteredAtMs: 0,
    dollarFormationCompleteMs: 0,
    nowMs: 100,
    morphDisabled: false,
    heroProgress: 0,
    arrivedSection: 'home',
    glyphsAvailable: true,
  });
  assert.equal(state.state, 'HERO');

  // Scroll away from hero into Background
  state = stepMorphStateMachine({
    currentState: state.state,
    stateEnteredAtMs: state.stateEnteredAtMs,
    dollarFormationCompleteMs: state.dollarFormationCompleteMs,
    nowMs: 500,
    morphDisabled: false,
    heroProgress: 1,
    arrivedSection: 'background',
    glyphsAvailable: true,
  });
  assert.equal(state.state, 'AMBIENT');

  // Arrive at Skills -> TOPOLOGY
  state = stepMorphStateMachine({
    currentState: state.state,
    stateEnteredAtMs: state.stateEnteredAtMs,
    dollarFormationCompleteMs: state.dollarFormationCompleteMs,
    nowMs: 1000,
    morphDisabled: false,
    heroProgress: 1,
    arrivedSection: 'skills',
    glyphsAvailable: true,
  });
  assert.equal(state.state, 'TOPOLOGY');
  assert.equal(state.stateEnteredAtMs, 1000);

  // Leave Skills for Projects -> back to AMBIENT
  state = stepMorphStateMachine({
    currentState: state.state,
    stateEnteredAtMs: state.stateEnteredAtMs,
    dollarFormationCompleteMs: state.dollarFormationCompleteMs,
    nowMs: 2500,
    morphDisabled: false,
    heroProgress: 1,
    arrivedSection: 'projects',
    glyphsAvailable: true,
  });
  assert.equal(state.state, 'AMBIENT');

  // Re-arrive at Skills -> replays TOPOLOGY
  state = stepMorphStateMachine({
    currentState: state.state,
    stateEnteredAtMs: state.stateEnteredAtMs,
    dollarFormationCompleteMs: state.dollarFormationCompleteMs,
    nowMs: 3200,
    morphDisabled: false,
    heroProgress: 1,
    arrivedSection: 'skills',
    glyphsAvailable: true,
  });
  assert.equal(state.state, 'TOPOLOGY');
  assert.equal(state.stateEnteredAtMs, 3200);

  // Nav jump from Home straight to Connect: in-transit sets arrivedSection = null -> AMBIENT, then landing sets 'connect' -> DOLLAR (never TOPOLOGY)
  const inTransitState = stepMorphStateMachine({
    currentState: 'HERO',
    stateEnteredAtMs: 0,
    dollarFormationCompleteMs: 0,
    nowMs: 4000,
    morphDisabled: false,
    heroProgress: 0.8,
    arrivedSection: null,
    glyphsAvailable: true,
  });
  assert.equal(inTransitState.state, 'AMBIENT');

  const connectArriveTime = 4500;
  const dollarState = stepMorphStateMachine({
    currentState: inTransitState.state,
    stateEnteredAtMs: inTransitState.stateEnteredAtMs,
    dollarFormationCompleteMs: inTransitState.dollarFormationCompleteMs,
    nowMs: connectArriveTime,
    morphDisabled: false,
    heroProgress: 1,
    arrivedSection: 'connect',
    glyphsAvailable: true,
  });
  assert.equal(dollarState.state, 'DOLLAR');

  // Before formationDurationMs (1150) + dollarHoldMs (700) = 1850ms, stays DOLLAR
  const dollarHolding = stepMorphStateMachine({
    currentState: dollarState.state,
    stateEnteredAtMs: dollarState.stateEnteredAtMs,
    dollarFormationCompleteMs: dollarState.dollarFormationCompleteMs,
    nowMs: connectArriveTime + 1500,
    morphDisabled: false,
    heroProgress: 1,
    arrivedSection: 'connect',
    glyphsAvailable: true,
  });
  assert.equal(dollarHolding.state, 'DOLLAR');

  // At >= 1850ms after DOLLAR entry, transitions to HASH
  const hashTransitionTime =
    connectArriveTime + SITE_CONFIG.morph.formationDurationMs + SITE_CONFIG.morph.dollarHoldMs;
  const hashState = stepMorphStateMachine({
    currentState: dollarHolding.state,
    stateEnteredAtMs: dollarHolding.stateEnteredAtMs,
    dollarFormationCompleteMs: dollarHolding.dollarFormationCompleteMs,
    nowMs: hashTransitionTime,
    morphDisabled: false,
    heroProgress: 1,
    arrivedSection: 'connect',
    glyphsAvailable: true,
  });
  assert.equal(hashState.state, 'HASH');

  // Hash morph progress lerps 0 -> 1 over hashMorphDurationMs (1000ms)
  assert.equal(computeHashMorphProgress(0, 1000), 0);
  assert.ok(computeHashMorphProgress(500, 1000) > 0.8);
  assert.equal(computeHashMorphProgress(1200, 1000), 1);

  // 4. Hand-authored Topology: 15 nodes (1 gateway + 3 sub-hubs + 11 leaves), 16 edges, and port scan lighting
  assert.equal(SITE_CONFIG.morph.topology.nodes.length, 15);
  assert.equal(SITE_CONFIG.morph.topology.edges.length, 16);
  const topo = generateTopologyTargets(1200);
  assert.equal(topo.normalizedPositions.length, 1200 * 3);
  assert.equal(topo.nodeAssignments.length, 1200);
  assert.equal(topo.nodeParticleCounts.length, 15);

  const scan0 = computeTopologyNodePortScanIntensities(15, 0, [4, 7, 11]);
  assert.equal(scan0[4], 0);
  const scanAfterAll = computeTopologyNodePortScanIntensities(15, 1600, [4, 7, 11]);
  assert.equal(scanAfterAll[4], 1);
  assert.equal(scanAfterAll[7], 1);
  assert.equal(scanAfterAll[11], 1);
  assert.equal(scanAfterAll[0], 0, 'Non-selected hub node remains dim');

  // 5. Glyph pair sampling & 1-to-1 nearest-neighbour matching
  const w = 64;
  const h = 64;
  const dollarRgba = new Uint8ClampedArray(w * h * 4);
  const hashRgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 12; y < 52; y++) {
    for (let x = 16; x < 48; x++) {
      const idx = (y * w + x) * 4 + 3;
      dollarRgba[idx] = 255;
      hashRgba[idx] = 255;
    }
  }
  const matched = sampleAndMatchGlyphPairFromRgba({
    dollarRgba,
    hashRgba,
    width: w,
    height: h,
    count: 300,
  });
  assert.ok(matched !== null);
  assert.equal(matched.dollarPositions.length, 300 * 3);
  assert.equal(matched.hashPositions.length, 300 * 3);

  // 6. Critically damped spring buffer: smooth retargeting without snapping & < 1ms for 1,200 particles
  const count = 1200;
  const currentPos = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const targetA = new Float32Array(count * 3);
  const targetB = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    targetA[i] = 2.0;
    targetB[i] = -1.5;
  }

  const t0 = performance.now();
  stepCriticallyDampedSpringBuffer(currentPos, velocities, targetA, 0.016, 4.6);
  const elapsedMs = performance.now() - t0;
  assert.ok(elapsedMs < 5, `Spring step took ${elapsedMs.toFixed(2)}ms, expected well under budget`);
  const posAfterFirstStep = currentPos[0];
  assert.ok(posAfterFirstStep > 0 && posAfterFirstStep < 2.0);

  // Retarget mid-transition to targetB and verify no discontinuous snap
  stepCriticallyDampedSpringBuffer(currentPos, velocities, targetB, 0.016, 4.6);
  assert.ok(Math.abs(currentPos[0] - posAfterFirstStep) < 0.5, 'Mid-flight retargeting must not snap');

  // 7. Readability overlap opacity cap (<= 0.18 when overlapping text blocks on desktop)
  const shapeBox = { left: 700, top: 200, right: 1050, bottom: 600 };
  const nonOverlappingText = [{ left: 80, top: 200, right: 640, bottom: 600 }];
  const overlappingText = [{ left: 80, top: 200, right: 820, bottom: 600 }];

  assert.equal(
    computeShapeEffectiveMaxOpacity({
      shapeBox,
      textRects: nonOverlappingText,
      configMaxOpacity: 0.9,
      overlapCap: 0.18,
    }).effectiveMaxOpacity,
    0.9,
  );
  assert.equal(
    computeShapeEffectiveMaxOpacity({
      shapeBox,
      textRects: overlappingText,
      configMaxOpacity: 0.9,
      overlapCap: 0.18,
    }).effectiveMaxOpacity,
    0.18,
  );
  assert.equal(
    computeShapeEffectiveMaxOpacity({
      shapeBox,
      textRects: overlappingText,
      configMaxOpacity: 0.22,
      overlapCap: 0.18,
    }).effectiveMaxOpacity,
    0.18,
  );

  // Leaf node selection avoids overlapping text rows
  const selectedLeaves = selectNonOverlappingLitLeafNodes({
    anchorX: 0.72,
    anchorY: 0.5,
    scale: 0.42,
    viewportWidth: 1280,
    viewportHeight: 800,
    textRowRects: [],
    litLeafCount: 3,
  });
  assert.equal(selectedLeaves.length, 3);
});

test('dark/light theme store: starts in dark in-memory, notifies subscribers, and meets >= 4.5:1 WCAG contrast on all text pairs', async () => {
  const {
    getTheme,
    getThemeTokens,
    setTheme,
    toggleTheme,
    subscribeTheme,
    resetThemeForTests,
    computeContrastRatio,
  } = await import('./themeStore');

  resetThemeForTests();
  assert.equal(SITE_CONFIG.theme.defaultTheme, 'dark');
  assert.equal(SITE_CONFIG.theme.CODE_BLOCKS_ALWAYS_DARK, true);
  assert.equal(getTheme(), 'dark');
  assert.equal(getThemeTokens().background, '#0B0D10');

  const observed: string[] = [];
  const unsubscribe = subscribeTheme((mode) => {
    observed.push(mode);
  });

  const switchedToLight = toggleTheme();
  assert.equal(switchedToLight, 'light');
  assert.equal(getTheme(), 'light');
  assert.equal(getThemeTokens().background, '#F4F1EA');
  assert.equal(getThemeTokens().text, '#14161A');
  assert.equal(getThemeTokens().textMuted, '#5B5F66');
  assert.equal(getThemeTokens().lineSubtle, '#D8D3C7');
  assert.equal(getThemeTokens().accent, '#0B6F78');
  assert.equal(getThemeTokens().amber, '#9A5500');
  assert.equal(getThemeTokens().scenePacketAdditiveBlending, false);

  const switchedBackToDark = toggleTheme();
  assert.equal(switchedBackToDark, 'dark');
  assert.equal(getTheme(), 'dark');
  assert.deepEqual(observed, ['light', 'dark']);

  setTheme('light');
  assert.equal(getTheme(), 'light');
  unsubscribe();
  resetThemeForTests();
  assert.equal(getTheme(), 'dark');

  // Verify WCAG 2.1 contrast ratio >= 4.5:1 for all dark and light theme text pairs
  const dark = SITE_CONFIG.theme.themes.dark;
  assert.ok(computeContrastRatio(dark.text, dark.background) >= 4.5);
  assert.ok(computeContrastRatio(dark.textMuted, dark.background) >= 4.5);
  assert.ok(computeContrastRatio(dark.accent, dark.background) >= 4.5);
  assert.ok(computeContrastRatio(dark.amber, dark.background) >= 4.5);

  const light = SITE_CONFIG.theme.themes.light;
  assert.ok(
    computeContrastRatio(light.text, light.background) >= 4.5,
    `Light primary text contrast ${computeContrastRatio(light.text, light.background).toFixed(2)}:1 must be >= 4.5:1`,
  );
  assert.ok(
    computeContrastRatio(light.textMuted, light.background) >= 4.5,
    `Light muted text contrast ${computeContrastRatio(light.textMuted, light.background).toFixed(2)}:1 must be >= 4.5:1`,
  );
  assert.ok(
    computeContrastRatio(light.accent, light.background) >= 4.5,
    `Light accent contrast ${computeContrastRatio(light.accent, light.background).toFixed(2)}:1 must be >= 4.5:1`,
  );
  assert.ok(
    computeContrastRatio(light.amber, light.background) >= 4.5,
    `Light amber contrast ${computeContrastRatio(light.amber, light.background).toFixed(2)}:1 must be >= 4.5:1`,
  );
});



