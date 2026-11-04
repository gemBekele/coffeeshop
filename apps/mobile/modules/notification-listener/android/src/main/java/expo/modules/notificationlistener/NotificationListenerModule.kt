package expo.modules.notificationlistener

import android.Manifest
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.provider.Settings
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
  private var smsReceiver: BroadcastReceiver? = null

  /** Register lazily: SMS permission may only be granted after app start. */
  private fun registerSmsReceiver() {
    if (smsReceiver != null) return
    val context = appContext.reactContext ?: return
    if (context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    val receiver = SmsReceivedReceiver { payload ->
      sendEvent("onSms", payload)
    }
    try {
      ContextCompat.registerReceiver(
        context,
        receiver,
        IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION),
        ContextCompat.RECEIVER_EXPORTED,
      )
      smsReceiver = receiver
    } catch (_: Throwable) {
      // Polling still covers capture if registration is unavailable.
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NotificationListener")

    Events("onNotification", "onListenerStateChanged", "onSms")

    OnCreate {
      registerSmsReceiver()
    }

    OnDestroy {
      val receiver = smsReceiver ?: return@OnDestroy
      try {
        appContext.reactContext?.unregisterReceiver(receiver)
      } catch (_: Throwable) {
        // Already unregistered.
      }
      smsReceiver = null
    }

    OnStartObserving {
      registerSmsReceiver()
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

    Function("ensureSmsReceiver") {
      registerSmsReceiver()
      smsReceiver != null
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
