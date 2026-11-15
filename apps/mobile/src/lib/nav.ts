/** Tiny navigation bus so a notification tap can open a screen. */
export type NavTarget = "payments";

type Listener = (target: NavTarget) => void;
const listeners = new Set<Listener>();

export function onNavigate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function goTo(target: NavTarget): void {
  listeners.forEach((listener) => {
    try {
      listener(target);
    } catch {}
  });
}
