// Toolbar pictograms (24x24, drawn with the current stroke colour).
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  hand: svg(
    '<path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  ),
  ratchet: svg('<circle cx="7" cy="7" r="4.2"/><circle cx="7" cy="7" r="1.4"/><path d="M10 10l10.5 10.5"/><path d="M15 18l3-3"/>'),
  torque: svg('<circle cx="6.5" cy="6.5" r="3.6"/><path d="M9.1 9.1 20.5 20.5"/><path d="M13 3.2a8.2 8.2 0 0 1 7.8 7.8"/><path d="M17.6 6.4l-2.2 2.2"/><path d="M16 19l3-3"/>'),
  screwdriver: svg('<path d="M3.5 20.5l8.5-8.5"/><path d="M11 13l2-2"/><path d="M12.2 8.8l3 3 5.3-5.3a2.1 2.1 0 0 0-3-3z"/>'),
  hammer: svg(
    '<path d="m15 12-8.4 8.4a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.9-1.9A2 2 0 0 1 19 8.2V7l-2.3-2.3a6 6 0 0 0-4.2-1.7H9l.9.8A6.2 6.2 0 0 1 12 8.4V10l2 2h1.2a2 2 0 0 1 1.4.6l1.9 1.9"/>',
  ),
  hook: svg('<path d="M15 6.5a3 3 0 1 0-6 0c0 2.6 6 3.6 6 8.5a3 3 0 0 1-6 0"/><path d="M15 6.5V8"/><path d="M9 15v-1.5"/>'),
  pistonTool: svg('<path d="M7 4h8a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7"/><path d="M4 12h9"/><path d="M4 9v6"/><path d="M13 9.5v5"/>'),
  brush: svg('<rect x="2.5" y="8" width="12" height="4.5" rx="1"/><path d="M14.5 10.2H22"/><path d="M4.5 12.5v4M7.5 12.5v4.5M10.5 12.5v4M13 12.5v3"/>'),
  cleaner: svg('<rect x="9" y="9" width="8" height="12" rx="1.6"/><path d="M11 9V6.5h4V9"/><path d="M13 6.5V4.5h-2"/><path d="M7 4h.01M4.5 2.8h.01M4.5 5.6h.01M2.5 4.2h.01"/>'),
  paste: svg('<path d="M7.5 3h9l1.3 13H6.2z"/><path d="M9.5 16v3h5v-3"/><path d="M11 19v2h2v-2"/><path d="M9 8h6"/>'),
  silicone: svg('<path d="M5 3h8l1.2 11.5H3.8z"/><path d="M7 14.5v3h4v-3"/><path d="M19 12c1.6 2.2 2.6 3.5 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.5 1-2.8 2.6-5z"/>'),
  oil: svg('<path d="M3 12h9l5.5-4.5L19 9l-4 4.5V20H3z"/><path d="M6 12V9h4v3"/><path d="M21 14.5c.8 1.1 1.3 1.8 1.3 2.6a1.3 1.3 0 0 1-2.6 0c0-.8.5-1.5 1.3-2.6z"/>'),
};
