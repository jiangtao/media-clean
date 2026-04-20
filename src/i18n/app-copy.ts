import type {
  CleanupCandidate,
  CleanupConfidence,
  CleanupIssueType,
  CleanupKind,
  DuplicateGroup,
  MediaType,
} from '../domain/recognition/types';
import type { ScanSummary } from '../features/scan/scan-media-library';
import type { ReminderSettings } from '../features/reminders/reminder-settings';
import type { AppLanguage } from './app-language';

type Frequency = ReminderSettings['frequency'];

interface LocalizedCopy {
  languageLabel: string;
  languageOptions: Array<{ value: AppLanguage; label: string }>;
  appearance: {
    title: string;
    system: string;
    light: string;
    dark: string;
  };
  common: {
    cancel: string;
    close: string;
    deleteConfirm: string;
    unknownSize: string;
    neverScanned: string;
    notScheduled: string;
    statusTitle: string;
  };
  hero: {
    kicker: string;
    title: string;
    description: string;
    lastScan: string;
    autoCleanupHint: string;
  };
  summary: {
    scannedLabel: string;
    scannedCaption: string;
    candidatesLabel: string;
    candidatesCaption: string;
    highConfidenceLabel: string;
    highConfidenceCaption: string;
    recycleLabel: string;
    recycleCaption: string;
  };
  controls: {
    rescan: string;
    scanning: string;
    autoCleanup: string;
  };
  info: {
    title: string;
    firstLine: string;
    secondLine: string;
  };
  reminder: {
    title: string;
    genericTitle: string;
    defaultSummary: string;
    disabledSummary: string;
    weekly: string;
    daily: string;
    weekdays: string[];
    themePreview: string;
    frequencyLabel: string;
    weekdayLabel: string;
    timeLabel: string;
    hourMinus: string;
    hourPlus: string;
    minuteMinus: string;
    minutePlus: string;
    themePlaceholder: string;
    saveTheme: string;
    footnote: string;
    permissionLabel: string;
    permissionOn: string;
      permissionOff: string;
      scheduled: string;
      pending: string;
      disabled: string;
      unauthorized: string;
      channelName: string;
      channelDescription: string;
      nextReminder: string;
    estimatedReminder: string;
    plannedReminder: string;
    noScanSummary: string;
    noScanDetail: string;
    eligibilityHint: (months: number) => string;
  };
  permission: {
    title: string;
    body: string;
    action: string;
  };
  tabs: {
    suggestions: string;
    recycle: string;
    photos: string;
    settings: string;
  };
  screens: {
    photoGrid: {
      filterAll: string;
      filterPhoto: string;
      filterVideo: string;
      permissionChecking: string;
      scanPromptTitle: string;
      scanPromptBody: string;
      startScan: string;
      scanScopeSummary: (count: number) => string;
      scanScopeHint: string;
      scanProgressTitle: string;
      scanProgressValue: (current: number, total: number) => string;
      scanProgressFootnote: string;
      scanCompleteTitle: string;
      scanResultSummary: (count: number) => string;
      scanResultFootnote: string;
      scanExhaustedTitle: string;
      scanExhaustedBody: string;
      continueScan: string;
      selectedItems: (count: number) => string;
      cleanupSelected: string;
      keepSelected: string;
    };
    recycleBin: {
      title: string;
      emptyTitle: string;
      emptyBody: string;
      expireHint: (days: number) => string;
      selectedItems: (count: number) => string;
      cancel: string;
      restore: string;
      delete: string;
    };
  };
  filters: {
    all: string;
    accidental: string;
    abnormal: string;
    duplicate: string;
  };
  empty: {
    suggestionsTitle: string;
    suggestionsBody: string;
    recycleTitle: string;
    recycleBody: string;
  };
  actionBar: {
    selectedItems: (count: number) => string;
    restoreSelected: string;
    cleanupSelected: string;
    clearSelection: string;
  };
  alerts: {
    scanFailed: string;
    initFailed: string;
    deleteFailedTitle: string;
    deleteFailedBody: string;
    noAutoCleanupTitle: string;
    noAutoCleanupBody: string;
    autoCleanupTitle: string;
    autoCleanupBody: (count: number) => string;
    confirmMoveToRecycle: string;
    selectedCleanupTitle: string;
    selectedCleanupBody: (count: number) => string;
    moveToRecycle: string;
    deleteForever: string;
    confirmAgainTitle: string;
    confirmAgainBody: string;
    previewDeleteTitle: string;
    previewDeleteBody: string;
    reminderDisabledTitle: string;
    reminderDisabledBody: string;
  };
  candidate: {
    highConfidence: string;
    mediumConfidence: string;
    lowConfidence: string;
    accidentalVideo: string;
    accidentalPhoto: string;
    abnormalVideo: string;
    abnormalPhoto: string;
    duplicateVideo: string;
    duplicatePhoto: string;
    accidentalIssue: string;
    abnormalIssue: string;
    duplicateIssue: string;
    selected: string;
    actionable: string;
    noRisk: string;
    recycleHint: string;
    previewHint: string;
    unselect: string;
    addAction: string;
    scoreUnit: string;
    secondUnit: string;
  };
  preview: {
    title: string;
    subtitle: string;
    clearAction: string;
    clearCompactAction: string;
    judgementTitle: string;
    mediaInfoTitle: string;
    typeLabel: string;
    capturedAtLabel: string;
    dimensionsLabel: string;
    sizeLabel: string;
    durationLabel: string;
    video: string;
    photo: string;
    keepAction: string;
    keepCompactAction: string;
    keepHint: string;
    restore: string;
    restoreCompactAction: string;
    moveToRecycle: string;
    deleteForever: string;
    deleteForeverCompactAction: string;
    duplicateGroupHint: (count: number) => string;
    duplicateExpand: string;
    duplicateCollapse: string;
    duplicateSelectionHint: string;
    duplicateSelectedCount: (count: number) => string;
    duplicateKeepReference: string;
    duplicateCurrentItem: string;
    duplicateSimilarItem: (index: number) => string;
    duplicateExactTag: string;
    duplicateSimilarTag: string;
    duplicateSimilarityTag: (percentage: number) => string;
    duplicateSelectDelete: string;
    duplicateSelectedDelete: string;
    duplicateRepresentativeTitle: string;
    duplicateReasonHigherResolution: string;
    duplicateReasonLargerFile: string;
    duplicateReasonNewerCapture: string;
  };
  recognition: {
    reasons: Record<string, string>;
  };
}

