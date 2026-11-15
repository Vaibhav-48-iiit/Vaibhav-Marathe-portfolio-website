/**
 * ============================================================================
 * PORTFOLIO CONTENT DATA FILE (Single Source of Truth)
 * ============================================================================
 * Edit this file to update copy, skills, projects, CTFs, write-ups, links,
 * and status labels across the entire site. No content is hard-coded inside
 * components.
 *
 * ----------------------------------------------------------------------------
 * WRITE-UP CONTENT RULES (MANDATORY)
 * ----------------------------------------------------------------------------
 * 1. Never include actual flag values, passwords, hashes, or credentials from
 *    any platform; always redact sensitive values as `[redacted]`.
 * 2. Never invent commands, tool outputs, IP addresses, or findings. Only add
 *    commands and observations from your own real lab notes.
 * 3. Every write-up has `"published": false` by default until you fill in your
 *    own notes and explicitly flip `"published": true`.
 * 4. Every screenshot object requires a non-empty `alt` text field and
 *    `caption`. Any empty section or field marked `TODO` renders nothing.
 *
 * ----------------------------------------------------------------------------
 * MASTER CHECKLIST OF `TODO` FIELDS, `published: false` & `confirmed: false`
 * ----------------------------------------------------------------------------
 *
 * A. TODO FIELDS (Render nothing if empty or prefixed with "TODO"):
 *  1. links.resume ("/Vaibhav_Marathe_Resume.pdf")
 *     -> TODO: confirm the PDF file exists in /public/Vaibhav_Marathe_Resume.pdf
 *  2. background.changelog[1].date ("")
 *     -> TODO date: when C++/Python/MERN/DSA to cybersecurity pivot happened
 *  3. background.changelog[1].text
 *     -> TODO: replace with my own wording
 *  4. background.changelog[2].date ("")
 *     -> TODO date: when TryHackMe Pre Security / Web Hacking / Mr Robot CTF completed
 *  5. projectsAndCtfs.built[0] ("DEXA AI").status ("")
 *     -> TODO: confirm whether status is "completed" or "in progress"
 *  6. projectsAndCtfs.built[2] ("Decentralized Maritime Communication Network").status ("")
 *     -> TODO: confirm status & whether project should be shown
 *  7. writeups.entries[0] ("mr-robot").date ("")
 *     -> TODO: add completion date for Mr Robot CTF
 *  8. writeups.entries[0] ("mr-robot").sections (goal, setup, reconnaissance,
 *     enumeration, foothold, privilegeEscalation, whatIGotWrong,
 *     defendersView, takeaways)
 *     -> TODO: my own notes (currently empty; published: false by default)
 *
 * B. UNPUBLISHED WRITE-UPS (`published: false` — hidden from published list):
 *  1. writeups.entries[0] ("mr-robot" — "Mr Robot CTF") (published: false)
 *
 * C. UNCONFIRMED ITEMS (`confirmed: false` — NEVER rendered on the live page):
 *  1. skills.groups["Recon and scanning"] -> "Wireshark" (confirmed: false — TODO: confirm, "Wireshark basics" appears in Pre Security)
 *  2. skills.groups["Recon and scanning"] -> "Nikto" (confirmed: false)
 *  3. skills.groups["Web"] -> "Hydra / WPScan" (confirmed: false)
 *  4. skills.groups["Linux and privilege escalation"] -> "LinPEAS" (confirmed: false)
 *  5. skills.groups["Linux and privilege escalation"] -> "Bash scripting" (confirmed: false — TODO)
 *  6. skills.groups["Development"] -> "TypeScript" (confirmed: false)
 *  7. skills.groups["Development"] -> "Next.js" (confirmed: false)
 *  8. skills.groups["Development"] -> "FastAPI" (confirmed: false)
 *  9. skills.groups["Development"] -> "Docker" (confirmed: false)
 * 10. skills.groups["Development"] -> "VMware" (confirmed: false)
 * 11. skills.groups["Development"] -> "AWS S3 / IAM" (confirmed: false)
 * 12. projectsAndCtfs.built[0] ("DEXA AI").unconfirmedHighlights (confirmed: false)
 * 13. projectsAndCtfs.built[2] ("Decentralized Maritime Communication Network") (confirmed: false)
 * ============================================================================
 */

