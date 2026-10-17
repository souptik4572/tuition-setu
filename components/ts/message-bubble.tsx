import { cn } from "@/lib/utils";

export type Highlight = { start: number; end: number; label: string };

export type Segment = { text: string; bold: boolean; highlight: string | null };

// Like WhatsApp, the text inside the asterisks can't start or end with a space ("5 * 3" stays plain).
const BOLD = /\*(\S(?:[^*\n]*\S)?)\*/g;

/**
 * Splits an assembled message into display segments. `*bold*` renders bold without its
 * asterisks, as WhatsApp does. Highlight ranges are in body coordinates (the guard checks
 * the body only), so `bodyOffset` shifts them onto the full message.
 */
export function segmentMessage(message: string, highlights: Highlight[] = [], bodyOffset = 0): Segment[] {
  const hidden = new Array<boolean>(message.length).fill(false);
  const bold = new Array<boolean>(message.length).fill(false);
  const mark = new Array<string | null>(message.length).fill(null);

  for (const m of message.matchAll(BOLD)) {
    const start = m.index;
    const end = start + m[0].length;
    hidden[start] = true;
    hidden[end - 1] = true;
    for (let i = start + 1; i < end - 1; i++) bold[i] = true;
  }
  for (const h of highlights) {
    const from = Math.max(0, bodyOffset + h.start);
    const to = Math.min(message.length, bodyOffset + h.end);
    for (let i = from; i < to; i++) mark[i] = h.label;
  }

  const segments: Segment[] = [];
  for (let i = 0; i < message.length; i++) {
    if (hidden[i]) continue;
    const last = segments.at(-1);
    if (last && last.bold === bold[i] && last.highlight === mark[i]) last.text += message[i];
    else segments.push({ text: message[i], bold: bold[i], highlight: mark[i] });
  }
  return segments;
}

/** One outgoing WhatsApp bubble; `meta` is the small line under the text ("Preview · not sent", "Sent …"). */
export function Bubble({
  message,
  language,
  meta,
  highlights,
  bodyOffset,
  streaming = false,
  className,
}: {
  message: string;
  language: "en" | "bn" | "hi";
  meta: string;
  highlights?: Highlight[];
  bodyOffset?: number;
  streaming?: boolean;
  className?: string;
}) {
  const segments = segmentMessage(message, highlights, bodyOffset);
  return (
    <div
      lang={language}
      className={cn(
        "flex max-w-[92%] flex-col gap-2 self-end rounded-[16px_4px_16px_16px] bg-bubble px-4 pt-3.5 pb-2.5 text-ink",
        language === "en" ? "text-base leading-normal" : "text-[17px] leading-[1.6]",
        className,
      )}
    >
      <p className="m-0 whitespace-pre-wrap break-words">
        {segments.map((s, i) => {
          const text = s.bold ? <strong className="font-extrabold">{s.text}</strong> : s.text;
          if (!s.highlight) return <span key={i}>{text}</span>;
          return (
            <mark
              key={i}
              className="rounded-[4px] border-b-[3px] border-orange bg-highlight px-1 py-px font-extrabold text-on-mark"
            >
              {text}
              <span className="sr-only"> ({s.highlight})</span>
            </mark>
          );
        })}
        {streaming && <span aria-hidden className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-[0.15em] animate-caret bg-ink" />}
      </p>
      <span lang="en" className="self-end text-[13px] text-bubble-meta">
        {meta}
      </span>
    </div>
  );
}

export function MessageBubble({
  header,
  meta = "Preview · not sent",
  className,
  ...bubble
}: {
  header: string;
  meta?: string;
  message: string;
  language: "en" | "bn" | "hi";
  highlights?: Highlight[];
  bodyOffset?: number;
  streaming?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-md bg-field px-4 py-5", className)}>
      <span className="text-sm text-muted-foreground">{header}</span>
      <Bubble {...bubble} meta={meta} />
    </div>
  );
}
