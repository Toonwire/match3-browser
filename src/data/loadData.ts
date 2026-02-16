import { parse } from "yaml";

export function resolvePath(path: string): string {
  return (import.meta as any).env.BASE_URL + path.replace(/^\//, "");
}

export async function loadYaml<T = unknown>(path: string): Promise<T> {
  const res = await fetch(resolvePath(path));
  if (!res.ok) throw new Error(`Failed to fetch YAML: ${path}`);
  const text = await res.text();
  return parse(text) as T;
}
