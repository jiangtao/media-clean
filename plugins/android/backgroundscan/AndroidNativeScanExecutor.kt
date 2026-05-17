package __ANDROID_PACKAGE__.backgroundscan

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.CancellationException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

private const val EVENT_PROGRESS = "AndroidNativeScanExecutorProgress"
private const val EVENT_CHECKPOINT = "AndroidNativeScanExecutorCheckpoint"
private const val EVENT_COMPLETE = "AndroidNativeScanExecutorComplete"
private const val EVENT_ERROR = "AndroidNativeScanExecutorError"
private const val EVENT_STOPPED = "AndroidNativeScanExecutorStopped"
private const val MAX_NOTIFICATION_FILE_NAME_LENGTH = 48
private const val IMAGE_SAMPLE_DIMENSION = 64
private const val HASH_DIMENSION = 8
private const val CHECKPOINT_ANALYZED_INPUT_CHUNK_SIZE = 12
private const val IMAGE_ANALYSIS_CONCURRENCY = 4
private const val VIDEO_ANALYSIS_CONCURRENCY = 2
private const val NOTIFICATION_UPDATE_THROTTLE_MS = 200L
private const val PROGRESS_EVENT_THROTTLE_MS = 250L

data class AndroidNativeScanAsset(
  val id: String,
  val uri: String,
  val previewUri: String?,
  val mediaType: String,
  val width: Int,
  val height: Int,
  val duration: Double,
  val fileSize: Long,
  val creationTime: Long,
)

data class AndroidNativeScanMetrics(
  val brightness: Double,
  val contrast: Double,
  val edgeDensity: Double,
)

data class AndroidNativeScanAnalyzedInput(
  val asset: AndroidNativeScanAsset,
  val metrics: AndroidNativeScanMetrics,
  val fingerprint: String?,
  val differenceHash: String?,
  val contentHash: String?,
  val frameFingerprints: List<String>,
  val analysisStatus: String,
)

data class AndroidNativeScanStartOptions(
  val jobId: String,
  val language: String,
  val assets: List<AndroidNativeScanAsset>,
  val displayProgressTotal: Int?,
  val displayProgressCurrent: Int?,
  val displayProgressCompletedOffset: Int,
)

data class AndroidNativeScanRuntimeStatus(
  val jobId: String,
  val phase: String,
  val current: Int,
  val total: Int,
  val processedCount: Int,
  val currentFileName: String?,
  val lastProcessedAssetId: String?,
  val startedAt: Long,
  val updatedAt: Long,
)

data class AndroidNativeScanRuntimeSnapshot(
  val status: AndroidNativeScanRuntimeStatus,
  val analyzedInputs: List<AndroidNativeScanAnalyzedInput>,
)

private data class AndroidNativeScanFrameAnalysis(
  val metrics: AndroidNativeScanMetrics,
  val fingerprint: String?,
  val differenceHash: String?,
)

private data class AndroidNativeScanRuntimeJob(
  val options: AndroidNativeScanStartOptions,
) {
  val cancelled = AtomicBoolean(false)
  val startedAt = System.currentTimeMillis()
  val analyzedInputsSnapshot = mutableListOf<AndroidNativeScanAnalyzedInput>()
  @Volatile var future: Future<*>? = null
  @Volatile var executor: ExecutorService? = null
  @Volatile var imageWorkerExecutor: ExecutorService? = null
  @Volatile var videoWorkerExecutor: ExecutorService? = null
  @Volatile var phase: String = "running"
  @Volatile var current: Int = 0
  @Volatile var total: Int = options.assets.size
  @Volatile var processedCount: Int = 0
  @Volatile var currentFileName: String? = null
  @Volatile var lastProcessedAssetId: String? = null
  @Volatile var updatedAt: Long = startedAt
  @Volatile var lastNotificationUpdateAt: Long = 0L
  @Volatile var lastProgressEventAt: Long = 0L
}

private data class AndroidNativeScanDisplayProgress(
  val current: Int,
  val total: Int,
)

private data class AndroidNativeScanCompletedAsset(
  val index: Int,
  val analyzedInput: AndroidNativeScanAnalyzedInput,
  val error: Throwable? = null,
)

private fun parseRequiredString(map: ReadableMap, key: String): String {
  if (!map.hasKey(key) || map.isNull(key)) {
    throw IllegalArgumentException("Missing required field: $key")
  }

  return map.getString(key)?.trim().orEmpty().also {
    if (it.isEmpty()) {
      throw IllegalArgumentException("Missing required field: $key")
    }
  }
}

private fun parseOptionalString(map: ReadableMap, key: String): String? {
  if (!map.hasKey(key) || map.isNull(key)) {
    return null
  }

  return map.getString(key)?.takeIf { it.isNotBlank() }
}

private fun parseRequiredLong(map: ReadableMap, key: String): Long {
  if (!map.hasKey(key) || map.isNull(key)) {
    throw IllegalArgumentException("Missing required field: $key")
  }

  return map.getDouble(key).toLong()
}

