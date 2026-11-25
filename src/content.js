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
 *     -> TODO: add completion date for Mr Robot CTF (optional)
 *
 * B. UNPUBLISHED WRITE-UPS (`published: false` — hidden from published list):
 *  (none currently — "mr-robot" is published with notes from GitHub)
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
        published: true,
        title: 'Mr Robot CTF',
        platform: 'TryHackMe',
        type: 'guided-lab',
        status: 'completed, 3 of 3 flags',
        // TODO: add completion date
        date: '',
        tags: ['Enumeration', 'WordPress', 'Hash Cracking', 'Linux PrivEsc', 'SUID'],
        roomUrl: 'https://tryhackme.com/r/room/mrrobot',
        githubUrl:
          'https://github.com/Vaibhav-48-iiit/ctf-writeups/tree/main/mr-robot-ctf',
        summary: SITE_CONFIG.writeupsConfig.mrRobotDefaultSummary,
        sections: {
          goal: {
            paragraphs: [
              'Mr Robot is a Linux-based Capture The Flag (CTF) room on TryHackMe, inspired by the television series Mr. Robot. The objective is to compromise a vulnerable machine, discover three hidden keys, and ultimately obtain root access.',
              'The challenge focuses on practical penetration-testing techniques, including network reconnaissance, web enumeration, WordPress exploitation, password hash cracking, Linux user enumeration, and privilege escalation.',
            ],
            steps: [
              'Understand how to identify exposed network services.',
              'Discover hidden directories and sensitive information on a web server.',
              'Understand WordPress authentication and exploitation.',
              'Gain initial access through an authenticated web application.',
              'Identify and crack password hashes.',
              'Understand Linux file permissions and SUID binaries.',
              'Escalate privileges from a low-privileged user to root.',
            ],
            codeBlocks: [],
            screenshots: [],
          },
          setup: {
            paragraphs: [
              'The assessment was performed in an authorized TryHackMe lab environment. The target machine was accessed through its assigned lab IP address, and all testing activities were restricted to the authorized CTF environment.',
            ],
            steps: [
              'Attacker machine: Kali Linux',
              'Target machine: TryHackMe Mr Robot',
              'Network access: TryHackMe VPN connection',
              'Network scanning: Nmap',
              'Web enumeration: Gobuster, cURL',
              'Web application: WordPress',
              'Shell interaction: Netcat',
              'Hash analysis: Hashcat / hash-cracking utilities',
              'Privilege escalation: Linux SUID enumeration and Nmap',
            ],
            codeBlocks: [],
            screenshots: [],
          },
          reconnaissance: {
            paragraphs: [
              'The assessment started with network reconnaissance to identify the target’s exposed services and understand its attack surface. Nmap was used to scan the target and identify accessible ports.',
              'The scan revealed web services running over HTTP and HTTPS, indicating that the web application was the primary entry point for further investigation. Instead of immediately attempting exploitation, the focus shifted towards understanding the services and inspecting the web interface in a browser.',
            ],
            steps: [
              'A web server was accessible over HTTP and HTTPS.',
              'The website contained a custom interface inspired by the Mr. Robot series.',
              'The web server became the primary target for further enumeration.',
            ],
            codeBlocks: [],
            screenshots: [],
          },
          enumeration: {
            paragraphs: [
              'After identifying the web services, directory enumeration was performed using Gobuster to discover hidden directories, files, and potentially sensitive information not directly accessible through the homepage.',
              'Inspecting robots.txt revealed references to a custom dictionary file and a hidden key file (key values [redacted]). The discovered dictionary appeared relevant to the authentication mechanism and was retained for further investigation.',
              'Another discovery was the /license resource, which contained an encoded string. Using cURL and Base64 decoding techniques, the encoded content was examined and identified as credential-related information ([redacted]).',
            ],
            steps: [
              'Hidden resources were discovered through directory enumeration.',
              'robots.txt exposed useful information about files hosted on the server.',
              'A custom dictionary was identified for potential password testing.',
              'The /license resource contained Base64-encoded information.',
              'WordPress was identified as the underlying content management system.',
            ],
            codeBlocks: [],
            screenshots: [],
          },
          foothold: {
            paragraphs: [
              'Using the information collected during enumeration, the WordPress login interface became the focus of the next stage and helped establish access to the WordPress administrative interface.',
              'Inside the dashboard, the WordPress Theme Editor allowed modification of PHP theme files, creating an authenticated remote code execution path. A PHP reverse-shell approach connected back to the attacking machine through a Netcat listener, providing a low-privileged shell for local enumeration.',
              'Examining home directories and accessible files uncovered an MD5 password hash associated with another local user account ([redacted]). A wordlist-based cracking approach recovered the password, allowing a switch to that local user account to continue locating the next hidden key.',
            ],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          privilegeEscalation: {
            paragraphs: [
              'This was the most educational stage of the entire CTF. Initially, I did not know about SUID-based privilege escalation or how specially permissioned Linux binaries could be abused to obtain higher privileges.',
              'While investigating Linux permissions and SUID-enabled files, I learned that SUID (Set User ID) allows an executable to run with the effective privileges of its file owner rather than the executing user. Enumeration revealed an Nmap binary with SUID permissions whose installed version supported an interactive mode allowing shell command execution, creating a path to root-level access.',
              'Important learning experience: I had not previously studied or practically performed SUID-based privilege escalation and learned the concept during this CTF with AI assistance for understanding the permission mechanism, commands, and scripts. The overall attack logic, reasoning behind each stage, interpretation of findings, and investigation decisions were my own.',
            ],
            steps: [],
            codeBlocks: [],
            screenshots: [],
          },
          whatIGotWrong: {
            paragraphs: [
              'If I attempted this CTF again, I would make several improvements across methodology, documentation, and independent troubleshooting.',
              'Overall, this CTF helped connect individual cybersecurity concepts into one practical penetration-testing workflow: understanding how reconnaissance, enumeration, exploitation, hash cracking, and privilege escalation work together during a real-world security assessment.',
            ],
            steps: [
              'More structured reconnaissance: perform a complete port and service enumeration before focusing on individual services.',
              'Better enumeration documentation: maintain a clear record of discovered directories, files, services, and potentially useful information.',
              'Understand tools before executing commands: spend more time understanding the options and purpose of each command.',
              'Improve Linux privilege-escalation knowledge: study SUID, SGID, Linux capabilities, cron jobs, sudo misconfigurations, and file-permission weaknesses beforehand.',
              'Improve shell handling: learn more about reverse-shell stabilization, interactive terminals, and troubleshooting network connectivity.',
              'Reduce dependency on AI: attempt to understand the problem independently first, then use AI to clarify unfamiliar concepts and verify approaches.',
              'Document findings throughout the assessment: record methodology, reasoning, mistakes, and lessons learned at every stage rather than only after completion.',
            ],
            codeBlocks: [],
            screenshots: [],
          },
          defendersView: {
            paragraphs: [
              'The vulnerabilities demonstrated in this challenge highlight several security weaknesses and defensive opportunities across network exposure, web hardening, authentication, password storage, Linux permissions, and monitoring.',
            ],
            steps: [
              'Network exposure: disable unnecessary services, restrict access to administrative interfaces, apply strict firewall rules, and regularly audit exposed ports.',
              'Web application security: avoid exposing sensitive files in public directories, review robots.txt for unintended disclosure, keep WordPress/themes/plugins updated, and disable Theme Editor file editing.',
              'Authentication security: enforce strong passwords, implement rate limiting and account lockout, require MFA for admin accounts, and avoid username enumeration in error messages.',
              'Password storage: avoid weak hashing algorithms like plain MD5; use Argon2id or bcrypt with proper salting and work factors.',
              'Linux privilege management: regularly audit SUID/SGID binaries, remove unnecessary SUID bits, and never grant elevated permissions to utilities with shell-escape capabilities.',
              'Detection opportunities: monitor unusual WordPress theme modifications, unexpected outbound reverse-shell traffic, repeated authentication failures, unusual SUID binary executions, and unexpected root-shell creation.',
            ],
            codeBlocks: [],
            screenshots: [],
          },
          takeaways: {
            paragraphs: [],
            steps: [
              'Reconnaissance matters: understanding exposed services before attempting exploitation makes the assessment more structured.',
              'Web enumeration can reveal sensitive information: files like robots.txt and public resources can expose paths and clues about the application.',
              'WordPress security is important: administrative features that allow modifying PHP files become dangerous when improperly secured.',
              'Reverse shells provide an initial foothold: understanding listeners, network connectivity, and shell interaction is essential during exploitation.',
              'Weak password storage creates security risks: weak passwords and outdated hashing algorithms make credential recovery easier.',
              'Linux permissions deserve attention: SUID, SGID, file ownership, and executable permissions are critical during Linux security assessments.',
              'Privilege escalation requires enumeration: obtaining a low-privileged shell is only the start; the local environment must be thoroughly investigated.',
              'AI can support practical learning: it can clarify unfamiliar concepts and scripts, but validating results and understanding the underlying logic remains essential.',
            ],
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