const COPY: Record<AppLanguage, LocalizedCopy> = {
  'zh-CN': {
    languageLabel: '语言',
    languageOptions: [
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en-US', label: 'English' },
    ],
    appearance: {
      title: '显示主题',
      system: '跟随系统',
      light: '浅色',
      dark: '深色',
    },
    common: {
      cancel: '取消',
      close: '关闭',
      deleteConfirm: '确认删除',
      unknownSize: '未知大小',
      neverScanned: '尚未扫描',
      notScheduled: '未排程',
      statusTitle: '当前状态',
    },
    hero: {
      kicker: 'Android 优先 MVP',
      title: '相册清理建议',
      description: '本地扫描最近媒体，用可解释规则识别误触、异常与重复内容，并通过应用内回收站做安全清理。',
      lastScan: '上次扫描',
      autoCleanupHint: '自动清理只会软删除，高风险操作始终二次确认。',
    },
    summary: {
      scannedLabel: '本次扫描',
      scannedCaption: '最近媒体总数',
      candidatesLabel: '识别结果',
      candidatesCaption: '待人工确认处理',
      highConfidenceLabel: '高置信度',
      highConfidenceCaption: '适合自动清理',
      recycleLabel: '回收站',
      recycleCaption: '应用内软删除',
    },
    controls: {
      rescan: '重新扫描',
      scanning: '扫描中...',
      autoCleanup: '自动清理',
    },
    info: {
      title: '首版识别说明',
      firstLine:
        '当前默认扫描最近 360 项媒体，并额外保留应用内回收站中的已软删除条目。识别完全在本地完成：误触与异常依赖启发式评分，重复内容依赖图片缩略图指纹，以及视频按时长自适应采样的多帧缩略图与元数据近似分组。',
      secondLine: '回收站是应用内软删除，不等同于系统回收站；卸载应用或清空本地存储后，软删除记录可能失效。',
    },
    reminder: {
      title: '定期清理准备',
      genericTitle: '定期清理提醒',
      defaultSummary: '定期检查最近拍摄的照片和视频，优先清理误触、异常与重复内容。',
      disabledSummary: '未开启定期清理提醒',
      weekly: '每周',
      daily: '每天',
      weekdays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      themePreview: '通知主题',
      frequencyLabel: '提醒频率',
      weekdayLabel: '提醒星期',
      timeLabel: '提醒时间',
      hourMinus: '小时 -1',
      hourPlus: '小时 +1',
      minuteMinus: '分钟 -15',
      minutePlus: '分钟 +15',
      themePlaceholder: '提醒主题',
      saveTheme: '保存提醒主题',
      footnote: '系统通知只负责提醒重新打开应用，不会在后台偷偷扫描你的照片或视频。',
      permissionLabel: '通知权限',
      permissionOn: '已开启',
      permissionOff: '未开启',
      scheduled: '已排程',
      pending: '待排程',
      disabled: '未开启',
      unauthorized: '未授权',
      channelName: '定期清理提醒',
      channelDescription: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
      nextReminder: '下次提醒',
      estimatedReminder: '预计下次提醒',
      plannedReminder: '计划提醒时间',
      noScanSummary: '还没有最近扫描记录，先打开应用完成一次本地扫描，再开始定期清理。',
      noScanDetail: '建议把扫描和提醒都保留在本地，避免把照片与视频上传到云端。',
      eligibilityHint: (months: number) => `仅当最近 ${months} 个月内有新增媒体时才触发提醒。`,
    },
    permission: {
      title: '需要媒体权限',
      body: '首版会读取照片和视频元数据，并在本地生成缩略图做轻量分析；不会上传到云端。',
      action: '授权并开始扫描',
    },
    tabs: {
      suggestions: '识别结果',
      recycle: '回收站',
      photos: '照片',
      settings: '设置',
    },
    screens: {
      photoGrid: {
        filterAll: '全部',
        filterPhoto: '照片',
        filterVideo: '视频',
        permissionChecking: '正在检查权限...',
        scanPromptTitle: '本地扫描',
        scanPromptBody: '最近媒体会在本地检查，结果直接留在本页。',
        startScan: '开始扫描',
        scanScopeSummary: (count: number) => `已选择 ${count} 个媒体`,
        scanScopeHint: '默认扫描最近媒体，尽量把空间留给下方展示区。',
        scanProgressTitle: '本地扫描',
        scanProgressValue: (current: number, total: number) => `${current}/${total}`,
        scanProgressFootnote: '正常媒体会持续退场，异常结果直接留在下方。',
        scanCompleteTitle: '本地扫描',
        scanResultSummary: (count: number) => `发现 ${count} 个异常媒体`,
        scanResultFootnote: '结果已留在当前页面，可继续筛选、查看并决定清理或保留。',
        scanExhaustedTitle: '当前这一批已处理完成',
        scanExhaustedBody: '可以继续扫描最近媒体，或等待新的媒体进入这一批范围。',
        continueScan: '继续扫描',
        selectedItems: (count) => `已选择 ${count} 项`,
        cleanupSelected: '清理',
        keepSelected: '保留',
      },
      recycleBin: {
        title: '回收站',
        emptyTitle: '回收站还是空的',
        emptyBody: '自动清理或手动移入回收站后，会在这里统一管理。',
        expireHint: (days) => `回收站中的项目将在 ${days} 天后自动彻底删除`,
        selectedItems: (count) => `已选择 ${count} 项`,
        cancel: '取消',
        restore: '恢复',
        delete: '删除',
      },
    },
    filters: {
      all: '全部',
      accidental: '误触',
      abnormal: '异常',
      duplicate: '重复',
    },
    empty: {
      suggestionsTitle: '当前没有待处理识别结果',
      suggestionsBody: '可以继续扫描，或等待后续引入更强识别规则。',
      recycleTitle: '回收站还是空的',
      recycleBody: '自动清理或手动移入回收站后，会在这里统一管理。',
    },
    actionBar: {
      selectedItems: (count) => `已选中 ${count} 项`,
      restoreSelected: '恢复选中',
      cleanupSelected: '选中清理',
      clearSelection: '清空选择',
    },
    alerts: {
      scanFailed: '扫描失败，请重试。',
      initFailed: '初始化失败，请重新授权并扫描。',
      deleteFailedTitle: '删除失败',
      deleteFailedBody: '系统未能完成永久删除，请稍后重试。',
      noAutoCleanupTitle: '暂无自动清理项',
      noAutoCleanupBody: '当前没有高置信度候选项，建议先手动预览后再清理。',
      autoCleanupTitle: '自动清理',
      autoCleanupBody: (count) => `将把 ${count} 个高置信度候选项移入应用内回收站，不会立刻永久删除。`,
      confirmMoveToRecycle: '确认移入回收站',
      selectedCleanupTitle: '选中清理',
      selectedCleanupBody: (count) => `已选中 ${count} 项，请选择处理方式。`,
      moveToRecycle: '移入回收站',
      deleteForever: '彻底删除',
      confirmAgainTitle: '再次确认',
      confirmAgainBody: '彻底删除后将从系统媒体库移除，无法从应用内恢复。',
      previewDeleteTitle: '永久删除当前媒体',
      previewDeleteBody: '删除后将无法通过应用内回收站恢复。',
      reminderDisabledTitle: '提醒未开启',
      reminderDisabledBody: '系统通知权限未授予，因此已保留提醒设置但暂不启用。',
    },
    candidate: {
      highConfidence: '高置信度',
      mediumConfidence: '中置信度',
      lowConfidence: '低置信度',
      accidentalVideo: '疑似误触视频',
      accidentalPhoto: '疑似误触照片',
      abnormalVideo: '疑似异常视频',
      abnormalPhoto: '疑似异常照片',
      duplicateVideo: '疑似重复视频',
      duplicatePhoto: '疑似重复照片',
      accidentalIssue: '误触',
      abnormalIssue: '异常',
      duplicateIssue: '重复',
      selected: '已选',
      actionable: '可操作',
      noRisk: '当前无明显风险标记',
      recycleHint: '已移入应用内回收站，可恢复或彻底删除。',
      previewHint: '点击查看预览，再决定是否清理。',
      unselect: '取消选择',
      addAction: '加入操作',
      scoreUnit: '分',
      secondUnit: '秒',
    },
    preview: {
      title: '媒体预览',
      subtitle: '先确认内容，再决定是否清理',
      clearAction: '清除',
      clearCompactAction: '清除',
      judgementTitle: '识别判断',
      mediaInfoTitle: '媒体信息',
      typeLabel: '类型',
      capturedAtLabel: '拍摄时间',
      dimensionsLabel: '尺寸',
      sizeLabel: '大小',
      durationLabel: '时长',
      video: '视频',
      photo: '照片',
      keepAction: '保留此媒体',
      keepCompactAction: '保留',
      keepHint: '保留表示这是误报，不再作为待清理项显示。',
      restore: '恢复当前媒体',
      restoreCompactAction: '恢复',
      moveToRecycle: '移入回收站',
      deleteForever: '彻底删除',
      deleteForeverCompactAction: '删除',
      duplicateGroupHint: (count) => `同组还有 ${count} 项相似媒体，当前已保留一份参考副本。`,
      duplicateExpand: '展开重复组',
      duplicateCollapse: '收起重复组',
      duplicateSelectionHint: '展开后可明确选择要删除的重复项；未展开时默认保留最佳副本。',
      duplicateSelectedCount: (count) => `已明确选择删除 ${count} 项`,
      duplicateKeepReference: '保留参考副本',
      duplicateCurrentItem: '当前条目',
      duplicateSimilarItem: (index) => `相似副本 ${index}`,
      duplicateExactTag: '完全相同',
      duplicateSimilarTag: '相似',
      duplicateSimilarityTag: (percentage) => `相似度${percentage}%`,
      duplicateSelectDelete: '选中此项删除',
      duplicateSelectedDelete: '已选中待删除',
      duplicateRepresentativeTitle: '保留副本依据',
      duplicateReasonHigherResolution: '分辨率更高',
      duplicateReasonLargerFile: '文件体积更大',
      duplicateReasonNewerCapture: '拍摄时间更新',
    },
    recognition: {
      reasons: {
        画面明显过暗: '画面明显过暗',
        边缘信息很少: '边缘信息很少',
        文件尺寸较小: '文件尺寸较小',
        分辨率较低: '分辨率较低',
        视频时长极短: '视频时长极短',
        视频时长较短: '视频时长较短',
        缩略图明显过暗: '缩略图明显过暗',
        缩略图边缘信息很少: '缩略图边缘信息很少',
        视频文件较小: '视频文件较小',
        画面接近全黑: '画面接近全黑',
        几乎没有可见内容: '几乎没有可见内容',
        媒体内容分析失败: '媒体内容分析失败',
        媒体文件为空: '媒体文件为空',
        媒体元数据异常: '媒体元数据异常',
        媒体尺寸异常小: '媒体尺寸异常小',
        分辨率异常低: '分辨率异常低',
        画面比例异常: '画面比例异常',
        媒体时长异常短: '媒体时长异常短',
        缩略图接近全黑: '缩略图接近全黑',
        缩略图几乎没有内容: '缩略图几乎没有内容',
        视频文件异常小: '视频文件异常小',
        与其他媒体高度相似: '与其他媒体高度相似',
        与其他媒体内容近似: '与其他媒体内容近似',
        已保留一份更高质量副本: '已保留一份更高质量副本',
      },
    },
  },
  'en-US': {
    languageLabel: 'Language',
    languageOptions: [
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en-US', label: 'English' },
    ],
    appearance: {
      title: 'Appearance',
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    },
    common: {
      cancel: 'Cancel',
      close: 'Close',
      deleteConfirm: 'Delete',
      unknownSize: 'Unknown size',
      neverScanned: 'Not scanned yet',
      notScheduled: 'Not scheduled',
      statusTitle: 'Current status',
    },
    hero: {
      kicker: 'Android-first MVP',
      title: 'Media Cleanup Suggestions',
      description: 'Scan recent media locally, explain accidental, anomalous, and duplicate media, and clean safely through an app-level recycle bin.',
      lastScan: 'Last scan',
      autoCleanupHint: 'Auto cleanup only performs soft delete, and risky actions always require a second confirmation.',
    },
    summary: {
      scannedLabel: 'Scanned',
      scannedCaption: 'recent media checked',
      candidatesLabel: 'Recognition results',
      candidatesCaption: 'ready for review',
      highConfidenceLabel: 'High confidence',
      highConfidenceCaption: 'ready for auto cleanup',
      recycleLabel: 'Recycle bin',
      recycleCaption: 'soft-deleted in app',
    },
    controls: {
      rescan: 'Scan again',
      scanning: 'Scanning...',
      autoCleanup: 'Auto cleanup',
    },
    info: {
      title: 'MVP Detection Notes',
      firstLine:
        'The current MVP scans the most recent 360 media items and also keeps app-level recycle-bin entries visible. Detection stays fully on-device: accidental and anomalous media use heuristic scoring, while duplicate media uses image thumbnail fingerprints plus duration-adaptive multi-frame video thumbnails and metadata similarity.',
      secondLine:
        'The recycle bin is an app-level soft-delete concept, not the system recycle bin. If the app is uninstalled or local storage is cleared, those records may be lost.',
    },
    reminder: {
      title: 'Recurring Cleanup Readiness',
      genericTitle: 'Cleanup Reminder',
      defaultSummary: 'Regularly review recent photos and videos, prioritizing accidental, anomalous, and duplicate media.',
      disabledSummary: 'Recurring cleanup reminder is off',
      weekly: 'Weekly',
      daily: 'Daily',
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      themePreview: 'Notification title',
      frequencyLabel: 'Reminder frequency',
      weekdayLabel: 'Reminder day',
      timeLabel: 'Reminder time',
      hourMinus: 'Hour -1',
      hourPlus: 'Hour +1',
      minuteMinus: 'Minute -15',
      minutePlus: 'Minute +15',
      themePlaceholder: 'Reminder title',
      saveTheme: 'Save reminder title',
      footnote: 'System notifications only remind you to reopen the app. They do not scan photos or videos in the background.',
      permissionLabel: 'Notification permission',
      permissionOn: 'On',
      permissionOff: 'Off',
      scheduled: 'Scheduled',
      pending: 'Pending',
      disabled: 'Off',
      unauthorized: 'Unauthorized',
      channelName: 'Cleanup reminders',
      channelDescription: 'Reminds you to reopen the app, rescan recent media, and clean accidental, anomalous, and duplicate media.',
      nextReminder: 'Next reminder',
      estimatedReminder: 'Estimated next reminder',
      plannedReminder: 'Planned reminder time',
      noScanSummary: 'There is no recent scan yet. Open the app and finish one local scan before starting recurring cleanup.',
      noScanDetail: 'Keep both scanning and reminders local so photos and videos never have to be uploaded to the cloud.',
      eligibilityHint: (months: number) =>
        `Only triggers when new media exists within the last ${months} month${months > 1 ? 's' : ''}.`,
    },
    permission: {
      title: 'Media permission required',
      body: 'The MVP reads photo and video metadata and generates thumbnails locally for lightweight analysis. Nothing is uploaded to the cloud.',
      action: 'Grant access and start scanning',
    },
    tabs: {
      suggestions: 'Recognition results',
      recycle: 'Recycle bin',
      photos: 'Photos',
      settings: 'Settings',
    },
    screens: {
      photoGrid: {
        filterAll: 'All',
        filterPhoto: 'Photos',
        filterVideo: 'Videos',
        permissionChecking: 'Checking permission...',
        scanPromptTitle: 'Local scan',
        scanPromptBody: 'Recent media is checked locally and the results stay on this page.',
        startScan: 'Start scan',
        scanScopeSummary: (count: number) => `${count} media selected`,
        scanScopeHint: 'The default recent-media scope stays compact so the gallery keeps most of the space.',
        scanProgressTitle: 'Local scan',
        scanProgressValue: (current: number, total: number) => `${current}/${total}`,
        scanProgressFootnote: 'Normal items keep fading away while flagged results stay below.',
        scanCompleteTitle: 'Local scan',
        scanResultSummary: (count: number) => `Found ${count} anomalous media items`,
        scanResultFootnote: 'Results stay on the page so filtering, review, cleanup, or keep actions can continue immediately.',
        scanExhaustedTitle: 'This batch is fully processed',
        scanExhaustedBody: 'You can continue scanning recent media or wait for new media to enter this range.',
        continueScan: 'Scan again',
        selectedItems: (count) => `${count} selected`,
        cleanupSelected: 'Clean up',
        keepSelected: 'Keep',
      },
      recycleBin: {
        title: 'Recycle Bin',
        emptyTitle: 'The recycle bin is still empty',
        emptyBody: 'Items moved by auto cleanup or manual cleanup will be managed here.',
        expireHint: (days) => `Items in the recycle bin will be permanently deleted after ${days} days.`,
        selectedItems: (count) => `${count} selected`,
        cancel: 'Cancel',
        restore: 'Restore',
        delete: 'Delete',
      },
    },
    filters: {
      all: 'All',
      accidental: 'Accidental',
      abnormal: 'Anomalous',
      duplicate: 'Duplicate',
    },
    empty: {
      suggestionsTitle: 'No recognition results right now',
      suggestionsBody: 'You can scan again later or wait for stronger detection rules in a future version.',
      recycleTitle: 'The recycle bin is still empty',
      recycleBody: 'Items moved by auto cleanup or manual cleanup will be managed here.',
    },
    actionBar: {
      selectedItems: (count) => `${count} selected`,
      restoreSelected: 'Restore selected',
      cleanupSelected: 'Clean selected',
      clearSelection: 'Clear selection',
    },
    alerts: {
      scanFailed: 'Scan failed. Please try again.',
      initFailed: 'Initialization failed. Re-authorize access and try scanning again.',
      deleteFailedTitle: 'Delete failed',
      deleteFailedBody: 'The system could not finish the permanent delete. Please try again later.',
      noAutoCleanupTitle: 'No auto-cleanup items',
      noAutoCleanupBody: 'There are no high-confidence candidates right now. Preview first before cleaning manually.',
      autoCleanupTitle: 'Auto cleanup',
      autoCleanupBody: (count) => `${count} high-confidence candidates will be moved into the app recycle bin, without being permanently deleted immediately.`,
      confirmMoveToRecycle: 'Move to recycle bin',
      selectedCleanupTitle: 'Selected cleanup',
      selectedCleanupBody: (count) => `${count} items selected. Choose how to handle them.`,
      moveToRecycle: 'Move to recycle bin',
      deleteForever: 'Delete forever',
      confirmAgainTitle: 'Confirm again',
      confirmAgainBody: 'Permanent delete removes media from the system library and cannot be restored inside the app.',
      previewDeleteTitle: 'Delete this media permanently',
      previewDeleteBody: 'After deletion, it cannot be restored from the app recycle bin.',
      reminderDisabledTitle: 'Reminder not enabled',
      reminderDisabledBody: 'Notification permission was not granted, so the reminder settings were kept but the reminder stays disabled for now.',
    },
    candidate: {
      highConfidence: 'High confidence',
      mediumConfidence: 'Medium confidence',
      lowConfidence: 'Low confidence',
      accidentalVideo: 'Likely accidental video',
      accidentalPhoto: 'Likely accidental photo',
      abnormalVideo: 'Likely anomalous video',
      abnormalPhoto: 'Likely anomalous photo',
      duplicateVideo: 'Likely duplicate video',
      duplicatePhoto: 'Likely duplicate photo',
      accidentalIssue: 'Accidental',
      abnormalIssue: 'Anomalous',
      duplicateIssue: 'Duplicate',
      selected: 'Selected',
      actionable: 'Ready',
      noRisk: 'No obvious risk marker',
      recycleHint: 'Already moved to the app recycle bin. You can restore it or delete it permanently.',
      previewHint: 'Open a preview first, then decide whether to clean it.',
      unselect: 'Unselect',
      addAction: 'Add to batch',
      scoreUnit: 'pts',
      secondUnit: 'sec',
    },
    preview: {
      title: 'Media Preview',
      subtitle: 'Confirm the content first, then decide whether to clean it',
      clearAction: 'Clear',
      clearCompactAction: 'Clear',
      judgementTitle: 'Detection result',
      mediaInfoTitle: 'Media details',
      typeLabel: 'Type',
      capturedAtLabel: 'Captured at',
      dimensionsLabel: 'Dimensions',
      sizeLabel: 'Size',
      durationLabel: 'Duration',
      video: 'Video',
      photo: 'Photo',
      keepAction: 'Keep this media',
      keepCompactAction: 'Keep',
      keepHint: 'Keep means this result is a false positive and should not be cleaned.',
      restore: 'Restore this media',
      restoreCompactAction: 'Restore',
      moveToRecycle: 'Move to recycle bin',
      deleteForever: 'Delete forever',
      deleteForeverCompactAction: 'Delete',
      duplicateGroupHint: (count) => `${count} similar items remain in this group, and one reference copy has been kept.`,
      duplicateExpand: 'Expand duplicate group',
      duplicateCollapse: 'Collapse duplicate group',
      duplicateSelectionHint: 'Expand to choose exactly which duplicate to delete. Without expanding, the best-quality copy is kept by default.',
      duplicateSelectedCount: (count) => `${count} items explicitly selected for deletion`,
      duplicateKeepReference: 'Keep reference copy',
      duplicateCurrentItem: 'Current item',
      duplicateSimilarItem: (index) => `Similar copy ${index}`,
      duplicateExactTag: 'Exact match',
      duplicateSimilarTag: 'Similar',
      duplicateSimilarityTag: (percentage) => `${percentage}% similar`,
      duplicateSelectDelete: 'Select this copy to delete',
      duplicateSelectedDelete: 'Selected for deletion',
      duplicateRepresentativeTitle: 'Reference copy kept because',
      duplicateReasonHigherResolution: 'higher resolution',
      duplicateReasonLargerFile: 'larger file size',
      duplicateReasonNewerCapture: 'newer capture time',
    },
    recognition: {
      reasons: {
        画面明显过暗: 'Frame is very dark',
        边缘信息很少: 'Very little edge detail',
        文件尺寸较小: 'Small file size',
        分辨率较低: 'Low resolution',
        视频时长极短: 'Video is extremely short',
        视频时长较短: 'Video is short',
        缩略图明显过暗: 'Thumbnail is very dark',
        缩略图边缘信息很少: 'Thumbnail has very little edge detail',
        视频文件较小: 'Small video file',
        画面接近全黑: 'Frame is nearly black',
        几乎没有可见内容: 'Almost no visible content',
        媒体内容分析失败: 'Media analysis failed',
        媒体文件为空: 'Media file is empty',
        媒体元数据异常: 'Media metadata looks invalid',
        媒体尺寸异常小: 'Media file is unusually small',
        分辨率异常低: 'Resolution is unusually low',
        画面比例异常: 'Aspect ratio looks unusual',
        媒体时长异常短: 'Media duration is unusually short',
        缩略图接近全黑: 'Thumbnail is nearly black',
        缩略图几乎没有内容: 'Thumbnail has almost no visible content',
        视频文件异常小: 'Video file is unusually small',
        与其他媒体高度相似: 'Highly similar to other media',
        与其他媒体内容近似: 'Content is similar to other media',
        已保留一份更高质量副本: 'A higher-quality copy has been kept',
      },
    },
  },
};

