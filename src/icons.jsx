import React from "react";

const paths = {
  bag: <><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
  work: <><path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect x="2" y="6" width="20" height="14" rx="2"/></>,
  nest: <><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10M8 20v-6h8v6"/><path d="M9 11h6"/></>,
  live: <><path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M7 18v-4h10v4M7 16h10M9 14v-2h3a2 2 0 0 1 2 2"/></>,
  save: <><path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1Z"/><path d="M16 10h.01M2 8v1a2 2 0 0 0 2 2h1"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  send: <><path d="M12 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M18 12h.01M6 12h.01"/><circle cx="12" cy="12" r="2"/><path d="M19 22v-6m3 3-3-3-3 3"/></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  studio: <><path d="M4 8h16v12H4zM3 8l2-4h14l2 4"/><path d="M9 13h6M12 11v4"/></>,
  shield: <><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z"/><path d="M12 8v8M8 12h8"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  back: <path d="m15 18-6-6 6-6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  bus: <><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M8 19v2M16 19v2M8 14h.01M16 14h.01"/></>,
  person: <><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
  bed: <><path d="M3 20v-9h18v9M3 16h18M6 11V7h5a4 4 0 0 1 4 4"/></>,
  power: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>,
  water: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>,
  clean: <><path d="m14 4 6 6-8 8-6-6 8-8Z"/><path d="m5 13-2 8 8-2M8 16l-3-3"/></>,
  wifi: <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/></>,
  laundry: <><path d="M7 5 3 8l3 4 2-2v11h8V10l2 2 3-4-4-3-2 2H9L7 5Z"/></>,
  trim: <><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m8 15 8-10M16 15 8 5"/></>,
  wrench: <path d="M21 7a6 6 0 0 1-8 5L5 20l-3-3 8-8a6 6 0 0 1 8-8l-4 4 3 3 4-4a6 6 0 0 1 0 3Z"/>,
  roof: <><path d="M3 11 12 3l9 8M5 10v10h14V10M9 20v-6h6v6"/><path d="M15 5v4h4"/></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></>,
  ledger: <><path d="M6 3h13v18H6zM3 6h3M3 10h3M3 14h3M3 18h3"/><path d="M10 8h5M10 12h5M10 16h4"/></>,
  family: <><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z"/><circle cx="12" cy="10" r="2"/><path d="M8.5 16a3.5 3.5 0 0 1 7 0"/></>,
  upi: <><path d="m5 4 7 8-7 8M12 4l7 8-7 8"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>
};

export function Icon({ name, size = 24, className = "", strokeWidth = 1.5 }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.check}
    </svg>
  );
}
