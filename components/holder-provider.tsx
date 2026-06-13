"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLaserEyes } from "@omnisat/lasereyes-react";

type HolderState = { connected: boolean; holder: boolean; address: string | null };

type HolderCtx = HolderState & {
  loading: boolean;
  error: string | null;
  connectWallet: (provider: string) => Promise<void>;
  disconnect: () => Promise<void>;
};

const Ctx = createContext<HolderCtx | null>(null);

export function useHolder(): HolderCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useHolder must be used within <HolderProvider>");
  return c;
}

export function HolderProvider({ children }: { children: ReactNode }) {
  const le = useLaserEyes();
  const [holder, setHolder] = useState(false);
  const [sessionAddr, setSessionAddr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wantVerify = useRef(false);

  // Hydrate holder state from our own session cookie on first load.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await fetch("/api/auth/me").then((r) => r.json());
        if (!active || !me.connected) return;
         
        setHolder(!!me.holder);
         
        setSessionAddr(me.address ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Nonce → BIP-322 sign → verify → ownership.
  const verify = useCallback(
    async (address: string) => {
      const { message, token } = await fetch(
        `/api/auth/nonce?address=${encodeURIComponent(address)}`,
      ).then((r) => r.json());
      const sign = le.signMessage as (m: string, a?: string) => Promise<string>;
      const signature = await sign(message, address);
      const v = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature, message, token }),
      }).then((r) => r.json());
      if (v.error) throw new Error(v.error);
      setHolder(!!v.holder);
      setSessionAddr(address);
    },
    [le],
  );

  // Once the wallet reports an address after a user-initiated connect, verify.
  useEffect(() => {
    if (!wantVerify.current || !le.address) return;
    wantVerify.current = false;
    (async () => {
      try {
        await verify(le.address);
      } catch (e) {
        setError((e as Error).message || "Verification failed.");
      } finally {
        setLoading(false);
      }
    })();
  }, [le.address, le.connected, verify]);

  const connectWallet = useCallback(
    async (provider: string) => {
      setLoading(true);
      setError(null);
      wantVerify.current = true;
      try {
        await (le.connect as (p: string) => Promise<void>)(provider);
        // If already connected (address present synchronously), kick verify now.
        if (le.address && wantVerify.current) {
          wantVerify.current = false;
          try {
            await verify(le.address);
          } finally {
            setLoading(false);
          }
        }
      } catch (e) {
        wantVerify.current = false;
        setLoading(false);
        const msg = (e as Error).message || "";
        setError(
          /not installed|no provider|undefined/i.test(msg)
            ? "That wallet isn't installed."
            : msg || "Connection failed.",
        );
      }
    },
    [le, verify],
  );

  const disconnect = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    try {
      le.disconnect();
    } catch {
      /* ignore */
    }
    setHolder(false);
    setSessionAddr(null);
    setError(null);
  }, [le]);

  return (
    <Ctx.Provider
      value={{
        connected: !!sessionAddr,
        holder,
        address: sessionAddr,
        loading,
        error,
        connectWallet,
        disconnect,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