function formatNumber(value: number, language: AppLanguage, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? maximumFractionDigits : 0,
  }).format(value);
}

function formatResolution(width: number, height: number) {
  return `${width} × ${height}`;
}

export function getAppCopy(language: AppLanguage): LocalizedCopy {
  return COPY[language];
}

export function getDefaultReminderSummary(language: AppLanguage): string {
  return COPY[language].reminder.defaultSummary;
}

export function isDefaultReminderSummary(summary: string | undefined): boolean {
  const trimmed = summary?.trim();
  if (!trimmed) {
    return true;
  }

  return Object.values(COPY).some((copy) => copy.reminder.defaultSummary === trimmed);
}

export function resolveReminderSummary(summary: string | undefined, language: AppLanguage) {
  const trimmed = summary?.trim();
  if (!trimmed || isDefaultReminderSummary(trimmed)) {
    return getDefaultReminderSummary(language);
  }

  return trimmed;
}

export function resolveReminderTitle(summary: string | undefined, language: AppLanguage) {
  const resolvedSummary = resolveReminderSummary(summary, language);
  return isDefaultReminderSummary(resolvedSummary)
    ? COPY[language].reminder.genericTitle
    : resolvedSummary;
}

export function listReminderFrequencyLabels(language: AppLanguage) {
  return {
    weekly: COPY[language].reminder.weekly,
    daily: COPY[language].reminder.daily,
  } satisfies Record<Frequency, string>;
}

