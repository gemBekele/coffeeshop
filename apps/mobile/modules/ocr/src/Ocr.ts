import { NativeModule, requireNativeModule } from "expo-modules-core";
import type { OcrResult } from "./Ocr.types";

declare class NativeOcrModule extends NativeModule {
  recognizeText(uri: string): Promise<OcrResult>;
}

/**
 * The native module only exists in an Android build that includes this local
 * module. Elsewhere every call degrades to an empty result.
 */
let native: NativeOcrModule | null = null;

try {
  native = requireNativeModule<NativeOcrModule>("Ocr");
} catch {
  native = null;
}

export const Ocr = {
  isAvailable(): boolean {
    return native != null;
  },

  async recognizeText(uri: string): Promise<OcrResult> {
    if (!native) return { text: "", blocks: [] };
    return native.recognizeText(uri);
  },
};

export default Ocr;
