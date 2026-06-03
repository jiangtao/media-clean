import { ReportWorkbenchActivity } from '@/components/report-workbench-activity';

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  return <ReportWorkbenchActivity initialSessionPath={firstParam(params.session)} initialPlanPath={firstParam(params.plan)} />;
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
