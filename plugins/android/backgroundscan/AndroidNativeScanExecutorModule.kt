package __ANDROID_PACKAGE__.backgroundscan

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

class AndroidNativeScanExecutorModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val executor = AndroidNativeScanExecutor(reactContext)

  override fun getName(): String = "AndroidNativeScanExecutor"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(executor.isSupported())
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(
      executor.getStatus()?.let { status ->
        AndroidNativeScanExecutor.statusToMap(status)
      },
    )
  }

  @ReactMethod
  fun getSnapshot(promise: Promise) {
    promise.resolve(
      executor.getSnapshot()?.let { snapshot ->
        AndroidNativeScanExecutor.snapshotToMap(snapshot)
      },
    )
  }

  @ReactMethod
  fun start(options: ReadableMap, promise: Promise) {
    try {
      val assets = options.getArray("assets") ?: throw IllegalArgumentException("Missing required field: assets")
      val parsedOptions = AndroidNativeScanStartOptions(
        jobId = options.getString("jobId")?.trim().orEmpty().ifBlank {
          throw IllegalArgumentException("Missing required field: jobId")
        },
        language = options.getString("language")?.trim().orEmpty().ifBlank {
          throw IllegalArgumentException("Missing required field: language")
        },
        assets = parseAssets(assets),
      )

      executor.start(parsedOptions)
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("android_native_scan_start_failed", error)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      executor.stop()
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("android_native_scan_stop_failed", error)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // NativeEventEmitter on RN expects this method to exist even when the
    // module emits through DeviceEventManagerModule.
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    // No-op: listener lifecycle is managed on the JS side.
  }

  override fun invalidate() {
    executor.stop()
    super.invalidate()
  }
}
