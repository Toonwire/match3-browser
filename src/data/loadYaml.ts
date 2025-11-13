// Lightweight YAML loader using ESM at runtime to avoid local deps
export async function loadYaml<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch YAML: ${path}`);
  const text = await res.text();
  const { parse } = await import("https://esm.sh/yaml@2.5.1");
  return parse(text) as T;
}
