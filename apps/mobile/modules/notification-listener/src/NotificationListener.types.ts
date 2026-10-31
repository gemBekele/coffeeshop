export type NotificationKind = "SMS" | "NOTIFICATION";

export interface PostedNotification {
  /** Android package that posted the notification (e.g. "et.telebirr"). */
  packageName: string;
  /** Human-readable app label when resolvable. */
  appLabel: string | null;
  title: string;
  text: string;
  /** Title + big text/text + subtext combined, newline separated. */
  body: string;
  /** Epoch millis when the notification was posted. */
  postedAt: number;
  id: number;
  tag: string | null;
  /** "SMS" when posted by a messaging app, otherwise "NOTIFICATION". */
  kind: NotificationKind;
}

export interface InboxSms {
  id: string;
  address: string;
  body: string;
  date: number;
}

export interface ListenerState {
  connected: boolean;
}
