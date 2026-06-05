import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tesbo-app-shell flex min-h-screen text-[var(--foreground)]">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="tesbo-page">{children}</div>
      </main>
    </div>
  );
}
