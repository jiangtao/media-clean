import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  getAppCopy,
  getDuplicateCardSummary,
  getDuplicateRepresentativeComparison,
} from './app-copy';
import type { CleanupCandidate } from '../domain/recognition/types';
import { formatI18nTemplate } from './formatters';
import { loadI18nResources, resolveI18nLocaleDirectory } from './resource-loader';
import { APP_I18N_RESOURCES, I18N_RESOURCE_NAMESPACES } from './resources.generated';

const duplicateCandidate: CleanupCandidate = {
  id: 'duplicate-item',
  asset: {
    id: 'duplicate-item',
    uri: 'file:///duplicate-item.jpg',
    mediaType: 'photo',
    width: 1080,
    height: 1440,
    duration: 0,
    fileSize: 680_000,
    creationTime: new Date('2026-04-16T08:00:00+08:00').getTime(),
  },
  score: 86,
  confidence: 'high',
  kind: 'duplicate-photo',
  primaryIssueType: 'duplicate',
  issueTypes: ['duplicate'],
  reasons: ['与其他媒体高度相似', '已保留一份更高质量副本'],
  duplicateGroup: {
    groupId: 'duplicate-a-b',
    representativeId: 'keep',
    relation: 'exact',
    size: 2,
    similarity: 0.98,
    representativeReason: 'higher-resolution',
    representativeWidth: 3024,
    representativeHeight: 4032,
    representativeFileSize: 4_200_000,
    representativeCreationTime: new Date('2026-04-15T08:00:00+08:00').getTime(),
  },
};

describe('duplicate copy helpers', () => {
  it('builds a compact zh-CN duplicate card summary', () => {
    expect(getDuplicateCardSummary(duplicateCandidate, 'zh-CN')).toBe(
      '保留 3024 × 4032 副本 · 同组还有 1 项',
    );
  });

  it('builds a detailed en-US duplicate comparison', () => {
    expect(getDuplicateRepresentativeComparison(duplicateCandidate, 'en-US')).toBe(
      'Kept 3024 × 4032 while this item is 1080 × 1440.',
    );
  });
});