private fun parseRequiredInt(map: ReadableMap, key: String): Int {
  if (!map.hasKey(key) || map.isNull(key)) {
    throw IllegalArgumentException("Missing required field: $key")
  }

  return map.getDouble(key).toInt()
}

private fun parseAsset(map: ReadableMap): AndroidNativeScanAsset {
  return AndroidNativeScanAsset(
    id = parseRequiredString(map, "id"),
    uri = parseRequiredString(map, "uri"),
    previewUri = parseOptionalString(map, "previewUri"),
    mediaType = parseRequiredString(map, "mediaType"),
    width = parseRequiredInt(map, "width"),
    height = parseRequiredInt(map, "height"),
    duration = if (map.hasKey("duration") && !map.isNull("duration")) map.getDouble("duration") else 0.0,
    fileSize = parseRequiredLong(map, "fileSize"),
    creationTime = parseRequiredLong(map, "creationTime"),
  )
}

fun parseAssets(assets: ReadableArray): List<AndroidNativeScanAsset> {
  val parsed = mutableListOf<AndroidNativeScanAsset>()

  for (index in 0 until assets.size()) {
    val item = assets.getMap(index) ?: throw IllegalArgumentException("assets[$index] must be an object")
    parsed += parseAsset(item)
  }

  return parsed
}

private fun buildFileName(value: String?): String? {
  if (value.isNullOrBlank()) {
    return null
  }

  if (value.length <= MAX_NOTIFICATION_FILE_NAME_LENGTH) {
    return value
  }

  return value.take(MAX_NOTIFICATION_FILE_NAME_LENGTH - 3) + "..."
}

private fun resolveDisplayFileName(asset: AndroidNativeScanAsset): String? {
  val source = asset.previewUri ?: asset.uri
  val path = Uri.parse(source).lastPathSegment ?: source
  return buildFileName(path)
}

private fun buildProgressBody(language: String, current: Int, total: Int, currentFileName: String?): String {
  val progressLabel = if (total > 0) {
    "${min(current, total)}/$total"
  } else {
    current.toString()
  }

  return if (language == "zh-CN") {
    if (!currentFileName.isNullOrBlank()) {
      "已处理 $progressLabel，当前：$currentFileName"
    } else {
      "已处理 $progressLabel，离开应用后仍会继续扫描。"
    }
  } else {
    if (!currentFileName.isNullOrBlank()) {
      "Processed $progressLabel. Current: $currentFileName"
    } else {
      "Processed $progressLabel. Scanning continues after leaving the app."
    }
  }
}

private fun buildProgressTitle(language: String): String {
  return if (language == "zh-CN") {
    "扫描进行中"
  } else {
    "Scanning in progress"
  }
}

private fun Double.clamp01(): Double = max(0.0, min(1.0, this))

private fun Bitmap.recycleQuietly() {
  if (!isRecycled) {
    recycle()
  }
}

private fun closeQuietly(stream: InputStream?) {
  try {
    stream?.close()
  } catch (_: Throwable) {
    // Ignore close failures.
  }
}

private fun decodeBitmapFromUri(context: Context, uriString: String, maxDimension: Int): Bitmap? {
  val uri = Uri.parse(uriString)
  val bounds = BitmapFactory.Options().apply {
    inJustDecodeBounds = true
  }

  val inputForBounds = openInputStream(context, uri)
  if (inputForBounds != null) {
    BitmapFactory.decodeStream(inputForBounds, null, bounds)
    closeQuietly(inputForBounds)
  }

  if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
    return null
  }

  val decodeOptions = BitmapFactory.Options().apply {
    inSampleSize = calculateInSampleSize(bounds.outWidth, bounds.outHeight, maxDimension)
    inPreferredConfig = Bitmap.Config.ARGB_8888
  }

  val inputForBitmap = openInputStream(context, uri)
  if (inputForBitmap == null) {
    return null
  }

  return try {
    BitmapFactory.decodeStream(inputForBitmap, null, decodeOptions)
  } finally {
    closeQuietly(inputForBitmap)
  }
}

private fun openInputStream(context: Context, uri: Uri): InputStream? {
  return when (uri.scheme) {
    null, "file" -> {
      val path = uri.path ?: return null
      runCatching { FileInputStream(File(path)) }.getOrNull()
    }
    else -> runCatching { context.contentResolver.openInputStream(uri) }.getOrNull()
  }
}

private fun calculateInSampleSize(outWidth: Int, outHeight: Int, maxDimension: Int): Int {
  var inSampleSize = 1
  if (outHeight > maxDimension || outWidth > maxDimension) {
    val halfHeight = outHeight / 2
    val halfWidth = outWidth / 2

    while (
      halfHeight / inSampleSize >= maxDimension &&
      halfWidth / inSampleSize >= maxDimension
    ) {
      inSampleSize *= 2
    }
  }

  return max(1, inSampleSize)
}

