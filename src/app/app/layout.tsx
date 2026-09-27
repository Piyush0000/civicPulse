import AppShell from "@/components/AppShell";

export default function DashboardLayout({ children }: LayoutProps<"/app">) {
  return <AppShell>{children}</AppShell>;
}