export function listReminderWeekdayLabels(language: AppLanguage) {
  return COPY[language].reminder.weekdays;
}

export function translateRiskReason(reason: string, language: AppLanguage) {
  return COPY[language].recognition.reasons[reason] ?? reason;
}

export function getConfidenceLabel(confidence: CleanupConfidence, language: AppLanguage) {
  const labels = COPY[language].candidate;
  if (confidence === 'high') {
    return labels.highConfidence;
  }

  if (confidence === 'medium') {
    return labels.mediumConfidence;
  }

  return labels.lowConfidence;
}

export function getIssueTypeLabel(issueType: CleanupIssueType, language: AppLanguage) {
  const labels = COPY[language].candidate;

  if (issueType === 'duplicate') {
    return labels.duplicateIssue;
  }

  if (issueType === 'abnormal') {
    return labels.abnormalIssue;
  }

  return labels.accidentalIssue;
}

export function getDuplicateRepresentativeReasonLabel(
  reason: DuplicateGroup['representativeReason'],
  language: AppLanguage,
) {
  const labels = COPY[language].preview;

  if (reason === 'higher-resolution') {
    return labels.duplicateReasonHigherResolution;
  }

  if (reason === 'larger-file') {
    return labels.duplicateReasonLargerFile;
  }

  return labels.duplicateReasonNewerCapture;
}

