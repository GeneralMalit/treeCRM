"use client";

import { usePathname } from "next/navigation";
import { AppFooter } from "@/components/AppFooter";

const AUTHENTICATED_PREFIXES = ["/admin", "/employee", "/portal"];

export function AppFooterGate() {
  const pathname = usePathname();

  if (AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return <AppFooter />;
}
