import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDeltaNetwork,
  generateShieldNetwork,
  generateAmbientDepthField,
  updateParticlesForScroll,
  computeHeroShieldPlacement,
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
  easeInOutCubic,
  shouldDisableSymbolCycle,
  resolveStaticShieldSymbol,
  createSymbolCycleState,
  stepSymbolCycleState,
  computeMaxSymbolSegmentVertices,
  writeSymbolSegmentsBuffer,
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
import {
  SHIELD_HEIGHT_VH,
  SHIELD_SYMBOL,
  SYMBOL_ORDER,
  SYMBOL_HOLD_MS,
  SYMBOL_MORPH_MS,
  termNodes,
  termEdges,
  hatNodes,
  hatEdges,
  codeNodes,
  codeEdges,
  SITE_CONFIG,
} from './config';
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

  // 2. Links to a write-up page render when published:true and are stripped when published:false
  const defaultMrRobotLab = defaultContent.projectsAndCtfs.broken.find(
    (item) => item.id === 'broken-mr-robot',
  );
  assert.ok(defaultMrRobotLab, 'Expected Mr Robot CTF in broken lane');
  assert.equal(
    defaultMrRobotLab.writeupUrl,
    '/writeups/mr-robot',
    'Published Mr Robot write-up link must render in Broken lane',
  );
  assert.equal(isWriteupUrlPublished('/writeups/mr-robot'), true);
  assert.equal(
    isWriteupUrlPublished('/writeups/unpublished-draft', [
      {
        ...getWriteupBySlug('mr-robot')!,
        slug: 'unpublished-draft',
        published: false,
      },
    ]),
    false,
    'Unpublished write-up link must return false',
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

test('writeup filtering: Mr Robot CTF is published with GitHub URL and all sections; unpublished entries, partial sections, and screenshot alt text filter correctly', () => {
  // 1. Default published state: mr-robot is published with GitHub URL and all 9 structured sections populated
  const defaultPublished = getPublishedWriteups();
  assert.equal(defaultPublished.length, 1, 'Expected Mr Robot CTF to be published');

  const mrRobot = getWriteupBySlug('mr-robot');
  assert.ok(mrRobot, 'Expected mr-robot entry to exist');
  assert.equal(mrRobot.published, true);
  assert.equal(mrRobot.type, 'guided-lab');
  assert.equal(
    mrRobot.githubUrl,
    'https://github.com/Vaibhav-48-iiit/ctf-writeups/tree/main/mr-robot-ctf',
  );
  const mrRobotSections = getRenderableWriteupSections(mrRobot);
  assert.equal(mrRobotSections.length, 9, 'Expected all 9 structured sections to be populated');
  assert.ok(
    estimateWriteupReadingTime(mrRobot)?.endsWith('min read'),
    'Expected estimated reading time for published Mr Robot CTF write-up',
  );

  // 2. Unpublished draft entry with empty sections is excluded from published list and renders 0 sections
  const emptySections = {
    goal: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
    setup: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
    reconnaissance: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
    enumeration: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
    foothold: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
    privilegeEscalation: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
    whatIGotWrong: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
    defendersView: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
    takeaways: { paragraphs: [], steps: [], codeBlocks: [], screenshots: [] },
  };
  const draftEntry = {
    ...mrRobot,
    slug: 'draft-lab',
    published: false,
    sections: emptySections,
  };
  assert.equal(getPublishedWriteups([draftEntry]).length, 0);
  assert.equal(getRenderableWriteupSections(draftEntry).length, 0);
  assert.equal(estimateWriteupReadingTime(draftEntry), null);

  // 3. Partial sections render only filled sections in exact order, and screenshot without alt text is rejected
  const customEntry = {
    ...draftEntry,
    published: true,
    sections: {
      ...emptySections,
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

  // Ensure getActiveWriteupEntries preserves the published mr-robot entry
  assert.equal(getActiveWriteupEntries('?demo=published')[0].githubUrl, mrRobot.githubUrl);
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

test('Section-arrival reveal: faster config timings, 5-item stagger cap (~400ms), normal-scroll immediate reveal, programmatic jump suppression, hash resolution, and disable conditions', () => {
  // 1. Config values
  assert.equal(SITE_CONFIG.sectionReveal.durationMs, 300);
  assert.equal(SITE_CONFIG.sectionReveal.easing, 'ease-out');
  assert.equal(SITE_CONFIG.sectionReveal.translateYDistancePx, 8);
  assert.equal(SITE_CONFIG.sectionReveal.staggerMs, 20);
  assert.equal(SITE_CONFIG.sectionReveal.staggerCap, 5);
  assert.equal(SITE_CONFIG.sectionReveal.intersectionThreshold, 0.05);
  assert.equal(SITE_CONFIG.sectionReveal.rootMargin, '0px 0px 12% 0px');
  assert.equal(SITE_CONFIG.sectionReveal.failsafeTimeoutMs, 200);

  // 2. Stagger delay capped at 5 items (indices 0..4 -> max delay 80ms; 80 + 300 = 380ms <= 400ms)
  assert.equal(computeRevealStaggerDelayMs(0), 0);
  assert.equal(computeRevealStaggerDelayMs(1), 20);
  assert.equal(computeRevealStaggerDelayMs(4), 80);
  assert.equal(computeRevealStaggerDelayMs(5), 80);
  assert.equal(computeRevealStaggerDelayMs(25), 80);
  assert.ok(
    computeRevealStaggerDelayMs(99) + SITE_CONFIG.sectionReveal.durationMs <= 400,
    'Entire section stagger + duration must finish in about 400ms',
  );

  // 3. Initial hash case-insensitive resolution (e.g. #Connect -> 'connect')
  assert.equal(resolveInitialHashSectionId('#Connect'), 'connect');
  assert.equal(resolveInitialHashSectionId('#connect'), 'connect');
  assert.equal(resolveInitialHashSectionId('#Background'), 'background');
  assert.equal(resolveInitialHashSectionId('#home'), null);
  assert.equal(resolveInitialHashSectionId(''), null);

  // 4. Two-mode reveal trigger:
  //    - Normal scrolling: triggers immediately at >= 5% without waiting for velocity to settle
  //    - Programmatic jump: suppresses sections passed over while flag is set
  //    - Once-only: already revealed never re-animates
  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: false,
      isIntersecting: true,
      intersectionRatio: 0.02,
      isProgrammaticScroll: false,
    }),
    false,
    'Below 5% visibility must not trigger arrival',
  );

  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: false,
      isIntersecting: true,
      intersectionRatio: 0.05,
      isProgrammaticScroll: false,
    }),
    true,
    'Normal scroll at >= 5% visibility triggers immediately without velocity check',
  );

  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: false,
      isIntersecting: true,
      intersectionRatio: 0.5,
      isProgrammaticScroll: true,
      inTransitTargetId: 'connect',
    }),
    false,
    'Section passed in transit during a programmatic jump must not animate while passing',
  );

  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'skills',
      alreadyRevealed: false,
      isIntersecting: true,
      intersectionRatio: 0.6,
      isProgrammaticScroll: true,
      inTransitTargetId: null,
    }),
    false,
    'Programmatic jump flag suppresses passed-over sections even without a targetSectionId',
  );

  assert.equal(
    shouldTriggerSectionArrival({
      sectionId: 'background',
      alreadyRevealed: true,
      isIntersecting: true,
      intersectionRatio: 0.8,
      isProgrammaticScroll: false,
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
  assert.equal(
    shouldDisableSectionReveal({
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: false,
      isPrint: true,
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

test('Hero shield structure: deterministic double outline, 3 z-layers, SHIELD_SYMBOL variants (term/hat/code), tier particle counts, and +/-15 deg 14s sway', () => {
  // 1. Default SHIELD_SYMBOL config ('cycle') & exact 14 outer + 14 inner outline vertices + 14 radial links
  assert.equal(SHIELD_SYMBOL, 'cycle');
  assert.equal(SITE_CONFIG.shield.SHIELD_SYMBOL, 'cycle');
  assert.deepEqual(Array.from(SYMBOL_ORDER), ['term', 'hat', 'code']);
  assert.equal(SYMBOL_HOLD_MS, 5000);
  assert.equal(SYMBOL_MORPH_MS, 1200);
  assert.equal(SITE_CONFIG.shield.outerOutline.length, 14);
  assert.equal(SITE_CONFIG.shield.innerOutline.length, 14);
  assert.equal(SITE_CONFIG.shield.radialLinks.length, 14);
  assert.deepEqual(Array.from(SITE_CONFIG.shield.zLayerFractions), [-0.15, 0, 0.15]);

  // 2. Gentle yaw sway: +/-15 degrees (~0.2618 rad) over ~14 seconds with slight tilt
  assert.equal(SITE_CONFIG.idle.rotationPeriodSec, 14.0);
  const swayDeg = (SITE_CONFIG.idle.rotationAmplitudeY * 180) / Math.PI;
  assert.ok(
    swayDeg >= 14.5 && swayDeg <= 15.5,
    `Expected yaw sway around +/-15 deg, got +/-${swayDeg.toFixed(2)} deg`,
  );
  assert.ok(SITE_CONFIG.idle.tiltAmplitudeX > 0 && SITE_CONFIG.idle.tiltAmplitudeX <= 0.08);
  assert.ok(SITE_CONFIG.idle.tiltAmplitudeZ > 0 && SITE_CONFIG.idle.tiltAmplitudeZ <= 0.04);

  // 3. Exact total particle count preserved across all 3 quality tiers (190 / 95 / 65)
  for (const tierCount of [
    SITE_CONFIG.qualityTiers.tiers.high.particleCount,
    SITE_CONFIG.qualityTiers.tiers.medium.particleCount,
    SITE_CONFIG.qualityTiers.tiers.low.particleCount,
  ]) {
    const net = generateShieldNetwork(tierCount, 'term', 42);
    assert.equal(net.basePositions.length, tierCount * 3);
    assert.equal(net.driftVectors.length, tierCount * 3);
    assert.equal(net.phases.length, tierCount);
    assert.equal(net.nodeIsSymbol.length, tierCount);

    let symCount = 0;
    let shieldCount = 0;
    const distinctZ = new Set<string>();
    for (let i = 0; i < tierCount; i++) {
      if (net.nodeIsSymbol[i] === 1) symCount++;
      else shieldCount++;
      distinctZ.add(net.basePositions[i * 3 + 2].toFixed(3));
    }
    assert.ok(symCount > 0, `Tier count ${tierCount} must include symbol nodes`);
    assert.ok(shieldCount > 0, `Tier count ${tierCount} must include shield nodes`);
    assert.equal(
      distinctZ.size,
      3,
      `Tier count ${tierCount} must populate all 3 z-layers (-0.15, 0, +0.15 H)`,
    );
  }

  // 4. Verify 3 z-layer geometry height and depth offsets (-0.15H, 0, +0.15H)
  const highTerm = generateShieldNetwork(190, 'term', 42);
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < highTerm.wireframeBasePositions.length; i += 3) {
    const y = highTerm.wireframeBasePositions[i + 1];
    const z = highTerm.wireframeBasePositions[i + 2];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const height = maxY - minY;
  assert.ok(
    Math.abs(height - SITE_CONFIG.shield.worldHeight) < 1e-4,
    `Expected shield world height ${SITE_CONFIG.shield.worldHeight}, got ${height}`,
  );
  assert.ok(Math.abs(maxZ - 0.15 * height) < 1e-4);
  assert.ok(Math.abs(minZ + 0.15 * height) < 1e-4);

  // 5. Verify SHIELD_HEIGHT_VH = 0.42, 1.25x visual scale, unchanged 5-unit subdivision, desktop [260, 480] clamp,
  //    mobile 30% vh, short-window nav/bottom-line clearance, and >= 40px hero name clearance
  assert.equal(SHIELD_HEIGHT_VH, 0.42);
  assert.equal(SITE_CONFIG.shield.SHIELD_HEIGHT_VH, 0.42);
  assert.equal(SITE_CONFIG.shield.subdivideStepUnits, 5);
  assert.equal(SITE_CONFIG.shield.visualScaleFactor, 1.25);

  const visibleHeightAtZ0 =
    2 * SITE_CONFIG.scroll.cameraStartZ * Math.tan((45 * Math.PI) / 360);

  // Desktop 1440x900 -> exact 42% vh (378px) with same centre anchor (2.38, 0.05)
  const desktop1440 = computeHeroShieldPlacement({
    viewportWidth: 1440,
    viewportHeight: 900,
    nameRect: { left: 80, top: 340, right: 632, bottom: 520 },
    navBottomPx: 56,
    heroBottomLineTopPx: 828,
  });
  assert.equal(desktop1440.anchorX, 2.38);
  assert.equal(desktop1440.anchorY, 0.05);
  assert.ok(
    Math.abs(desktop1440.finalHeightPx - 900 * 0.42) < 0.5,
    `Expected ~378px at 1440x900, got ${desktop1440.finalHeightPx.toFixed(1)}px`,
  );
  const desktopHeightRatio = (height * desktop1440.scale) / visibleHeightAtZ0;
  assert.ok(
    Math.abs(desktopHeightRatio - 0.42) < 0.005,
    `Expected desktop shield height ratio ~0.42, got ${(desktopHeightRatio * 100).toFixed(1)}%`,
  );
  assert.ok(
    desktop1440.screenBox.left >= 632 + 40,
    `Expected >= 40px clearance from hero name, got ${(desktop1440.screenBox.left - 632).toFixed(1)}px`,
  );

  // Ultra-tall desktop 1920x1400 -> clamped to 480px max
  const desktopTall = computeHeroShieldPlacement({
    viewportWidth: 1920,
    viewportHeight: 1400,
    nameRect: { left: 320, top: 520, right: 860, bottom: 720 },
    navBottomPx: 56,
    heroBottomLineTopPx: 1320,
  });
  assert.equal(Math.round(desktopTall.finalHeightPx), 480);

  // Compact height desktop 1440x560 -> clamped to 260px min while clearing nav & bottom line
  const desktopCompactH = computeHeroShieldPlacement({
    viewportWidth: 1440,
    viewportHeight: 560,
    nameRect: { left: 80, top: 180, right: 560, bottom: 340 },
    navBottomPx: 56,
    heroBottomLineTopPx: 492,
  });
  assert.equal(Math.round(desktopCompactH.finalHeightPx), 260);
  assert.ok(desktopCompactH.screenBox.top > 56);
  assert.ok(desktopCompactH.screenBox.bottom < 492);

  // Very short window 1440x380 -> scales below 260px so it never overlaps top nav or bottom line
  const desktopVeryShort = computeHeroShieldPlacement({
    viewportWidth: 1440,
    viewportHeight: 380,
    nameRect: { left: 80, top: 100, right: 520, bottom: 240 },
    navBottomPx: 56,
    heroBottomLineTopPx: 312,
  });
  assert.ok(desktopVeryShort.finalHeightPx < 260);
  assert.ok(
    desktopVeryShort.screenBox.top >= 56,
    `Short window shield top (${desktopVeryShort.screenBox.top.toFixed(1)}) must stay below nav (56)`,
  );
  assert.ok(
    desktopVeryShort.screenBox.bottom <= 312,
    `Short window shield bottom (${desktopVeryShort.screenBox.bottom.toFixed(1)}) must stay above hero bottom line (312)`,
  );

  // Narrow desktop where name extends close to shield -> scales down just enough to keep >= 40px gap
  const narrowNameClose = computeHeroShieldPlacement({
    viewportWidth: 1024,
    viewportHeight: 768,
    nameRect: { left: 80, top: 260, right: 632, bottom: 440 },
    navBottomPx: 56,
    heroBottomLineTopPx: 696,
  });
  assert.ok(
    narrowNameClose.screenBox.left >= 632 + 40 - 1e-6,
    `Expected >= 40px gap on narrow desktop, got ${(narrowNameClose.screenBox.left - 632).toFixed(1)}px`,
  );

  // Mobile (< 768px) 390x844 -> 30% of viewport height (~253.2px), anchor (0, -0.78), >= 40px below name
  const mobile390 = computeHeroShieldPlacement({
    viewportWidth: 390,
    viewportHeight: 844,
    nameRect: { left: 16, top: 120, right: 340, bottom: 260 },
    navBottomPx: 56,
    heroBottomLineTopPx: 770,
  });
  assert.equal(mobile390.anchorX, 0);
  assert.equal(mobile390.anchorY, -0.78);
  assert.ok(
    Math.abs(mobile390.finalHeightPx - 844 * 0.3) < 0.5,
    `Expected ~253.2px at 390x844, got ${mobile390.finalHeightPx.toFixed(1)}px`,
  );
  assert.ok(
    mobile390.screenBox.top >= 260 + 40,
    `Mobile shield top (${mobile390.screenBox.top.toFixed(1)}) must clear hero name bottom (260) by >= 40px`,
  );
  assert.ok(mobile390.screenBox.bottom <= 770);

  // 6. Verify all 3 SHIELD_SYMBOL options ('term', 'hat', 'code') produce distinct, valid symbol geometry
  const highHat = generateShieldNetwork(190, 'hat', 42);
  const highCode = generateShieldNetwork(190, 'code', 42);

  assert.equal(highTerm.symbol, 'term');
  assert.equal(highHat.symbol, 'hat');
  assert.equal(highCode.symbol, 'code');

  assert.ok(highTerm.wireframeSymbolSegments.length > 0);
  assert.ok(highHat.wireframeSymbolSegments.length > 0);
  assert.ok(highCode.wireframeSymbolSegments.length > 0);

  // Swapping symbol produces distinct symbol segment buffers
  assert.notDeepEqual(
    Array.from(highTerm.wireframeSymbolSegments),
    Array.from(highHat.wireframeSymbolSegments),
  );
  assert.notDeepEqual(
    Array.from(highHat.wireframeSymbolSegments),
    Array.from(highCode.wireframeSymbolSegments),
  );

  // Travelling packets build valid continuous walks strictly along wireframePacketEdges
  const wfNodeCount = highTerm.wireframePhases.length;
  const pktLoops = buildPacketEdgeLoops(highTerm.wireframePacketEdges, wfNodeCount);
  assert.equal(pktLoops.length, SITE_CONFIG.idle.packetCount);
});

test('Hero shield symbol cycling: exact 48-node data, HOLD/MORPH state machine, 250ms/300ms edge fades, pause/resume, retargeting, and static fallbacks', () => {
  // 1. Verify exact 48-node arrays & valid edge indices for all three symbols
  assert.equal(termNodes.length, 48);
  assert.equal(hatNodes.length, 48);
  assert.equal(codeNodes.length, 48);
  assert.equal(termEdges.length, 46);
  assert.equal(hatEdges.length, 43);
  assert.equal(codeEdges.length, 45);

  for (const edges of [termEdges, hatEdges, codeEdges]) {
    for (const [a, b] of edges) {
      assert.ok(a >= 0 && a < 48 && b >= 0 && b < 48 && a !== b);
    }
  }

  // 2. Verify all 3 z-layers' symbol targets (48 * 3 = 144 nodes) & zero-alloc segment writer
  const net = generateShieldNetwork(190, 'term', 42);
  assert.equal(net.symbolNodeCountPerLayer, 48);
  assert.equal(net.symbolLayerCount, 3);
  assert.equal(net.symbolNodeTotalCount, 144);
  assert.equal(net.symbolTargetPositions.term.length, 144 * 3);
  assert.equal(net.symbolTargetPositions.hat.length, 144 * 3);
  assert.equal(net.symbolTargetPositions.code.length, 144 * 3);
  assert.ok(net.wireframeShieldPacketEdges.length > 0);
  assert.ok(net.symbolPacketEdges.term.length > 0);
  assert.ok(net.symbolPacketEdges.hat.length > 0);
  assert.ok(net.symbolPacketEdges.code.length > 0);

  const maxVerts = computeMaxSymbolSegmentVertices();
  const posBuf = new Float32Array(maxVerts * 3);
  const driftBuf = new Float32Array(maxVerts * 3);
  const phaseBuf = new Float32Array(maxVerts);
  const alphaBuf = new Float32Array(maxVerts);
  for (const sym of SYMBOL_ORDER) {
    const written = writeSymbolSegmentsBuffer({
      symbol: sym,
      symbolPositions: net.symbolTargetPositions[sym],
      symbolDrifts: net.symbolNodeDriftVectors,
      symbolPhases: net.symbolNodePhases,
      unitScale: net.unitScale,
      outPositions: posBuf,
      outDrifts: driftBuf,
      outPhases: phaseBuf,
      outAlphas: alphaBuf,
    });
    assert.ok(written > 0 && written <= maxVerts);
  }

  // 3. Full cycle state machine: term -> hat -> code -> term with exact edge fade timings
  const state = createSymbolCycleState({
    shieldSymbolConfig: 'cycle',
    plainView: false,
    prefersReducedMotion: false,
    qualityTier: 'high',
    saveData: false,
  });
  const advanceMs = (totalMs: number, isActive = true) => {
    let remaining = totalMs;
    let lastRes = stepSymbolCycleState(state, {
      dtMs: 0,
      isActive,
      disableCycle: false,
      staticSymbol: 'term',
    });
    let sawStartedMorph = false;
    let sawSwitchedEdge = false;
    while (remaining > 0) {
      const step = Math.min(50, remaining);
      remaining -= step;
      lastRes = stepSymbolCycleState(state, {
        dtMs: step,
        isActive,
        disableCycle: false,
        staticSymbol: 'term',
      });
      if (lastRes.startedMorph) sawStartedMorph = true;
      if (lastRes.switchedEdgeSymbol) sawSwitchedEdge = true;
    }
    return { lastRes, sawStartedMorph, sawSwitchedEdge };
  };

  assert.equal(state.phase, 'HOLD');
  assert.equal(state.edgeSymbol, 'term');
  assert.equal(state.edgeAlpha, 1);
  assert.equal(state.secondsUntilNext, 5);

  // Advance 4900ms in HOLD -> still term, 0.1s left
  let stepOut = advanceMs(4900, true);
  assert.equal(state.phase, 'HOLD');
  assert.equal(stepOut.lastRes.activeSymbol, 'term');
  assert.equal(state.edgeAlpha, 1);
  assert.ok(state.secondsUntilNext !== null && Math.abs(state.secondsUntilNext - 0.1) < 1e-6);

  // Advance 100ms -> enters MORPH from term -> hat
  stepOut = advanceMs(100, true);
  assert.equal(state.phase, 'MORPH');
  assert.equal(stepOut.lastRes.activeSymbol, 'term');
  assert.equal(stepOut.lastRes.targetSymbol, 'hat');
  assert.equal(state.edgeSymbol, 'term');
  assert.equal(state.edgeAlpha, 1);
  assert.equal(stepOut.sawStartedMorph, true);
  assert.equal(stepOut.sawSwitchedEdge, false);

  // Fade out over first 250ms: at 125ms edgeAlpha = 0.5, at 250ms edgeAlpha = 0
  stepOut = advanceMs(125, true);
  assert.equal(state.phase, 'MORPH');
  assert.equal(state.edgeSymbol, 'term');
  assert.ok(Math.abs(state.edgeAlpha - 0.5) < 1e-6);

  stepOut = advanceMs(125, true);
  assert.equal(state.edgeAlpha, 0);
  assert.equal(state.edgeSymbol, 'term');

  // Pause mid-morph (scroll away / tab hidden) -> everything freezes cleanly
  const pausedMorphElapsed = state.phaseElapsedMs;
  advanceMs(3500, false);
  assert.equal(state.phase, 'MORPH');
  assert.equal(state.phaseElapsedMs, pausedMorphElapsed);
  assert.equal(state.edgeAlpha, 0);
  assert.equal(state.edgeSymbol, 'term');

  // Resume and finish remaining 950ms of 1200ms morph -> swaps edgeSymbol to 'hat' with edgeAlpha starting at 0
  stepOut = advanceMs(950, true);
  assert.equal(state.phase, 'HOLD');
  assert.equal(stepOut.lastRes.activeSymbol, 'hat');
  assert.equal(state.edgeSymbol, 'hat');
  assert.equal(stepOut.sawSwitchedEdge, true);
  assert.equal(state.edgeAlpha, 0);

  // Fade new 'hat' edges in over 300ms: at 150ms -> 0.5, at 300ms -> 1.0
  advanceMs(150, true);
  assert.ok(Math.abs(state.edgeAlpha - 0.5) < 1e-6);
  advanceMs(150, true);
  assert.equal(state.edgeAlpha, 1);

  // Continue through hat -> code -> term loop
  stepOut = advanceMs(4700, true); // finishes 5000ms HOLD on hat -> starts MORPH to code
  assert.equal(state.phase, 'MORPH');
  assert.equal(stepOut.lastRes.targetSymbol, 'code');
  stepOut = advanceMs(1200, true); // finishes MORPH to code
  assert.equal(state.phase, 'HOLD');
  assert.equal(stepOut.lastRes.activeSymbol, 'code');
  assert.equal(state.edgeSymbol, 'code');

  stepOut = advanceMs(5000, true); // finishes HOLD on code -> starts MORPH back to term
  assert.equal(state.phase, 'MORPH');
  assert.equal(stepOut.lastRes.targetSymbol, 'term');
  stepOut = advanceMs(1200, true); // finishes MORPH back to term
  assert.equal(state.phase, 'HOLD');
  assert.equal(stepOut.lastRes.activeSymbol, 'term');
  assert.equal(state.edgeSymbol, 'term');

  // 4. Ease-in-out + critically damped spring settles within ~1200ms and retargets mid-morph without snapping
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);

  const count = net.symbolNodeTotalCount;
  const cur = new Float32Array(net.symbolTargetPositions.term);
  const vel = new Float32Array(count * 3);
  const start = new Float32Array(cur);
  const desired = new Float32Array(count * 3);
  const targetHat = net.symbolTargetPositions.hat;
  const targetCode = net.symbolTargetPositions.code;
  const omega = 16.0 / (SYMBOL_MORPH_MS / 1000);
  const rampMs = SYMBOL_MORPH_MS * 0.8;

  // Step 600ms (halfway) toward 'hat', then retarget mid-morph to 'code' without zeroing velocity
  const dt = 1 / 60;
  for (let f = 0; f < 36; f++) {
    const t = Math.min(1, ((f + 1) * dt * 1000) / rampMs);
    const e = easeInOutCubic(t);
    for (let j = 0; j < count * 3; j++) {
      desired[j] = start[j] + (targetHat[j] - start[j]) * e;
    }
    stepCriticallyDampedSpringBuffer(cur, vel, desired, dt, omega);
  }
  const beforeRetarget = new Float32Array(cur);
  start.set(cur);
  // First step after retargeting to 'code' must move continuously (no teleport/snap)
  const e1 = easeInOutCubic((dt * 1000) / rampMs);
  for (let j = 0; j < count * 3; j++) {
    desired[j] = start[j] + (targetCode[j] - start[j]) * e1;
  }
  stepCriticallyDampedSpringBuffer(cur, vel, desired, dt, omega);
  let maxSingleFrameJump = 0;
  for (let j = 0; j < count * 3; j++) {
    const d = Math.abs(cur[j] - beforeRetarget[j]);
    if (d > maxSingleFrameJump) maxSingleFrameJump = d;
  }
  assert.ok(
    maxSingleFrameJump < 0.08,
    `Mid-morph retarget must not snap (max single-frame delta ${maxSingleFrameJump.toFixed(4)})`,
  );

  // Run full 1200ms clean morph from start -> targetCode and verify tight settlement
  for (let f = 1; f < 72; f++) {
    const t = Math.min(1, ((f + 1) * dt * 1000) / rampMs);
    const e = easeInOutCubic(t);
    for (let j = 0; j < count * 3; j++) {
      desired[j] = start[j] + (targetCode[j] - start[j]) * e;
    }
    stepCriticallyDampedSpringBuffer(cur, vel, desired, dt, omega);
  }
  let maxResidual = 0;
  for (let j = 0; j < count * 3; j++) {
    const err = Math.abs(cur[j] - targetCode[j]);
    if (err > maxResidual) maxResidual = err;
  }
  assert.ok(
    maxResidual < 0.03,
    `Expected tight settlement within 1200ms, got max residual ${maxResidual.toFixed(4)}`,
  );

  // 5. Fallback rules: low tier, prefers-reduced-motion, Save-Data, Plain view -> static 'term'; fixed config -> fixed symbol
  assert.equal(
    shouldDisableSymbolCycle({
      shieldSymbolConfig: 'cycle',
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: false,
    }),
    false,
  );
  assert.equal(
    shouldDisableSymbolCycle({
      shieldSymbolConfig: 'cycle',
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'low',
      saveData: false,
    }),
    true,
  );
  assert.equal(
    shouldDisableSymbolCycle({
      shieldSymbolConfig: 'cycle',
      plainView: false,
      prefersReducedMotion: true,
      qualityTier: 'high',
      saveData: false,
    }),
    true,
  );
  assert.equal(
    shouldDisableSymbolCycle({
      shieldSymbolConfig: 'cycle',
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: true,
    }),
    true,
  );
  assert.equal(
    shouldDisableSymbolCycle({
      shieldSymbolConfig: 'cycle',
      plainView: true,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: false,
    }),
    true,
  );
  assert.equal(
    resolveStaticShieldSymbol({
      shieldSymbolConfig: 'cycle',
      plainView: false,
      prefersReducedMotion: true,
      qualityTier: 'high',
      saveData: false,
    }),
    'term',
  );
  assert.equal(
    resolveStaticShieldSymbol({
      shieldSymbolConfig: 'hat',
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'high',
      saveData: false,
    }),
    'hat',
  );
  assert.equal(
    resolveStaticShieldSymbol({
      shieldSymbolConfig: 'code',
      plainView: false,
      prefersReducedMotion: false,
      qualityTier: 'low',
      saveData: false,
    }),
    'term',
  );
});





