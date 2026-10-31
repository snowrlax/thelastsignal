"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { complete } from "@/game/completion";
import { promptFor } from "@/game/engine";
import { dim } from "@/game/text";
import { useGameStore } from "@/hooks/useGameStore";
import { sound } from "@/libs/audio";

export interface PromptHandle {
  focus(): void;
  prefill(text: string): void;
}

interface PromptLineProps {
  readonly disabled: boolean;
  readonly takenOver: boolean;
  /** The session is over: the prompt goes quiet. */
  readonly ended: boolean;
}

/** The command prompt: history (up/down), tab completion, block cursor. */
const PromptLine = forwardRef<PromptHandle, PromptLineProps>(function PromptLine({ disabled, takenOver, ended }, ref) {
  const game = useGameStore((state) => state.game);
  const submit = useGameStore((state) => state.submit);
  const keystroke = useGameStore((state) => state.keystroke);
  const enqueueLines = useGameStore((state) => state.enqueueLines);
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const historyIndex = useRef<number | null>(null);
  const draft = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  const setText = (text: string) => {
    setValue(text);
    setCaret(text.length);
    window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(text.length, text.length));
  };

  // Blocked prompts stay focused (readOnly, not disabled) so typing resumes the moment they unlock.
  useEffect(() => {
    if (!disabled) inputRef.current?.focus({ preventScroll: true });
  }, [disabled]);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus({ preventScroll: true }),
    prefill: (text: string) => {
      setText(text);
      inputRef.current?.focus({ preventScroll: true });
    },
  }));

  if (!game) return null;
  const history = game.history;

  const recall = (direction: -1 | 1) => {
    if (history.length === 0) return;
    if (historyIndex.current === null) {
      if (direction === 1) return;
      draft.current = value;
      historyIndex.current = history.length;
    }
    const next = historyIndex.current + direction;
    if (next >= history.length) {
      historyIndex.current = null;
      setText(draft.current);
      return;
    }
    historyIndex.current = Math.max(0, next);
    setText(history[historyIndex.current]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      if (event.key === "Enter" || event.key === "Tab") event.preventDefault();
      return;
    }
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        submit(value);
        historyIndex.current = null;
        setText("");
        return;
      case "ArrowUp":
        event.preventDefault();
        recall(-1);
        return;
      case "ArrowDown":
        event.preventDefault();
        recall(1);
        return;
      case "Tab": {
        event.preventDefault();
        const result = complete(game, value);
        setText(result.value);
        if (result.options.length > 0) enqueueLines([dim(result.options.join("   "))]);
        return;
      }
      default:
        break;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      enqueueLines([dim(`${promptFor(game)}${value}^C`)]);
      setText("");
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      submit("clear");
      return;
    }
    if (event.key.length === 1 || event.key === "Backspace") sound().play("key");
    keystroke();
  };

  const prompt = takenOver ? "ivega@ofrenda-01:~$ " : promptFor(game);
  const before = value.slice(0, caret);
  const under = value[caret] ?? " ";
  const after = value.slice(caret + 1);

  return (
    <div className="prompt-row term-line" onClick={() => inputRef.current?.focus()} data-testid="prompt">
      {disabled ? (
        <span style={{ color: "var(--amber-dim)" }}>{ended ? "" : "▶ playing ... (the containment window is held)"}</span>
      ) : (
        <>
          <span>{prompt}</span>
          <span>{before}</span>
          <span className="cursor-block">{under}</span>
          <span>{after}</span>
        </>
      )}
      <input
        ref={inputRef}
        className="prompt-input"
        aria-label="Terminal command"
        value={value}
        readOnly={disabled}
        aria-disabled={disabled}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-testid="command-input"
        onChange={(event) => {
          if (disabled) return;
          setValue(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? value.length)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
});

export default PromptLine;
