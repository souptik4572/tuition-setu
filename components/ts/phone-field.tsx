"use client";

import { Check, ExternalLink, Globe, Info, MessageCircle } from "lucide-react";
import { useState } from "react";
import { formatPhone, normalizePhone } from "@/lib/util/phone";
import { cn } from "@/lib/utils";
import { FieldError, helpClass, labelClass } from "./field";

/** How a stored number goes back into the field: "98000 00001", or "+44 7700 900123" from abroad. */
export function phoneInputValue(digits: string): string {
  return digits.length === 12 && digits.startsWith("91") ? `${digits.slice(2, 7)} ${digits.slice(7)}` : formatPhone(digits);
}

const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0]);

/** "We tidied the spaces, dash and leading 0." (R2-Pasted), naming only what was there. */
function tidyNote(typed: string): string | null {
  const digits = typed.replace(/\D/g, "");
  const parts: string[] = [];
  if (digits.length === 12) parts.push("country code");
  if (/\s/.test(typed.trim())) parts.push("spaces");
  const dashes = typed.split("-").length - 1;
  if (dashes) parts.push(dashes > 1 ? "dashes" : "dash");
  if (/[()]/.test(typed)) parts.push("brackets");
  if (/\./.test(typed)) parts.push("dots");
  if (digits.length === 11 && digits.startsWith("0")) parts.push("leading 0");
  return parts.length ? `We tidied the ${list(parts)}.` : null;
}

/**
 * The parent's WhatsApp number (R2): +91 unless typed with another country code, tidied when the
 * field loses focus, with the number messages will go to, brothers and sisters already on it, and
 * a link that opens the chat on WhatsApp without typing anything.
 */
export function PhoneField({
  id,
  value,
  onChange,
  others,
  showErrors,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Other students, for "Also used for Riya Sen". */
  others: { fullName: string; parentPhone: string }[];
  /** True once the form has tried to save. */
  showErrors: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const [tidied, setTidied] = useState<string | null>(null);
  const phone = normalizePhone(value);
  const abroad = value.trim().startsWith("+") && !value.trim().startsWith("+91");
  const error = !phone.ok && (showErrors || (touched && phone.reason !== "empty"));
  const siblings = phone.ok ? others.filter((s) => s.parentPhone === phone.digits).map((s) => s.fullName) : [];

  const blur = () => {
    setTouched(true);
    if (!phone.ok) return;
    const shown = phone.international ? phone.display : phone.display.slice(4);
    if (value === shown) return;
    if (!phone.international) setTidied(value.trim() === phone.digits.slice(2) ? null : tidyNote(value));
    onChange(shown);
  };

  const messages = [error && `${id}-error`, `${id}-help`].filter(Boolean).join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className={labelClass}>
        Parent&apos;s WhatsApp number <span aria-hidden className="text-danger">*</span>
      </label>
      <div
        className={cn(
          "flex h-[52px] min-w-0 items-stretch overflow-hidden rounded-md border-2 bg-field focus-within:bg-surface",
          error ? "border-danger bg-surface" : "border-field-border",
        )}
      >
        <span className="flex w-[58px] shrink-0 items-center justify-center border-r-2 border-hairline text-[17px] font-extrabold text-ink-strong">
          {abroad ? (
            <>
              <Globe aria-hidden className="size-5" strokeWidth={2.2} />
              <span className="sr-only">International number</span>
            </>
          ) : (
            <>
              <span aria-hidden>+91</span>
              <span className="sr-only">India, +91</span>
            </>
          )}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="98000 00001"
          value={value}
          onChange={(e) => {
            setTidied(null);
            onChange(e.target.value);
          }}
          onBlur={blur}
          aria-required
          aria-invalid={error}
          aria-describedby={messages}
          className="min-w-0 flex-1 bg-transparent px-3.5 text-[17px] text-ink outline-none placeholder:text-muted-foreground"
        />
      </div>

      {error && (
        <FieldError id={`${id}-error`}>
          <span className="flex flex-col">
            <span>Enter a 10-digit mobile number</span>
            {phone.digitCount > 0 && (
              <span className="font-semibold">
                {abroad ? "Check the country code and the number." : `This one has ${phone.digitCount} ${phone.digitCount === 1 ? "digit" : "digits"}.`}
              </span>
            )}
          </span>
        </FieldError>
      )}

      <div id={`${id}-help`} className="flex flex-col gap-2">
        {phone.ok && (phone.international || tidied) && (
          <span role="status" className="flex items-start gap-2 rounded-md bg-sky-tint px-3.5 py-3 text-[15px] leading-[1.45] text-on-sky-tint">
            <Check aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2.8} />
            <span className="flex flex-col">
              <strong className="font-extrabold">Messages will go to {phone.display}</strong>
              {phone.international ? (
                <span>
                  Country code {phone.display.split(" ")[0]}
                  {phone.country && ` — ${phone.country}`}
                </span>
              ) : (
                <span>{tidied}</span>
              )}
            </span>
          </span>
        )}

        {siblings.length > 0 && (
          <span className="flex items-start gap-2.5 rounded-md bg-field px-3.5 py-3 text-[15px] leading-[1.45] text-ink">
            <Info aria-hidden className="mt-0.5 size-[18px] shrink-0 text-ocean" strokeWidth={2.4} />
            <span>
              <strong className="font-extrabold">Also used for {list(siblings)}.</strong> That&apos;s fine for brothers and sisters — each gets their own update.
            </span>
          </span>
        )}

        {abroad ? (
          <button type="button" onClick={() => onChange("")} className="cursor-pointer self-start text-[15px] font-extrabold text-ocean">
            Use an Indian number (+91) instead
          </button>
        ) : (
          <span className={helpClass}>Number outside India? Start with + and the country code.</span>
        )}

        {phone.ok ? (
          <>
            <a
              href={`https://wa.me/${phone.digits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border-2 border-sky bg-sky-tint px-3.5 text-[15px] font-extrabold text-on-sky-tint no-underline"
            >
              <MessageCircle aria-hidden className="size-[18px]" strokeWidth={2.4} />
              Check on WhatsApp
              <ExternalLink aria-hidden className="size-4" strokeWidth={2.4} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <span className={helpClass}>
              Opens a chat with {phone.display} in WhatsApp. Nothing is typed or sent — just see whose name and photo come up.
            </span>
          </>
        ) : (
          !error && <span className={helpClass}>“Check on WhatsApp” appears once there&apos;s a full number.</span>
        )}
      </div>
    </div>
  );
}
