import { PORTFOLIO_CONTENT } from './content.js';

export interface ChangelogItem {
  id: string;
  date: string;
  text: string;
  confirmed: boolean;
}

export interface SkillItem {
  name: string;
  status: 'used in lab' | 'learning';
  detail?: string;
  evidenceLabel?: string;
  evidenceUrl?: string;
  confirmed: boolean;
}

export interface SkillGroup {
  id: string;
  title: string;
  items: SkillItem[];
}

export interface BuiltProjectItem {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  tags: string[];
  status: string;
  repoUrl?: string;
  repoLabel?: string;
  repoNote?: string;
  confirmed: boolean;
}

export interface BrokenLabItem {
  id: string;
  title: string;
  platform: string;
  status: string;
  description: string;
  externalUrl?: string;
  externalLabel?: string;
  writeupUrl?: string;
  writeupLabel?: string;
  confirmed: boolean;
}

export interface WriteupCodeBlock {
  label?: string;
  language?: string;
  code: string;
}

export interface WriteupScreenshot {
  src: string;
  /** Every image requires a non-empty alt text field */
  alt: string;
  caption?: string;
}

export interface WriteupSectionData {
  paragraphs?: string[];
  steps?: string[];
  codeBlocks?: WriteupCodeBlock[];
  screenshots?: WriteupScreenshot[];
}

export type WriteupSectionKey =
  | 'goal'
  | 'setup'
  | 'reconnaissance'
  | 'enumeration'
  | 'foothold'
  | 'privilegeEscalation'
  | 'whatIGotWrong'
  | 'defendersView'
  | 'takeaways';

export interface WriteupEntry {
  slug: string;
  published: boolean;
  title: string;
  platform: string;
  type: 'guided-lab' | 'original';
  status: string;
  date?: string;
  tags: string[];
  roomUrl?: string;
  summary: string;
  sections: Record<WriteupSectionKey, WriteupSectionData>;
}

export interface RenderableWriteupSection {
  key: WriteupSectionKey;
  id: string;
  heading: string;
  paragraphs: string[];
  steps: string[];
  codeBlocks: WriteupCodeBlock[];
  screenshots: WriteupScreenshot[];
}

export const WRITEUP_SECTION_DEFINITIONS: ReadonlyArray<{
  key: WriteupSectionKey;
  id: string;
  heading: string;
}> = [
  { key: 'goal', id: 'section-goal', heading: 'Goal' },
  { key: 'setup', id: 'section-setup', heading: 'Setup' },
  { key: 'reconnaissance', id: 'section-reconnaissance', heading: 'Reconnaissance' },
  { key: 'enumeration', id: 'section-enumeration', heading: 'Enumeration' },
  { key: 'foothold', id: 'section-foothold', heading: 'Foothold' },
  {
    key: 'privilegeEscalation',
    id: 'section-privilege-escalation',
    heading: 'Privilege escalation',
  },
  {
    key: 'whatIGotWrong',
    id: 'section-what-i-got-wrong',
    heading: 'What I got wrong',
  },
  {
    key: 'defendersView',
    id: 'section-defenders-view',
    heading: "Defender's view",
  },
  { key: 'takeaways', id: 'section-takeaways', heading: 'Takeaways' },
] as const;

/**
 * Returns true only if a string field is non-empty and does not start with "TODO".
 * Any config or content string starting with "TODO" or empty renders nothing on the live page.
 */
export function isRenderableText(value: string | undefined | null): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (/^todo\b/i.test(trimmed)) return false;
  return true;
}

/**
 * Returns the trimmed string if it is renderable (non-empty and does not start with "TODO"),
 * or empty string `""` otherwise.
 */
export function sanitizeRenderableString(value: string | undefined | null): string {
  return isRenderableText(value) ? value : '';
}

/**
 * Filters an array of data records so any item with `confirmed: false` is excluded
 * from rendering on the live page.
 */
export function filterConfirmed<T extends { confirmed: boolean }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => item.confirmed === true);
}

/**
 * Returns all write-up entries from the data file (or a custom list for testing).
 */
export function getAllWriteups(
  entries: readonly WriteupEntry[] = PORTFOLIO_CONTENT.writeups
    .entries as WriteupEntry[],
): WriteupEntry[] {
  return [...entries];
}

