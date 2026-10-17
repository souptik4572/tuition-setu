"use client";

import { Check, Smartphone, Wifi, WifiOff } from "lucide-react";
import { Tabs } from "radix-ui";
import type { ReactNode } from "react";
import { Banner } from "@/components/ts/banner";

export type PhoneStatus = "phone" | "ready" | "laptop_only" | "no_wifi";
type Platform = "iphone" | "android";

const card = "flex flex-col gap-4 rounded-lg border-2 border-b-4 border-hairline p-5 lg:p-6";
const tabClass =
  "inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] border-2 border-transparent px-4 text-base font-extrabold text-ink-strong data-[state=active]:border-hairline data-[state=active]:bg-surface data-[state=active]:text-ocean";
const text = "text-base leading-normal";
const muted = "text-[15px] leading-normal text-muted-foreground";

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-field px-1.5 py-0.5 font-mono text-[15px] wrap-break-word text-ink-strong">{children}</code>;
}

function Status({ status, address }: { status: PhoneStatus; address: string | null }) {
  if (status === "phone")
    return (
      <Banner variant="success" icon={Smartphone}>
        <span className="flex flex-col gap-0.5">
          <span>This phone is connected to TuitionSetu on your laptop.</span>
          <span className="font-semibold">Add it to your home screen (step 5) so it opens like an app.</span>
        </span>
      </Banner>
    );
  if (status === "no_wifi")
    return (
      <Banner variant="caution" icon={WifiOff}>
        <span className="flex flex-col gap-0.5">
          <span>This laptop isn&apos;t connected to a Wi-Fi network.</span>
          <span className="font-semibold">Connect it to the same Wi-Fi as your phone, then open this page again.</span>
        </span>
      </Banner>
    );
  if (status === "laptop_only")
    return (
      <section aria-labelledby="status-title" className="flex flex-col gap-3 rounded-lg border-2 border-caution-border bg-caution p-5 text-on-caution">
        <h2 id="status-title" className="flex items-center gap-2.5 text-lg font-extrabold">
          <WifiOff aria-hidden className="size-[22px] shrink-0" strokeWidth={2.4} />
          Phones can&apos;t open it yet
        </h2>
        <p className={text}>
          TuitionSetu is only listening on this laptop. In the terminal where it&apos;s running, press <Code>Ctrl+C</Code>, then start it again with <Code>./start.sh --lan</Code>.
        </p>
        {address && (
          <p className={text}>
            Your phone will then open <strong className="font-extrabold">{address}</strong>
          </p>
        )}
      </section>
    );
  return (
    <section aria-labelledby="status-title" className="flex flex-col gap-2 rounded-lg bg-sky-tint p-5 text-on-sky-tint lg:p-6">
      <h2 id="status-title" className="flex items-center gap-2.5 text-[15px] font-extrabold tracking-[0.6px] uppercase">
        <Wifi aria-hidden className="size-5 shrink-0" strokeWidth={2.4} />
        Ready · on your phone, open
      </h2>
      <p className="font-mono text-[26px] leading-tight font-bold break-all text-ink-strong select-all lg:text-[32px]">{address}</p>
      <p className="text-[15px] leading-normal">Phones on the same Wi-Fi can open TuitionSetu now. Sign in with your PIN.</p>
    </section>
  );
}

type Step = { title: string; body: (p: Platform) => ReactNode };

function steps(address: string | null): Step[] {
  const shown = address ? <Code>{address}</Code> : "the address from step 2";
  return [
    {
      title: "Put both on the same Wi-Fi",
      body: (p) => (
        <>
          <p className={text}>Your phone reaches the laptop through your Wi-Fi router, so both need to be on the same network. Mobile data won&apos;t work for this.</p>
          <p className={text}>
            {p === "iphone" ? (
              <>
                On your iPhone, open <strong>Settings → Wi-Fi</strong>. The network with a tick should have the same name as the laptop&apos;s.
              </>
            ) : (
              <>
                On your Android phone, open <strong>Settings → Network &amp; internet → Internet</strong> (on Samsung, <strong>Settings → Connections → Wi-Fi</strong>). The connected network should have the same name as the laptop&apos;s.
              </>
            )}
          </p>
          <p className={muted}>On a Mac, click the Wi-Fi icon in the menu bar to see which network it&apos;s on.</p>
        </>
      ),
    },
    {
      title: "Start TuitionSetu for phones",
      body: () => (
        <>
          <p className={text}>
            On the laptop, start it with <Code>./start.sh --lan</Code>. It prints the address for your phone, and the box at the top of this page shows it too.
          </p>
          <p className={muted}>
            The first time, your Mac may ask whether &ldquo;node&rdquo; can accept incoming network connections. Click <strong>Allow</strong>. To start this way every time, add <Code>LISTEN_ON_LAN=true</Code> to <Code>.env.local</Code>.
          </p>
        </>
      ),
    },
    {
      title: "Open the address on your phone",
      body: (p) => (
        <>
          <p className={text}>
            {p === "iphone" ? "Open Safari and tap the address bar." : "Open Chrome and tap the address bar."} Type {shown} exactly, with <Code>http://</Code> at the start and the number after the colon at the end, then tap <strong>{p === "iphone" ? "Go" : "Enter"}</strong>.
          </p>
          {p === "iphone" && <p className={muted}>Using Chrome on your iPhone? If it asks to find devices on your local network, tap Allow.</p>}
          <p className={muted}>
            The browser may show &ldquo;Not secure&rdquo; next to the address. The connection isn&apos;t encrypted, but it stays inside your Wi-Fi and never reaches the internet, so use a Wi-Fi you trust, like your home&apos;s.
          </p>
        </>
      ),
    },
    {
      title: "Sign in with your PIN",
      body: () => (
        <p className={text}>
          Use the same PIN as on the laptop. The phone stays signed in. Choosing a new PIN on the laptop with <Code>npm run reset-pin</Code> signs every phone out.
        </p>
      ),
    },
    {
      title: "Add it to your home screen",
      body: (p) => (
        <>
          <p className={text}>
            {p === "iphone" ? (
              <>
                In Safari, tap <strong>Share</strong> (the square with an arrow), scroll down, tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </>
            ) : (
              <>
                In Chrome, tap <strong>⋮</strong> at the top right, tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>), then <strong>Add</strong>.
              </>
            )}
          </p>
          <p className={muted}>It opens like an app whenever the laptop is on, TuitionSetu is running and your phone is on the same Wi-Fi.</p>
        </>
      ),
    },
  ];
}

