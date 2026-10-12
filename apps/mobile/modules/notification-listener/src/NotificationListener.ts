import {
  EventEmitter,
  NativeModule,
  requireNativeModule,
  type EventSubscription,
} from "expo-modules-core";
import type { ListenerState, PostedNotification } from "./NotificationListener.types";

type NotificationEvents = {
  onNotification: (notification: PostedNotification) => void;
  onListenerStateChanged: (state: ListenerState) => void;
  // Index signature required by Expo's EventsMap constraint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
};

declare class NativeNotificationModule extends NativeModule {
  isPermissionGranted(): boolean;
  isListening(): boolean;
  getBuffered(): PostedNotification[];
  openPermissionSettings(): void;
}

/**
 * The native module is only present in an Android build that includes this
 * local module. On iOS/web/Expo Go it is absent and every method degrades to a
 * safe no-op so the app keeps running.
 */
let native: NativeNotificationModule | null = null;

try {
  native = requireNativeModule<NativeNotificationModule>("NotificationListener");
} catch {
  native = null;
}

const emitter = native ? new EventEmitter<NotificationEvents>(native) : null;

export const NotificationListener = {
  isAvailable(): boolean {
    return native != null;
  },

  isPermissionGranted(): boolean {
    return native ? native.isPermissionGranted() : false;
  },

  isListening(): boolean {
    return native ? native.isListening() : false;
  },

  openPermissionSettings(): void {
    native?.openPermissionSettings();
  },

  getBuffered(): PostedNotification[] {
    return native ? native.getBuffered() : [];
  },

  addNotificationListener(
    listener: (notification: PostedNotification) => void,
  ): EventSubscription | null {
    if (!emitter) return null;
    return emitter.addListener("onNotification", listener);
  },

  addStateListener(
    listener: (state: ListenerState) => void,
  ): EventSubscription | null {
    if (!emitter) return null;
    return emitter.addListener("onListenerStateChanged", listener);
  },
};

export default NotificationListener;
