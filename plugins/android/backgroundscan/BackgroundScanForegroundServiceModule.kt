package __ANDROID_PACKAGE__.backgroundscan

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class BackgroundScanForegroundServiceModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BackgroundScanForegroundService"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun start(options: ReadableMap, promise: Promise) {
    try {
      BackgroundScanForegroundService.startOrUpdate(
        reactApplicationContext,
        options.getString("title").orEmpty(),
        options.getString("body").orEmpty(),
        options.getString("currentFileName"),
        options.getDouble("progressCurrent").toInt(),
        options.getDouble("progressTotal").toInt(),
      )
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("background_scan_start_failed", error)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      BackgroundScanForegroundService.stop(reactApplicationContext)
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("background_scan_stop_failed", error)
    }
  }
}
