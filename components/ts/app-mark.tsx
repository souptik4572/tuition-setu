/** The simplified app icon from Board 1, for sizes under 64px. */
export function AppMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden className="shrink-0 rounded-[25%]">
      <rect width="1024" height="1024" fill="#1CB0F6" />
      <g transform="translate(512 512) scale(0.92) translate(-512 -512)">
        <rect x="128" y="276" width="290" height="420" rx="56" fill="#FFFFFF" />
        <path d="M240 420h120M240 520h90" stroke="#1CB0F6" strokeWidth="44" strokeLinecap="round" fill="none" />
        <path
          d="M666 276H836A60 60 0 0 1 896 336V556A60 60 0 0 1 836 616H830L870 696L760 616H666A60 60 0 0 1 606 556V336A60 60 0 0 1 666 276Z"
          fill="#FFFFFF"
        />
        <path d="M670 420h150" stroke="#1CB0F6" strokeWidth="44" strokeLinecap="round" fill="none" />
        <path d="M400 572Q512 400 624 572" stroke="#FF9600" strokeWidth="72" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
