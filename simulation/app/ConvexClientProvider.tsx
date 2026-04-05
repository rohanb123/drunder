"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL?.trim() ?? "";
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = getConvexUrl();
  if (!url) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-zinc-400">
        <p className="mb-2">Missing <code className="text-cyan-400">NEXT_PUBLIC_CONVEX_URL</code>.</p>
        <p>
          Run <code className="text-zinc-300">npx convex dev</code> and copy the deployment URL into{" "}
          <code className="text-zinc-300">.env.local</code>.
        </p>
      </div>
    );
  }

  const client = new ConvexReactClient(url);
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
