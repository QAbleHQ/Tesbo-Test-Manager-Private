"use client";

import { useEffect, useRef } from "react";
import type { Betterbugs as BetterbugsInstance } from "@betterbugs/web-sdk";
import { authMe } from "@/lib/api";

const API_KEY = process.env.NEXT_PUBLIC_BETTERBUGS_API_KEY;
const PROJECT_ID = process.env.NEXT_PUBLIC_BETTERBUGS_PROJECT_ID;
const MODE = process.env.NODE_ENV === "production" ? "production" : "development";

// Renders nothing itself — mounts the BetterBugs floating bug-report widget as a side effect.
export default function BetterBugsWidget() {
  const instanceRef = useRef<BetterbugsInstance | null>(null);

  useEffect(() => {
    if (!API_KEY) return;
    let isMounted = true;

    (async () => {
      const [{ default: Betterbugs }, me] = await Promise.all([
        import("@betterbugs/web-sdk"),
        // Email identification only takes effect in production mode.
        MODE === "production" ? authMe() : Promise.resolve(null),
      ]);
      if (!isMounted) return;
      instanceRef.current = new Betterbugs({
        apiKey: API_KEY,
        ...(PROJECT_ID && { projectId: PROJECT_ID }),
        mode: MODE,
        ...(me?.email && { email: me.email }),
      });
    })();

    return () => {
      isMounted = false;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  return null;
}
