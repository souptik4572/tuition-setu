import type { Metadata } from "next";
import { NeedsYouScreen } from "../screen";

export const metadata: Metadata = { title: "Needs you · TuitionSetu" };

export default async function NeedsYouItemPage(props: PageProps<"/needs-you/[id]">) {
  const { id } = await props.params;
  return <NeedsYouScreen selectedId={id} />;
}
