/** Greedy word wrap measured in "dots". Words longer than a line are split. */
export function wrapText(text: string, measure: (value: string) => number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (measure(word) <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const char of word) {
        if (measure(chunk + char) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      current = chunk;
    }
    lines.push(current);
  }
  return lines;
}

/** Offset in `text` at which each wrapped line starts (wrap points drop their space). */
export function lineStarts(text: string, lines: readonly string[]): number[] {
  const starts: number[] = [];
  let from = 0;
  for (const line of lines) {
    const found = line ? text.indexOf(line, from) : -1;
    const start = found < 0 ? from : found;
    starts.push(start);
    from = start + line.length;
  }
  return starts;
}

export interface CaretCell {
  readonly line: number;
  readonly col: number;
}

/** Where the caret sits once `reveal` characters of the text are showing. */
export function caretCell(lines: readonly string[], starts: readonly number[], reveal: number): CaretCell {
  for (let index = 0; index < lines.length; index += 1) {
    const end = starts[index] + lines[index].length;
    if (reveal > end) continue;
    if (reveal >= starts[index]) return { line: index, col: reveal - starts[index] };
    const previous = Math.max(0, index - 1);
    return { line: previous, col: index > 0 ? lines[previous].length : 0 };
  }
  const last = lines.length - 1;
  return { line: last, col: lines[last].length };
}
