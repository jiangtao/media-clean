import type {
  CleanupCandidate,
  CleanupConfidence,
  CleanupIssueType,
  CleanupKind,
  DuplicateGroup,
  MediaType,
} from '../domain/recognition/types';
import type { ScanSummary } from '../features/scan/scan-media-library';
import { DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT } from '../features/scan/scan-config';
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
    blurryLabel: string;
    duplicateLabel: string;
    similarLabel: string;
    suggestedCleanupLabel: string;
    suggestedCleanupCaption: string;
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
  splash: {
    brand: string;
    title: string;
    subtitle: string;
    body: string;
  };
  landing: {
    statusTitleGranted: string;
    statusBodyGranted: string;
    statusTitlePending: string;
    statusBodyPending: string;
    heroTitle: string;
    heroBodyGranted: string;
    heroBodyPending: string;
    actionReady: string;
    actionPending: string;
    featurePill: string;
    localOnlyTitle: string;
    localOnlyBody: string;
    mediaSupportTitle: string;
    mediaSupportBody: string;
  };
  settings: {
    loading: string;
    headerTitle: string;
    headerBody: string;
    runtimeTitle: string;
    preferenceTitle: string;
    maintenanceTitle: string;
    languageThemeTitle: string;
    scanRangeTitle: string;
    scanRangeHint: string;
    scanRangeRecentMonths: (months: number) => string;
    scanRangeAllLabel: string;
    followSystemLanguage: (currentLabel: string) => string;
    reminderEnableAction: string;
    reminderDisableAction: string;
    reminderTitle: string;
    lastScanTitle: string;
    cachedDataTitle: string;
    localOnlyNote: string;
    cacheHint: string;
    clearingAction: string;
    clearAction: string;
    clearCache: string;
    clearCacheWithSize: (formattedSize: string) => string;
    currentThemePrefix: string;
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
      scanCurrentBatchRange: (start: string, end: string) => string;
      scanBatchRange: (start: string, end: string) => string;
      scanCompleteTitle: string;
      scanResultSummary: (count: number) => string;
      scanResultFootnote: string;
      scanExhaustedTitle: string;
      scanExhaustedBody: string;
      scanAllCompleteTitle: string;
      scanAllCompleteBody: string;
      continueScan: string;
      selectedItems: (count: number) => string;
      cleanupSelected: string;
      keepSelected: string;
    };
    recycleBin: {
      title: string;
      emptyTitle: string;
      emptyBody: string;
      loading: string;
      selectionToggle: (isAllSelected: boolean) => string;
      pendingSummary: (count: number) => string;
      selectedItems: (count: number) => string;
      cancel: string;
      restore: string;
      delete: string;
      keepAction: string;
      cleanupAction: string;
      releasableSizeLabel: string;
      cleanupHistoryTitle: string;
      cleanupHistoryReleased: (formattedSize: string) => string;
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
    similarVideo: string;
    similarPhoto: string;
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
      kicker: '跨端本地清理',
      title: '相册清理建议',
      description: '本地分批扫描整个相册，识别重复、模糊与相似照片，并通过应用内回收站做安全清理。',
      lastScan: '上次扫描',
      autoCleanupHint: '自动清理只会软删除，高风险操作始终二次确认。',
    },
    summary: {
      scannedLabel: '本次扫描',
      scannedCaption: '最近媒体总数',
      candidatesLabel: '识别结果',
      candidatesCaption: '待人工确认处理',
      blurryLabel: '模糊照片',
      duplicateLabel: '重复照片',
      similarLabel: '相似照片',
      suggestedCleanupLabel: '建议清理',
      suggestedCleanupCaption: '优先复核处理',
      recycleLabel: '保留和清理',
      recycleCaption: '最终决策区',
    },
    controls: {
      rescan: '重新扫描',
      scanning: '扫描中...',
      autoCleanup: '自动清理',
    },
    info: {
      title: '首版识别说明',
      firstLine:
        '当前默认扫描整个相册，并额外保留应用内回收站中的已软删除条目。识别完全在本地完成：模糊与相似内容依赖本地启发式评分，重复内容依赖图片缩略图指纹，以及视频按时长自适应采样的多帧缩略图与元数据近似分组。扫描过程会分批推进，以控制内存占用与机身发热。',
      secondLine: '回收站是应用内软删除，不等同于系统回收站；卸载应用或清空本地存储后，软删除记录可能失效。',
    },
    reminder: {
      title: '定期清理准备',
      genericTitle: '定期清理提醒',
      defaultSummary: '定期检查最近拍摄的照片和视频，优先清理重复、模糊与相似内容。',
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
      channelDescription: '提醒你重新扫描最近媒体并清理重复、模糊与相似内容。',
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
    splash: {
      brand: 'Media Clean',
      title: '智能相册 管理工具',
      subtitle: '智能识别重复、模糊与相似内容',
      body: '本地扫描、识别重复、模糊与相似内容',
    },
    landing: {
      statusTitleGranted: '授权已完成',
      statusBodyGranted: '可开始扫描相册',
      statusTitlePending: '需要媒体权限',
      statusBodyPending: '进入工作区后授权即可开始扫描',
      heroTitle: '本地扫描',
      heroBodyGranted: '识别重复、模糊与相似内容',
      heroBodyPending: '进入工作区后授权，即可识别重复、模糊与相似内容',
      actionReady: '开始扫描',
      actionPending: '进入工作区并授权',
      featurePill: '即将扫描照片与视频',
      localOnlyTitle: '仅在本地分析，不上传任何数据',
      localOnlyBody: '所有识别与清理操作均在本地完成',
      mediaSupportTitle: '支持照片与视频',
      mediaSupportBody: '全面识别，快速定位重复、模糊与相似内容',
    },
    settings: {
      loading: '加载中...',
      headerTitle: '设置',
      headerBody: '统一调整扫描范围、提醒节奏、语言主题与本地缓存，让清理流程保持稳定、连续、可理解。',
      runtimeTitle: '当前状态',
      preferenceTitle: '核心偏好',
      maintenanceTitle: '维护与缓存',
      languageThemeTitle: '语言与主题',
      scanRangeTitle: '扫描范围',
      scanRangeHint: '扫描范围决定首轮扫描窗口，也影响后续提醒节奏与回填范围。',
      scanRangeRecentMonths: (months: number) => `最近 ${months} 个月`,
      scanRangeAllLabel: '全部',
      followSystemLanguage: (currentLabel: string) => `跟随系统（当前：${currentLabel}）`,
      reminderEnableAction: '开启',
      reminderDisableAction: '关闭',
      reminderTitle: '定期提醒',
      lastScanTitle: '上次扫描',
      cachedDataTitle: '缓存数据',
      localOnlyNote: '仅在本地分析，不上传任何数据',
      cacheHint: '清除缓存只会移除本地扫描与分析缓存，不会改变你已保留或已清理的结果。',
      clearingAction: '清除中...',
      clearAction: '清除',
      clearCache: '清除缓存',
      clearCacheWithSize: (formattedSize: string) => `清除缓存 ${formattedSize}`,
      currentThemePrefix: '当前主题: ',
    },
    screens: {
      photoGrid: {
        filterAll: '全部',
        filterPhoto: '照片',
        filterVideo: '视频',
        permissionChecking: '正在检查权限...',
        scanPromptTitle: '本地扫描',
        scanPromptBody: `最近 ${DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT} 个月媒体会在本地分批检查重复、模糊与相似内容，结果直接留在本页。`,
        startScan: '开始扫描',
        scanScopeSummary: (count: number) =>
          count > 0 ? `已选择 ${count} 个媒体` : `最近 ${DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT} 个月媒体`,
        scanScopeHint: `默认先扫描最近 ${DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT} 个月媒体；完成后继续回填更早媒体，直到整库覆盖。离开再回来会自动接回进度。`,
        scanProgressTitle: '本地扫描',
        scanProgressValue: (current: number, total: number) => `${current}/${total}`,
        scanProgressFootnote: '重复、模糊与相似候选会持续留在下方，正常媒体会逐步退场。',
        scanCurrentBatchRange: (start: string, end: string) => `当前扫描批次：${start} - ${end}`,
        scanBatchRange: (start: string, end: string) => `已扫描范围：${start} - ${end}`,
        scanCompleteTitle: '本地扫描',
        scanResultSummary: (count: number) => `发现 ${count} 个待处理媒体`,
        scanResultFootnote: '结果已按本地规则留在当前页面，可继续筛选、查看并决定清理或保留。',
        scanExhaustedTitle: '当前这一批已处理完成',
        scanExhaustedBody: '继续扫描会从上一批之前的更早媒体接着回填；整库已覆盖时，只处理新增或变化媒体。',
        scanAllCompleteTitle: '全部媒体已扫描完成',
        scanAllCompleteBody: '当前媒体库已经完整覆盖；后续只有新增或变化媒体需要重新进入扫描。',
        continueScan: '继续扫描',
        selectedItems: (count) => `已选择 ${count} 项`,
        cleanupSelected: '清理',
        keepSelected: '保留',
      },
      recycleBin: {
        title: '回收站',
        emptyTitle: '这里还没有待最终处理的项目',
        emptyBody: '自动清理或手动移入应用内回收站后的项目，会在这里统一决定保留还是彻底清理。',
        loading: '加载保留和清理…',
        selectionToggle: (isAllSelected: boolean) => (isAllSelected ? '取消全选' : '全选'),
        pendingSummary: (count) => `清理 ${count} 项`,
        selectedItems: (count) => `已选择 ${count} 项`,
        cancel: '取消',
        restore: '恢复',
        delete: '删除',
        keepAction: '保留',
        cleanupAction: '清理',
        releasableSizeLabel: '释放',
        cleanupHistoryTitle: '历史清理',
        cleanupHistoryReleased: (formattedSize: string) => `共释放 ${formattedSize}`,
      },
    },
    filters: {
      all: '全部',
      accidental: '模糊照片',
      abnormal: '相似照片',
      duplicate: '重复照片',
    },
    empty: {
      suggestionsTitle: '当前没有待处理识别结果',
      suggestionsBody: '可以继续扫描，或等待后续引入更强识别规则。',
      recycleTitle: '这里还没有待最终处理的项目',
      recycleBody: '自动清理或手动移入应用内回收站后的项目，会在这里统一决定保留还是彻底清理。',
    },
    actionBar: {
      selectedItems: (count) => `已选中 ${count} 项`,
      restoreSelected: '保留选中',
      cleanupSelected: '选中清理',
      clearSelection: '清空选择',
    },
    alerts: {
      scanFailed: '扫描失败，请重试。',
      initFailed: '初始化失败，请重新授权并扫描。',
      deleteFailedTitle: '删除失败',
      deleteFailedBody: '系统未能完成永久删除，请稍后重试。',
      noAutoCleanupTitle: '暂无自动清理项',
      noAutoCleanupBody: '当前没有可直接建议清理的项目，建议先手动预览后再清理。',
      autoCleanupTitle: '自动清理',
      autoCleanupBody: (count) => `将把 ${count} 个建议清理项目移入应用内回收站，不会立刻永久删除。`,
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
      highConfidence: '建议清理',
      mediumConfidence: '建议复核',
      lowConfidence: '需要确认',
      accidentalVideo: '模糊视频',
      accidentalPhoto: '模糊照片',
      abnormalVideo: '模糊视频',
      abnormalPhoto: '模糊照片',
      similarVideo: '相似视频',
      similarPhoto: '相似照片',
      duplicateVideo: '重复视频',
      duplicatePhoto: '重复照片',
      accidentalIssue: '模糊',
      abnormalIssue: '模糊',
      duplicateIssue: '重复',
      selected: '已选',
      actionable: '可操作',
      noRisk: '当前无明显风险标记',
      recycleHint: '已移入应用内回收站，可保留或彻底删除。',
      previewHint: '点击查看预览，再决定是否清理。',
      unselect: '取消选择',
      addAction: '加入操作',
      scoreUnit: '分',
      secondUnit: '秒',
    },
    preview: {
      title: '媒体预览',
      subtitle: '先确认内容，再决定是否清理',
      clearAction: '清理',
      clearCompactAction: '清理',
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
      restore: '保留当前媒体',
      restoreCompactAction: '保留',
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
      kicker: 'Cross-platform local cleanup',
      title: 'Media Cleanup Suggestions',
      description: 'Scan the whole library locally in batches, find duplicate, blurry, and similar photos, and clean safely through an app-level recycle bin.',
      lastScan: 'Last scan',
      autoCleanupHint: 'Auto cleanup only performs soft delete, and risky actions always require a second confirmation.',
    },
    summary: {
      scannedLabel: 'Scanned',
      scannedCaption: 'recent media checked',
      candidatesLabel: 'Recognition results',
      candidatesCaption: 'ready for review',
      blurryLabel: 'Blurry photos',
      duplicateLabel: 'Duplicate photos',
      similarLabel: 'Similar photos',
      suggestedCleanupLabel: 'Suggested cleanup',
      suggestedCleanupCaption: 'review first',
      recycleLabel: 'Keep & clean',
      recycleCaption: 'final decision zone',
    },
    controls: {
      rescan: 'Scan again',
      scanning: 'Scanning...',
      autoCleanup: 'Auto cleanup',
    },
    info: {
      title: 'MVP Detection Notes',
      firstLine:
        'The current MVP scans the whole library and also keeps app-level recycle-bin entries visible. Detection stays fully on-device: blurry and similar items use local heuristic scoring, while duplicate media uses image thumbnail fingerprints plus duration-adaptive multi-frame video thumbnails and metadata similarity. Scanning advances in batches to keep memory usage and device heat under control.',
      secondLine:
        'The recycle bin is an app-level soft-delete concept, not the system recycle bin. If the app is uninstalled or local storage is cleared, those records may be lost.',
    },
    reminder: {
      title: 'Recurring Cleanup Readiness',
      genericTitle: 'Cleanup Reminder',
      defaultSummary: 'Regularly review recent photos and videos, prioritizing duplicate, blurry, and similar media.',
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
      channelDescription: 'Reminds you to reopen the app, rescan recent media, and clean duplicate, blurry, and similar media.',
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
    splash: {
      brand: 'Media Clean',
      title: 'Smart Album Manager',
      subtitle: 'Detect duplicate, blurry, and similar media',
      body: 'Scan and review duplicate, blurry, and similar items locally.',
    },
    landing: {
      statusTitleGranted: 'Permission granted',
      statusBodyGranted: 'Ready to scan the library',
      statusTitlePending: 'Media permission required',
      statusBodyPending: 'Grant access in the workspace to start scanning',
      heroTitle: 'Local scan',
      heroBodyGranted: 'Find duplicate, blurry, and similar items',
      heroBodyPending: 'Open the workspace, grant access, then find duplicate, blurry, and similar items',
      actionReady: 'Open workspace',
      actionPending: 'Open and grant access',
      featurePill: 'Photos and videos will be included',
      localOnlyTitle: 'Local analysis only, nothing is uploaded',
      localOnlyBody: 'Every recognition and cleanup action stays on the device',
      mediaSupportTitle: 'Supports both photos and videos',
      mediaSupportBody: 'Broader coverage for duplicate, blurry, and similar items',
    },
    settings: {
      loading: 'Loading...',
      headerTitle: 'Settings',
      headerBody: 'Adjust scan range, reminder cadence, language, theme, and local cache so the cleanup flow stays stable, continuous, and understandable.',
      runtimeTitle: 'Current status',
      preferenceTitle: 'Core preferences',
      maintenanceTitle: 'Maintenance & cache',
      languageThemeTitle: 'Language & theme',
      scanRangeTitle: 'Scan Range',
      scanRangeHint: 'The scan range sets the first review window and also affects reminder cadence and backfill scope.',
      scanRangeRecentMonths: (months: number) => `Last ${months} month${months > 1 ? 's' : ''}`,
      scanRangeAllLabel: 'All',
      followSystemLanguage: (currentLabel: string) => `System (${currentLabel})`,
      reminderEnableAction: 'Enable',
      reminderDisableAction: 'Disable',
      reminderTitle: 'Reminders',
      lastScanTitle: 'Last Scan',
      cachedDataTitle: 'Cached Data',
      localOnlyNote: 'Analyzed only on this device. Nothing is uploaded.',
      cacheHint: 'Clearing cache only removes local scan and analysis cache. It does not change items you already kept or cleaned.',
      clearingAction: 'Clearing...',
      clearAction: 'Clear',
      clearCache: 'Clear cache',
      clearCacheWithSize: (formattedSize: string) => `Clear cache ${formattedSize}`,
      currentThemePrefix: 'Current theme: ',
    },
    screens: {
      photoGrid: {
        filterAll: 'All',
        filterPhoto: 'Photos',
        filterVideo: 'Videos',
        permissionChecking: 'Checking permission...',
        scanPromptTitle: 'Local scan',
        scanPromptBody: `Recent media from the last ${DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT} months is checked locally in batches for duplicate, blurry, and similar items, and the results stay on this page.`,
        startScan: 'Start scan',
        scanScopeSummary: (count: number) =>
          count > 0 ? `${count} media selected` : `Recent ${DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT} months`,
        scanScopeHint: `The default scan starts with the last ${DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT} months, then backfills older media until the whole library is covered. Return to the app to reattach to the current progress.`,
        scanProgressTitle: 'Local scan',
        scanProgressValue: (current: number, total: number) => `${current}/${total}`,
        scanProgressFootnote: 'Duplicate, blurry, and similar candidates stay below while normal media gradually drops out.',
        scanCurrentBatchRange: (start: string, end: string) => `Current batch: ${start} - ${end}`,
        scanBatchRange: (start: string, end: string) => `Scanned range: ${start} - ${end}`,
        scanCompleteTitle: 'Local scan',
        scanResultSummary: (count: number) => `Found ${count} items to review`,
        scanResultFootnote: 'Results stay on the page under the local first-pass rules so filtering, review, cleanup, or keep actions can continue immediately.',
        scanExhaustedTitle: 'This batch is fully processed',
        scanExhaustedBody: 'Continuing the scan picks up from media older than the previous batch; once the whole library is covered, only new or changed media is processed.',
        scanAllCompleteTitle: 'All media has been scanned',
        scanAllCompleteBody: 'The current media library is fully covered. Only new or changed media needs another scan later.',
        continueScan: 'Continue scan',
        selectedItems: (count) => `${count} selected`,
        cleanupSelected: 'Clean',
        keepSelected: 'Keep',
      },
      recycleBin: {
        title: 'Recycle bin',
        emptyTitle: 'Nothing is waiting for a final decision yet',
        emptyBody:
          'Items moved into the app recycle bin by auto cleanup or manual cleanup are finalized here: keep or delete forever.',
        loading: 'Loading keep and clean…',
        selectionToggle: (isAllSelected: boolean) => (isAllSelected ? 'Deselect All' : 'Select All'),
        pendingSummary: (count) => `Clean ${count} items`,
        selectedItems: (count) => `${count} selected`,
        cancel: 'Cancel',
        restore: 'Restore',
        delete: 'Delete',
        keepAction: 'Keep',
        cleanupAction: 'Clean',
        releasableSizeLabel: 'Free up',
        cleanupHistoryTitle: 'Cleanup history',
        cleanupHistoryReleased: (formattedSize: string) => `Total freed ${formattedSize}`,
      },
    },
    filters: {
      all: 'All',
      accidental: 'Blurry photos',
      abnormal: 'Similar photos',
      duplicate: 'Duplicate photos',
    },
    empty: {
      suggestionsTitle: 'No recognition results right now',
      suggestionsBody: 'You can scan again later or wait for stronger detection rules in a future version.',
      recycleTitle: 'Nothing is waiting for a final decision yet',
      recycleBody:
        'Items moved into the app recycle bin by auto cleanup or manual cleanup are finalized here: keep or delete forever.',
    },
    actionBar: {
      selectedItems: (count) => `${count} selected`,
      restoreSelected: 'Keep selected',
      cleanupSelected: 'Clean selected',
      clearSelection: 'Clear selection',
    },
    alerts: {
      scanFailed: 'Scan failed. Please try again.',
      initFailed: 'Initialization failed. Re-authorize access and try scanning again.',
      deleteFailedTitle: 'Delete failed',
      deleteFailedBody: 'The system could not finish the permanent delete. Please try again later.',
      noAutoCleanupTitle: 'No auto-cleanup items',
      noAutoCleanupBody: 'There are no items ready for suggested cleanup right now. Preview first before cleaning manually.',
      autoCleanupTitle: 'Auto cleanup',
      autoCleanupBody: (count) => `${count} suggested-cleanup items will be moved into the app recycle bin, without being permanently deleted immediately.`,
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
      highConfidence: 'Suggested cleanup',
      mediumConfidence: 'Review suggested',
      lowConfidence: 'Needs review',
      accidentalVideo: 'Blurry video',
      accidentalPhoto: 'Blurry photo',
      abnormalVideo: 'Blurry video',
      abnormalPhoto: 'Blurry photo',
      similarVideo: 'Similar video',
      similarPhoto: 'Similar photo',
      duplicateVideo: 'Duplicate video',
      duplicatePhoto: 'Duplicate photo',
      accidentalIssue: 'Blurry',
      abnormalIssue: 'Blurry',
      duplicateIssue: 'Duplicate',
      selected: 'Selected',
      actionable: 'Ready',
      noRisk: 'No obvious risk marker',
      recycleHint: 'Already moved to the app recycle bin. You can keep it or delete it permanently.',
      previewHint: 'Open a preview first, then decide whether to clean it.',
      unselect: 'Unselect',
      addAction: 'Add to batch',
      scoreUnit: 'pts',
      secondUnit: 'sec',
    },
    preview: {
      title: 'Media Preview',
      subtitle: 'Confirm the content first, then decide whether to clean it',
      clearAction: 'Clean',
      clearCompactAction: 'Clean',
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
      restore: 'Keep this media',
      restoreCompactAction: 'Keep',
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

export function getCandidateDisplayTitle(candidate: CleanupCandidate, language: AppLanguage) {
  const labels = COPY[language].candidate;
  const isVideo = candidate.asset.mediaType === 'video';

  if (candidate.duplicateGroup?.relation === 'near') {
    return isVideo ? labels.similarVideo : labels.similarPhoto;
  }

  if (candidate.primaryIssueType === 'duplicate') {
    return isVideo ? labels.duplicateVideo : labels.duplicatePhoto;
  }

  return isVideo ? labels.accidentalVideo : labels.accidentalPhoto;
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
  } else {
    tags.push(getIssueTypeLabel(candidate.primaryIssueType, language));
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
      ? `本次扫描共检查 ${latestScan.scannedCount} 项媒体，其中 ${latestScan.highConfidenceCount} 项建议清理、${latestScan.mediumConfidenceCount} 项建议复核，保留和清理页里还有 ${latestScan.recycleBinCount} 项待处理。`
      : `This scan checked ${latestScan.scannedCount} media items: ${latestScan.highConfidenceCount} suggested for cleanup, ${latestScan.mediumConfidenceCount} suggested for review, and ${latestScan.recycleBinCount} still waiting in keep & clean.`;

  return {
    title: resolveReminderTitle(settings.summary, language),
    summary,
    detail,
  };
}
