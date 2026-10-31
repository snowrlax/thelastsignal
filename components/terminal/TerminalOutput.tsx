"use client";

import { useEffect, useRef, type ReactNode } from "react";
import MessageBlock from "@/components/terminal/MessageBlock";
import { useGameStore } from "@/hooks/useGameStore";

const STICK_THRESHOLD_PX = 60;

/** Scrollback: output lines and message windows, with the prompt at the bottom. */
export default function TerminalOutput({ children }: { readonly children: ReactNode }) {
  const items = useGameStore((state) => state.items);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const observer = new ResizeObserver(() => {
      if (stick.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) {
      stick.current = true;
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [items.length]);

  const onScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    stick.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_THRESHOLD_PX;
  };

  return (
    <div className="term-output" ref={scrollRef} role="log" aria-label="Terminal output" onScroll={onScroll} data-testid="output">
      <div ref={contentRef}>
        {items.map((item) =>
          item.type === "message" ? (
            <MessageBlock key={item.id} item={item} />
          ) : (
            <div key={item.id} className={`term-line ln-${item.kind}`}>
              {item.text}
            </div>
          ),
        )}
        {children}
      </div>
    </div>
  );
}
