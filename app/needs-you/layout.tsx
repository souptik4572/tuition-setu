import { ToastProvider } from "@/components/ts/toast";

export default function NeedsYouLayout({ children }: LayoutProps<"/needs-you">) {
  return <ToastProvider>{children}</ToastProvider>;
}
