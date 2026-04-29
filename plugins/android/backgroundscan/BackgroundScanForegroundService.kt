package __ANDROID_PACKAGE__.backgroundscan

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.jt.mistapmediacleaner.R
import java.util.concurrent.atomic.AtomicBoolean

class BackgroundScanForegroundService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ensureNotificationChannel()
    isRunning.set(true)
    startForegroundWithNotification(
      buildNotification(
        title = DEFAULT_TITLE,
        body = DEFAULT_BODY,
        currentFileName = null,
        progressCurrent = 0,
        progressTotal = 0,
      ),
    )
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_START_OR_UPDATE) {
      acquireWakeLock()
      startForegroundWithNotification(
        buildNotification(intent),
      )
    }

    return START_NOT_STICKY
  }

  override fun onDestroy() {
    isRunning.set(false)
    resetNotificationThrottle()
    stopForeground(STOP_FOREGROUND_REMOVE)
    releaseWakeLock()
    super.onDestroy()
  }

  private fun buildNotification(intent: Intent): android.app.Notification {
    val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { DEFAULT_TITLE }
    val body = intent.getStringExtra(EXTRA_BODY).orEmpty().ifBlank { DEFAULT_BODY }
    val currentFileName = intent.getStringExtra(EXTRA_CURRENT_FILE_NAME)
    val progressCurrent = intent.getIntExtra(EXTRA_PROGRESS_CURRENT, 0).coerceAtLeast(0)
    val progressTotal = intent.getIntExtra(EXTRA_PROGRESS_TOTAL, 0).coerceAtLeast(0)
    return buildNotification(title, body, currentFileName, progressCurrent, progressTotal)
  }

  private fun buildNotification(
    title: String,
    body: String,
    currentFileName: String?,
    progressCurrent: Int,
    progressTotal: Int,
  ): android.app.Notification {
    val contentIntent = createContentIntent()

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setSubText(currentFileName)
      .setContentIntent(contentIntent)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setProgress(
        progressTotal,
        progressCurrent.coerceAtMost(progressTotal.takeIf { it > 0 } ?: progressCurrent),
        progressTotal <= 0,
      )
      .build()
  }

  private fun startForegroundWithNotification(notification: android.app.Notification) {
    val foregroundServiceType =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      } else {
        0
      }

    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification,
      foregroundServiceType,
    )
  }

  private fun createContentIntent(): PendingIntent? {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    launchIntent.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP

    return PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val notificationManager =
      getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID)
    if (existingChannel != null) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      "后台扫描",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "在 Android 后台继续本地媒体扫描。"
      setShowBadge(false)
    }
    notificationManager.createNotificationChannel(channel)
  }

  @Suppress("WakelockTimeout")
  private fun acquireWakeLock() {
    val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    if (wakeLock?.isHeld == true) {
      return
    }

    wakeLock = powerManager.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      WAKE_LOCK_TAG,
    ).apply {
      setReferenceCounted(false)
      acquire()
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.let { lock ->
      if (lock.isHeld) {
        lock.release()
      }
    }
    wakeLock = null
  }

  companion object {
    private const val CHANNEL_ID = "background-scan"
    private const val NOTIFICATION_ID = 42001
    private const val WAKE_LOCK_TAG = "MistapMediaCleaner:BackgroundScan"

    private const val ACTION_START_OR_UPDATE =
      "com.jt.mistapmediacleaner.backgroundscan.START_OR_UPDATE"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_BODY = "body"
    private const val EXTRA_CURRENT_FILE_NAME = "current_file_name"
    private const val EXTRA_PROGRESS_CURRENT = "progress_current"
    private const val EXTRA_PROGRESS_TOTAL = "progress_total"

    private const val DEFAULT_TITLE = "扫描进行中"
    private const val DEFAULT_BODY = "离开应用后仍会继续扫描。"
    private val isRunning = AtomicBoolean(false)
    private val notificationLock = Any()
    @Volatile private var lastNotifiedPayload: NotificationPayload? = null

    fun startOrUpdate(
      context: Context,
      title: String,
      body: String,
      currentFileName: String?,
      progressCurrent: Int,
      progressTotal: Int,
      force: Boolean = false,
    ) {
      val payload = NotificationPayload(
        title = title,
        body = body,
        currentFileName = currentFileName,
        progressCurrent = progressCurrent,
        progressTotal = progressTotal,
      )

      synchronized(notificationLock) {
        if (isRunning.compareAndSet(false, true)) {
          lastNotifiedPayload = payload

          val intent = Intent(context, BackgroundScanForegroundService::class.java).apply {
            action = ACTION_START_OR_UPDATE
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_BODY, body)
            putExtra(EXTRA_CURRENT_FILE_NAME, currentFileName)
            putExtra(EXTRA_PROGRESS_CURRENT, progressCurrent)
            putExtra(EXTRA_PROGRESS_TOTAL, progressTotal)
          }

          ContextCompat.startForegroundService(context, intent)
          return
        }

        if (!force && lastNotifiedPayload == payload) {
          return
        }

        lastNotifiedPayload = payload
      }

      updateNotification(context, payload)
    }

    fun stop(context: Context) {
      isRunning.set(false)
      resetNotificationThrottle()
      context.stopService(Intent(context, BackgroundScanForegroundService::class.java))
    }

    private fun updateNotification(context: Context, payload: NotificationPayload) {
      val notification = buildNotification(context, payload)
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(
      context: Context,
      payload: NotificationPayload,
    ): android.app.Notification {
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      launchIntent?.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      val contentIntent =
        launchIntent?.let {
          PendingIntent.getActivity(
            context,
            0,
            it,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
        }

      return NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(payload.title.ifBlank { DEFAULT_TITLE })
        .setContentText(payload.body.ifBlank { DEFAULT_BODY })
        .setSubText(payload.currentFileName)
        .setContentIntent(contentIntent)
        .setOnlyAlertOnce(true)
        .setOngoing(true)
        .setSilent(true)
        .setCategory(NotificationCompat.CATEGORY_PROGRESS)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setProgress(
          payload.progressTotal,
          payload.progressCurrent.coerceAtMost(
            payload.progressTotal.takeIf { it > 0 } ?: payload.progressCurrent,
          ),
          payload.progressTotal <= 0,
        )
        .build()
    }

    private fun resetNotificationThrottle() {
      synchronized(notificationLock) {
        lastNotifiedPayload = null
      }
    }
  }

  private var wakeLock: PowerManager.WakeLock? = null
}

private data class NotificationPayload(
  val title: String,
  val body: String,
  val currentFileName: String?,
  val progressCurrent: Int,
  val progressTotal: Int,
)