export function getDuplicateCardSummary(candidate: CleanupCandidate, language: AppLanguage) {
  const group = candidate.duplicateGroup;
  if (!group) {
    return null;
  }

  const count = group.size - 1;

  if (group.representativeReason === 'higher-resolution') {
    return language === 'zh-CN'
      ? `保留 ${formatResolution(group.representativeWidth, group.representativeHeight)} 副本 · 同组还有 ${count} 项`
      : `Kept ${formatResolution(group.representativeWidth, group.representativeHeight)} copy · ${count} more in group`;
  }

  if (group.representativeReason === 'larger-file') {
    return language === 'zh-CN'
      ? `保留 ${formatLocalizedSize(group.representativeFileSize, language)} 副本 · 同组还有 ${count} 项`
      : `Kept ${formatLocalizedSize(group.representativeFileSize, language)} copy · ${count} more in group`;
  }

  return language === 'zh-CN'
    ? `保留 ${formatLocalizedDateTime(group.representativeCreationTime, language)} 副本 · 同组还有 ${count} 项`
    : `Kept ${formatLocalizedDateTime(group.representativeCreationTime, language)} copy · ${count} more in group`;
}

export function getDuplicateRepresentativeComparison(
  candidate: CleanupCandidate,
  language: AppLanguage,
) {
  const group = candidate.duplicateGroup;
  if (!group) {
    return null;
  }

  if (group.representativeReason === 'higher-resolution') {
    return language === 'zh-CN'
      ? `已保留 ${formatResolution(group.representativeWidth, group.representativeHeight)} 副本，当前为 ${formatResolution(candidate.asset.width, candidate.asset.height)}。`
      : `Kept ${formatResolution(group.representativeWidth, group.representativeHeight)} while this item is ${formatResolution(candidate.asset.width, candidate.asset.height)}.`;
  }

  if (group.representativeReason === 'larger-file') {
    return language === 'zh-CN'
      ? `已保留 ${formatLocalizedSize(group.representativeFileSize, language)} 副本，当前为 ${formatLocalizedSize(candidate.asset.fileSize, language)}。`
      : `Kept ${formatLocalizedSize(group.representativeFileSize, language)} while this item is ${formatLocalizedSize(candidate.asset.fileSize, language)}.`;
  }

  return language === 'zh-CN'
    ? `已保留拍摄于 ${formatLocalizedDateTime(group.representativeCreationTime, language)} 的副本，当前条目拍摄于 ${formatLocalizedDateTime(candidate.asset.creationTime, language)}。`
    : `Kept the copy captured at ${formatLocalizedDateTime(group.representativeCreationTime, language)} while this item was captured at ${formatLocalizedDateTime(candidate.asset.creationTime, language)}.`;
}