describe('app copy baseline', () => {
  it('keeps the zh-CN copy facade shape stable for JSON resource migration', () => {
    const copy = getAppCopy('zh-CN');

    expect(copy.languageLabel).toBe('语言');
    expect(copy.languageOptions).toEqual([
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en-US', label: 'English' },
    ]);
    expect(copy.tabs).toMatchObject({
      photos: '照片',
      recycle: '回收站',
      settings: '设置',
    });
    expect(copy.appErrorBoundary).toMatchObject({
      title: '应用遇到渲染错误',
      retry: '重试',
    });
    expect(copy.landing).toMatchObject({
      statusTitleGranted: '授权已完成',
      heroTitle: '本地扫描',
      actionReady: '开始扫描',
      localOnlyTitle: '仅在本地分析，不上传任何数据',
    });
    expect(copy.settings).toMatchObject({
      loading: '加载中...',
      headerTitle: '设置',
      languageThemeTitle: '语言与主题',
      scanRangeAllLabel: '全部',
    });
    expect(copy.components.selectionBar.selectedItems(3)).toBe('已选择 3 张');
    expect(copy.components.scanCounter.scanning('5/10')).toBe('识别中... 5/10');
    expect(copy.components.scanProgress.completedResults(9)).toBe('发现 9 个待处理媒体');
    expect(copy.screens.photoGrid.permissionChecking).toBe('正在检查权限...');
    expect(copy.screens.recycleBin.loading).toBe('加载保留和清理…');
  });

  it('keeps the en-US copy facade shape stable for JSON resource migration', () => {
    const copy = getAppCopy('en-US');

    expect(copy.languageLabel).toBe('Language');
    expect(copy.languageOptions).toEqual([
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en-US', label: 'English' },
    ]);
    expect(copy.tabs).toMatchObject({
      photos: 'Photos',
      recycle: 'Recycle bin',
      settings: 'Settings',
    });
    expect(copy.appErrorBoundary).toMatchObject({
      title: 'The app hit a rendering error',
      retry: 'Retry',
    });
    expect(copy.landing).toMatchObject({
      statusTitleGranted: 'Permission granted',
      heroTitle: 'Local scan',
      actionReady: 'Open workspace',
      localOnlyTitle: 'Local analysis only, nothing is uploaded',
    });
    expect(copy.settings).toMatchObject({
      loading: 'Loading...',
      headerTitle: 'Settings',
      languageThemeTitle: 'Language & theme',
      scanRangeAllLabel: 'All',
    });
    expect(copy.components.selectionBar.selectedItems(3)).toBe('3 selected');
    expect(copy.components.scanCounter.scanning('5/10')).toBe('Scanning... 5/10');
    expect(copy.components.scanProgress.completedResults(9)).toBe('Found 9 items to review');
    expect(copy.screens.photoGrid.permissionChecking).toBe('Checking permission...');
    expect(copy.screens.recycleBin.loading).toBe('Loading keep and clean…');
  });

  it('keeps dynamic copy functions stable before they move to templates', () => {
    const zhCopy = getAppCopy('zh-CN');
    const enCopy = getAppCopy('en-US');

    expect(zhCopy.settings.scanRangeRecentMonths(6)).toBe('最近 6 个月');
    expect(enCopy.settings.scanRangeRecentMonths(6)).toBe('Last 6 months');
    expect(zhCopy.settings.followSystemLanguage('简体中文')).toBe('跟随系统（当前：简体中文）');
    expect(enCopy.settings.followSystemLanguage('English')).toBe('System (English)');
    expect(zhCopy.screens.photoGrid.scanProgressValue(2, 8)).toBe('2/8');
    expect(enCopy.screens.photoGrid.scanProgressValue(2, 8)).toBe('2/8');
    expect(zhCopy.screens.photoGrid.workspaceTitleWithCount('模糊照片', 3)).toBe('模糊照片 (3)');
    expect(enCopy.screens.photoGrid.workspaceTitleWithCount('Blurry', 3)).toBe('Blurry (3)');
    expect(zhCopy.screens.photoGrid.workspaceSelectedSize('12 MB')).toBe('已选 12 MB');
    expect(enCopy.screens.photoGrid.workspaceSelectedSize('12 MB')).toBe('Selected 12 MB');
    expect(zhCopy.screens.photoGrid.selectionModeSelectAll).toBe('全选');
    expect(enCopy.screens.photoGrid.selectionModeDeselectAll).toBe('Deselect All');
    expect(zhCopy.screens.photoGrid.selectionModeSelectedItems(2)).toBe('已选 2 项');
    expect(enCopy.screens.photoGrid.selectionModeSelectedItems(2)).toBe('2 selected');
    expect(zhCopy.screens.photoGrid.stateResultBody(7)).toBe('共识别 7 个媒体');
    expect(enCopy.screens.photoGrid.stateResultBody(7)).toBe('Reviewed 7 media items in this batch');
    expect(zhCopy.screens.photoGrid.entryPermissionGrantedTitle).toBe('授权已完成');
    expect(enCopy.screens.photoGrid.entryPermissionGrantedTitle).toBe('Permission granted');
    expect(zhCopy.screens.recycleBin.pendingSummary(3)).toBe('清理 3 项');
    expect(enCopy.screens.recycleBin.pendingSummary(3)).toBe('Clean 3 items');
  });
});

