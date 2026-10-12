import type { Api, DeviceConfig, DeviceTemplate } from "../api/client";
import { readSms, requestSmsPermission, isSmsModuleAvailable } from "./reader";
import { matchTemplates } from "../capture/matcher";

export interface CaptureEvent {
  at: string;
  message: string;
  level: "info" | "success" | "error";
}

type Listener = (event: CaptureEvent) => void;

const POLL_MS = 8000;

/**
 * Foreground SMS capture for the owner phone.
 *
 * Polls the inbox, matches each new SMS against the shop's active templates
 * (compiled locally with the shared engine), and posts matches to the API for
 * server-side re-validation. Background capture while the app is closed
 * requires a custom dev client with a native Android BroadcastReceiver
 * (documented in the README).
 */
class SmsCapture {
  private timer: ReturnType<typeof setInterval> | null = null;
  private processed = new Set<string>();
  private templates: DeviceTemplate[] = [];
  private listeners = new Set<Listener>();
  private running = false;
  private api: Api | null = null;

  isRunning(): boolean {
    return this.running;
  }

  smsModuleAvailable(): boolean {
    return isSmsModuleAvailable();
  }

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(level: CaptureEvent["level"], message: string): void {
    const event: CaptureEvent = { at: new Date().toISOString(), message, level };
    this.listeners.forEach((l) => l(event));
  }

  async loadTemplates(deviceKey: string, api: Api): Promise<DeviceConfig> {
    const config = await api.deviceConfig(deviceKey);
    this.templates = config.templates;
    this.emit("info", `Loaded ${this.templates.length} active template(s)`);
    return config;
  }

  async start(deviceKey: string, api: Api): Promise<void> {
    if (this.running) return;
    this.api = api;

    const granted = await requestSmsPermission();
    if (!granted) {
      this.emit("error", "SMS permission not granted");
      return;
    }
    if (!this.smsModuleAvailable()) {
      this.emit(
        "error",
        "Native SMS module unavailable — build a dev client (Expo Go cannot read SMS)",
      );
      return;
    }

    await this.loadTemplates(deviceKey, api);

    this.running = true;
    this.emit("info", "SMS capture started");
    this.timer = setInterval(() => {
      void this.poll();
    }, POLL_MS);
    void this.poll();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    this.emit("info", "SMS capture stopped");
  }

  private async poll(): Promise<void> {
    if (!this.running || !this.api) return;
    let messages;
    try {
      messages = await readSms(20);
    } catch {
      return;
    }

    for (const sms of messages) {
      if (this.processed.has(sms.id)) continue;
      this.processed.add(sms.id);

      const parsed = matchTemplates(this.templates, sms.body);
      if (!parsed) continue;

      if (parsed.direction === "DEBIT") continue;

      try {
        const result = await this.api.ingestSms({
          txnId: parsed.txnId ?? `SMS-${sms.id}`,
          amount: parsed.amount,
          sender: parsed.sender,
          senderPhone: parsed.senderPhone,
          bank: parsed.provider,
          direction: parsed.direction,
          rawSms: sms.body,
          templateId: parsed.templateId,
          source: "SMS",
          receivedAt: new Date(sms.date).toISOString(),
        });
        if (result.unmatched) {
          this.emit("info", `SMS needs a template (added to inbox)`);
        } else if (result.duplicate) {
          this.emit("info", `Duplicate payment ${parsed.txnId ?? sms.id}`);
        } else if (result.matched) {
          this.emit("success", `Payment ${parsed.amount} matched (${result.matchType})`);
        } else {
          this.emit("info", `Payment ${parsed.amount} recorded (unmatched)`);
        }
      } catch (err) {
        this.emit("error", `Ingest failed: ${(err as Error).message}`);
      }
    }

    if (this.processed.size > 500) {
      this.processed = new Set([...this.processed].slice(-200));
    }
  }
}

export const smsCapture = new SmsCapture();
