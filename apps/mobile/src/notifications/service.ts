import { NotificationListener, type PostedNotification } from "../../modules/notification-listener";
import type { Api, DeviceTemplate } from "../api/client";
import { matchTemplates } from "../capture/matcher";

export interface CaptureEvent {
  at: string;
  message: string;
  level: "info" | "success" | "error";
}

type Listener = (event: CaptureEvent) => void;

/**
 * Captures bank / mobile-money notifications via the native
 * NotificationListenerService and ingests matches. Event-driven (no polling):
 * the native service pushes notifications, including any buffered before JS
 * attached a listener.
 */
class NotificationCapture {
  private templates: DeviceTemplate[] = [];
  private listeners = new Set<Listener>();
  private running = false;
  private api: Api | null = null;
  private subscriptions: Array<{ remove: () => void } | null> = [];
  private processed = new Set<string>();

  isRunning(): boolean {
    return this.running;
  }

  isAvailable(): boolean {
    return NotificationListener.isAvailable();
  }

  isPermissionGranted(): boolean {
    return NotificationListener.isPermissionGranted();
  }

  openPermissionSettings(): void {
    NotificationListener.openPermissionSettings();
  }

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(level: CaptureEvent["level"], message: string): void {
    const event: CaptureEvent = { at: new Date().toISOString(), message, level };
    this.listeners.forEach((l) => l(event));
  }

  async loadTemplates(deviceKey: string, api: Api): Promise<void> {
    const config = await api.deviceConfig(deviceKey);
    this.templates = config.templates;
    this.emit("info", `Loaded ${this.templates.length} active template(s)`);
  }

  async start(deviceKey: string, api: Api): Promise<void> {
    if (this.running) return;
    if (!NotificationListener.isAvailable()) {
      this.emit(
        "error",
        "Native notification listener unavailable — build a custom dev client",
      );
      return;
    }
    if (!NotificationListener.isPermissionGranted()) {
      this.emit("error", "Notification access not granted");
      NotificationListener.openPermissionSettings();
      return;
    }

    this.api = api;
    await this.loadTemplates(deviceKey, api);

    for (const buffered of NotificationListener.getBuffered()) {
      await this.handle(buffered);
    }

    const sub = NotificationListener.addNotificationListener((n) => {
      void this.handle(n);
    });
    const stateSub = NotificationListener.addStateListener((state) => {
      this.emit("info", `Listener ${state.connected ? "connected" : "disconnected"}`);
    });
    this.subscriptions = [sub, stateSub];

    this.running = true;
    this.emit("info", "Notification capture started");
  }

  stop(): void {
    this.subscriptions.forEach((s) => s?.remove());
    this.subscriptions = [];
    this.running = false;
    this.emit("info", "Notification capture stopped");
  }

  private async handle(notification: PostedNotification): Promise<void> {
    const key = `${notification.packageName}:${notification.id}:${notification.postedAt}`;
    if (this.processed.has(key)) return;
    this.processed.add(key);
    if (this.processed.size > 500) {
      this.processed = new Set([...this.processed].slice(-200));
    }

    const text = notification.body || notification.text || notification.title;
    if (!text) return;

    const parsed = matchTemplates(this.templates, text);
    if (!parsed || parsed.direction === "DEBIT") return;

    try {
      const result = await this.api!.ingestSms({
        txnId: parsed.txnId ?? `NTF-${notification.id}-${notification.postedAt}`,
        amount: parsed.amount,
        sender: parsed.sender,
        senderPhone: parsed.senderPhone,
        bank: parsed.provider,
        direction: parsed.direction,
        rawSms: text,
        templateId: parsed.templateId,
        source: "NOTIFICATION",
        receivedAt: new Date(notification.postedAt).toISOString(),
      });
      if (result.matched) {
        this.emit(
          "success",
          `${notification.appLabel ?? notification.packageName}: ${parsed.amount} matched (${result.matchType})`,
        );
      } else if (result.duplicate) {
        this.emit("info", `Duplicate payment ${parsed.txnId ?? notification.id}`);
      } else if (result.unmatched) {
        this.emit("info", "Notification needs a template (added to inbox)");
      } else {
        this.emit("info", `Payment ${parsed.amount} recorded (unmatched)`);
      }
    } catch (err) {
      this.emit("error", `Ingest failed: ${(err as Error).message}`);
    }
  }
}

export const notificationCapture = new NotificationCapture();