private fun bitmapToGrayscale(bitmap: Bitmap): IntArray {
  val width = bitmap.width
  val height = bitmap.height
  val pixels = IntArray(width * height)
  bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
  return IntArray(pixels.size) { index ->
    val color = pixels[index]
    val red = (color shr 16) and 0xff
    val green = (color shr 8) and 0xff
    val blue = color and 0xff
    (0.299 * red + 0.587 * green + 0.114 * blue).toInt()
  }
}

private fun calculateMetricsFromGrayscale(grayscale: IntArray): AndroidNativeScanMetrics {
  if (grayscale.isEmpty()) {
    return AndroidNativeScanMetrics(0.0, 0.0, 0.0)
  }

  val normalized = grayscale.map { it / 255.0 }
  val average = normalized.sum() / normalized.size
  val variance = normalized.fold(0.0) { acc, value ->
    val delta = value - average
    acc + delta * delta
  } / normalized.size
  val contrast = sqrt(variance).clamp01()

  val width = sqrt(grayscale.size.toDouble()).toInt().coerceAtLeast(1)
  val height = (grayscale.size / width).coerceAtLeast(1)
  var edges = 0
  var total = 0

  if (width >= 3 && height >= 3) {
    for (y in 1 until height - 1) {
      for (x in 1 until width - 1) {
        val topLeft = grayscale[(y - 1) * width + (x - 1)]
        val top = grayscale[(y - 1) * width + x]
        val topRight = grayscale[(y - 1) * width + (x + 1)]
        val left = grayscale[y * width + (x - 1)]
        val right = grayscale[y * width + (x + 1)]
        val bottomLeft = grayscale[(y + 1) * width + (x - 1)]
        val bottom = grayscale[(y + 1) * width + x]
        val bottomRight = grayscale[(y + 1) * width + (x + 1)]

        val gx =
          (-topLeft) + topRight +
            (-2 * left) + (2 * right) +
            (-bottomLeft) + bottomRight
        val gy =
          (-topLeft) + (-2 * top) + (-topRight) +
            bottomLeft + (2 * bottom) + bottomRight
        val magnitude = sqrt((gx * gx + gy * gy).toDouble()) / 1020.0

        if (magnitude > 0.18) {
          edges += 1
        }
        total += 1
      }
    }
  }

  return AndroidNativeScanMetrics(
    brightness = average.clamp01(),
    contrast = contrast,
    edgeDensity = if (total > 0) (edges.toDouble() / total).clamp01() else 0.0,
  )
}

private fun calculateAverageHash(bitmap: Bitmap): String? {
  val scaled = Bitmap.createScaledBitmap(bitmap, HASH_DIMENSION, HASH_DIMENSION, true)
  return try {
    val grayscale = bitmapToGrayscale(scaled)
    if (grayscale.isEmpty()) {
      return null
    }

    val average = grayscale.sum().toDouble() / grayscale.size
    var hash = 0L
    grayscale.forEachIndexed { index, value ->
      if (value >= average) {
        hash = hash or (1L shl index)
      }
    }
    longToHex(hash)
  } finally {
    scaled.recycleQuietly()
  }
}

private fun calculateDifferenceHash(bitmap: Bitmap): String? {
  val scaled = Bitmap.createScaledBitmap(bitmap, HASH_DIMENSION + 1, HASH_DIMENSION, true)
  return try {
    val grayscale = bitmapToGrayscale(scaled)
    if (grayscale.isEmpty()) {
      return null
    }

    var hash = 0L
    var bitIndex = 0
    for (y in 0 until HASH_DIMENSION) {
      for (x in 0 until HASH_DIMENSION) {
        val left = grayscale[y * (HASH_DIMENSION + 1) + x]
        val right = grayscale[y * (HASH_DIMENSION + 1) + x + 1]
        if (left >= right) {
          hash = hash or (1L shl bitIndex)
        }
        bitIndex += 1
      }
    }
    longToHex(hash)
  } finally {
    scaled.recycleQuietly()
  }
}

private fun longToHex(value: Long): String {
  return java.lang.Long.toUnsignedString(value, 16).padStart(16, '0')
}

private fun combineHashes(hashes: List<String>): String? {
  if (hashes.isEmpty()) {
    return null
  }

  var accumulator = 0L
  for (hash in hashes) {
    runCatching { java.lang.Long.parseUnsignedLong(hash.take(16), 16) }
      .getOrNull()
      ?.let { accumulator = accumulator xor it }
  }

  return longToHex(accumulator)
}

private fun computeFrameAnalysis(bitmap: Bitmap): AndroidNativeScanFrameAnalysis {
  val sample = Bitmap.createScaledBitmap(bitmap, IMAGE_SAMPLE_DIMENSION, IMAGE_SAMPLE_DIMENSION, true)
  return try {
    val grayscale = bitmapToGrayscale(sample)
    val metrics = calculateMetricsFromGrayscale(grayscale)
    AndroidNativeScanFrameAnalysis(
      metrics = metrics,
      fingerprint = calculateAverageHash(sample),
      differenceHash = calculateDifferenceHash(sample),
    )
  } finally {
    sample.recycleQuietly()
  }
}

