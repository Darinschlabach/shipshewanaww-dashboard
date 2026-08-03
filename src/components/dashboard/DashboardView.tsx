"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconBell,
  IconCalendar,
  IconCheckbox,
  IconFileInvoice,
  IconPackage,
  IconTruck,
  IconUsers,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/async";
import {
  addDays,
  enrichCalendarEvent,
} from "@/lib/calendar";
import {
  isActivePo,
  normalizePoDisplayStatus,
} from "@/lib/purchase-orders";
import { type InvoiceRow } from "@/lib/invoices";
import { isActiveQuote } from "@/lib/quotes";
import { formatDateLong } from "@/lib/utils";
import type { CalendarEvent, Job, Lead, PurchaseOrder } from "@/lib/types";

type Priority = "High" | "Medium" | "Low";

type AgendaItem = {
  id: string;
  time: string;
  title: string;
  subtitle: string;
  priority: Priority;
  icon: "alert" | "package" | "invoice" | "truck" | "users" | "calendar";
  sortMinutes: number;
};

type UrgentTask = {
  id: string;
  title: string;
  priority: Priority;
  href: string;
};

type ReminderItem = {
  id: string;
  title: string;
  dueLabel: string;
  href: string;
};

const PRIORITY_STYLES: Record<Priority, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-orange-100 text-orange-700",
  Low: "bg-gray-100 text-gray-600",
};

const MOCK_URGENT_TASKS: UrgentTask[] = [
  {
    id: "t1",
    title: "Review and approve final drawings",
    priority: "High",
    href: "/jobs",
  },
  {
    id: "t2",
    title: "Order cabinet hardware",
    priority: "Medium",
    href: "/purchasing",
  },
  {
    id: "t3",
    title: "Send invoice to Johnson Kitchen",
    priority: "Medium",
    href: "/invoices",
  },
  {
    id: "t4",
    title: "Schedule Miller Office delivery",
    priority: "Low",
    href: "/production",
  },
];

const MOCK_REMINDERS: ReminderItem[] = [
  {
    id: "r1",
    title: "Quarterly taxes due in 5 days",
    dueLabel: formatDateLong(addDays(new Date(), 5).toISOString().slice(0, 10)),
    href: "/dashboard",
  },
  {
    id: "r2",
    title: "Follow up on Anderson Home quote",
    dueLabel: formatDateLong(addDays(new Date(), 2).toISOString().slice(0, 10)),
    href: "/leads",
  },
  {
    id: "r3",
    title: "Review vendor pricing updates",
    dueLabel: formatDateLong(addDays(new Date(), 7).toISOString().slice(0, 10)),
    href: "/purchasing",
  },
];

function formatMinutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${hour12}:00 ${period}`;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return "there";
  return fullName.trim().split(/\s+/)[0] ?? "there";
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">
      {count}
    </span>
  );
}

function AgendaIcon({ type }: { type: AgendaItem["icon"] }) {
  const className = "shrink-0 text-gray-500";
  const size = 18;
  switch (type) {
    case "alert":
      return <IconAlertCircle size={size} className={className} />;
    case "package":
      return <IconPackage size={size} className={className} />;
    case "invoice":
      return <IconFileInvoice size={size} className={className} />;
    case "truck":
      return <IconTruck size={size} className={className} />;
    case "users":
      return <IconUsers size={size} className={className} />;
    default:
      return <IconCalendar size={size} className={className} />;
  }
}

function DashboardSection({
  icon: Icon,
  title,
  count,
  children,
  footerHref,
  footerLabel,
  className,
  fill = false,
}: {
  icon: typeof IconCalendar;
  title: string;
  count?: number;
  children: React.ReactNode;
  footerHref?: string;
  footerLabel?: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-gray-200 bg-white ${className ?? ""}`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-2.5">
        <Icon size={18} className="shrink-0 text-gray-500" stroke={1.5} />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {count != null && count > 0 && <CountBadge count={count} />}
      </div>
      <div
        className={`px-4 py-3 ${fill ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
      >
        {children}
      </div>
      {footerHref && footerLabel && (
        <div className="shrink-0 border-t border-gray-100 px-4 py-2.5">
          <Link
            href={footerHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-burgundy hover:underline"
          >
            {footerLabel}
            <IconArrowRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}

function buildTodayAgenda(
  calendarEvents: CalendarEvent[],
  orders: PurchaseOrder[],
  jobs: Job[],
  leads: Lead[],
  invoices: InvoiceRow[]
): AgendaItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const items: AgendaItem[] = [];

  calendarEvents
    .map((event, index) => enrichCalendarEvent(event, index))
    .filter((event) => event.event_date === today)
    .forEach((event) => {
      items.push({
        id: `cal-${event.id}`,
        time: event.isAllDay
          ? "All day"
          : formatMinutesLabel(event.startMinutes),
        title: event.taskName,
        subtitle:
          event.clientName !== "—"
            ? event.clientName
            : (event.jobNumber ?? "—"),
        priority: "Medium",
        icon: "calendar",
        sortMinutes: event.isAllDay ? 0 : event.startMinutes,
      });
    });

  const pendingPos = orders.filter(
    (po) => isActivePo(po) && normalizePoDisplayStatus(po) === "pending_approval"
  );
  if (pendingPos.length > 0) {
    items.push({
      id: "agenda-po-approve",
      time: "8:30 AM",
      title: "Review & Approve Purchase Orders",
      subtitle: `${pendingPos.length} PO${pendingPos.length === 1 ? "" : "s"} need your approval`,
      priority: "High",
      icon: "alert",
      sortMinutes: 8 * 60 + 30,
    });
  }

  const toOrder = orders.filter((po) => isActivePo(po) && po.status === "not_ordered");
  if (toOrder.length > 0) {
    items.push({
      id: "agenda-order-materials",
      time: "9:15 AM",
      title: "Order Materials",
      subtitle: `${toOrder.length} item${toOrder.length === 1 ? "" : "s"} need to be ordered`,
      priority: "Medium",
      icon: "package",
      sortMinutes: 9 * 60 + 15,
    });
  }

  const openInvoice = invoices.find((inv) => Number(inv.balance) > 0);
  if (openInvoice) {
    items.push({
      id: `agenda-invoice-${openInvoice.id}`,
      time: "10:00 AM",
      title: "Send Invoice to Client",
      subtitle: openInvoice.customer_name,
      priority: "Medium",
      icon: "invoice",
      sortMinutes: 10 * 60,
    });
  }

  const deliveryJob = jobs.find((job) => job.stage === "delivery");
  if (deliveryJob) {
    items.push({
      id: `agenda-delivery-${deliveryJob.id}`,
      time: "1:00 PM",
      title: "Schedule Delivery",
      subtitle: deliveryJob.name,
      priority: "Low",
      icon: "truck",
      sortMinutes: 13 * 60,
    });
  }

  const followUpLead = leads.find(
    (lead) => isActiveQuote(lead.status) && lead.status === "sent"
  );
  if (followUpLead) {
    items.push({
      id: `agenda-quote-${followUpLead.id}`,
      time: "2:30 PM",
      title: "Follow Up on Quote",
      subtitle: followUpLead.customer_name,
      priority: "Medium",
      icon: "users",
      sortMinutes: 14 * 60 + 30,
    });
  }

  return items
    .sort((a, b) => a.sortMinutes - b.sortMinutes)
    .slice(0, 6);
}

export default function DashboardView() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const rangeStart = new Date().toISOString().slice(0, 10);
      const rangeEnd = addDays(new Date(), 21).toISOString().slice(0, 10);

      const [
        { data: userData },
        { data: leadsData },
        { data: jobsData },
        { data: ordersData },
        { data: invoiceData },
        { data: calData },
      ] = await withTimeout(
        Promise.all([
          supabase.auth.getUser(),
          supabase.from("leads").select("*").neq("status", "converted"),
          supabase.from("jobs").select("*"),
          supabase.from("purchase_orders").select("*, jobs(id, name)"),
          supabase
            .from("invoices")
            .select("*")
            .order("invoice_date", { ascending: false }),
          supabase
            .from("calendar_events")
            .select("*, jobs(id, name, created_at, contacts(name))")
            .gte("event_date", rangeStart)
            .lte("event_date", rangeEnd)
            .order("event_date"),
        ]),
        12_000,
        "Dashboard data"
      );

      if (userData.user) {
        try {
          const { data: profile } = await withTimeout(
            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", userData.user.id)
              .maybeSingle(),
            5_000,
            "Profile"
          );
          setUserName(
            profile?.full_name ?? userData.user.email?.split("@")[0] ?? null
          );
        } catch {
          setUserName(userData.user.email?.split("@")[0] ?? null);
        }
      }

      setLeads((leadsData as Lead[]) ?? []);
      setJobs((jobsData as Job[]) ?? []);
      setOrders((ordersData as PurchaseOrder[]) ?? []);
      setInvoices((invoiceData as InvoiceRow[]) ?? []);
      setCalendarEvents((calData as CalendarEvent[]) ?? []);
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const activeLeads = useMemo(
    () => leads.filter((lead) => isActiveQuote(lead.status)),
    [leads]
  );
  const activeOrders = useMemo(() => orders.filter(isActivePo), [orders]);

  const agenda = useMemo(
    () => buildTodayAgenda(calendarEvents, activeOrders, jobs, activeLeads, invoices),
    [calendarEvents, activeOrders, jobs, activeLeads, invoices]
  );

  const urgentTasks = MOCK_URGENT_TASKS;
  const reminders = MOCK_REMINDERS;

  if (loading) {
    return <p className="text-gray-500">Loading dashboard…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {greetingForHour(now.getHours())}, {firstName(userName)}.
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <IconCalendar size={18} className="shrink-0 text-gray-400" />
          <span>{todayLabel}</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
        <div className="min-h-0 xl:col-span-2">
          <DashboardSection
            icon={IconCalendar}
            title="Today's Agenda"
            footerHref="/calendar"
            footerLabel="View full calendar"
            className="h-full min-h-0 overflow-hidden"
            fill
          >
            {agenda.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing on the agenda for today.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {agenda.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="w-16 shrink-0 pt-0.5 text-xs font-medium text-gray-500">
                      {item.time}
                    </span>
                    <AgendaIcon type={item.icon} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.subtitle}</p>
                    </div>
                    <PriorityBadge priority={item.priority} />
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <DashboardSection
            icon={IconAlertTriangle}
            title="Urgent Tasks"
            count={urgentTasks.length}
            footerHref="/jobs"
            footerLabel="View all tasks"
            className="min-h-0 flex-1 overflow-hidden"
            fill
          >
            <ul className="divide-y divide-gray-100">
              {urgentTasks.map((task) => (
                <li key={task.id} className="flex items-start gap-2 py-2.5 first:pt-0 last:pb-0">
                  <IconCheckbox size={16} className="mt-0.5 shrink-0 text-gray-300" />
                  <Link
                    href={task.href}
                    className="min-w-0 flex-1 text-sm text-gray-800 hover:text-burgundy"
                  >
                    {task.title}
                  </Link>
                  <PriorityBadge priority={task.priority} />
                </li>
              ))}
            </ul>
          </DashboardSection>

          <DashboardSection
            icon={IconBell}
            title="Reminders"
            count={reminders.length}
            footerHref="/calendar"
            footerLabel="View all reminders"
            className="min-h-0 flex-1 overflow-hidden"
            fill
          >
            <ul className="divide-y divide-gray-100">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={reminder.href}
                    className="block text-sm text-gray-800 hover:text-burgundy"
                  >
                    {reminder.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-500">{reminder.dueLabel}</p>
                </li>
              ))}
            </ul>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}
