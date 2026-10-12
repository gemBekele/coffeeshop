package expo.modules.notificationlistener

import android.app.Notification
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Captures notifications from banking / mobile-money apps (Telebirr, CBE Birr,
 * Amole, Awash, ...) and forwards their text to the JS capture service, which
 * matches it against the shop's active SMS templates.
 *
 * Requires the user to grant Notification access in system settings.
 */
class CoffeeNotificationListenerService : NotificationListenerService() {

  override fun onListenerConnected() {
    super.onListenerConnected()
    instance = this
    NotificationBridge.onServiceConnected()
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    if (instance === this) instance = null
    NotificationBridge.onServiceDisconnected()
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()

    val body = buildString {
      if (title.isNotEmpty()) append(title)
      val main = if (bigText.isNotEmpty()) bigText else text
      if (main.isNotEmpty()) {
        if (isNotEmpty()) append('\n')
        append(main)
      }
      if (subText.isNotEmpty()) {
        if (isNotEmpty()) append('\n')
        append(subText)
      }
    }

    if (body.isBlank()) return

    NotificationBridge.onNotification(
      NotificationPayload(
        packageName = sbn.packageName,
        appLabel = labelFor(sbn.packageName),
        title = title,
        text = text,
        body = body,
        postedAt = sbn.postTime,
        id = sbn.id,
        tag = sbn.tag,
      ),
    )
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

    fun isConnected(): Boolean = instance != null
  }
}