export function getCandidateTitle(kind: CleanupKind, language: AppLanguage) {
  const labels = COPY[language].candidate;

  switch (kind) {
    case 'accidental-video':
      return labels.accidentalVideo;
    case 'abnormal-video':
      return labels.abnormalVideo;
    case 'duplicate-video':
      return labels.duplicateVideo;
    case 'duplicate-photo':
      return labels.duplicatePhoto;
    case 'abnormal-photo':
      return labels.abnormalPhoto;
    case 'accidental-photo':
    default:
      return labels.accidentalPhoto;
  }
}

export function getMediaTypeLabel(mediaType: MediaType, language: AppLanguage) {
  return mediaType === 'video' ? COPY[language].preview.video : COPY[language].preview.photo;
}

function getCompactReasonLabel(reason: string, language: AppLanguage) {
  const compactLabels: Partial<Record<string, Record<AppLanguage, string>>> = {
    '画面明显过暗': { 'zh-CN': '过暗', 'en-US': 'Dark' },
    '缩略图明显过暗': { 'zh-CN': '过暗', 'en-US': 'Dark' },
    '边缘信息很少': { 'zh-CN': '模糊', 'en-US': 'Blurry' },
    '缩略图边缘信息很少': { 'zh-CN': '模糊', 'en-US': 'Blurry' },
    '文件尺寸较小': { 'zh-CN': '低质量', 'en-US': 'Low quality' },
    '视频文件较小': { 'zh-CN': '低质量', 'en-US': 'Low quality' },
    '分辨率较低': { 'zh-CN': '低质量', 'en-US': 'Low quality' },
    '媒体尺寸异常小': { 'zh-CN': '低质量', 'en-US': 'Low quality' },
    '画面接近全黑': { 'zh-CN': '全黑', 'en-US': 'Nearly black' },
    '几乎没有可见内容': { 'zh-CN': '无内容', 'en-US': 'No visible content' },
    '媒体内容分析失败': { 'zh-CN': '识别失败', 'en-US': 'Analysis failed' },
    '媒体文件为空': { 'zh-CN': '空文件', 'en-US': 'Empty file' },
    '媒体元数据异常': { 'zh-CN': '元数据异常', 'en-US': 'Metadata issue' },
    '画面比例异常': { 'zh-CN': '比例异常', 'en-US': 'Odd ratio' },
    '媒体时长异常短': { 'zh-CN': '时长过短', 'en-US': 'Too short' },
    '视频时长极短': { 'zh-CN': '时长过短', 'en-US': 'Too short' },
    '视频时长较短': { 'zh-CN': '时长较短', 'en-US': 'Short' },
    '与其他媒体高度相似': { 'zh-CN': '高度相似', 'en-US': 'Highly similar' },
    '已保留一份更高质量副本': { 'zh-CN': '已保留最佳副本', 'en-US': 'Best copy kept' },
    '曝光过度': { 'zh-CN': '曝光过度', 'en-US': 'Overexposed' },
  };

  return compactLabels[reason]?.[language] ?? translateRiskReason(reason, language);
}

