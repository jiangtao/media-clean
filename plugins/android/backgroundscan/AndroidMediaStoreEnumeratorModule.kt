package __ANDROID_PACKAGE__.backgroundscan

import android.content.ContentUris
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import kotlin.math.roundToInt

private data class MediaStoreEnumerateOptions(
  val createdAfter: Long?,
  val createdBefore: Long?,
  val mediaTypes: List<String>,
  val limit: Int?,
)

private data class EnumeratedMediaStoreAsset(
  val createdAtSort: Long,
  val assetId: Long,
  val payload: WritableMap,
)

class AndroidMediaStoreEnumeratorModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AndroidMediaStoreEnumerator"

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun enumerate(options: ReadableMap, promise: Promise) {
    try {
      promise.resolve(queryAssets(parseEnumerateOptions(options)))
    } catch (error: Throwable) {
      promise.reject("android_media_store_enumerate_failed", error)
    }
  }

  private fun parseEnumerateOptions(options: ReadableMap): MediaStoreEnumerateOptions {
    val mediaTypes = parseMediaTypes(options.getArray("mediaTypes"))
    val limit =
      if (options.hasKey("limit") && !options.isNull("limit")) {
        options.getDouble("limit").roundToInt().takeIf { it > 0 }
      } else {
        null
      }

    return MediaStoreEnumerateOptions(
      createdAfter = options.getLongOrNull("createdAfter"),
      createdBefore = options.getLongOrNull("createdBefore"),
      mediaTypes = mediaTypes.ifEmpty { listOf("photo", "video") },
      limit = limit,
    )
  }

  private fun parseMediaTypes(mediaTypes: ReadableArray?): List<String> {
    if (mediaTypes == null) {
      return emptyList()
    }

    return buildList {
      for (index in 0 until mediaTypes.size()) {
        val value = mediaTypes.getString(index)?.trim()?.lowercase()
        if (value == "photo" || value == "video") {
          add(value)
        }
      }
    }
  }

  private fun queryAssets(options: MediaStoreEnumerateOptions): WritableArray {
    val collectedAssets = mutableListOf<EnumeratedMediaStoreAsset>()

    if ("photo" in options.mediaTypes) {
      collectedAssets += queryAssetsFromCollection(mediaType = "photo", options = options)
    }

    if ("video" in options.mediaTypes) {
      collectedAssets += queryAssetsFromCollection(mediaType = "video", options = options)
    }

    val sortedAssets = collectedAssets.sortedWith(
      compareByDescending<EnumeratedMediaStoreAsset> { it.createdAtSort }
        .thenByDescending { it.assetId },
    )
    val limitedAssets = options.limit?.let { sortedAssets.take(it) } ?: sortedAssets
    val result = Arguments.createArray()
    for (asset in limitedAssets) {
      result.pushMap(asset.payload)
    }

    return result
  }

  private fun queryAssetsFromCollection(
    mediaType: String,
    options: MediaStoreEnumerateOptions,
  ): List<EnumeratedMediaStoreAsset> {
    val projection = arrayOf(
      MediaStore.MediaColumns._ID,
      MediaStore.MediaColumns.WIDTH,
      MediaStore.MediaColumns.HEIGHT,
      MediaStore.MediaColumns.SIZE,
      MediaStore.MediaColumns.DATE_TAKEN,
      MediaStore.MediaColumns.DATE_MODIFIED,
      MediaStore.MediaColumns.DATE_ADDED,
      MediaStore.Images.Media.BUCKET_ID,
      MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
      MediaStore.MediaColumns.MIME_TYPE,
      MediaStore.MediaColumns.RELATIVE_PATH,
      MediaStore.MediaColumns.DISPLAY_NAME,
      MediaStore.MediaColumns.ORIENTATION,
      MediaStore.Video.VideoColumns.DURATION,
      MediaStore.Video.VideoColumns.BITRATE,
    )

    val selectionParts = mutableListOf<String>()
    selectionParts += "${MediaStore.MediaColumns.IS_PENDING} = 0"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      selectionParts += "${MediaStore.MediaColumns.IS_TRASHED} = 0"
    }
    selectionParts += "${MediaStore.MediaColumns.SIZE} > 0"

    val selection = selectionParts.joinToString(" AND ")
    val queryUri = resolveCollectionUri(mediaType)
    val result = mutableListOf<EnumeratedMediaStoreAsset>()
    reactApplicationContext.contentResolver.query(
      queryUri,
      projection,
      selection,
      emptyArray(),
      null,
    )?.use { cursor ->
      val idIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
      val widthIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.WIDTH)
      val heightIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.HEIGHT)
      val sizeIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
      val dateTakenIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_TAKEN)
      val dateModifiedIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_MODIFIED)
      val dateAddedIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
      val bucketIdIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.BUCKET_ID)
      val bucketNameIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
      val mimeTypeIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
      val relativePathIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.RELATIVE_PATH)
      val displayNameIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
      val orientationIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.ORIENTATION)
      val durationIndex = cursor.getColumnIndexOrThrow(MediaStore.Video.VideoColumns.DURATION)
      val bitrateIndex = cursor.getColumnIndexOrThrow(MediaStore.Video.VideoColumns.BITRATE)

      while (cursor.moveToNext()) {
        val assetId = cursor.getLong(idIndex)
        val contentUri = ContentUris.withAppendedId(queryUri, assetId)
        val width = cursor.getIntOrZero(widthIndex)
        val height = cursor.getIntOrZero(heightIndex)
        val bucketName = cursor.getStringOrNull(bucketNameIndex)
        val relativePath = cursor.getStringOrNull(relativePathIndex)
        val displayName = cursor.getStringOrNull(displayNameIndex)
        val dateTaken = cursor.getLongOrNull(dateTakenIndex)?.takeIf { it > 0 }
        val dateModified = cursor.getLongOrNull(dateModifiedIndex)?.takeIf { it > 0 }?.times(1000)
        val dateAdded = cursor.getLongOrNull(dateAddedIndex)?.takeIf { it > 0 }?.times(1000)
        val effectiveDateModified = dateModified ?: dateAdded
        val sortCreatedAt = dateTaken ?: effectiveDateModified ?: 0L
        if (!matchesCreatedAtRange(sortCreatedAt, options)) {
          continue
        }

        result += EnumeratedMediaStoreAsset(
          createdAtSort = sortCreatedAt,
          assetId = assetId,
          payload =
            Arguments.createMap().apply {
              putString("assetId", assetId.toString())
              putString("contentUri", contentUri.toString())
              putString("mediaType", mediaType)
              putInt("width", width)
              putInt("height", height)
              putDouble("durationMs", cursor.getLongOrZero(durationIndex).toDouble())
              putDouble("fileSizeBytes", cursor.getLongOrZero(sizeIndex).toDouble())
              putNullableDouble("dateTaken", dateTaken)
              putNullableDouble("dateModified", effectiveDateModified)
              putNullableString("bucketId", cursor.getStringOrNull(bucketIdIndex))
              putNullableString("bucketName", bucketName)
              putNullableString("mimeType", cursor.getStringOrNull(mimeTypeIndex))
              putBoolean("isScreenshot", isScreenshotAsset(bucketName, relativePath, displayName))
              putNullableDouble("bitrate", cursor.getLongOrNull(bitrateIndex)?.takeIf { it > 0 })
              putNull("frameRate")
              putNull("codec")
              putNullableDouble(
                "orientation",
                cursor.getLongOrNull(orientationIndex)?.takeIf { it != 0L },
              )
              putNullableDouble(
                "aspectRatio",
                if (width > 0 && height > 0) width.toDouble() / height.toDouble() else null,
              )
            },
        )
      }
    }

    return result
  }

  private fun matchesCreatedAtRange(
    createdAt: Long,
    options: MediaStoreEnumerateOptions,
  ): Boolean {
    if (options.createdAfter != null && createdAt < options.createdAfter) {
      return false
    }

    if (options.createdBefore != null && createdAt >= options.createdBefore) {
      return false
    }

    return true
  }

  private fun resolveCollectionUri(mediaType: String): Uri {
    val volumeName =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.VOLUME_EXTERNAL
      } else {
        "external"
      }

    return when (mediaType) {
      "video" ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          MediaStore.Video.Media.getContentUri(volumeName)
        } else {
          MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        }
      else ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          MediaStore.Images.Media.getContentUri(volumeName)
        } else {
          MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }
    }
  }

  private fun isScreenshotAsset(bucketName: String?, relativePath: String?, displayName: String?): Boolean {
    val haystack = listOfNotNull(bucketName, relativePath, displayName).joinToString(" ").lowercase()
    return "screenshot" in haystack || "screenshots" in haystack
  }
}

private fun ReadableMap.getLongOrNull(key: String): Long? {
  if (!hasKey(key) || isNull(key)) {
    return null
  }

  return getDouble(key).toLong()
}

private fun android.database.Cursor.getLongOrNull(index: Int): Long? {
  return if (isNull(index)) null else getLong(index)
}

private fun android.database.Cursor.getLongOrZero(index: Int): Long {
  return getLongOrNull(index) ?: 0L
}

private fun android.database.Cursor.getIntOrZero(index: Int): Int {
  return if (isNull(index)) 0 else getInt(index)
}

private fun android.database.Cursor.getStringOrNull(index: Int): String? {
  return if (isNull(index)) null else getString(index)
}

private fun WritableMap.putNullableString(key: String, value: String?) {
  if (value == null) {
    putNull(key)
  } else {
    putString(key, value)
  }
}

private fun WritableMap.putNullableDouble(key: String, value: Number?) {
  if (value == null) {
    putNull(key)
  } else {
    putDouble(key, value.toDouble())
  }
}
