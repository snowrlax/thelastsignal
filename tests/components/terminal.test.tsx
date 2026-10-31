// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessageBlock from "@/components/terminal/MessageBlock";
import PromptLine from "@/components/terminal/PromptLine";
import StatusBar from "@/components/terminal/StatusBar";
import { setPause, tick } from "@/game/engine";
import { useGameStore } from "@/hooks/useGameStore";
import { flushQueue, freshRun, printedText } from "@/tests/helpers/store";

beforeEach(() => {
  freshRun();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PromptLine", () => {
  const input = () => screen.getByTestId("command-input") as HTMLInputElement;

  it("submits commands and recalls them with the arrow keys", () => {
    render(<PromptLine disabled={false} takenOver={false} ended={false} />);
    fireEvent.change(input(), { target: { value: "pwd" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    act(() => flushQueue());
    expect(printedText()).toContain("/home/operator");
    expect(input().value).toBe("");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().value).toBe("pwd");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().value).toBe("");
  });

  it("completes with Tab and lists ambiguous options", () => {
    render(<PromptLine disabled={false} takenOver={false} ended={false} />);
    fireEvent.change(input(), { target: { value: "cat REA" } });
    fireEvent.keyDown(input(), { key: "Tab" });
    expect(input().value).toBe("cat README.txt ");
    fireEvent.change(input(), { target: { value: "c" } });
    fireEvent.keyDown(input(), { key: "Tab" });
    act(() => flushQueue());
    expect(printedText()).toContain("cd");
  });

  it("supports Ctrl+C and Ctrl+L", () => {
    render(<PromptLine disabled={false} takenOver={false} ended={false} />);
    fireEvent.change(input(), { target: { value: "half typed" } });
    fireEvent.keyDown(input(), { key: "c", ctrlKey: true });
    act(() => flushQueue());
    expect(printedText()).toContain("half typed^C");
    fireEvent.keyDown(input(), { key: "l", ctrlKey: true });
    act(() => flushQueue());
    expect(useGameStore.getState().items).toHaveLength(0);
  });

  it("ignores typing while a recording plays and shows the takeover prompt", () => {
    const { rerender } = render(<PromptLine disabled takenOver={false} ended={false} />);
    expect(screen.getByTestId("prompt").textContent).toContain("playing");
    fireEvent.change(input(), { target: { value: "ls" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(useGameStore.getState().queue).toHaveLength(0);
    rerender(<PromptLine disabled={false} takenOver ended={false} />);
    expect(screen.getByTestId("prompt").textContent).toContain("ivega@ofrenda-01");
  });
});

describe("MessageBlock", () => {
  it("shows a receiving state, then types the text out", () => {
    vi.useFakeTimers();
    const item = { type: "message" as const, id: 1, key: "k", speaker: "vega" as const, text: null, source: null, clock: "23:52:00" };
    const { rerender } = render(<MessageBlock item={item} />);
    expect(screen.getByTestId("msg-vega").textContent).toContain("incoming signal");
    rerender(<MessageBlock item={{ ...item, text: "Hola.", source: "ai" }} />);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("msg-vega").textContent).toContain("Hola.");
  });

  it("labels HOLLOW's notices", () => {
    render(<MessageBlock item={{ type: "message", id: 2, key: "h", speaker: "hollow", text: null, source: null, clock: "23:52:00" }} />);
    expect(screen.getByTestId("msg-hollow").textContent).toContain("HOLLOW · pid 218");
  });
});

describe("StatusBar", () => {
  const game = () => useGameStore.getState().game!;

  it("shows the containment window, holds, grace and takeover", () => {
    const { rerender } = render(<StatusBar game={game()} unread={false} takenOver={false} />);
    expect(screen.getByTestId("status-bar").textContent).toContain("--:--");
    const running = tick(game(), 3_000).state;
    rerender(<StatusBar game={running} unread takenOver={false} />);
    expect(screen.getByTestId("timer").textContent).toContain("CONTAINMENT WINDOW 03:00");
    rerender(<StatusBar game={setPause(running, "help", true)} unread={false} takenOver={false} />);
    expect(screen.getByTestId("status-bar").textContent).toContain("MANUAL OPEN");
    rerender(<StatusBar game={setPause(running, "recording", true)} unread={false} takenOver={false} />);
    expect(screen.getByTestId("status-bar").textContent).toContain("RECORDING");
    const grace = { ...running, timer: { ...running.timer, grace: { remainingMs: 12_000, totalMs: 30_000 } } };
    rerender(<StatusBar game={grace} unread={false} takenOver={false} />);
    expect(screen.getByTestId("timer").textContent).toContain("FINAL GRACE 00:12");
    rerender(<StatusBar game={running} unread={false} takenOver />);
    expect(screen.getByTestId("status-bar").textContent).toContain("CONTROL LOST");
  });
});
