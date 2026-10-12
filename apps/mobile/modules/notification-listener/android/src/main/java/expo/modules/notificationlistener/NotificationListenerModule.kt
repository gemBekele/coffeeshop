package expo.modules.notificationlistener

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NotificationListener")

    Events("onNotification", "onListenerStateChanged")

    OnStartObserving {
      NotificationBridge.setNotificationEmitter { payload ->
        sendEvent("onNotification", payload.toMap())
      }
      NotificationBridge.setConnectionEmitter { connected ->
        sendEvent("onListenerStateChanged", mapOf("connected" to connected))
      }
    }

    OnStopObserving {
      NotificationBridge.setNotificationEmitter(null)
      NotificationBridge.setConnectionEmitter(null)
    }

    Function("isPermissionGranted") {
      val context = appContext.reactContext ?: return@Function false
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners",
      ) ?: return@Function false
      val component = ComponentName(context, CoffeeNotificationListenerService::class.java)
      val flattened = component.flattenToString()
      val short = component.flattenToShortString()
      enabled.split(":").any {
        it.equals(flattened, ignoreCase = true) || it.equals(short, ignoreCase = true)
      }
    }

    Function("isListening") {
      CoffeeNotificationListenerService.isConnected()
    }

    Function("getBuffered") {
      NotificationBridge.drain().map { it.toMap() }
    }

    AsyncFunction("openPermissionSettings") {
      val context = appContext.reactContext
      if (context != null) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      true
    }
  }
}
