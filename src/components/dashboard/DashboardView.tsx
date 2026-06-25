"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconBriefcase,
  IconChevronDown,
  IconFileInvoice,
  IconPackage,
  IconTool,
  IconUsers,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import JobStageBadge from "@/components/JobStageBadge";
import KpiCard from "@/components/dashboard/KpiCard";
import {
  InvoiceBars,
  PipelineFunnel,
  ProductionDonut,
} from "@/components/dashboard/DashboardCharts";
import {
  addDays,
  aggregatePipeline,
  aggregateProduction,
  buildRecentActivity,
  deriveInvoiceMetrics,
  formatActivityTimestamp,
  formatJobNumber,
  formatWeekRange,
  startOfWeek,
} from "@/lib/dashboard";
import {
  enrichCalendarEvent,
  formatTimeRange,
  getCategoryStyles,
} from "@/lib/calendar";
import {
  countByPoDisplayStatus,
  isActivePo,
  sumByPoDisplayStatus,
} from "@/lib/purchase-orders";
import { isActiveQuote, quotePipelineValue } from "@/lib/quotes";
import { formatCurrencyFull } from "@/lib/utils";
import type {
  CalendarEvent,
  Job,
  Lead,
  PurchaseOrder,
} from "@/lib/types";

function DashboardCard({
  title,
  viewHref,
  viewLabel,
  children,
  className,
}: {
  title: string;
  viewHref?: string;
  viewLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-5 ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {viewHref && viewLabel && (
          <Link
            href={viewHref}
            className="text-xs font-medium text-burgundy hover:underline"
          >
            {viewLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export default function DashboardView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [jobs, setJobs] = useState<(Job & { contacts: { name: string } | null })[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [productionJobs, setProductionJobs] = useState<
    { kanban_status: string; job_id: string }[]
  >([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const rangeStart = startOfWeek(new Date()).toISOString().slice(0, 10);
    const rangeEnd = addDays(startOfWeek(new Date()), 14).toISOString().slice(0, 10);

    const [
      { data: leadsData },
      { data: jobsData },
      { data: ordersData },
      { data: prodData },
      { data: calData },
    ] = await Promise.all([
      supabase.from("leads").select("*").neq("status", "converted"),
      supabase.from("jobs").select("*, contacts(name)"),
      supabase.from("purchase_orders").select("*"),
      supabase.from("production_jobs").select("job_id, kanban_status"),
      supabase
        .from("calendar_events")
        .select("*, jobs(id, name, created_at, contacts(name))")
        .gte("event_date", rangeStart)
        .lte("event_date", rangeEnd),
    ]);

    setLeads((leadsData as Lead[]) ?? []);
    setJobs(
      (jobsData as (Job & { contacts: { name: string } | null })[]) ?? []
    );
    setOrders((ordersData as PurchaseOrder[]) ?? []);
    setProductionJobs((prodData as typeof productionJobs) ?? []);
    setCalendarEvents((calData as CalendarEvent[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeLeads = useMemo(
    () => leads.filter((l) => isActiveQuote(l.status)),
    [leads]
  );
  const activeOrders = useMemo(() => orders.filter(isActivePo), [orders]);
  const inProgressJobs = useMemo(
    () => jobs.filter((j) => j.stage !== "complete"),
    [jobs]
  );
  const productionStageJobs = useMemo(
    () => jobs.filter((j) => j.stage === "production"),
    [jobs]
  );
  const deliveryJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.stage === "delivery" ||
          (j.stage === "production" &&
            productionJobs.some(
              (p) =>
                p.job_id === j.id &&
                (p.kanban_status === "ready_for_delivery" ||
                  p.kanban_status === "ready_to_ship")
            ))
      ),
    [jobs, productionJobs]
  );

  const pipeline = useMemo(() => aggregatePipeline(activeLeads), [activeLeads]);
  const pipelineTotal = quotePipelineValue(activeLeads);
  const productionSegments = useMemo(
    () => aggregateProduction(jobs, productionJobs),
    [jobs, productionJobs]
  );
  const productionTotal = productionSegments.reduce((s, seg) => s + seg.count, 0);
  const invoices = useMemo(() => deriveInvoiceMetrics(jobs), [jobs]);
  const activity = useMemo(
    () => buildRecentActivity(activeLeads, jobs, activeOrders),
    [activeLeads, jobs, activeOrders]
  );

  const upcoming = useMemo(() => {
    const weekEnd = addDays(weekStart, 6);
    return calendarEvents
      .map((e, i) => enrichCalendarEvent(e, i))
      .filter((e) => {
        const d = new Date(`${e.event_date}T12:00:00`);
        return d >= weekStart && d <= weekEnd;
      })
      .sort((a, b) => a.startMinutes - b.startMinutes)
      .slice(0, 5);
  }, [calendarEvents, weekStart]);

  const topJobs = useMemo(
    () =>
      [...inProgressJobs]
        .sort((a, b) => Number(b.total_value) - Number(a.total_value))
        .slice(0, 5),
    [inProgressJobs]
  );

  const poOnOrder =
    sumByPoDisplayStatus(activeOrders, "pending_approval") +
    sumByPoDisplayStatus(activeOrders, "on_order") +
    sumByPoDisplayStatus(activeOrders, "partially_received");

  if (loading) {
    return <p className="text-gray-500">Loading dashboard…</p>;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your business"
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {formatWeekRange(weekStart)}
              <IconChevronDown size={16} className="text-gray-400" />
            </button>
            <Link
              href="/leads?new=1"
              className="flex items-center gap-1 rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90"
            >
              + New Quote
              <IconChevronDown size={16} />
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          icon={IconUsers}
          iconClass="text-blue-500"
          label="Quotes"
          count={activeLeads.length}
          countLabel="active quotes"
          value={pipelineTotal}
          valueLabel="Total Pipeline Value"
          href="/leads"
          viewLabel="View quotes →"
        />
        <KpiCard
          icon={IconBriefcase}
          iconClass="text-green-600"
          label="Jobs In Progress"
          count={inProgressJobs.length}
          countLabel="active jobs"
          value={inProgressJobs.reduce((s, j) => s + Number(j.total_value), 0)}
          valueLabel="Total Job Value"
          href="/jobs"
          viewLabel="View jobs →"
        />
        <KpiCard
          icon={IconTool}
          iconClass="text-orange-500"
          label="In Production"
          count={productionStageJobs.length}
          countLabel="in shop"
          value={productionStageJobs.reduce((s, j) => s + Number(j.total_value), 0)}
          valueLabel="Total Value"
          href="/production"
          viewLabel="View production →"
        />
        <KpiCard
          icon={IconPackage}
          iconClass="text-purple-500"
          label="Ready for Delivery"
          count={deliveryJobs.length}
          countLabel="deliveries"
          value={deliveryJobs.reduce((s, j) => s + Number(j.total_value), 0)}
          valueLabel="Total Value"
          href="/production"
          viewLabel="View deliveries →"
        />
        <KpiCard
          icon={IconFileInvoice}
          iconClass="text-violet-600"
          label="Open Invoices"
          count={invoices.openCount}
          countLabel="open"
          value={invoices.totalOpen}
          valueLabel="Total Open"
          href="/jobs"
          viewLabel="View invoices →"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCard
          title="Pipeline Summary"
          viewHref="/leads"
          viewLabel="View pipeline →"
        >
          <PipelineFunnel stages={pipeline} total={pipelineTotal} />
        </DashboardCard>

        <DashboardCard
          title="Production Overview"
          viewHref="/production"
          viewLabel="View production →"
        >
          <ProductionDonut segments={productionSegments} total={productionTotal} />
        </DashboardCard>

        <DashboardCard title="Upcoming This Week">
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing scheduled this week.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((ev) => {
                const styles = getCategoryStyles(ev.category);
                return (
                  <li key={ev.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.border.replace("border-l-", "bg-")}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-900">
                        {ev.taskName}
                        {ev.clientName !== "—" && ` — ${ev.clientName}`}
                        {ev.jobNumber && ` (${ev.jobNumber})`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {ev.isAllDay
                          ? "All day"
                          : formatTimeRange(ev.startMinutes, ev.endMinutes)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/calendar"
            className="mt-4 inline-block text-sm font-medium text-burgundy hover:underline"
          >
            Show all ({calendarEvents.length}) →
          </Link>
        </DashboardCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCard
          title="Top Jobs by Value (In Progress)"
          viewHref="/jobs"
          viewLabel="View all jobs →"
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="pb-2 font-medium">Job</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 text-right font-medium">Value</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {topJobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-burgundy">
                    <Link href={`/jobs/${job.id}`}>{formatJobNumber(job)}</Link>
                  </td>
                  <td className="py-2 text-gray-900">{job.name}</td>
                  <td className="py-2 text-right text-gray-900">
                    {formatCurrencyFull(Number(job.total_value))}
                  </td>
                  <td className="py-2">
                    <JobStageBadge job={job} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardCard>

        <DashboardCard
          title="Purchasing Summary"
          viewHref="/purchasing"
          viewLabel="View purchasing →"
        >
          <ul className="space-y-3 text-sm">
            {(
              [
                ["pending_approval", "Pending Approval"],
                ["on_order", "On Order"],
                ["partially_received", "Partially Received"],
                ["fully_received", "Fully Received"],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className="flex items-center justify-between">
                <span className="text-gray-700">{label}</span>
                <span className="font-medium text-gray-900">
                  {countByPoDisplayStatus(activeOrders, key)} ·{" "}
                  {formatCurrencyFull(sumByPoDisplayStatus(activeOrders, key))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">Total on Order</p>
            <p className="font-semibold text-gray-900">
              {formatCurrencyFull(poOnOrder)}
            </p>
          </div>
        </DashboardCard>

        <DashboardCard title="Invoices Overview">
          <InvoiceBars
            open={invoices.totalOpen}
            overdue={invoices.overdue}
            paidMonth={invoices.paidMonth}
            paidYtd={invoices.paidYtd}
          />
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">Total Sales (YTD)</p>
            <p className="font-semibold text-gray-900">
              {formatCurrencyFull(invoices.paidYtd)}
            </p>
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCard title="Recent Activity" className="lg:col-span-2">
          <ul className="space-y-3">
            {activity.map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  {item.icon === "quote" && <IconUsers size={14} />}
                  {item.icon === "job" && <IconBriefcase size={14} />}
                  {item.icon === "po" && <IconPackage size={14} />}
                  {item.icon === "payment" && <IconFileInvoice size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900">{item.text}</p>
                  <p className="text-xs text-gray-500">
                    {formatActivityTimestamp(item.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard title="Aging of Open Invoices">
          <div className="grid grid-cols-2 gap-4">
            {invoices.aging.map((bucket) => (
              <div key={bucket.label}>
                <p className="text-xs text-gray-500">{bucket.label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatCurrencyFull(bucket.amount)}
                </p>
                <div className={`mt-1 h-0.5 w-8 ${bucket.color.replace("border-", "bg-")}`} />
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">Total Open</p>
            <p className="font-semibold text-gray-900">
              {formatCurrencyFull(invoices.totalOpen)}
            </p>
          </div>
        </DashboardCard>
      </div>
    </>
  );
}