private fun calculateContentHash(context: Context, uriString: String): String? {
  val uri = Uri.parse(uriString)
  val input = openInputStream(context, uri) ?: return null
  return try {
    val digest = MessageDigest.getInstance("MD5")
    val buffer = ByteArray(16 * 1024)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) {
        break
      }
      digest.update(buffer, 0, read)
    }
    digest.digest().joinToString("") { byte -> "%02x".format(byte) }
  } catch (_: Throwable) {
    null
  } finally {
    closeQuietly(input)
  }
}

private fun createAssetMap(asset: AndroidNativeScanAsset): WritableMap {
  return Arguments.createMap().apply {
    putString("id", asset.id)
    putString("uri", asset.uri)
    if (asset.previewUri != null) {
      putString("previewUri", asset.previewUri)
    } else {
      putNull("previewUri")
    }
    putString("mediaType", asset.mediaType)
    putInt("width", asset.width)
    putInt("height", asset.height)
    putDouble("duration", asset.duration)
    putDouble("fileSize", asset.fileSize.toDouble())
    putDouble("creationTime", asset.creationTime.toDouble())
  }
}

private fun createMetricsMap(metrics: AndroidNativeScanMetrics): WritableMap {
  return Arguments.createMap().apply {
    putDouble("brightness", metrics.brightness)
    putDouble("contrast", metrics.contrast)
    putDouble("edgeDensity", metrics.edgeDensity)
  }
}

private fun createAnalyzedInputMap(input: AndroidNativeScanAnalyzedInput): WritableMap {
  return Arguments.createMap().apply {
    putMap("asset", createAssetMap(input.asset))
    putMap("metrics", createMetricsMap(input.metrics))
    if (input.fingerprint != null) {
      putString("fingerprint", input.fingerprint)
    } else {
      putNull("fingerprint")
    }
    if (input.differenceHash != null) {
      putString("differenceHash", input.differenceHash)
    } else {
      putNull("differenceHash")
    }
    if (input.contentHash != null) {
      putString("contentHash", input.contentHash)
    } else {
      putNull("contentHash")
    }
    val frames = Arguments.createArray()
    input.frameFingerprints.forEach { frames.pushString(it) }
    putArray("frameFingerprints", frames)
    putString("analysisStatus", input.analysisStatus)
  }
}

private fun createProgressEventMap(
  jobId: String,
  current: Int,
  total: Int,
  currentFileName: String?,
  isScanning: Boolean,
): WritableMap {
  return Arguments.createMap().apply {
    putString("jobId", jobId)
    putInt("current", current)
    putInt("total", total)
    putString("currentFileName", currentFileName)
    putBoolean("isScanning", isScanning)
    putDouble("percentage", if (total > 0) (current.toDouble() / total.toDouble()) * 100.0 else 0.0)
  }
}

private fun createCheckpointEventMap(
  jobId: String,
  current: Int,
  total: Int,
  currentFileName: String?,
  processedCount: Int,
  lastProcessedAssetId: String,
  analyzedInputs: List<AndroidNativeScanAnalyzedInput>,
): WritableMap {
  val analyzedInputsArray: WritableArray = Arguments.createArray()
  analyzedInputs.forEach { analyzedInputsArray.pushMap(createAnalyzedInputMap(it)) }

  return Arguments.createMap().apply {
    putString("jobId", jobId)
    putInt("current", current)
    putInt("total", total)
    putString("currentFileName", currentFileName)
    putInt("processedCount", processedCount)
    putString("lastProcessedAssetId", lastProcessedAssetId)
    putArray("analyzedInputs", analyzedInputsArray)
    putDouble("lastHeartbeatAt", System.currentTimeMillis().toDouble())
  }
}

private fun createCompleteEventMap(
  jobId: String,
  scannedCount: Int,
): WritableMap {
  return Arguments.createMap().apply {
    putString("jobId", jobId)
    putInt("completedCount", scannedCount)
    putInt("scannedCount", scannedCount)
    putDouble("scannedAt", System.currentTimeMillis().toDouble())
  }
}

private fun createRuntimeStatusMap(status: AndroidNativeScanRuntimeStatus): WritableMap {
  return Arguments.createMap().apply {
    putString("jobId", status.jobId)
    putString("phase", status.phase)
    putInt("current", status.current)
    putInt("total", status.total)
    putInt("processedCount", status.processedCount)
    if (status.currentFileName != null) {
      putString("currentFileName", status.currentFileName)
    } else {
      putNull("currentFileName")
    }
    if (status.lastProcessedAssetId != null) {
      putString("lastProcessedAssetId", status.lastProcessedAssetId)
    } else {
      putNull("lastProcessedAssetId")
    }
    putDouble("startedAt", status.startedAt.toDouble())
    putDouble("updatedAt", status.updatedAt.toDouble())
  }
}

