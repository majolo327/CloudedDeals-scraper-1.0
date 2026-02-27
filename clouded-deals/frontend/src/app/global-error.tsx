"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0b14", padding: "1rem" }}>
          <div style={{ textAlign: "center", maxWidth: "28rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#f87171", marginBottom: "1rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "2rem" }}>
              An unexpected error occurred. Try refreshing the page.
            </p>
            <button
              onClick={reset}
              style={{ padding: "0.75rem 1.5rem", background: "#a855f7", color: "white", fontWeight: 600, borderRadius: "0.75rem", border: "none", cursor: "pointer" }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
