import { parse } from "yaml";

export function resolvePath(path: string): string {
  return (import.meta as any).env.BASE_URL + path.replace(/^\//, "");
}

const yamlCache = new Map<string, Promise<unknown>>();

export async function loadYaml<T = unknown>(path: string): Promise<T> {
  const resolvedPath = resolvePath(path);

  if (yamlCache.has(resolvedPath)) {
    return yamlCache.get(resolvedPath) as Promise<T>;
  }

  const promise = (async () => {
    try {
      const res = await fetch(resolvedPath);
      if (!res.ok) throw new Error(`Failed to fetch YAML: ${path}`);
      const text = await res.text();
      return parse(text) as T;
    } catch (e) {
      yamlCache.delete(resolvedPath); // Remove failed requests from cache
      throw e;
    }
  })();

  yamlCache.set(resolvedPath, promise);
  return promise as Promise<T>;
}
