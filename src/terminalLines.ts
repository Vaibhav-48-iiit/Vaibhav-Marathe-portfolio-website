/**
 * Editable Terminal Recon Lines
 *
 * TODO: replace with my real lab output
 *
 * Each entry represents one line of terminal output during the intro sequence.
 * - `tone: 'command'` renders with a subtle prompt prefix.
 * - `tone: 'output'` renders in standard warm ivory (#E8E4DA).
 * - `tone: 'warning'` or `tone: 'granted'` uses the reserved amber (#E8A33D).
 */

export interface TerminalLineItem {
  id: string;
  text: string;
  tone: 'command' | 'output' | 'warning' | 'granted';
}

// TODO: replace with my real lab output
export const TERMINAL_LINES: readonly TerminalLineItem[] = [
  {
    id: 'cmd-recon',
    text: '$ nmap -sV -Pn --open 10.10.14.18 -p 22,80,443,8443',
    tone: 'command',
  },
  {
    id: 'out-host',
    text: 'Host is up (0.014s latency). Not shown: 2 closed tcp ports',
    tone: 'output',
  },
  {
    id: 'out-ports',
    text: '443/tcp  open  ssl/http  nginx 1.24.0 (TLSv1.3 / ECDHE-RSA-AES256-GCM)',
    tone: 'output',
  },
  {
    id: 'out-cert',
    text: 'ssl-cert: subject: CN=lab.vaibhavmarathe.local / issuer: internal-ca-01',
    tone: 'output',
  },
  {
    id: 'out-warn',
    text: '[warn] strict transport policy verified; passive telemetry only',
    tone: 'warning',
  },
  {
    id: 'out-granted',
    text: 'status: access granted — session authenticated [Δ]',
    tone: 'granted',
  },
];
