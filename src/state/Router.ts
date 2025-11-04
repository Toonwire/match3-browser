export type RouteName = 'base' | 'world' | 'battle';

export interface Route {
  name: RouteName;
  params?: Record<string, unknown>;
}

type Listener = (route: Route) => void;

export class Router {
  private current: Route = { name: 'base' };
  private listeners = new Set<Listener>();

  get route(): Route { return this.current; }

  navigate(name: RouteName, params?: Record<string, unknown>) {
    this.current = { name, params };
    this.listeners.forEach((l) => l(this.current));
  }

  onChange(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}


