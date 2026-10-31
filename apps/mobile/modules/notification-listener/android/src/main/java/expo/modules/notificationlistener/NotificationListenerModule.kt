package expo.modules.notificationlistener

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import android.provider.Telephony
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
      CoffeeNotificationListenerService.harvestActive()
      NotificationBridge.drain().map { it.toMap() }
    }

    Function("hasSmsPermission") {
      val context = appContext.reactContext ?: return@Function false
      context.checkSelfPermission(Manifest.permission.READ_SMS) ==
        PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("readSmsInbox") { maxCount: Int ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any?>>()
      if (context.checkSelfPermission(Manifest.permission.READ_SMS) !=
        PackageManager.PERMISSION_GRANTED
      ) {
        return@AsyncFunction emptyList<Map<String, Any?>>()
      }

      val limit = if (maxCount > 0) maxCount else 50
      val out = ArrayList<Map<String, Any?>>()
      val projection = arrayOf(
        Telephony.Sms._ID,
        Telephony.Sms.ADDRESS,
        Telephony.Sms.BODY,
        Telephony.Sms.DATE,
      )

      try {
        context.contentResolver.query(
          Telephony.Sms.Inbox.CONTENT_URI,
          projection,
          null,
          null,
          "${Telephony.Sms.DATE} DESC",
        )?.use { cursor ->
          val idIdx = cursor.getColumnIndex(Telephony.Sms._ID)
          val addrIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
          val bodyIdx = cursor.getColumnIndex(Telephony.Sms.BODY)
          val dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE)
          while (cursor.moveToNext() && out.size < limit) {
            out.add(
              mapOf(
                "id" to (if (idIdx >= 0) cursor.getString(idIdx) else null),
                "address" to (if (addrIdx >= 0) cursor.getString(addrIdx) else ""),
                "body" to (if (bodyIdx >= 0) cursor.getString(bodyIdx) else ""),
                "date" to (if (dateIdx >= 0) cursor.getLong(dateIdx) else 0L),
              ),
            )
          }
        }
      } catch (e: SecurityException) {
        return@AsyncFunction emptyList<Map<String, Any?>>()
      }

      out
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
