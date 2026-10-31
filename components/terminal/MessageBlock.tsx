"use client";

import { useEffect, useState } from "react";
import type { MessageItem } from "@/hooks/useGameStore";

const TYPE_MS = 26;

function useTypewriter(text: string | null): string {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!text) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = window.setTimeout(() => setCount(text.length), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(() => {
      setCount((value) => {
        if (value >= text.length) {
          window.clearInterval(id);
          return value;
        }
        return value + 1;
      });
    }, TYPE_MS);
    return () => window.clearInterval(id);
  }, [text]);
  return text ? text.slice(0, count) : "";
}

/** An incoming-message window embedded in the terminal flow. */
export default function MessageBlock({ item }: { readonly item: MessageItem }) {
  const typed = useTypewriter(item.text);
  const vega = item.speaker === "vega";
  return (
    <section className={`msg ${vega ? "msg-vega" : "msg-hollow"}`} data-testid={`msg-${item.speaker}`} aria-live="polite">
      <div className="msg-head">
        <span>{vega ? "✉ M_VEGA · pts/404" : "▲ HOLLOW · pid 218"}</span>
        <span>{item.clock}</span>
      </div>
      <div className="msg-body">
        {item.text === null ? (
          <span className="receiving">{vega ? "incoming signal" : "integrity notice"}</span>
        ) : (
          <>
            {typed}
            {typed.length < item.text.length && <span className="cursor-block"> </span>}
          </>
        )}
      </div>
    </section>
  );
}
