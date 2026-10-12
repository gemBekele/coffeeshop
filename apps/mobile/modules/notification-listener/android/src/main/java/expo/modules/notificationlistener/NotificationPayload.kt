package expo.modules.notificationlistener

/** A normalized payment-relevant notification. */
data class NotificationPayload(
  val packageName: String,
  val appLabel: String?,
  val title: String,
  val text: String,
  val body: String,
  val postedAt: Long,
  val id: Int,
  val tag: String?,
) {
  fun toMap(): Map<String, Any?> =
    mapOf(
      "packageName" to packageName,
      "appLabel" to appLabel,
      "title" to title,
      "text" to text,
      "body" to body,
      "postedAt" to postedAt,
      "id" to id,
      "tag" to tag,
    )
}
