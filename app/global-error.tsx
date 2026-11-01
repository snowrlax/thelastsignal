"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  readonly error: Error & { digest?: string };
}

/** Last-resort screen when the root layout itself fails; reports the error to Sentry. */
export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#050403", color: "#ffb347", fontFamily: "monospace" }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <p>SIGNAL LOST.</p>
          <p>The terminal failed to start. Reload the page to try again.</p>
        </main>
      </body>
    </html>
  );
}
