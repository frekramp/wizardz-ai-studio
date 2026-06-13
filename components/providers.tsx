"use client";

import type { ReactNode } from "react";
import { LaserEyesProvider, MAINNET } from "@omnisat/lasereyes-react";
import { HolderProvider } from "@/components/holder-provider";

// LaserEyes must live on the client only (it touches window/wallet providers).
export function Providers({ children }: { children: ReactNode }) {
  return (
    <LaserEyesProvider config={{ network: MAINNET }}>
      <HolderProvider>{children}</HolderProvider>
    </LaserEyesProvider>
  );
}