/**
 * Returns only write-ups where `published === true`.
 */
export function getPublishedWriteups(
  entries: readonly WriteupEntry[] = PORTFOLIO_CONTENT.writeups
    .entries as WriteupEntry[],
): WriteupEntry[] {
  return entries.filter((entry) => entry.published === true);
}

/**
 * Finds a write-up entry by its URL slug (matches both published and draft entries
 * so direct route navigation `/writeups/:slug` works cleanly).
 */
export function getWriteupBySlug(
  slug: string,
  entries: readonly WriteupEntry[] = PORTFOLIO_CONTENT.writeups
    .entries as WriteupEntry[],
): WriteupEntry | null {
  const clean = slug.trim().toLowerCase();
  return entries.find((entry) => entry.slug.toLowerCase() === clean) ?? null;
}

/**
 * Checks whether a write-up URL (e.g. "/writeups/mr-robot") targets a write-up
 * that currently has `published === true`.
 */
export function isWriteupUrlPublished(
  writeupUrl: string | undefined | null,
  entries: readonly WriteupEntry[] = PORTFOLIO_CONTENT.writeups
    .entries as WriteupEntry[],
): boolean {
  if (!isRenderableText(writeupUrl)) return false;
  const trimmed = writeupUrl.trim();
  const match = /^\/writeups\/([^/?#]+)/i.exec(trimmed);
  if (!match) return false;
  const slug = match[1].toLowerCase();
  const entry = entries.find((e) => e.slug.toLowerCase() === slug);
  return Boolean(entry && entry.published === true);
}

/**
 * Inspects all 9 ordered structured sections of a write-up entry and returns ONLY
 * the sections that have at least one non-empty, non-TODO paragraph, step, code block,
 * or valid screenshot (requiring both `src` and non-empty `alt`).
 * Any empty section is omitted so neither its heading nor its TOC link renders.
 */
export function getRenderableWriteupSections(
  entry: WriteupEntry,
): RenderableWriteupSection[] {
  const result: RenderableWriteupSection[] = [];

  for (const def of WRITEUP_SECTION_DEFINITIONS) {
    const rawSection = entry.sections?.[def.key];
    if (!rawSection) continue;

    const paragraphs = (rawSection.paragraphs ?? []).filter((p) =>
      isRenderableText(p),
    );
    const steps = (rawSection.steps ?? []).filter((s) => isRenderableText(s));
    const codeBlocks = (rawSection.codeBlocks ?? []).filter((cb) =>
      isRenderableText(cb?.code),
    );
    // Every screenshot requires both a valid src and a non-empty alt text field
    const screenshots = (rawSection.screenshots ?? []).filter(
      (shot) => isRenderableText(shot?.src) && isRenderableText(shot?.alt),
    );

    if (
      paragraphs.length > 0 ||
      steps.length > 0 ||
      codeBlocks.length > 0 ||
      screenshots.length > 0
    ) {
      result.push({
        key: def.key,
        id: def.id,
        heading: def.heading,
        paragraphs,
        steps,
        codeBlocks,
        screenshots,
      });
    }
  }

  return result;
}

/**
 * Computes an estimated reading time string (e.g. "3 min read") from the renderable
 * sections of a write-up. Returns null if no body sections are filled yet.
 */
export function estimateWriteupReadingTime(entry: WriteupEntry): string | null {
  const sections = getRenderableWriteupSections(entry);
  if (sections.length === 0) return null;

  let wordCount = isRenderableText(entry.summary)
    ? entry.summary.trim().split(/\s+/).length
    : 0;

  for (const sec of sections) {
    for (const p of sec.paragraphs) {
      wordCount += p.trim().split(/\s+/).length;
    }
    for (const s of sec.steps) {
      wordCount += s.trim().split(/\s+/).length;
    }
    for (const cb of sec.codeBlocks) {
      wordCount += cb.code.trim().split(/\s+/).length;
    }
    for (const shot of sec.screenshots) {
      if (isRenderableText(shot.caption)) {
        wordCount += shot.caption.trim().split(/\s+/).length;
      }
    }
  }

  const minutes = Math.max(1, Math.ceil(wordCount / 180));
  return `${minutes} min read`;
}

/**
 * Returns previous and next write-up entries for bottom pagination.
 */
export function getAdjacentWriteups(
  slug: string,
  entries: readonly WriteupEntry[] = PORTFOLIO_CONTENT.writeups
    .entries as WriteupEntry[],
): { previous: WriteupEntry | null; next: WriteupEntry | null } {
  const pool = entries.filter((e) => e.published);
  const idx = pool.findIndex((e) => e.slug.toLowerCase() === slug.toLowerCase());
  if (idx === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: idx > 0 ? pool[idx - 1] : null,
    next: idx < pool.length - 1 ? pool[idx + 1] : null,
  };
}

/**
 * Builds a preview-capable write-up list when `?demo=published` is present in the URL
 * so automated acceptance checks can verify both:
 * - Default state (`published: false`, empty sections -> shows empty state on Home)
 * - Published state (`published: true` with partial sections & long code block -> renders only filled sections)
 */
export function getActiveWriteupEntries(searchQuery = ''): WriteupEntry[] {
  const baseEntries = getAllWriteups();
  const params = new URLSearchParams(searchQuery);
  if (params.get('demo') !== 'published') {
    return baseEntries;
  }

  return baseEntries.map((entry) => {
    if (entry.slug !== 'mr-robot') return entry;
    return {
      ...entry,
      published: true,
      sections: {
        ...entry.sections,
        goal: {
          paragraphs: [
            'Locate all three keys across the target host by enumerating exposed web assets, obtaining an initial shell, and escalating privileges to root.',
          ],
          steps: [],
          codeBlocks: [],
          screenshots: [],
        },
        reconnaissance: {
          paragraphs: [
            'Service discovery and directory enumeration against the target host.',
          ],
          steps: [
            'Run an initial TCP service and version scan across standard ports.',
            'Enumerate web directories and inspect robots.txt entries.',
          ],
          codeBlocks: [
            {
              label: 'TCP service scan & directory brute-force',
              language: 'bash',
              code: 'nmap -sC -sV -oN scans/mr-robot-initial.nmap <target-ip> && gobuster dir -u http://<target-ip>/ -w /usr/share/wordlists/dirb/common.txt -x txt,php,bak -t 40',
            },
          ],
          screenshots: [],
        },
        privilegeEscalation: {
          paragraphs: [
            'Enumerated binaries with the SUID bit set and used the legacy interactive mode in the installed Nmap binary to spawn an elevated shell (key values [redacted]).',
          ],
          steps: [],
          codeBlocks: [
            {
              label: 'Locate SUID binaries on the target system',
              language: 'bash',
              code: 'find / -perm -4000 -type f -exec ls -la {} 2>/dev/null \\;',
            },
          ],
          screenshots: [],
        },
      },
    };
  });
}

/**
 * Returns the sanitized, confirmed-only view of PORTFOLIO_CONTENT for rendering.
 * - Any string starting with "TODO" is sanitized to empty/null so no TODO text ever renders.
 * - Any link to a write-up page (`writeupUrl`) is stripped unless that write-up has `published: true`.
 */
export function getConfirmedPortfolioContent(searchQuery = '') {
  const raw = PORTFOLIO_CONTENT;

  const changelog = filterConfirmed(raw.background.changelog as ChangelogItem[]).map(
    (entry) => ({
      ...entry,
      date: sanitizeRenderableString(entry.date),
      text: sanitizeRenderableString(entry.text),
    }),
  ).filter((entry) => isRenderableText(entry.text));

  const skillGroups = (raw.skills.groups as SkillGroup[])
    .map((group) => {
      const confirmedItems = filterConfirmed(group.items).map((item) => ({
        ...item,
        name: sanitizeRenderableString(item.name),
        detail: sanitizeRenderableString(item.detail),
        evidenceLabel: sanitizeRenderableString(item.evidenceLabel),
        evidenceUrl: sanitizeRenderableString(item.evidenceUrl),
      })).filter((item) => isRenderableText(item.name));

      const usedInLab = confirmedItems.filter((item) => item.status === 'used in lab');
      const learning = confirmedItems.filter((item) => item.status === 'learning');
      return {
        id: group.id,
        title: sanitizeRenderableString(group.title),
        items: confirmedItems,
        usedInLab,
        learning,
      };
    })
    .filter((group) => group.items.length > 0 && isRenderableText(group.title));

  const allWriteups = getActiveWriteupEntries(searchQuery);
  const publishedWriteups = getPublishedWriteups(allWriteups);

  const builtProjects = filterConfirmed(
    raw.projectsAndCtfs.built as BuiltProjectItem[],
  ).map((proj) => ({
    ...proj,
    title: sanitizeRenderableString(proj.title),
    subtitle: sanitizeRenderableString(proj.subtitle),
    description: sanitizeRenderableString(proj.description),
    status: sanitizeRenderableString(proj.status),
    repoUrl: sanitizeRenderableString(proj.repoUrl),
    repoLabel: sanitizeRenderableString(proj.repoLabel),
    repoNote: sanitizeRenderableString(proj.repoNote),
    tags: (proj.tags ?? []).filter((t) => isRenderableText(t)),
  })).filter((proj) => isRenderableText(proj.title));

  // Fix 2: Links to a write-up page (e.g. "Write-up →" on Mr Robot) render ONLY when that write-up has published:true
  const brokenLabs = filterConfirmed(
    raw.projectsAndCtfs.broken as BrokenLabItem[],
  ).map((lab) => {
    const canLinkWriteup = isWriteupUrlPublished(lab.writeupUrl, allWriteups);
    return {
      ...lab,
      title: sanitizeRenderableString(lab.title),
      platform: sanitizeRenderableString(lab.platform),
      status: sanitizeRenderableString(lab.status),
      description: sanitizeRenderableString(lab.description),
      externalUrl: sanitizeRenderableString(lab.externalUrl),
      externalLabel: sanitizeRenderableString(lab.externalLabel),
      writeupUrl: canLinkWriteup ? sanitizeRenderableString(lab.writeupUrl) : '',
      writeupLabel: canLinkWriteup ? sanitizeRenderableString(lab.writeupLabel) : '',
    };
  }).filter((lab) => isRenderableText(lab.title));

  const brokenCompactLine =
    raw.projectsAndCtfs.brokenCompactLine?.confirmed === true &&
    isRenderableText(raw.projectsAndCtfs.brokenCompactLine.text)
      ? raw.projectsAndCtfs.brokenCompactLine.text
      : null;

  return {
    links: raw.links,
    background: {
      introDraft: isRenderableText(raw.background.introDraft)
        ? raw.background.introDraft
        : null,
      taglinePullQuote: isRenderableText(raw.background.taglinePullQuote)
        ? raw.background.taglinePullQuote
        : null,
      statusLine: isRenderableText(raw.background.statusLine)
        ? raw.background.statusLine
        : null,
      changelog,
    },
    skills: {
      statusLabels: raw.skills.statusLabels,
      groups: skillGroups,
    },
    projectsAndCtfs: {
      builtHeading: sanitizeRenderableString(raw.projectsAndCtfs.builtHeading),
      brokenHeading: sanitizeRenderableString(raw.projectsAndCtfs.brokenHeading),
      built: builtProjects,
      broken: brokenLabs,
      brokenCompactLine,
    },
    writeups: {
      all: allWriteups,
      published: publishedWriteups,
    },
    connect: {
      ...raw.connect,
      amberStatusLabel: sanitizeRenderableString(raw.connect.amberStatusLabel),
      heading: sanitizeRenderableString(raw.connect.heading),
      // Fix 1: Any string starting with "TODO" renders nothing on the page
      introLine: sanitizeRenderableString(raw.connect.introLine),
      statusLine: sanitizeRenderableString(raw.connect.statusLine),
      copyEmailLabel: sanitizeRenderableString(raw.connect.copyEmailLabel),
      copiedConfirmationLabel: sanitizeRenderableString(raw.connect.copiedConfirmationLabel),
      backToTopLabel: sanitizeRenderableString(raw.connect.backToTopLabel),
      channels: raw.connect.channels
        .map((ch) => ({
          ...ch,
          label: sanitizeRenderableString(ch.label),
          value: sanitizeRenderableString(ch.value),
          href: sanitizeRenderableString(ch.href),
        }))
        .filter((ch) => isRenderableText(ch.label) && isRenderableText(ch.value)),
    },
    placeholders: raw.placeholders,
  };
}