describe('i18n JSON resources', () => {
  it('keeps zh and en namespace JSON files as the resource source of truth', () => {
    expect(I18N_RESOURCE_NAMESPACES).toEqual([
      'app',
      'components',
      'landing',
      'settings',
      'photo-grid',
      'recycle-bin',
      'cleanup',
      'notifications',
      'recognition',
    ]);

    for (const localeDirectory of ['zh', 'en']) {
      for (const namespace of I18N_RESOURCE_NAMESPACES) {
        expect(
          existsSync(join(process.cwd(), 'src/i18n/locales', localeDirectory, `${namespace}.json`)),
        ).toBe(true);
      }
    }
  });

  it('loads zh-CN and en-US resources from locale aliases', () => {
    expect(resolveI18nLocaleDirectory('zh-CN')).toBe('zh');
    expect(resolveI18nLocaleDirectory('zh-Hans')).toBe('zh');
    expect(resolveI18nLocaleDirectory('en-US')).toBe('en');
    expect(resolveI18nLocaleDirectory('en-GB')).toBe('en');

    expect(loadI18nResources('zh-Hans').landing.heroTitle).toBe('本地扫描');
    expect(loadI18nResources('en-GB').landing.heroTitle).toBe('Local scan');
  });

  it('keeps generated resources as JSON-compatible data without function leaves', () => {
    const visit = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${path}[${index}]`));
        return;
      }

      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, item]) => visit(item, `${path}.${key}`));
        return;
      }

      expect(typeof value, path).toBe('string');
      expect(value, path).not.toBe('');
    };

    visit(APP_I18N_RESOURCES, 'APP_I18N_RESOURCES');
  });
});

describe('i18n resource verification', () => {
  it('accepts the checked-in zh/en resources', () => {
    expect(() => {
      execFileSync(process.execPath, ['scripts/i18n/verify-i18n-resources.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
    }).not.toThrow();
  });

  it('fails with actionable locale namespace key paths for incomplete resources', () => {
    const root = mkdtempSync(join(tmpdir(), 'app-cleaner-i18n-'));
    const zhRoot = join(root, 'zh');
    const enRoot = join(root, 'en');
    mkdirSync(zhRoot, { recursive: true });
    mkdirSync(enRoot, { recursive: true });
    writeFileSync(
      join(zhRoot, 'app.json'),
      JSON.stringify({ title: '标题', empty: '', zhOnly: '只在中文' }),
    );
    writeFileSync(
      join(enRoot, 'app.json'),
      JSON.stringify({ title: 'Title', extra: 'Only in English', empty: 'Empty' }),
    );
    writeFileSync(join(zhRoot, 'settings.json'), JSON.stringify({ title: '设置' }));

    let output = '';
    try {
      execFileSync(process.execPath, ['scripts/i18n/verify-i18n-resources.mjs', '--root', root], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      throw new Error('Expected i18n verification to fail.');
    } catch (error) {
      output = `${(error as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? ''}${
        (error as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ?? ''
      }`;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    expect(output).toContain('[en/app] missing key: zhOnly');
    expect(output).toContain('[zh/app] missing key: extra');
    expect(output).toContain('[en/settings] missing namespace file');
    expect(output).toContain('[zh/app] empty string: empty');
  });

  it('fails when generated resources drift from locale JSON source files', () => {
    const root = mkdtempSync(join(tmpdir(), 'app-cleaner-i18n-'));
    const zhRoot = join(root, 'zh');
    const enRoot = join(root, 'en');
    const outputPath = join(root, 'resources.generated.ts');
    mkdirSync(zhRoot, { recursive: true });
    mkdirSync(enRoot, { recursive: true });
    writeFileSync(join(zhRoot, 'app.json'), JSON.stringify({ title: '标题' }));
    writeFileSync(join(enRoot, 'app.json'), JSON.stringify({ title: 'Title' }));
    writeFileSync(outputPath, '// stale generated output\n');

    let output = '';
    try {
      execFileSync(
        process.execPath,
        [
          'scripts/i18n/verify-i18n-resources.mjs',
          '--root',
          root,
          '--output',
          outputPath,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      throw new Error('Expected i18n verification to fail for stale generated output.');
    } catch (error) {
      output = `${(error as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? ''}${
        (error as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ?? ''
      }`;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    expect(output).toContain('Generated i18n resource output is stale');
  });
});

describe('i18n template formatter', () => {
  it('formats template variables used by dynamic copy facades', () => {
    expect(formatI18nTemplate('最近 {{months}} 个月', { months: 6 })).toBe('最近 6 个月');
    expect(
      formatI18nTemplate('Last {{months}} month{{monthPluralSuffix}}', {
        months: 6,
        monthPluralSuffix: 's',
      }),
    ).toBe('Last 6 months');
  });

  it('throws a clear error when a template variable is missing', () => {
    expect(() => formatI18nTemplate('Clean {{count}} items', {})).toThrow(
      'Missing i18n template value: count',
    );
  });
});