function uniqueLabels(labels: string[]) {
  return Array.from(new Set(labels.filter(Boolean)));
}

export function getDetailViewerTags(candidate: CleanupCandidate, language: AppLanguage) {
  const copy = COPY[language];
  const tags: string[] = [];

  if (candidate.duplicateGroup) {
    if (candidate.duplicateGroup.relation === 'exact') {
      tags.push(copy.candidate.duplicateIssue, copy.preview.duplicateExactTag);
    } else {
      tags.push(
        copy.preview.duplicateSimilarTag,
        copy.preview.duplicateSimilarityTag(Math.round(candidate.duplicateGroup.similarity * 100)),
      );
    }
  } else if (candidate.primaryIssueType === 'accidental') {
    tags.push(copy.candidate.accidentalIssue);
  }

  const compactReasons = candidate.reasons.map((reason) => getCompactReasonLabel(reason, language));
  return uniqueLabels([...tags, ...compactReasons]);
}

export function formatLocalizedDateTime(timestamp: number | null | undefined, language: AppLanguage) {
  if (!timestamp) {
    return COPY[language].common.neverScanned;
  }

  return new Date(timestamp).toLocaleString(language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatLocalizedSize(bytes: number, language: AppLanguage) {
  if (bytes <= 0) {
    return COPY[language].common.unknownSize;
  }

  if (bytes < 1024 * 1024) {
    return `${formatNumber(Math.round(bytes / 1024), language)} KB`;
  }

  return `${formatNumber(bytes / (1024 * 1024), language, 1)} MB`;
}

export function formatLocalizedDuration(seconds: number, language: AppLanguage) {
  return `${formatNumber(seconds, language, 1)} ${COPY[language].candidate.secondUnit}`;
}

export function buildReminderScheduleSummary(
  settings: Pick<ReminderSettings, 'enabled' | 'frequency' | 'weekday' | 'hour' | 'minute'>,
  language: AppLanguage,
) {
  const copy = COPY[language].reminder;
  if (!settings.enabled) {
    return copy.disabledSummary;
  }

  const time = `${settings.hour.toString().padStart(2, '0')}:${settings.minute
    .toString()
    .padStart(2, '0')}`;

  if (settings.frequency === 'daily') {
    return language === 'zh-CN'
      ? `${copy.daily} ${time} 提醒你检查识别结果`
      : `${copy.daily} at ${time} to review recognition results`;
  }

  const weekdayLabel = copy.weekdays[settings.weekday - 1] ?? copy.weekdays[0];
  return language === 'zh-CN'
    ? `${copy.weekly}${weekdayLabel.replace('周', '')} ${time} 提醒你检查识别结果`
    : `${copy.weekly} ${weekdayLabel} at ${time} to review recognition results`;
}

export function buildRecentScanReminderContent(
  latestScan: ScanSummary | null,
  settings: Pick<ReminderSettings, 'hour' | 'minute'> & { summary?: string },
  language: AppLanguage,
) {
  const copy = COPY[language].reminder;
  const reminderTime = `${settings.hour.toString().padStart(2, '0')}:${settings.minute
    .toString()
    .padStart(2, '0')}`;

  if (!latestScan) {
    return {
      title: resolveReminderTitle(settings.summary, language),
      summary: copy.noScanSummary,
      detail: copy.noScanDetail,
    };
  }

  const summary =
    latestScan.candidateCount > 0
      ? language === 'zh-CN'
        ? `最近一次扫描发现 ${latestScan.candidateCount} 个待处理识别结果，建议在 ${reminderTime} 再检查一次。`
        : `The last scan found ${latestScan.candidateCount} recognition results to review. Check again at ${reminderTime}.`
      : language === 'zh-CN'
        ? `最近一次扫描没有发现明显待处理项，建议在 ${reminderTime} 再确认一下相册。`
        : `The last scan found no obvious items to handle. Check the library again at ${reminderTime}.`;

  const detail =
    language === 'zh-CN'
      ? `本次扫描共检查 ${latestScan.scannedCount} 项媒体，其中 ${latestScan.highConfidenceCount} 项高置信度、${latestScan.mediumConfidenceCount} 项中置信度，回收站里还有 ${latestScan.recycleBinCount} 项待处理。`
      : `This scan checked ${latestScan.scannedCount} media items: ${latestScan.highConfidenceCount} high-confidence, ${latestScan.mediumConfidenceCount} medium-confidence, and ${latestScan.recycleBinCount} still waiting in the recycle bin.`;

  return {
    title: resolveReminderTitle(settings.summary, language),
    summary,
    detail,
  };
}