const problems: { title: string; body: ReactNode }[] = [
  {
    title: "“Can't open the page” or “This site can't be reached”",
    body: "Look at the box at the top of this page on the laptop. Then check that your phone is on the same Wi-Fi, not mobile data.",
  },
  {
    title: "The laptop went to sleep",
    body: "A sleeping laptop can't answer your phone. Keep it awake and plugged in while you use your phone. On a Mac, System Settings → Battery → Options can keep it awake while it's charging.",
  },
  {
    title: "The address stopped working",
    body: "Wi-Fi routers sometimes give the laptop a new address, after a restart for example. Open this page on the laptop for the new one, and add it to your home screen again.",
  },
  {
    title: "Office, school, café or guest Wi-Fi",
    body: "Some networks stop devices from seeing each other. Use your home Wi-Fi, or turn on your phone's hotspot and connect the laptop to it, then open this page on the laptop for the new address.",
  },
  { title: "“Too many tries”", body: "After five wrong PINs, signing in pauses for 10 minutes." },
];

/** The phone guide (IMPL D-42): live status from the server, then the steps for the chosen phone. */
export function PhoneGuide({ status, address, platform }: { status: PhoneStatus; address: string | null; platform: Platform }) {
  const list = steps(address);
  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-4 lg:px-6 lg:pt-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-[1.2] font-extrabold text-ink-strong lg:font-display lg:text-5xl lg:leading-[1.1] lg:tracking-[-1.2px]">Use it on your phone</h1>
        <p className="text-[17px] leading-normal text-muted-foreground">Your phone opens TuitionSetu from this laptop over your Wi-Fi. Nothing goes through the internet.</p>
      </header>

      <Status status={status} address={address} />

      <Tabs.Root defaultValue={platform} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-extrabold tracking-[0.6px] text-muted-foreground uppercase">Your phone</span>
          <Tabs.List aria-label="Your phone" className="flex min-w-[240px] flex-1 gap-1 rounded-md bg-field p-1">
            <Tabs.Trigger value="iphone" className={tabClass}>
              iPhone
            </Tabs.Trigger>
            <Tabs.Trigger value="android" className={tabClass}>
              Android
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        {(["iphone", "android"] as const).map((p) => (
          <Tabs.Content key={p} value={p}>
            <ol className={card}>
              {list.map((step, i) => (
                <li key={step.title} className="flex gap-4 border-t-2 border-hairline pt-4 first:border-t-0 first:pt-0">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-tint text-base font-extrabold text-ocean">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-2">
                    <h2 className="pt-1 text-lg font-extrabold text-ink-strong">{step.title}</h2>
                    {step.body(p)}
                  </div>
                </li>
              ))}
            </ol>
          </Tabs.Content>
        ))}
      </Tabs.Root>

      <section aria-labelledby="problems-title" className={card}>
        <h2 id="problems-title" className="text-xl font-extrabold text-ink-strong">
          If it doesn&apos;t open
        </h2>
        <ul className="flex flex-col gap-4">
          {problems.map((item) => (
            <li key={item.title} className="flex flex-col gap-1">
              <h3 className="text-base font-extrabold text-ink-strong">{item.title}</h3>
              <p className={muted}>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-start gap-2.5 text-sm leading-normal text-muted-foreground">
        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ocean" strokeWidth={2.6} />
        Anyone on the same Wi-Fi could open the address, but they&apos;d still need your PIN. Your phone talks only to your laptop, and your laptop talks only to the AI running on itself.
      </p>
    </div>
  );
}
