'use client';

import {
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileWarning,
  Film,
  Home,
  Loader2,
  Maximize2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HomeLoadingSkeleton, ReportLoadingSkeleton } from '@/components/report-loading-skeleton';
import { ScanWorkbench } from '@/components/scan-workbench';
import { SessionHistory } from '@/components/session-history';
import type {
  CleanupPlan,
  Cluster,
  ClusterCategory,
  ReportPayload,
  SessionAsset,
} from '@/lib/report-contract';
import { updateSelectionForAsset, updateSelectionForItem, type SelectionItem } from '@/lib/selection';
import { cn } from '@/lib/utils';

const DEFAULT_PAGE_SIZE = 60;
const PAGE_SIZE_OPTIONS = [60, 120, 240] as const;
const PREVIEW_SLOT_COUNT = 4;
const SHORTCUT_HELP_GROUPS: Array<{
  title: string;
  status: '已接入' | '规划';
  items: Array<{ keys: string[]; description: string }>;
}> = [
  {
    title: '批量选择',
    status: '已接入',
    items: [
      { keys: ['全选'], description: '选中当前页可见候选里的所有文件。' },
      { keys: ['全不选'], description: '取消当前页可见文件的选择，其他页选择不受影响。' },
    ],
  },
  {
    title: '鼠标范围选择',
    status: '已接入',
    items: [
      { keys: ['Shift', 'Click'], description: '按当前页显示顺序，从上次点选候选到当前候选做范围选择。' },
    ],
  },
  {
    title: '鼠标追加选择',
    status: '规划',
    items: [
      { keys: ['Cmd / Ctrl', 'Click'], description: '追加或取消单个候选，不影响已有选择。' },
    ],
  },
  {
    title: '键盘审阅',
    status: '规划',
    items: [
      { keys: ['J / K', '↑ / ↓'], description: '在候选卡片之间移动焦点。' },
      { keys: ['Space'], description: '选中或取消当前焦点候选。' },
      { keys: ['Enter'], description: '打开当前焦点候选的详情。' },
      { keys: ['/'], description: '聚焦搜索框，快速缩小候选范围。' },
      { keys: ['Esc'], description: '关闭详情、清理面板或快捷键说明。' },
    ],
  },
  {
    title: '详情确认',
    status: '已接入',
    items: [
      { keys: ['← / →'], description: '在详情 Gallery 里切换上一张或下一张。' },
      { keys: ['Space'], description: '选中或取消当前正在查看的文件。' },
      { keys: ['Cmd / Ctrl', 'Click'], description: '在详情 Gallery 里追加或取消单张文件选择。' },
      { keys: ['Shift', 'Click'], description: '在详情 Gallery 里按图片顺序范围选择。' },
      { keys: ['C'], description: '只选择当前文件。' },
      { keys: ['A'], description: '全选同组其他文件，保留当前文件。' },
      { keys: ['Esc'], description: '关闭详情弹窗。' },
    ],
  },
];

const CATEGORY_COPY: Record<string, { label: string; description: string }> = {
  duplicate: {
    label: '重复文件',
    description: '内容 hash 完全一致，适合优先确认。',
  },
  near_similar: {
    label: '相似图片',
    description: '视觉 hash 接近，需要人工复核。',
  },
  low_value: {
    label: '低价值',
    description: '低亮度、低对比、模糊或信息量偏低。',
  },
  video: {
    label: '视频',
    description: '视频 metadata 与代表帧分析结果。',
  },
};

interface ReviewItem {
  id: string;
  category: ClusterCategory | 'video';
  title: string;
  description: string;
  assets: SessionAsset[];
  cluster?: Cluster;
  cleanupPlan?: CleanupPlan;
  reasons: string[];
  score?: number;
}

interface BridgeResult {
  mode: string;
  planCount: number;
  assetCount: number;
  actions: Array<{
    planId?: string;
    assetId?: string;
    path?: string;
    assetIds?: string[];
    status: string;
    error?: string;
  }>;
}

interface ReportWorkbenchProps {
  initialSessionPath?: string | null;
  initialPlanPath?: string | null;
}

