package expo.modules.notificationlistener

/**
 * Process-wide bridge between the NotificationListenerService (which has no
 * access to the React context) and the Expo module.
 *
 * Notifications posted before JS attaches a listener are buffered so nothing is
 * lost during app start.
 */
object NotificationBridge {
  private const val MAX_BUFFER = 50

  private val buffer = ArrayDeque<NotificationPayload>()
  private var notificationEmitter: ((NotificationPayload) -> Unit)? = null
  private var connectionEmitter: ((Boolean) -> Unit)? = null
  private var connected = false

  @Synchronized
  fun setNotificationEmitter(emitter: ((NotificationPayload) -> Unit)?) {
    notificationEmitter = emitter
  }

  @Synchronized
  fun setConnectionEmitter(emitter: ((Boolean) -> Unit)?) {
    connectionEmitter = emitter
    emitter?.invoke(connected)
  }

  @Synchronized
  fun onNotification(payload: NotificationPayload) {
    val emitter = notificationEmitter
    if (emitter != null) {
      emitter.invoke(payload)
    } else {
      buffer.addLast(payload)
      while (buffer.size > MAX_BUFFER) buffer.removeFirst()
    }
  }

  @Synchronized
  fun drain(): List<NotificationPayload> {
    val items = buffer.toList()
    buffer.clear()
    return items
  }

  @Synchronized
  fun onServiceConnected() {
    connected = true
    connectionEmitter?.invoke(true)
  }

  @Synchronized
  fun onServiceDisconnected() {
    connected = false
    connectionEmitter?.invoke(false)
  }

  @Synchronized
  fun isConnected(): Boolean = connected
}
