import { HOME } from "@/game/constants";

/** Turns any user-typed path into a normalized absolute path (no symlink resolution). */
export function normalizePath(cwd: string, input: string): string {
  const raw = input.trim();
  let base: string;
  let rest: string;

  if (raw === "" || raw === "~") return HOME;
  if (raw.startsWith("~/")) {
    base = HOME;
    rest = raw.slice(2);
  } else if (raw.startsWith("/")) {
    base = "/";
    rest = raw.slice(1);
  } else {
    base = cwd;
    rest = raw;
  }

  const parts = base.split("/").filter(Boolean);
  for (const segment of rest.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return "/" + parts.join("/");
}

export function joinPath(parent: string, name: string): string {
  return parent === "/" ? `/${name}` : `${parent}/${name}`;
}

export function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length === 0 ? "/" : parts[parts.length - 1];
}

/** Display form of a path for the prompt: /home/operator becomes ~ */
export function displayPath(path: string): string {
  if (path === HOME) return "~";
  if (path.startsWith(HOME + "/")) return "~" + path.slice(HOME.length);
  return path;
}

/** Converts a shell glob (*, ?) into an anchored, case-sensitive RegExp. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}
