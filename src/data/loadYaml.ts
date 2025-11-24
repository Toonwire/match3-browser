import { parse } from "yaml";

export async function loadYaml<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch YAML: ${path}`);
  const text = await res.text();
  return parse(text) as T;
}
