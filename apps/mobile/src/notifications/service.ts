import { NotificationListener, type PostedNotification } from "../../modules/notification-listener";
import type { Api, DeviceTemplate } from "../api/client";
import { matchTemplates } from "../capture/matcher";

export interface CaptureEvent {
  at: string;
  message: string;
  level: "info" | "success" | "error";
}

type Listener = (event: CaptureEvent) => void;

class NotificationCapture {
  private templates: DeviceTemplate[] = [];
  private listeners = new Set<Listener>();
  private capturedListeners = new Set<(items: PostedNotification[]) => void>();
  private running = false;
  private watching = false;
  private api: Api | null = null;
  private subscriptions: Array<{ remove: () => void } | null> = [];
  private processed = new Set<string>();
  private capturedSms: PostedNotification[] = [];

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

  onCapturedSms(listener: (items: PostedNotification[]) => void): () => void {
    this.capturedListeners.add(listener);
    listener(this.capturedSms);
    return () => this.capturedListeners.delete(listener);
  }

  getCapturedSms(): PostedNotification[] {
    this.drainBuffered();
    return this.capturedSms;
  }

  private emit(level: CaptureEvent["level"], message: string): void {
    const event: CaptureEvent = { at: new Date().toISOString(), message, level };
    this.listeners.forEach((l) => l(event));
  }

  private emitCaptured(): void {
    this.capturedListeners.forEach((l) => l(this.capturedSms));
  }

  private drainBuffered(): void {
    if (!NotificationListener.isAvailable()) return;
    const buffered = NotificationListener.getBuffered();
    for (const item of buffered) {
      void this.receive(item);
    }
  }

  private ensureListener(): void {
    if (this.watching || !NotificationListener.isAvailable()) return;
    const sub = NotificationListener.addNotificationListener((n) => {
      void this.receive(n);
    });
    this.subscriptions.push(sub);
    this.watching = true;
  }

  async loadTemplates(deviceKey: string, api: Api): Promise<void> {
    this.api = api;
    const config = await api.deviceConfig(deviceKey);
    this.templates = config.templates;
    this.processed.clear();
    this.emit("info", `Loaded ${this.templates.length} active template(s)`);
    if (this.running) {
      for (const existing of this.capturedSms) {
        await this.handle(existing);
      }
    }
  }

  watch(): void {
    if (!NotificationListener.isAvailable()) return;
    this.ensureListener();
    this.drainBuffered();
  }

  async start(deviceKey: string, api: Api): Promise<void> {
    if (this.running) return;
    if (!NotificationListener.isAvailable()) return;
    if (!NotificationListener.isPermissionGranted()) return;

    this.api = api;
    await this.loadTemplates(deviceKey, api);

    this.ensureListener();
    this.drainBuffered();

    const stateSub = NotificationListener.addStateListener((state) => {
      this.emit("info", `Listener ${state.connected ? "connected" : "disconnected"}`);
    });
    this.subscriptions.push(stateSub);

    this.running = true;
    this.emit("info", "Notification capture started");

    for (const existing of this.capturedSms) {
      await this.handle(existing);
    }
  }

  stop(): void {
    this.subscriptions.forEach((s) => s?.remove());
    this.subscriptions = [];
    this.running = false;
    this.watching = false;
    this.emit("info", "Notification capture stopped");
  }

  private async receive(notification: PostedNotification): Promise<void> {
    if (notification.packageName === "com.coffeeshop.app") return;
    const key = `${notification.packageName}:${notification.id}:${notification.postedAt}`;
    if (!this.capturedSms.some((n) => `${n.packageName}:${n.id}:${n.postedAt}` === key)) {
      this.capturedSms = [notification, ...this.capturedSms].slice(0, 100);
      this.emitCaptured();
    }

    if (!this.running || !this.api) return;
    await this.handle(notification);
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
