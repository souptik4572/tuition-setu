import type { Metadata } from "next";
import { NeedsYouScreen } from "./screen";

export const metadata: Metadata = { title: "Needs you · TuitionSetu" };

export default function NeedsYouPage() {
  return <NeedsYouScreen />;
}
