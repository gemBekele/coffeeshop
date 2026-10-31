package expo.modules.ocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * On-device OCR using Google ML Kit text recognition (Latin script). Used to
 * read a payer's payment-confirmation screen so the employee can verify it
 * against the SMS the shop received.
 */
class OcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Ocr")

    AsyncFunction("recognizeText") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_OCR", "No react context", null)
        return@AsyncFunction
      }

      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        val image = InputImage.fromFilePath(context, Uri.parse(uri))
        recognizer.process(image)
          .addOnSuccessListener { visionText ->
            val result = mapOf(
              "text" to visionText.text,
              "blocks" to visionText.textBlocks.map { it.text },
            )
            promise.resolve(result)
          }
          .addOnFailureListener { error ->
            promise.reject("ERR_OCR", error.message ?: "Text recognition failed", error)
          }
      } catch (error: Throwable) {
        promise.reject("ERR_OCR", error.message ?: "Could not read image", error)
      }
    }
  }
}
