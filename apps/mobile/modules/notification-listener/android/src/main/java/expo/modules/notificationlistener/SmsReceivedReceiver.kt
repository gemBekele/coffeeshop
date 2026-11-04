package expo.modules.notificationlistener

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/**
 * Receives SMS the moment Android delivers them and forwards them to JS.
 * The polling reader stays as a fallback, but this removes the 2s delay.
 */
class SmsReceivedReceiver(
  private val onSms: (Map<String, Any?>) -> Unit,
) : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

    // Rebuild multipart messages (same sender + timestamp) into one body.
    val grouped = LinkedHashMap<String, StringBuilder>()
    val meta = LinkedHashMap<String, Pair<String, Long>>()
    for (message in messages) {
      val address = message.originatingAddress ?: ""
      val timestamp = message.timestampMillis
      val key = "$address|$timestamp"
      grouped.getOrPut(key) { StringBuilder() }
        .append(message.messageBody ?: "")
      meta[key] = address to timestamp
    }

    for ((key, body) in grouped) {
      val (address, timestamp) = meta[key] ?: continue
      onSms(
        mapOf(
          "id" to "live-$address-$timestamp",
          "address" to address,
          "body" to body.toString(),
          "date" to timestamp,
        ),
      )
    }
  }
}
