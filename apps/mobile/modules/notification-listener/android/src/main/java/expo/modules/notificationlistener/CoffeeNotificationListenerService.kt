package expo.modules.notificationlistener

import android.app.Notification
import android.content.pm.PackageManager
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class CoffeeNotificationListenerService : NotificationListenerService() {

  override fun onListenerConnected() {
    super.onListenerConnected()
    instance = this
    NotificationBridge.onServiceConnected()
    seedActiveNotifications()
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    if (instance === this) instance = null
    NotificationBridge.onServiceDisconnected()
  }

  fun seedActiveNotifications() {
    try {
      val active = activeNotifications ?: return
      for (sbn in active) {
        onNotificationPosted(sbn)
      }
    } catch (_: Throwable) {
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    if (sbn.packageName == packageName) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()

    val mainText = if (bigText.isNotEmpty()) bigText else text
    val isSms = isSmsPackage(sbn.packageName) ||
      sbn.notification?.category == Notification.CATEGORY_MESSAGE

    val body = if (isSms && mainText.isNotEmpty()) {
      mainText
    } else {
      buildString {
        if (title.isNotEmpty()) append(title)
        if (mainText.isNotEmpty()) {
          if (isNotEmpty()) append('\n')
          append(mainText)
        }
        if (subText.isNotEmpty()) {
          if (isNotEmpty()) append('\n')
          append(subText)
        }
      }
    }

    if (body.isBlank()) return

    NotificationBridge.onNotification(
      NotificationPayload(
        packageName = sbn.packageName,
        appLabel = labelFor(sbn.packageName),
        title = title,
        text = mainText.ifEmpty { text },
        body = body,
        postedAt = sbn.postTime,
        id = sbn.id,
        tag = sbn.tag,
        kind = if (isSms) "SMS" else "NOTIFICATION",
      ),
    )
  }

  private fun isSmsPackage(pkg: String): Boolean {
    if (pkg in SMS_PACKAGES) return true
    val defaultSms = Telephony.Sms.getDefaultSmsPackage(this)
    return defaultSms != null && defaultSms == pkg
  }

  private fun labelFor(pkg: String): String? =
    try {
      val info = packageManager.getApplicationInfo(pkg, 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (e: PackageManager.NameNotFoundException) {
      null
    }

  companion object {
    @Volatile
    private var instance: CoffeeNotificationListenerService? = null

    private val SMS_PACKAGES = setOf(
      "com.samsung.android.messaging",
      "com.google.android.apps.messaging",
      "com.android.messaging",
      "com.android.mms",
      "com.textra",
      "com.android.mms.service",
    )

    fun isConnected(): Boolean = instance != null

    fun harvestActive() {
      instance?.seedActiveNotifications()
    }
  }
}
