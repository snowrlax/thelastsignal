export interface ParsedCommand {
  readonly name: string;
  readonly args: readonly string[];
}

export type ParseResult =
  | { readonly ok: true; readonly command: ParsedCommand }
  | { readonly ok: false; readonly reason: "unsupported_operator" | "unterminated_quote" };

const OPERATORS = new Set(["|", ">", "<", ";", "&", "`", "$("]);

/** Splits a command line into tokens, honouring single and double quotes. */
export function parseCommandLine(input: string): ParseResult {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let hasToken = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      hasToken = true;
      continue;
    }
    if (OPERATORS.has(char) || (char === "$" && input[index + 1] === "(")) {
      return { ok: false, reason: "unsupported_operator" };
    }
    if (/\s/.test(char)) {
      if (hasToken) tokens.push(current);
      current = "";
      hasToken = false;
      continue;
    }
    current += char;
    hasToken = true;
  }
  if (quote) return { ok: false, reason: "unterminated_quote" };
  if (hasToken) tokens.push(current);
  const [name = "", ...args] = tokens;
  return { ok: true, command: { name: name.toLowerCase(), args } };
}

/** Separates short flags (-la, -r) from positional arguments. "--" ends flag parsing. */
export function splitFlags(args: readonly string[]): { flags: Set<string>; positional: string[] } {
  const flags = new Set<string>();
  const positional: string[] = [];
  let flagsDone = false;
  for (const arg of args) {
    if (!flagsDone && arg === "--") {
      flagsDone = true;
      continue;
    }
    if (!flagsDone && arg.startsWith("--") && arg.length > 2) {
      flags.add(arg.slice(2));
      continue;
    }
    if (!flagsDone && arg.startsWith("-") && arg.length > 1 && !/^-\d+$/.test(arg)) {
      for (const letter of arg.slice(1)) flags.add(letter);
      continue;
    }
    positional.push(arg);
  }
  return { flags, positional };
}

/** Levenshtein distance, used to suggest the command the player probably meant. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      table[i][j] = Math.min(table[i - 1][j] + 1, table[i][j - 1] + 1, table[i - 1][j - 1] + cost);
    }
  }
  return table[a.length][b.length];
}