export function ReportWorkbench({ initialSessionPath = null, initialPlanPath = null }: ReportWorkbenchProps) {
  const [sessionPath, setSessionPath] = useState<string | null>(initialSessionPath);
  const [planPath, setPlanPath] = useState<string | null>(initialPlanPath);
  const [workspaceTab, setWorkspaceTab] = useState<'scan' | 'review'>(initialSessionPath ? 'review' : 'scan');
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(() => new Set());
  const [selectionAnchorItemId, setSelectionAnchorItemId] = useState<string | null>(null);
  const [galleryItem, setGalleryItem] = useState<ReviewItem | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [bridgeResult, setBridgeResult] = useState<BridgeResult | null>(null);
  const [bridgePending, setBridgePending] = useState(false);

  const loadReport = useCallback(async () => {
    if (!sessionPath) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ session: sessionPath });
      if (planPath) params.set('plan', planPath);
      const response = await fetch(`/api/report?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '读取 report 失败');
      }
      setPayload(data as ReportPayload);
      setSelectedAssetIds(new Set());
      setSelectionAnchorItemId(null);
      setBridgeResult(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [planPath, sessionPath]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 600);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const items = useMemo(() => (payload ? buildReviewItems(payload) : []), [payload]);
  const categoryCounts = useMemo(() => buildCategoryCounts(items), [items]);
  const tabs = useMemo(() => buildTabs(categoryCounts), [categoryCounts]);
  const selectedAssetCount = selectedAssetIds.size;
  const selectedGroupCount = useMemo(
    () => items.filter((item) => item.assets.some((asset) => selectedAssetIds.has(asset.id))).length,
    [items, selectedAssetIds],
  );
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeTab !== 'all' && item.category !== activeTab) return false;
      if (!normalized) return true;
      return (
        item.id.toLowerCase().includes(normalized) ||
        item.assets.some((asset) => fileName(asset.uri).toLowerCase().includes(normalized))
      );
    });
  }, [activeTab, items, query]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleStart = pageIndex * pageSize;
  const visibleItems = filteredItems.slice(visibleStart, visibleStart + pageSize);
  const visibleAssetIds = useMemo(
    () => visibleItems.flatMap((item) => item.assets.map((asset) => asset.id)),
    [visibleItems],
  );
  const visibleSelectionItems = useMemo<SelectionItem[]>(
    () => visibleItems.map((item) => ({ id: item.id, assetIds: item.assets.map((asset) => asset.id) })),
    [visibleItems],
  );

  useEffect(() => {
    if (activeTab !== 'all' && !tabs.some((tab) => tab.value === activeTab)) {
      setActiveTab('all');
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const toggleItemAssets = useCallback(
    (item: ReviewItem, range: boolean) => {
      if (item.assets.length === 0) return;
      setSelectedAssetIds((current) => {
        const updated = updateSelectionForItem({
          selectedAssetIds: current,
          orderedItems: visibleSelectionItems,
          targetItemId: item.id,
          anchorItemId: selectionAnchorItemId,
          range,
        });
        setSelectionAnchorItemId(updated.anchorItemId);
        return updated.selectedAssetIds;
      });
    },
    [selectionAnchorItemId, visibleSelectionItems],
  );

  const replaceScopedAssetSelection = useCallback((scopeAssetIds: string[], nextAssetIds: string[]) => {
    const nextAssetIdSet = new Set(nextAssetIds);
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      for (const assetId of scopeAssetIds) next.delete(assetId);
      for (const assetId of nextAssetIdSet) next.add(assetId);
      return next;
    });
  }, []);

  const selectVisibleAssets = useCallback(() => {
    if (visibleAssetIds.length === 0) return;
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      for (const assetId of visibleAssetIds) next.add(assetId);
      return next;
    });
  }, [visibleAssetIds]);

  const clearVisibleAssets = useCallback(() => {
    if (visibleAssetIds.length === 0) return;
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      for (const assetId of visibleAssetIds) next.delete(assetId);
      return next;
    });
  }, [visibleAssetIds]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openGallery = useCallback((item: ReviewItem) => {
    setGalleryItem(item);
    setGalleryIndex(0);
  }, []);

  const runBridge = useCallback(
    async (confirm: boolean) => {
      if (!payload || selectedAssetIds.size === 0) return;
      setBridgePending(true);
      try {
        const response = await fetch('/api/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session: payload.paths.session,
            plan: payload.paths.cleanupPlan,
            assetIds: [...selectedAssetIds],
            confirm,
          }),
        });
        const data = (await response.json()) as BridgeResult;
        if (!response.ok) {
          throw new Error(JSON.stringify(data));
        }
        setBridgeResult(data);
        toast.success(confirm ? '已发送到系统回收站' : 'Dry-run 已完成');
        if (confirm) {
          const removedAssetIds = successfulActionAssetIds(data);
          if (removedAssetIds.size > 0) {
            setPayload((current) => (current ? removeAssetsFromPayload(current, removedAssetIds) : current));
            setSelectedAssetIds((current) => {
              const next = new Set(current);
              for (const assetId of removedAssetIds) next.delete(assetId);
              return next;
            });
            setGalleryItem((current) => {
              if (!current) return current;
              const assets = current.assets.filter((asset) => !removedAssetIds.has(asset.id));
              return assets.length > 0 ? { ...current, assets } : null;
            });
            setGalleryIndex(0);
          }
        }
      } catch (nextError) {
        toast.error(nextError instanceof Error ? nextError.message : String(nextError));
      } finally {
        setBridgePending(false);
      }
    },
    [payload, selectedAssetIds],
  );

  const openReport = useCallback((session: string, cleanupPlan: string) => {
    setSessionPath(session);
    setPlanPath(cleanupPlan);
    setWorkspaceTab('review');
    const params = new URLSearchParams({ session, plan: cleanupPlan });
    window.history.replaceState(null, '', `/?${params.toString()}`);
  }, []);

  const returnHome = useCallback(() => {
    setSessionPath(null);
    setPlanPath(null);
    setPayload(null);
    setError(null);
    setWorkspaceTab('scan');
    setSelectedAssetIds(new Set());
    setSelectionAnchorItemId(null);
    setGalleryItem(null);
    setBridgeResult(null);
    window.history.replaceState(null, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (loading) return sessionPath ? <ReportLoadingSkeleton /> : <HomeLoadingSkeleton />;
  if (!sessionPath) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-5 px-5 py-6">
        <EmptyHeader />
        <WorkspaceTabs value="scan" onValueChange={setWorkspaceTab} reviewDisabled />
        <ScanWorkbench onOpenReport={openReport} />
        <SessionHistory onOpenReport={openReport} />
        <SetupGuide />
      </main>
    );
  }
  if (error || !payload) return <ErrorScreen error={error ?? 'report payload missing'} onRetry={loadReport} />;

  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-5 px-5 pb-28 pt-6">
      <Header payload={payload} onHome={returnHome} onReload={loadReport} />
      <WorkspaceTabs value={workspaceTab} onValueChange={setWorkspaceTab} />

      {workspaceTab === 'scan' ? (
        <>
          <ScanWorkbench onOpenReport={openReport} />
          <SessionHistory onOpenReport={openReport} />
        </>
      ) : (
        <>
          <section className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <MetricCard label="Assets" value={payload.summary.assetCount} caption="图片和视频总数" />
            <MetricCard label="Clusters" value={payload.summary.clusterCount} caption="识别候选组" />
            <MetricCard label="Cleanup Plans" value={payload.summary.cleanupPlanCount} caption="可清理计划" />
            <MetricCard label="Diagnostics" value={payload.summary.diagnosticCount} caption="扫描诊断" />
          </section>

          <Card className="gap-3 py-3">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 px-3">
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  setActiveTab(value);
                  setPageIndex(0);
                }}
              >
                <TabsList className="flex-wrap">
                  {tabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                      <Badge variant="secondary">{tab.count}</Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative min-w-[280px] max-sm:min-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPageIndex(0);
                  }}
                  className="pl-9"
                  placeholder="搜索文件名或 cluster id"
                />
              </div>
            </CardContent>
          </Card>

          {filteredItems.length > 0 ? (
            <PaginationControls
              total={filteredItems.length}
              pageIndex={pageIndex}
              pageSize={pageSize}
              pageCount={pageCount}
              selectedAssetIds={selectedAssetIds}
              visibleAssetIds={visibleAssetIds}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPageIndex(0);
              }}
              onSelectVisible={selectVisibleAssets}
              onClearVisible={clearVisibleAssets}
            />
          ) : null}

          <section className="grid grid-cols-[minmax(0,1fr)_340px] gap-4 max-xl:grid-cols-1">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3">
                {visibleItems.map((item) => (
                  <ReviewCard
                    key={item.id}
                    item={item}
                    checked={item.assets.length > 0 && item.assets.every((asset) => selectedAssetIds.has(asset.id))}
                    partialChecked={
                      item.assets.some((asset) => selectedAssetIds.has(asset.id)) &&
                      !item.assets.every((asset) => selectedAssetIds.has(asset.id))
                    }
                    onToggle={(range) => toggleItemAssets(item, range)}
                    onOpen={() => openGallery(item)}
                  />
                ))}
              </div>
              {filteredItems.length === 0 ? (
                <Card>
                  <CardContent className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                    没有匹配的候选。
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <aside className="flex flex-col gap-4">
              <DiagnosticsPanel payload={payload} />
            </aside>
          </section>

          <CleanupDrawer
            selectedGroupCount={selectedGroupCount}
            selectedAssetCount={selectedAssetCount}
            cleanupHistory={payload.cleanupHistory}
            bridgePending={bridgePending}
            bridgeResult={bridgeResult}
            onDryRun={() => runBridge(false)}
            onTrash={() => runBridge(true)}
            onClear={() => {
              setSelectedAssetIds(new Set());
              setBridgeResult(null);
            }}
          />

          <BackToTopButton visible={showBackToTop} onClick={scrollToTop} />

          <GalleryDialog
            item={galleryItem}
            index={galleryIndex}
            selectedAssetIds={selectedAssetIds}
            onIndexChange={setGalleryIndex}
            onReplaceAssetSelection={replaceScopedAssetSelection}
            onOpenChange={(open) => {
              if (!open) setGalleryItem(null);
            }}
          />
        </>
      )}
    </main>
  );
}

function Header({
  payload,
  onHome,
  onReload,
}: {
  payload: ReportPayload;
  onHome: () => void;
  onReload: () => void;
}) {
  return (
    <header className="rounded-lg border bg-card/95 p-5 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">Media Clean · Local Review</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">清理候选审阅工作台</h1>
          <p className="mt-2 max-w-4xl truncate text-sm text-muted-foreground">
            Session {payload.session.sessionId} · {payload.session.source.root}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShortcutHelpDrawer />
          <Button variant="outline" onClick={onHome}>
            <Home data-icon="inline-start" />
            返回首页
          </Button>
          <Button variant="outline" onClick={onReload}>
            <RefreshCw data-icon="inline-start" />
            刷新
          </Button>
        </div>
      </div>
    </header>
  );
}

function ShortcutHelpDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" aria-label="快捷键帮助" onClick={() => setOpen(true)}>
            <CircleHelp />
            <span className="sr-only">快捷键帮助</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>快捷键帮助</p>
        </TooltipContent>
      </Tooltip>
      <DrawerContent className="max-h-[82vh]">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          <DrawerHeader className="text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle>快捷键与快速操作</DrawerTitle>
                <DrawerDescription>
                  PC 端优先使用筛选、批量选择、鼠标多选和键盘导航完成大规模审阅。
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" aria-label="关闭快捷键帮助">
                  <X />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <ScrollArea className="max-h-[58vh] px-4">
            <div className="grid gap-3 pb-4">
              {SHORTCUT_HELP_GROUPS.map((group) => (
                <section key={group.title} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold">{group.title}</h2>
                    <Badge variant={group.status === '已接入' ? 'secondary' : 'outline'}>{group.status}</Badge>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex flex-col gap-3">
                    {group.items.map((item) => (
                      <ShortcutHelpRow key={`${group.title}-${item.keys.join('-')}`} item={item} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </ScrollArea>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">关闭</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ShortcutHelpRow({ item }: { item: { keys: string[]; description: string } }) {
  return (
    <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1fr)] items-start gap-3 max-sm:grid-cols-1">
      <div className="flex flex-wrap gap-1">
        {item.keys.map((key) => (
          <kbd key={key} className="rounded-md border bg-muted px-2 py-1 font-mono text-[11px] font-medium">
            {key}
          </kbd>
        ))}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
    </div>
  );
}

function BackToTopButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="fixed bottom-24 right-5 z-40 rounded-full shadow-lg max-sm:bottom-28"
          onClick={onClick}
          aria-label="返回顶部"
        >
          <ArrowUp />
          <span className="sr-only">返回顶部</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>返回顶部</p>
      </TooltipContent>
    </Tooltip>
  );
}

function EmptyHeader() {
  return (
    <header className="rounded-lg border bg-card/95 p-5 text-card-foreground shadow-sm">
      <p className="text-sm font-medium text-primary">Media Clean · Local Workbench</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal">扫描与审阅工作台</h1>
      <p className="mt-2 text-sm text-muted-foreground">从本地目录生成 session，再继续确认和清理候选。</p>
    </header>
  );
}

function WorkspaceTabs({
  value,
  onValueChange,
  reviewDisabled = false,
}: {
  value: 'scan' | 'review';
  onValueChange: (value: 'scan' | 'review') => void;
  reviewDisabled?: boolean;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as 'scan' | 'review')}>
      <TabsList>
        <TabsTrigger value="scan">扫描</TabsTrigger>
        <TabsTrigger value="review" disabled={reviewDisabled}>
          审阅
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function MetricCard({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <Card className="min-h-28 gap-2 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div>
        <strong className="block text-3xl font-semibold tracking-normal">{value}</strong>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </div>
    </Card>
  );
}

function PaginationControls({
  total,
  pageIndex,
  pageSize,
  pageCount,
  selectedAssetIds,
  visibleAssetIds,
  onPageIndexChange,
  onPageSizeChange,
  onSelectVisible,
  onClearVisible,
}: {
  total: number;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  selectedAssetIds: Set<string>;
  visibleAssetIds: string[];
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectVisible: () => void;
  onClearVisible: () => void;
}) {
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(total, (pageIndex + 1) * pageSize);
  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageIndex < pageCount - 1;
  const visibleSelectedCount = visibleAssetIds.filter((assetId) => selectedAssetIds.has(assetId)).length;
  const hasVisibleAssets = visibleAssetIds.length > 0;
  const allVisibleSelected = hasVisibleAssets && visibleSelectedCount === visibleAssetIds.length;
  const noVisibleSelected = visibleSelectedCount === 0;

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 px-3 py-2 text-card-foreground shadow-sm backdrop-blur">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          显示 {start}-{end} / {total} · 第 {pageIndex + 1} / {pageCount} 页
        </p>
        <Separator orientation="vertical" className="h-5 max-sm:hidden" />
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onSelectVisible} disabled={!hasVisibleAssets || allVisibleSelected}>
            全选
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearVisible} disabled={noVisibleSelected}>
            全不选
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Button
              key={size}
              variant={size === pageSize ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onPageSizeChange(size)}
            >
              {size}
            </Button>
          ))}
        </div>
        <Separator orientation="vertical" className="h-6 max-sm:hidden" />
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onPageIndexChange(0)} disabled={!canGoPrevious}>
            首页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}
            disabled={!canGoPrevious}
          >
            <ChevronLeft data-icon="inline-start" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageIndexChange(Math.min(pageCount - 1, pageIndex + 1))}
            disabled={!canGoNext}
          >
            下一页
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  item,
  checked,
  partialChecked,
  onToggle,
  onOpen,
}: {
  item: ReviewItem;
  checked: boolean;
  partialChecked: boolean;
  onToggle: (range: boolean) => void;
  onOpen: () => void;
}) {
  const previewAssets = item.assets.slice(0, PREVIEW_SLOT_COUNT);
  const previewSlots = Array.from(
    { length: PREVIEW_SLOT_COUNT },
    (_, index) => previewAssets[index] ?? null,
  );
  return (
    <Card className="gap-3 overflow-hidden p-3 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn('grid gap-1.5', item.assets.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {item.assets.length > 1 ? (
          previewSlots.map((asset, index) =>
            asset ? (
              <MediaTileButton key={asset.id} asset={asset} dense onOpen={onOpen} />
            ) : (
              <EmptyMediaSlot key={`empty-${index}`} />
            ),
          )
        ) : previewAssets[0] ? (
          <MediaTileButton asset={previewAssets[0]} dense onOpen={onOpen} />
        ) : (
          <EmptyMediaSlot />
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{item.title}</Badge>
            {item.score != null ? <Badge variant="outline">score {Math.round(item.score)}</Badge> : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold">{fileName(item.assets[0]?.uri ?? item.id)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.assets.length} 个资产 · {item.description}
          </p>
        </div>
        <Checkbox
          checked={partialChecked ? 'indeterminate' : checked}
          onClick={(event) => onToggle(event.shiftKey)}
          aria-label={`选择 ${item.assets.length} 个文件`}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {partialChecked ? '已选择部分文件' : item.reasons.join(', ') || 'no reason'}
        </p>
        <Button variant="outline" size="sm" onClick={onOpen}>
          详情
        </Button>
      </div>
    </Card>
  );
}

function MediaTileButton({
  asset,
  dense = false,
  onOpen,
}: {
  asset: SessionAsset;
  dense?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onOpen}
      aria-label={`打开 ${fileName(asset.uri)} 详情`}
    >
      <MediaTile asset={asset} dense={dense} />
    </button>
  );
}

function EmptyMediaSlot() {
  return (
    <div className="flex aspect-square items-center justify-center rounded-md border border-dashed bg-muted text-xs text-muted-foreground">
      空位
    </div>
  );
}

function MediaTile({ asset, dense = false }: { asset: SessionAsset; dense?: boolean }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const className = cn(
    'relative overflow-hidden rounded-md border bg-muted',
    dense ? 'aspect-square' : 'aspect-[4/3]',
  );
  if (asset.mediaType === 'video') {
    return (
      <div className={className}>
        {posterFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#141c28] text-white">
            <Film className="size-5" />
          </div>
        ) : (
          <img
            src={videoPosterUrl(asset)}
            alt={`${fileName(asset.uri)} 封面`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setPosterFailed(true)}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/55 px-2 py-1 text-white">
          <Film className="size-4 shrink-0" />
          <span className="truncate text-xs">{formatDuration(asset.duration)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <img
        src={mediaUrl(asset.uri)}
        alt={fileName(asset.uri)}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function shouldIgnoreShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('input, textarea, select, video, [contenteditable="true"]'),
  );
}

function GalleryDialog({
  item,
  index,
  selectedAssetIds,
  onIndexChange,
  onReplaceAssetSelection,
  onOpenChange,
}: {
  item: ReviewItem | null;
  index: number;
  selectedAssetIds: Set<string>;
  onIndexChange: (index: number) => void;
  onReplaceAssetSelection: (scopeAssetIds: string[], nextAssetIds: string[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [gallerySelectionAnchorAssetId, setGallerySelectionAnchorAssetId] = useState<string | null>(null);
  const mediaFrameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const asset = item?.assets[index] ?? item?.assets[0];
  const itemAssetIds = useMemo(() => item?.assets.map((candidate) => candidate.id) ?? [], [item]);
  const otherAssetIds = useMemo(
    () => (asset ? itemAssetIds.filter((assetId) => assetId !== asset.id) : []),
    [asset, itemAssetIds],
  );
  const previous = useCallback(() => {
    if (!item) return;
    onIndexChange((index - 1 + item.assets.length) % item.assets.length);
  }, [index, item, onIndexChange]);
  const next = useCallback(() => {
    if (!item) return;
    onIndexChange((index + 1) % item.assets.length);
  }, [index, item, onIndexChange]);
  const updateGalleryAssetSelection = useCallback(
    (targetAssetId: string, range: boolean) => {
      const updated = updateSelectionForAsset({
        selectedAssetIds,
        orderedAssetIds: itemAssetIds,
        targetAssetId,
        anchorAssetId: gallerySelectionAnchorAssetId,
        range,
      });
      setGallerySelectionAnchorAssetId(updated.anchorAssetId);
      onReplaceAssetSelection(
        itemAssetIds,
        itemAssetIds.filter((assetId) => updated.selectedAssetIds.has(assetId)),
      );
    },
    [gallerySelectionAnchorAssetId, itemAssetIds, onReplaceAssetSelection, selectedAssetIds],
  );
  const selectCurrentAsset = useCallback(() => {
    if (!asset) return;
    setGallerySelectionAnchorAssetId(asset.id);
    onReplaceAssetSelection(itemAssetIds, [asset.id]);
  }, [asset, itemAssetIds, onReplaceAssetSelection]);
  const selectOtherAssets = useCallback(() => {
    if (!asset) return;
    setGallerySelectionAnchorAssetId(asset.id);
    onReplaceAssetSelection(itemAssetIds, otherAssetIds);
  }, [asset, itemAssetIds, onReplaceAssetSelection, otherAssetIds]);
  const requestVideoFullscreen = useCallback(async () => {
    try {
      const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
      if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
      const target = videoRef.current ?? mediaFrameRef.current;
      if (target?.requestFullscreen) {
        await target.requestFullscreen();
        return;
      }
      toast.error('当前浏览器不支持视频全屏');
    } catch {
      toast.error('当前浏览器阻止了视频全屏');
    }
  }, []);

  useEffect(() => {
    setGallerySelectionAnchorAssetId(null);
  }, [item?.id]);

  useEffect(() => {
    if (!item || !asset) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (shouldIgnoreShortcutTarget(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        updateGalleryAssetSelection(asset.id, false);
        return;
      }
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        selectCurrentAsset();
        return;
      }
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectOtherAssets();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    asset,
    item,
    itemAssetIds,
    next,
    onOpenChange,
    previous,
    selectCurrentAsset,
    selectOtherAssets,
    updateGalleryAssetSelection,
  ]);

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[88vh] max-h-[88vh] max-w-4xl flex-col overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{item?.title ?? '媒体详情'}</DialogTitle>
          <DialogDescription>查看识别组内图片和视频详情。</DialogDescription>
        </DialogHeader>
        <div
          ref={mediaFrameRef}
          className="relative flex h-[52vh] min-h-[280px] shrink-0 items-center justify-center bg-[#05080d] max-sm:h-[40vh] max-sm:min-h-[220px]"
        >
          <DialogClose asChild>
            <Button className="absolute right-3 top-3 z-20" variant="secondary" size="icon" aria-label="关闭详情">
              <X />
            </Button>
          </DialogClose>
          {asset?.mediaType === 'video' ? (
            <>
              <Button
                className="absolute left-3 top-3 z-20"
                variant="secondary"
                size="sm"
                onClick={requestVideoFullscreen}
              >
                <Maximize2 data-icon="inline-start" />
                全屏
              </Button>
              <video
                ref={videoRef}
                src={mediaUrl(asset.uri)}
                poster={videoPosterUrl(asset)}
                className="h-full w-full object-contain"
                controls
                preload="metadata"
                playsInline={false}
              />
            </>
          ) : asset ? (
            <img src={mediaUrl(asset.uri)} className="h-full w-full object-contain" alt={fileName(asset.uri)} />
          ) : null}
          {item && item.assets.length > 1 ? (
            <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between">
              <Button variant="secondary" size="icon" onClick={previous} aria-label="上一张">
                <ChevronLeft />
              </Button>
              <Button variant="secondary" size="icon" onClick={next} aria-label="下一张">
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <aside className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-5">
            <div>
              <Badge>{item?.title}</Badge>
              <h2 className="mt-3 break-all text-xl font-semibold">{asset ? fileName(asset.uri) : '媒体详情'}</h2>
              <p className="mt-1 break-all text-xs text-muted-foreground">{asset?.uri}</p>
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">识别原因</p>
              <div className="flex flex-wrap gap-2">
                {item?.reasons.map((reason) => (
                  <Badge key={reason} variant="outline">
                    {reason}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Gallery · 勾选要移除的文件</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                {item?.assets.map((candidate, candidateIndex) => (
                  <div
                    key={candidate.id}
                    className={cn(
                      'overflow-hidden rounded-md border bg-background',
                      candidateIndex === index ? 'border-primary' : 'border-border',
                    )}
                  >
                    <button
                      className="block w-full"
                      aria-label={`查看 ${fileName(candidate.uri)}`}
                      onClick={(event) => {
                        onIndexChange(candidateIndex);
                        if (event.metaKey || event.ctrlKey || event.shiftKey) {
                          updateGalleryAssetSelection(candidate.id, event.shiftKey);
                        }
                      }}
                      onContextMenu={(event) => {
                        if (!event.ctrlKey) return;
                        event.preventDefault();
                        onIndexChange(candidateIndex);
                        updateGalleryAssetSelection(candidate.id, event.shiftKey);
                      }}
                    >
                      <MediaTile asset={candidate} dense />
                    </button>
                    <label className="flex items-center justify-center gap-1 p-1">
                      <Checkbox
                        checked={selectedAssetIds.has(candidate.id)}
                        onClick={(event) => {
                          onIndexChange(candidateIndex);
                          updateGalleryAssetSelection(candidate.id, event.shiftKey);
                        }}
                        onContextMenu={(event) => {
                          if (!event.ctrlKey) return;
                          event.preventDefault();
                          onIndexChange(candidateIndex);
                          updateGalleryAssetSelection(candidate.id, event.shiftKey);
                        }}
                        aria-label={`选择 ${fileName(candidate.uri)}`}
                      />
                    </label>
                  </div>
                ))}
              </div>
              {asset && item ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectOtherAssets}
                    disabled={otherAssetIds.length === 0}
                  >
                    <CheckCircle2 data-icon="inline-start" />
                    全选（不包括当前）
                    <Badge variant="secondary">{otherAssetIds.length}</Badge>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={selectCurrentAsset}
                  >
                    <CheckCircle2 data-icon="inline-start" />
                    当前
                  </Button>
                </div>
              ) : null}
            </div>
            {asset ? (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">媒体信息</p>
                  <div className="grid grid-cols-2 gap-2 text-sm max-sm:grid-cols-1">
                    <Info label="媒体" value={asset.mediaType} />
                    <Info label="尺寸" value={`${asset.width} × ${asset.height}`} />
                    <Info label="大小" value={formatBytes(asset.fileSize)} />
                    <Info label="时长" value={formatDuration(asset.duration)} />
                    <Info label="亮度" value={asset.metrics.brightness.toFixed(3)} />
                    <Info label="模糊" value={asset.metrics.blurScore.toFixed(3)} />
                  </div>
                </div>
              </>
            ) : null}
          </aside>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CleanupDrawer({
  selectedGroupCount,
  selectedAssetCount,
  cleanupHistory,
  bridgePending,
  bridgeResult,
  onDryRun,
  onTrash,
  onClear,
}: {
  selectedGroupCount: number;
  selectedAssetCount: number;
  cleanupHistory: ReportPayload['cleanupHistory'];
  bridgePending: boolean;
  bridgeResult: BridgeResult | null;
  onDryRun: () => void;
  onTrash: () => void;
  onClear: () => void;
}) {
  const disabled = selectedAssetCount === 0 || bridgePending;
  return (
    <Drawer>
      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 px-4 py-3 text-card-foreground shadow-lg backdrop-blur">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-medium">确认与清理</p>
            <p className="truncate text-xs text-muted-foreground">
              已选 {selectedAssetCount} 个文件，涉及 {selectedGroupCount} 个候选组
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:flex-1">
            {cleanupHistory.assetCount > 0 ? (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                历史已清理 {cleanupHistory.assetCount} 个 · {formatBytes(cleanupHistory.fileSize)}
              </Badge>
            ) : null}
            <DrawerTrigger asChild>
              <Button className="shrink-0">
                <Trash2 data-icon="inline-start" />
                打开清理
                {selectedAssetCount > 0 ? <Badge variant="secondary">{selectedAssetCount}</Badge> : null}
              </Button>
            </DrawerTrigger>
          </div>
        </div>
      </div>
      <DrawerContent className="max-h-[82vh]">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          <DrawerHeader className="text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle>确认与清理</DrawerTitle>
                <DrawerDescription>在卡片或详情里勾选具体文件，先 dry-run，再移入系统回收站。</DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" aria-label="关闭清理面板">
                  <X />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <ScrollArea className="max-h-[52vh] px-4">
            <div className="flex flex-col gap-3 pb-4">
              <div className="grid grid-cols-2 gap-2">
                <Info label="涉及候选组" value={String(selectedGroupCount)} />
                <Info label="已选文件" value={String(selectedAssetCount)} />
                <Info label="历史已清理" value={`${cleanupHistory.assetCount} 个`} />
                <Info label="历史释放空间" value={formatBytes(cleanupHistory.fileSize)} />
              </div>
              {bridgeResult ? (
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  <p>
                    {bridgeResult.mode} · {bridgeResult.planCount} plans · {bridgeResult.assetCount} assets
                  </p>
                  <p className="mt-1 truncate">
                    {bridgeResult.actions.filter((action) => action.status === 'failed').length} failed
                  </p>
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <DrawerFooter className="grid grid-cols-[1fr_1fr_auto] gap-2 max-sm:grid-cols-1">
            <Button variant="outline" onClick={onDryRun} disabled={disabled}>
              {bridgePending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <CheckCircle2 data-icon="inline-start" />}
              Dry-run
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={disabled}>
                  <Trash2 data-icon="inline-start" />
                  移入回收站
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认移入系统回收站？</AlertDialogTitle>
                  <AlertDialogDescription>
                    将把 {selectedAssetCount} 个文件移动到系统回收站。这个动作不会永久删除，但会改变本地文件位置。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={onTrash}>确认移入回收站</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" onClick={onClear} disabled={selectedAssetCount === 0}>
              清空
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function DiagnosticsPanel({ payload }: { payload: ReportPayload }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>诊断</CardTitle>
        <CardDescription>扫描和视频抽帧过程中的可审计信息。</CardDescription>
      </CardHeader>
      <CardContent>
        {payload.session.diagnostics?.length ? (
          <ScrollArea className="h-[340px] pr-3">
            <div className="flex flex-col gap-2">
              {payload.session.diagnostics.slice(0, 80).map((diagnostic, index) => (
                <div key={`${diagnostic.code}-${index}`} className="rounded-md bg-muted p-3 text-xs">
                  <p className="font-medium">
                    {diagnostic.code} · {diagnostic.severity}
                  </p>
                  <p className="mt-1 text-muted-foreground">{diagnostic.message}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground">No diagnostics.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value ?? '-'}</p>
    </div>
  );
}

function SetupGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>打开已有 session</CardTitle>
        <CardDescription>发布后通过 mc CLI 打开本地审阅工作台。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <code className="rounded-md bg-muted p-3 text-sm">
          mc report .mc/&lt;session-id&gt;/session.json --open
        </code>
        <p className="text-sm text-muted-foreground">
          开发阶段仍可直接访问 /?session=artifacts/scan/case-full/session.json。
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[960px] items-center justify-center px-5">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="size-5 text-destructive" />
            Report 读取失败
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRetry}>重试</Button>
        </CardContent>
      </Card>
    </main>
  );
}

function buildReviewItems(payload: ReportPayload): ReviewItem[] {
  const assetById = new Map(payload.session.assets.map((asset) => [asset.id, asset]));
  const planByClusterId = new Map(
    (payload.cleanupPlan?.plans ?? payload.session.cleanupPlans).map((plan) => [plan.clusterId, plan]),
  );
  const clusterItems = payload.session.clusters.map((cluster) => {
    const copy = CATEGORY_COPY[cluster.category] ?? {
      label: cluster.category,
      description: '识别候选',
    };
    return {
      id: cluster.id,
      category: cluster.category,
      title: copy.label,
      description: copy.description,
      assets: cluster.assetIds.map((id) => assetById.get(id)).filter(Boolean) as SessionAsset[],
      cluster,
      cleanupPlan: planByClusterId.get(cluster.id),
      reasons: cluster.reasons,
      score: cluster.score,
    };
  });
  const videoClusteredIds = new Set(clusterItems.flatMap((item) => item.assets.map((asset) => asset.id)));
  const videoItems = payload.session.assets
    .filter((asset) => asset.mediaType === 'video' && !videoClusteredIds.has(asset.id))
    .map((asset) => ({
      id: `video-${asset.id}`,
      category: 'video',
      title: CATEGORY_COPY.video.label,
      description: CATEGORY_COPY.video.description,
      assets: [asset],
      reasons: asset.hashes.frameHashes?.length ? ['representative-video-frames'] : ['metadata-only'],
    }));
  return [...clusterItems, ...videoItems];
}

function successfulActionAssetIds(result: BridgeResult) {
  const successStatuses = new Set(['completed', 'trashed']);
  const removed = new Set<string>();
  for (const action of result.actions) {
    if (!successStatuses.has(action.status.toLowerCase())) continue;
    if (action.assetId) removed.add(action.assetId);
    for (const assetId of action.assetIds ?? []) removed.add(assetId);
  }
  return removed;
}

function removeAssetsFromPayload(payload: ReportPayload, removedAssetIds: Set<string>): ReportPayload {
  if (removedAssetIds.size === 0) return payload;

  const removedAssets = payload.session.assets.filter((asset) => removedAssetIds.has(asset.id));
  const assets = payload.session.assets.filter((asset) => !removedAssetIds.has(asset.id));
  const clusters = payload.session.clusters
    .map((cluster) => {
      const assetIds = cluster.assetIds.filter((assetId) => !removedAssetIds.has(assetId));
      return {
        ...cluster,
        assetIds,
        representativeAssetId: assetIds.includes(cluster.representativeAssetId)
          ? cluster.representativeAssetId
          : assetIds[0] ?? cluster.representativeAssetId,
      };
    })
    .filter((cluster) => cluster.assetIds.length >= minimumClusterAssetCount(cluster.category));
  const keptClusterIds = new Set(clusters.map((cluster) => cluster.id));
  const cleanupPlans = payload.session.cleanupPlans
    .map((plan) => ({
      ...plan,
      assetIds: plan.assetIds.filter((assetId) => !removedAssetIds.has(assetId)),
    }))
    .filter((plan) => plan.assetIds.length > 0 && keptClusterIds.has(plan.clusterId));
  const cleanupPlan = payload.cleanupPlan
    ? {
        ...payload.cleanupPlan,
        assets: payload.cleanupPlan.assets.filter((asset) => !removedAssetIds.has(asset.id)),
        plans: payload.cleanupPlan.plans
          .map((plan) => ({
            ...plan,
            assetIds: plan.assetIds.filter((assetId) => !removedAssetIds.has(assetId)),
          }))
          .filter((plan) => plan.assetIds.length > 0 && keptClusterIds.has(plan.clusterId)),
      }
    : null;

  return {
    ...payload,
    session: {
      ...payload.session,
      assets,
      clusters,
      cleanupPlans,
    },
    cleanupPlan,
    cleanupHistory: {
      assetCount: payload.cleanupHistory.assetCount + removedAssets.length,
      fileSize: payload.cleanupHistory.fileSize + removedAssets.reduce((total, asset) => total + asset.fileSize, 0),
    },
    summary: {
      assetCount: assets.length,
      clusterCount: clusters.length,
      cleanupPlanCount: cleanupPlan?.plans.length ?? cleanupPlans.length,
      diagnosticCount: payload.session.diagnostics?.length ?? 0,
    },
  };
}

function minimumClusterAssetCount(category: ClusterCategory) {
  return category === 'duplicate' || category === 'near_similar' ? 2 : 1;
}

function buildCategoryCounts(items: ReviewItem[]) {
  return items.reduce<Record<string, number>>(
    (counts, item) => {
      counts.all += 1;
      counts[item.category] = (counts[item.category] ?? 0) + 1;
      return counts;
    },
    { all: 0 },
  );
}

function buildTabs(counts: Record<string, number>) {
  return [
    { value: 'all', label: 'All', count: counts.all ?? 0 },
    { value: 'duplicate', label: CATEGORY_COPY.duplicate.label, count: counts.duplicate ?? 0 },
    { value: 'near_similar', label: CATEGORY_COPY.near_similar.label, count: counts.near_similar ?? 0 },
    { value: 'low_value', label: CATEGORY_COPY.low_value.label, count: counts.low_value ?? 0 },
    { value: 'video', label: CATEGORY_COPY.video.label, count: counts.video ?? 0 },
  ].filter((tab) => tab.value === 'all' || tab.count > 0);
}

function mediaUrl(uri: string) {
  return `/api/media?uri=${encodeURIComponent(uri)}`;
}

function videoPosterUrl(asset: SessionAsset) {
  const params = new URLSearchParams({
    uri: asset.uri,
    time: String(videoPosterTimestampSeconds(asset.duration)),
  });
  return `/api/media/poster?${params.toString()}`;
}

function videoPosterTimestampSeconds(duration?: number | null) {
  if (!Number.isFinite(duration) || !duration || duration <= 0) return 0.5;
  return Number(Math.min(Math.max(duration * 0.12, 0.5), Math.max(duration - 0.25, 0)).toFixed(3));
}

function fileName(uri: string) {
  try {
    const decoded = decodeURIComponent(uri);
    return decoded.slice(decoded.lastIndexOf('/') + 1) || decoded;
  } catch {
    return uri;
  }
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let next = value;
  let unit = 0;
  while (next >= 1024 && unit < units.length - 1) {
    next /= 1024;
    unit += 1;
  }
  return `${next.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(seconds?: number | null) {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return '--:--';
  const safe = Math.round(seconds);
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}
