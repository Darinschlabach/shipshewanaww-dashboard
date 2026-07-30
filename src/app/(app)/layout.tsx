import Sidebar from "@/components/Sidebar";
import CalendarReminderWatcher from "@/components/calendar/CalendarReminderWatcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-y-auto bg-white p-5">{children}</main>
      <CalendarReminderWatcher />
    </div>
  );
}