private fun createRuntimeSnapshotMap(snapshot: AndroidNativeScanRuntimeSnapshot): WritableMap {
  val analyzedInputsArray = Arguments.createArray()
  snapshot.analyzedInputs.forEach { analyzedInputsArray.pushMap(createAnalyzedInputMap(it)) }

  return createRuntimeStatusMap(snapshot.status).apply {
    putArray("analyzedInputs", analyzedInputsArray)
  }
}

private fun createErrorEventMap(
  jobId: String,
  throwable: Throwable,
  current: Int?,
  total: Int?,
  currentFileName: String?,
): WritableMap {
  return Arguments.createMap().apply {
    putString("jobId", jobId)
    putString("message", throwable.message ?: throwable.javaClass.simpleName)
    putString("errorClass", throwable.javaClass.name)
    putString("stack", throwable.stackTraceToString())
    if (current != null) {
      putInt("current", current)
    }
    if (total != null) {
      putInt("total", total)
    }
    if (currentFileName != null) {
      putString("currentFileName", currentFileName)
    }
  }
}

private fun createStoppedEventMap(jobId: String): WritableMap {
  return Arguments.createMap().apply {
    putString("jobId", jobId)
  }
}

private fun ReactApplicationContext.emitNativeEvent(name: String, payload: WritableMap) {
  if (!hasActiveCatalystInstance()) {
    return
  }

  runOnUiQueueThread {
    if (!hasActiveCatalystInstance()) {
      return@runOnUiQueueThread
    }

    getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, payload)
  }
}

private fun analyzeImageAsset(
  context: Context,
  asset: AndroidNativeScanAsset,
): AndroidNativeScanAnalyzedInput {
  val bitmap = decodeBitmapFromUri(context, asset.uri, IMAGE_SAMPLE_DIMENSION)
    ?: throw IllegalStateException("Unable to decode image asset ${asset.id}")

  return try {
    val frameAnalysis = computeFrameAnalysis(bitmap)
    val fingerprint = frameAnalysis.fingerprint
    val differenceHash = frameAnalysis.differenceHash
    val contentHash = calculateContentHash(context, asset.uri)

    AndroidNativeScanAnalyzedInput(
      asset = asset,
      metrics = frameAnalysis.metrics,
      fingerprint = fingerprint,
      differenceHash = differenceHash,
      contentHash = contentHash,
      frameFingerprints = listOfNotNull(fingerprint),
      analysisStatus = "ok",
    )
  } finally {
    bitmap.recycleQuietly()
  }
}

private fun analyzeVideoAsset(
  context: Context,
  asset: AndroidNativeScanAsset,
): AndroidNativeScanAnalyzedInput {
  val retriever = MediaMetadataRetriever()
  val frameAnalyses = mutableListOf<AndroidNativeScanFrameAnalysis>()

  return try {
    retriever.setDataSource(context, Uri.parse(asset.uri))
    val durationMs = if (asset.duration > 0) asset.duration.toLong() else runCatching {
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong()
    }.getOrNull() ?: 0L
    val sampleTimesUs = buildList {
      if (durationMs > 0) {
        add((durationMs * 1_000L * 0.15).toLong())
        add((durationMs * 1_000L * 0.50).toLong())
        add((durationMs * 1_000L * 0.85).toLong())
      } else {
        add(0L)
      }
    }

    for (timeUs in sampleTimesUs) {
      val frame = runCatching {
        retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
          ?: retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
      }.getOrNull()
      if (frame != null) {
        frameAnalyses += computeFrameAnalysis(frame)
        frame.recycleQuietly()
      }
    }

    if (frameAnalyses.isEmpty()) {
      throw IllegalStateException("Unable to extract video frames for ${asset.id}")
    }

    val averagedMetrics = AndroidNativeScanMetrics(
      brightness = frameAnalyses.map { it.metrics.brightness }.average().clamp01(),
      contrast = frameAnalyses.map { it.metrics.contrast }.average().clamp01(),
      edgeDensity = frameAnalyses.map { it.metrics.edgeDensity }.average().clamp01(),
    )
    val frameFingerprints = frameAnalyses.mapNotNull { it.fingerprint }
    val differenceHashes = frameAnalyses.mapNotNull { it.differenceHash }
    val contentHash = calculateContentHash(context, asset.uri)

    AndroidNativeScanAnalyzedInput(
      asset = asset,
      metrics = averagedMetrics,
      fingerprint = combineHashes(frameFingerprints),
      differenceHash = combineHashes(differenceHashes),
      contentHash = contentHash,
      frameFingerprints = frameFingerprints,
      analysisStatus = "ok",
    )
  } catch (error: Throwable) {
    AndroidNativeScanAnalyzedInput(
      asset = asset,
      metrics = AndroidNativeScanMetrics(0.0, 0.0, 0.0),
      fingerprint = null,
      differenceHash = null,
      contentHash = null,
      frameFingerprints = emptyList(),
      analysisStatus = "fallback",
    )
  } finally {
    runCatching { retriever.release() }
  }
}

