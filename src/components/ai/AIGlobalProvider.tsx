"use client";

import { AICommandButton } from "./AICommandButton";

/**
 * Global AI Provider that renders the floating AI command button
 * This component is rendered at the root level to be available on all pages
 */
export function AIGlobalProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AICommandButton />
    </>
  );
}