import { SITE_CONFIG } from './config';

export const PORTFOLIO_CONTENT = {
  links: {
    github: 'https://github.com/Vaibhav-48-iiit',
    linkedin: 'https://www.linkedin.com/in/cyber-vaibhav',
    tryhackme: 'https://tryhackme.com/p/CyberVaibhav',
    x: 'https://x.com/whoami_vaibhav',
    email: 'vaibhavashokm123@gmail.com',
    mailto: 'mailto:vaibhavashokm123@gmail.com',
    // TODO: confirm the file exists in /public
    resume: '/Vaibhav_Marathe_Resume.pdf',
  },

  background: {
    introDraft:
      "I'm a Computer Science student at IIIT Surat. I started in software development with React, Node.js and MongoDB, then moved to security because I want to work on the offensive side. I'm learning penetration testing and web application testing through TryHackMe and PortSwigger's Web Security Academy, and I've completed Pre Security, Cyber Security 101 and the Mr Robot CTF. Right now I'm working through the Junior Penetration Tester path and learning Burp Suite.",
    taglinePullQuote:
      'Understanding systems. Finding weaknesses. Building better security.',
    statusLine: 'Open to internships, Summer 2027 · Surat, India',
    changelog: [
      {
        id: 'log-2024',
        date: '2024',
        text: 'Started B.Tech in Computer Science and Engineering at IIIT Surat.',
        confirmed: true,
      },
      {
        id: 'log-pivot',
        // TODO date: add exact month/semester
        date: '',
        // TODO: my own wording
        text: 'Spent months on C++, Python, the MERN stack and DSA for software roles, then decided cybersecurity is what I actually want to do.',
        confirmed: true,
      },
      {
        id: 'log-thm',
        // TODO date: add completion timeframe
        date: '',
        text: 'Completed TryHackMe Pre Security, Web Hacking and Cyber Security 101, a Snort practical, and the Mr Robot CTF.',
        confirmed: true,
      },
      {
        id: 'log-now',
        date: 'Now',
        text: '5th semester. Working through the TryHackMe Junior Penetration Tester path and PortSwigger Web Security Academy. Cybersecurity lead of Google Developer Groups at IIIT Surat. Looking for a cybersecurity internship for Summer 2027.',
        confirmed: true,
      },
    ],
  },

  skills: {
    statusLabels: {
      usedInLab: 'used in lab',
      learning: 'learning',
    },
    groups: [
      {
        id: 'grp-recon',
        title: 'Recon and scanning',
        items: [
          {
            name: 'Nmap',
            status: 'used in lab',
            evidenceLabel: 'Mr Robot CTF',
            evidenceUrl: 'https://tryhackme.com/r/room/mrrobot',
            confirmed: true,
          },
          {
            name: 'Gobuster',
            status: 'used in lab',
            evidenceLabel: 'Mr Robot CTF',
            evidenceUrl: 'https://tryhackme.com/r/room/mrrobot',
            confirmed: true,
          },
          {
            name: 'Nessus',
            status: 'learning',
            confirmed: true,
          },
          {
            name: 'Wireshark',
            status: 'learning',
            // TODO: confirm, "Wireshark basics" appears in Pre Security
            confirmed: false,
          },
          {
            name: 'Nikto',
            status: 'learning',
            confirmed: false,
          },
        ],
      },
      {
        id: 'grp-web',
        title: 'Web',
        items: [
          {
            name: 'WordPress enumeration',
            status: 'used in lab',
            evidenceLabel: 'Mr Robot CTF',
            evidenceUrl: 'https://tryhackme.com/r/room/mrrobot',
            confirmed: true,
          },
          {
            name: 'Burp Suite',
            status: 'learning',
            confirmed: true,
          },
          {
            name: 'PortSwigger Web Security Academy',
            status: 'learning',
            detail: 'in progress',
            evidenceUrl: 'https://portswigger.net/web-security',
            confirmed: true,
          },
          {
            name: 'Hydra / WPScan',
            status: 'used in lab',
            confirmed: false,
          },
        ],
      },
      {
        id: 'grp-linux',
        title: 'Linux and privilege escalation',
        items: [
          {
            name: 'Kali Linux and Linux CLI',
            status: 'used in lab',
            confirmed: true,
          },
          {
            name: 'SUID-based privilege escalation',
            status: 'used in lab',
            evidenceLabel: 'Mr Robot CTF',
            evidenceUrl: 'https://tryhackme.com/r/room/mrrobot',
            confirmed: true,
          },
          {
            name: 'Hash cracking',
            status: 'used in lab',
            evidenceLabel: 'Mr Robot CTF',
            evidenceUrl: 'https://tryhackme.com/r/room/mrrobot',
            confirmed: true,
          },
          {
            name: 'LinPEAS',
            status: 'learning',
            confirmed: false,
          },
          {
            name: 'Bash scripting',
            status: 'learning',
            // TODO: confirm level of lab usage
            confirmed: false,
          },
        ],
      },
      {
        id: 'grp-detection',
        title: 'Detection',
        items: [
          {
            name: 'Snort',
            status: 'used in lab',
            evidenceLabel: 'TryHackMe Snort practical',
            confirmed: true,
          },
        ],
      },
      {
        id: 'grp-dev',
        title: 'Development',
        items: [
          { name: 'Python', status: 'used in lab', confirmed: true },
          { name: 'JavaScript', status: 'used in lab', confirmed: true },
          { name: 'React', status: 'used in lab', confirmed: true },
          { name: 'Node.js', status: 'used in lab', confirmed: true },
          { name: 'Express', status: 'used in lab', confirmed: true },
          { name: 'MongoDB', status: 'used in lab', confirmed: true },
          { name: 'Socket.IO', status: 'used in lab', confirmed: true },
          { name: 'C++', status: 'used in lab', confirmed: true },
          { name: 'TypeScript', status: 'learning', confirmed: false },
          { name: 'Next.js', status: 'learning', confirmed: false },
          { name: 'FastAPI', status: 'learning', confirmed: false },
          { name: 'Docker', status: 'learning', confirmed: false },
          { name: 'VMware', status: 'learning', confirmed: false },
          { name: 'AWS S3 / IAM', status: 'learning', confirmed: false },
        ],
      },
    ],
  },

  projectsAndCtfs: {
    builtHeading: 'Built',
    brokenHeading: 'Broken',
    built: [
      {
        id: 'built-dexa',
        title: 'DEXA AI',
        subtitle: 'Private desktop AI assistant that works with local apps and files',
        description:
          'A desktop assistant that talks to a local language model through Ollama.',
        tags: ['React', 'Node.js', 'Express', 'Socket.IO', 'Ollama'],
        // TODO: confirm: completed or in progress
        status: '',
        repoUrl: 'https://github.com/Vaibhav-48-iiit/DexaAi',
        repoLabel: 'GitHub repository',
        confirmed: true,
        unconfirmedHighlights: [
          {
            text: 'Voice wake-word and OS automation hooks',
            confirmed: false,
          },
        ],
      },
      {
        id: 'built-cctv',
        title: 'CCTV Detection, The Distributed Eye',
        description:
          'Cloud-oriented analysis of recorded CCTV footage that flags anomalous events and shows them on a web dashboard.',
        tags: ['AWS', 'cloud processing', 'web dashboard'],
        status: 'academic project, in progress',
        repoUrl: '',
        repoNote: 'Private, academic project',
        confirmed: true,
      },
      {
        id: 'built-maritime',
        title: 'Decentralized Maritime Communication Network',
        description: 'Store-and-forward communication between distributed nodes.',
        tags: ['React', 'Node.js', 'Socket.IO', 'Dijkstra', 'BFS'],
        // TODO: confirm status
        status: '',
        repoUrl: '',
        // Kept false until confirmed that it should be shown on the live site
        confirmed: false,
      },
    ],

    broken: [
      {
        id: 'broken-mr-robot',
        title: 'Mr Robot CTF',
        platform: 'TryHackMe',
        status: 'completed, 3 of 3 flags',
        description:
          'Nmap recon, Gobuster enumeration, WordPress enumeration, shell access, hash cracking, and privilege escalation through an SUID Nmap binary.',
        externalUrl: 'https://tryhackme.com/r/room/mrrobot',
        externalLabel: 'TryHackMe room',
        writeupUrl: '/writeups/mr-robot',
        writeupLabel: 'Write-up',
        confirmed: true,
      },
      {
        id: 'broken-pre-security',
        title: 'TryHackMe Pre Security path',
        platform: 'TryHackMe',
        status: 'completed',
        description:
          'Networking basics, OSI model, HTTP, Linux and Windows fundamentals.',
        externalUrl: 'https://tryhackme.com/path/outline/presecurity',
        externalLabel: 'Path outline',
        confirmed: true,
      },
      {
        id: 'broken-snort',
        title: 'Snort practical',
        platform: 'TryHackMe',
        status: 'completed',
        description: '',
        externalUrl: '',
        confirmed: true,
      },
      {
        id: 'broken-portswigger',
        title: 'PortSwigger Web Security Academy',
        platform: 'PortSwigger',
        status: 'in progress',
        description: '',
        externalUrl: 'https://portswigger.net/web-security',
        externalLabel: 'Academy labs',
        confirmed: true,
      },
    ],

    brokenCompactLine: {
      text: 'Web Hacking and Cyber Security 101 (TryHackMe): completed training',
      confirmed: true,
    },
  },

  writeups: {
    entries: [
      {
        slug: 'mr-robot',
        published: false,
        title: 'Mr Robot CTF',
        platform: 'TryHackMe',
        type: 'guided-lab',
        status: 'completed, 3 of 3 flags',
        // TODO: add completion date
        date: '',
        tags: ['Enumeration', 'WordPress', 'Linux PrivEsc', 'SUID'],
        roomUrl: 'https://tryhackme.com/r/room/mrrobot',
        summary: SITE_CONFIG.writeupsConfig.mrRobotDefaultSummary,
        sections: {
          goal: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          setup: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          reconnaissance: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          enumeration: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          foothold: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          privilegeEscalation: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          whatIGotWrong: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          defendersView: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          takeaways: {
            // TODO: my own notes
            paragraphs: [],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
        },
      },

      /*
       * ======================================================================
       * SECOND ENTRY TEMPLATE (COMMENTED OUT)
       * Copy, uncomment, and fill with your own real lab notes to add a new
       * write-up. Keep `published: false` until notes are verified and all
       * flags/credentials are redacted as `[redacted]`.
       * ======================================================================
       *
       * {
       *   slug: 'template-room-slug',
       *   published: false,
       *   title: 'Room or Lab Title',
       *   platform: 'TryHackMe', // or 'PortSwigger', 'HackTheBox', etc.
       *   type: 'guided-lab', // 'guided-lab' | 'original'
       *   status: 'completed',
       *   date: 'YYYY-MM-DD', // optional — leave '' if unknown (never invent a date)
       *   tags: ['Web', 'Enumeration', 'Privilege Escalation'],
       *   roomUrl: 'https://tryhackme.com/r/room/example',
       *   summary: 'One-line factual summary of what was practised in this room.',
       *   sections: {
       *     goal: {
       *       paragraphs: ['TODO: my own notes on the objective of the room.'],
       *       steps: [],
       *       codeBlocks: [],
       *       screenshots: [],
       *     },
       *     setup: {
       *       paragraphs: [],
       *       steps: ['Connect to lab VPN and verify target reachability.'],
       *       codeBlocks: [
       *         {
       *           label: 'Environment check',
       *           language: 'bash',
       *           code: 'ping -c 3 <target-ip>',
       *         },
       *       ],
       *       screenshots: [],
       *     },
       *     reconnaissance: {
       *       paragraphs: [],
       *       steps: [],
       *       codeBlocks: [],
       *       screenshots: [
       *         {
       *           src: '/screenshots/example-nmap.png',
       *           alt: 'Terminal output showing open ports on the target host',
       *           caption: 'Initial port scan results with service versions.',
       *         },
       *       ],
       *     },
       *     enumeration: {
       *       paragraphs: [],
       *       steps: [],
       *       codeBlocks: [],
       *       screenshots: [],
       *     },
       *     foothold: {
       *       paragraphs: [],
       *       steps: [],
       *       codeBlocks: [],
       *       screenshots: [],
       *     },
       *     privilegeEscalation: {
       *       paragraphs: [],
       *       steps: [],
       *       codeBlocks: [],
       *       screenshots: [],
       *     },
       *     whatIGotWrong: {
       *       paragraphs: [],
       *       steps: [],
       *       codeBlocks: [],
       *       screenshots: [],
       *     },
       *     defendersView: {
       *       paragraphs: [],
       *       steps: [],
       *       codeBlocks: [],
       *       screenshots: [],
       *     },
       *     takeaways: {
       *       paragraphs: [],
       *       steps: [],
       *       codeBlocks: [],
       *       screenshots: [],
       *     },
       *   },
       * },
       */
    ],
  },

  connect: {
    amberStatusLabel: SITE_CONFIG.connectConfig.amberStatusLabel,
    heading: SITE_CONFIG.connectConfig.heading,
    introLine: SITE_CONFIG.connectConfig.introLine,
    statusLine: SITE_CONFIG.connectConfig.statusLine,
    copyEmailLabel: SITE_CONFIG.connectConfig.copyEmailLabel,
    copiedConfirmationLabel: SITE_CONFIG.connectConfig.copiedConfirmationLabel,
    backToTopLabel: SITE_CONFIG.connectConfig.backToTopLabel,
    channels: [
      {
        id: 'channel-email',
        label: 'Email',
        value: 'vaibhavashokm123@gmail.com',
        href: 'mailto:vaibhavashokm123@gmail.com',
        external: false,
        copyValue: 'vaibhavashokm123@gmail.com',
      },
      {
        id: 'channel-linkedin',
        label: 'LinkedIn',
        value: 'linkedin.com/in/cyber-vaibhav',
        href: 'https://www.linkedin.com/in/cyber-vaibhav',
        external: true,
      },
      {
        id: 'channel-github',
        label: 'GitHub',
        value: 'github.com/Vaibhav-48-iiit',
        href: 'https://github.com/Vaibhav-48-iiit',
        external: true,
      },
      {
        id: 'channel-tryhackme',
        label: 'TryHackMe',
        value: 'tryhackme.com/p/CyberVaibhav',
        href: 'https://tryhackme.com/p/CyberVaibhav',
        external: true,
      },
      {
        id: 'channel-x',
        label: 'X',
        value: '@whoami_vaibhav',
        href: 'https://x.com/whoami_vaibhav',
        external: true,
      },
      {
        id: 'channel-resume',
        label: 'Resume (PDF)',
        value: '/Vaibhav_Marathe_Resume.pdf',
        href: '/Vaibhav_Marathe_Resume.pdf',
        external: true,
      },
    ],
  },

  placeholders: {
    writeups: 'Placeholder, content in a later phase',
    connect: 'Placeholder, content in a later phase',
    secondaryLinksLabel: 'Profiles & direct channels',
  },
};