class AndroidNativeScanExecutor(private val reactContext: ReactApplicationContext) {
  private val lock = Any()
  private var executor: ExecutorService? = null
  private var currentJob: AndroidNativeScanRuntimeJob? = null
  private var lastSnapshot: AndroidNativeScanRuntimeSnapshot? = null

  fun isSupported(): Boolean = true

  fun getStatus(): AndroidNativeScanRuntimeStatus? {
    return synchronized(lock) {
      currentJob?.toRuntimeStatus() ?: lastSnapshot?.status
    }
  }

  fun getSnapshot(): AndroidNativeScanRuntimeSnapshot? {
    return synchronized(lock) {
      currentJob?.toRuntimeSnapshot() ?: lastSnapshot
    }
  }

  fun start(options: AndroidNativeScanStartOptions) {
    synchronized(lock) {
      stopLocked()

      val job = AndroidNativeScanRuntimeJob(options)
      val threadName = "AndroidNativeScanExecutor-${options.jobId}"
      val nextExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, threadName).apply {
          isDaemon = true
          priority = Thread.NORM_PRIORITY - 1
        }
      }
      val future = nextExecutor.submit {
        runJob(job)
      }

      job.future = future
      job.executor = nextExecutor
      executor = nextExecutor
      currentJob = job
      lastSnapshot = job.toRuntimeSnapshot()
    }
  }

  private fun resolveDisplayProgress(
    job: AndroidNativeScanRuntimeJob,
    rawCurrent: Int,
    rawTotal: Int,
  ): AndroidNativeScanDisplayProgress {
    val requestedDisplayTotal = job.options.displayProgressTotal?.coerceAtLeast(0)
    val total = rawTotal.coerceAtLeast(0)
    val displayTotal =
      if (requestedDisplayTotal != null && requestedDisplayTotal >= total) {
        requestedDisplayTotal
      } else {
        total
      }
    val displayBaseCurrent =
      (job.options.displayProgressCurrent ?: job.options.displayProgressCompletedOffset)
        .coerceIn(0, displayTotal)
    val shouldApplyDisplayOffset =
      requestedDisplayTotal != null &&
        displayTotal > total &&
        total == job.options.assets.size
    val displayCurrent =
      if (shouldApplyDisplayOffset) {
        displayBaseCurrent + rawCurrent.coerceAtLeast(0)
      } else {
        rawCurrent.coerceAtLeast(0)
      }

    return AndroidNativeScanDisplayProgress(
      current = displayCurrent.coerceIn(0, displayTotal.takeIf { it > 0 } ?: displayCurrent),
      total = displayTotal,
    )
  }

  fun stop() {
    synchronized(lock) {
      stopLocked()
    }
  }

  private fun stopLocked() {
    val job = currentJob
    currentJob = null

    job?.cancelled?.set(true)
    job?.phase = "stopped"
    job?.updatedAt = System.currentTimeMillis()
    job?.let {
      lastSnapshot = it.toRuntimeSnapshot()
    }
    job?.future?.cancel(true)
    job?.imageWorkerExecutor?.shutdownNow()
    job?.videoWorkerExecutor?.shutdownNow()
    job?.executor?.shutdownNow()
    executor = null

    BackgroundScanForegroundService.stop(reactContext)
  }

  private fun runJob(job: AndroidNativeScanRuntimeJob) {
    val options = job.options
    val total = options.assets.size
    var completedCount = 0
    var processedCount = 0
    var lastProcessedAssetId = ""
    var currentFileName: String? = null
    val checkpointAnalyzedInputs = mutableListOf<AndroidNativeScanAnalyzedInput>()

    try {
      val initialDisplayProgress = resolveDisplayProgress(job, 0, total)
      updateRuntimeStatus(
        job,
        phase = "running",
        current = initialDisplayProgress.current,
        total = initialDisplayProgress.total,
      )
      updateForegroundService(
        options.language,
        initialDisplayProgress.current,
        initialDisplayProgress.total,
        null,
        force = true,
      )
      job.lastNotificationUpdateAt = System.currentTimeMillis()
      if (total == 0) {
        updateRuntimeStatus(job, phase = "completed", current = 0, total = 0, processedCount = 0)
        reactContext.emitNativeEvent(EVENT_COMPLETE, createCompleteEventMap(options.jobId, 0))
        return
      }

      val imageWorkerExecutor = Executors.newFixedThreadPool(IMAGE_ANALYSIS_CONCURRENCY) { runnable ->
        Thread(runnable, "AndroidNativeScanImageWorker-${options.jobId}").apply {
          isDaemon = true
          priority = Thread.NORM_PRIORITY - 1
        }
      }
      val videoWorkerExecutor = Executors.newFixedThreadPool(VIDEO_ANALYSIS_CONCURRENCY) { runnable ->
        Thread(runnable, "AndroidNativeScanVideoWorker-${options.jobId}").apply {
          isDaemon = true
          priority = Thread.NORM_PRIORITY - 1
        }
      }
      job.imageWorkerExecutor = imageWorkerExecutor
      job.videoWorkerExecutor = videoWorkerExecutor
      val completedAssets = LinkedBlockingQueue<AndroidNativeScanCompletedAsset>()

      options.assets.forEachIndexed { index, asset ->
        val workerExecutor = when (asset.mediaType.lowercase(Locale.US)) {
          "photo" -> imageWorkerExecutor
          "video" -> videoWorkerExecutor
          else -> throw IllegalArgumentException("Unsupported media type: ${asset.mediaType}")
        }

        workerExecutor.submit {
          if (job.cancelled.get()) {
            return@submit
          }

          val completedAsset = try {
            ensureActive(job)
            val analyzedInput = when (asset.mediaType.lowercase(Locale.US)) {
              "photo" -> analyzeImageAsset(reactContext, asset)
              "video" -> analyzeVideoAsset(reactContext, asset)
              else -> throw IllegalArgumentException("Unsupported media type: ${asset.mediaType}")
            }
            AndroidNativeScanCompletedAsset(
              index = index,
              analyzedInput = analyzedInput,
            )
          } catch (error: Throwable) {
            AndroidNativeScanCompletedAsset(
              index = index,
              analyzedInput = AndroidNativeScanAnalyzedInput(
                asset = asset,
                metrics = AndroidNativeScanMetrics(0.0, 0.0, 0.0),
                fingerprint = null,
                differenceHash = null,
                contentHash = null,
                frameFingerprints = emptyList(),
                analysisStatus = "failed",
              ),
              error = error,
            )
          }

          if (!job.cancelled.get()) {
            completedAssets.put(completedAsset)
          }
        }
      }

      val contiguousResultsByIndex = mutableMapOf<Int, AndroidNativeScanAnalyzedInput>()

      while (completedCount < total) {
        ensureActive(job)

        val completedAsset = completedAssets.take()
        completedAsset.error?.let { error ->
          throw error
        }

        ensureActive(job)

        completedCount += 1
        currentFileName = resolveDisplayFileName(completedAsset.analyzedInput.asset)
        contiguousResultsByIndex[completedAsset.index] = completedAsset.analyzedInput

        var checkpointFileName: String? = currentFileName
        while (true) {
          val nextInput = contiguousResultsByIndex.remove(processedCount) ?: break
          job.analyzedInputsSnapshot += nextInput
          checkpointAnalyzedInputs += nextInput
          processedCount += 1
          lastProcessedAssetId = nextInput.asset.id
          checkpointFileName = resolveDisplayFileName(nextInput.asset)
        }

        val displayProgress = resolveDisplayProgress(job, completedCount, total)
        updateRuntimeStatus(
          job,
          phase = "running",
          current = displayProgress.current,
          total = displayProgress.total,
          processedCount = processedCount,
          currentFileName = currentFileName,
          lastProcessedAssetId = lastProcessedAssetId.ifBlank { null },
        )

        val now = System.currentTimeMillis()
        if (
          completedCount == total ||
            completedCount == 1 ||
            now - job.lastNotificationUpdateAt >= NOTIFICATION_UPDATE_THROTTLE_MS
        ) {
          updateForegroundService(
            options.language,
            displayProgress.current,
            displayProgress.total,
            currentFileName,
            force = completedCount == total,
          )
          job.lastNotificationUpdateAt = now
        }

        if (
          completedCount == total ||
            completedCount == 1 ||
            now - job.lastProgressEventAt >= PROGRESS_EVENT_THROTTLE_MS
        ) {
          reactContext.emitNativeEvent(
            EVENT_PROGRESS,
            createProgressEventMap(
              jobId = options.jobId,
              current = displayProgress.current,
              total = displayProgress.total,
              currentFileName = currentFileName,
              isScanning = completedCount < total,
            ),
          )
          job.lastProgressEventAt = now
        }

        if (checkpointAnalyzedInputs.size >= CHECKPOINT_ANALYZED_INPUT_CHUNK_SIZE || (completedCount == total && checkpointAnalyzedInputs.isNotEmpty())) {
          reactContext.emitNativeEvent(
            EVENT_CHECKPOINT,
            createCheckpointEventMap(
              jobId = options.jobId,
              current = displayProgress.current,
              total = displayProgress.total,
              currentFileName = checkpointFileName,
              processedCount = processedCount,
              lastProcessedAssetId = lastProcessedAssetId,
              analyzedInputs = checkpointAnalyzedInputs.toList(),
            ),
          )
          checkpointAnalyzedInputs.clear()
        }
      }

      ensureActive(job)
      val completedDisplayProgress = resolveDisplayProgress(job, completedCount, total)
      updateRuntimeStatus(
        job,
        phase = "completed",
        current = completedDisplayProgress.current,
        total = completedDisplayProgress.total,
        processedCount = processedCount,
        currentFileName = currentFileName,
        lastProcessedAssetId = lastProcessedAssetId.ifBlank { null },
      )
      reactContext.emitNativeEvent(EVENT_COMPLETE, createCompleteEventMap(options.jobId, completedCount))
    } catch (cancelled: CancellationException) {
      val stoppedDisplayProgress = resolveDisplayProgress(job, completedCount, total)
      updateRuntimeStatus(
        job,
        phase = "stopped",
        current = stoppedDisplayProgress.current,
        total = stoppedDisplayProgress.total,
        processedCount = processedCount,
        currentFileName = currentFileName,
        lastProcessedAssetId = lastProcessedAssetId.ifBlank { null },
      )
      reactContext.emitNativeEvent(EVENT_STOPPED, createStoppedEventMap(options.jobId))
    } catch (error: Throwable) {
      val failedDisplayProgress = resolveDisplayProgress(job, completedCount, total)
      updateRuntimeStatus(
        job,
        phase = "failed",
        current = failedDisplayProgress.current,
        total = failedDisplayProgress.total,
        processedCount = processedCount,
        currentFileName = currentFileName,
        lastProcessedAssetId = lastProcessedAssetId.ifBlank { null },
      )
      reactContext.emitNativeEvent(
        EVENT_ERROR,
        createErrorEventMap(
          jobId = options.jobId,
          throwable = error,
          current = if (failedDisplayProgress.current > 0) failedDisplayProgress.current else null,
          total = if (failedDisplayProgress.total > 0) failedDisplayProgress.total else null,
          currentFileName = currentFileName,
        ),
      )
    } finally {
      synchronized(lock) {
        if (currentJob === job) {
          lastSnapshot = job.toRuntimeSnapshot()
          currentJob = null
          BackgroundScanForegroundService.stop(reactContext)
          job.imageWorkerExecutor?.shutdownNow()
          job.videoWorkerExecutor?.shutdownNow()
          executor?.shutdownNow()
          executor = null
        }
      }
    }
  }

  private fun updateForegroundService(
    language: String,
    current: Int,
    total: Int,
    currentFileName: String?,
    force: Boolean,
  ) {
    BackgroundScanForegroundService.startOrUpdate(
      reactContext,
      buildProgressTitle(language),
      buildProgressBody(language, current, total, currentFileName),
      currentFileName,
      current,
      total,
      force = force,
    )
  }

  private fun ensureActive(job: AndroidNativeScanRuntimeJob) {
    if (job.cancelled.get() || Thread.currentThread().isInterrupted) {
      throw CancellationException("Android native scan job was stopped.")
    }
  }

  private fun updateRuntimeStatus(
    job: AndroidNativeScanRuntimeJob,
    phase: String = job.phase,
    current: Int = job.current,
    total: Int = job.total,
    processedCount: Int = job.processedCount,
    currentFileName: String? = job.currentFileName,
    lastProcessedAssetId: String? = job.lastProcessedAssetId,
  ) {
    synchronized(lock) {
      job.phase = phase
      job.current = current
      job.total = total
      job.processedCount = processedCount
      job.currentFileName = currentFileName
      job.lastProcessedAssetId = lastProcessedAssetId
      job.updatedAt = System.currentTimeMillis()

      if (shouldTrackSnapshot(job)) {
        lastSnapshot = job.toRuntimeSnapshot()
      }
    }
  }

  private fun AndroidNativeScanRuntimeJob.toRuntimeStatus(): AndroidNativeScanRuntimeStatus {
    return AndroidNativeScanRuntimeStatus(
      jobId = options.jobId,
      phase = phase,
      current = current,
      total = total,
      processedCount = processedCount,
      currentFileName = currentFileName,
      lastProcessedAssetId = lastProcessedAssetId,
      startedAt = startedAt,
      updatedAt = updatedAt,
    )
  }

  private fun AndroidNativeScanRuntimeJob.toRuntimeSnapshot(): AndroidNativeScanRuntimeSnapshot {
    return AndroidNativeScanRuntimeSnapshot(
      status = toRuntimeStatus(),
      analyzedInputs = analyzedInputsSnapshot.toList(),
    )
  }

  private fun shouldTrackSnapshot(job: AndroidNativeScanRuntimeJob): Boolean {
    if (currentJob === job) {
      return true
    }

    val snapshot = lastSnapshot ?: return false
    return snapshot.status.jobId == job.options.jobId && snapshot.status.startedAt == job.startedAt
  }

  companion object {
    fun statusToMap(status: AndroidNativeScanRuntimeStatus): WritableMap {
      return createRuntimeStatusMap(status)
    }

    fun snapshotToMap(snapshot: AndroidNativeScanRuntimeSnapshot): WritableMap {
      return createRuntimeSnapshotMap(snapshot)
    }
  }
}
