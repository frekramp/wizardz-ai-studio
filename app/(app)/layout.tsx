import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { Providers } from "@/components/providers";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-svh">
        <Sidebar />
        <div className="flex min-h-svh flex-1 flex-col">
          <TopBar />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
