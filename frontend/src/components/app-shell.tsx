import Link from "next/link";
import type { ReactNode } from "react";
import { ApiSourceBanner } from "@/components/api-source-banner";
import {
  BarChart3,
  Database,
  LayoutDashboard,
  ScanEye,
  Settings2,
  ShieldCheck,
  Video,
} from "lucide-react";

type Props = { children: ReactNode; section: "overview" | "analyses"; pageName: string };

export function AppShell({ children, section, pageName }: Props) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" style={{ textDecoration: "none" }}>
          <div className="brand-mark"><ScanEye size={21} strokeWidth={2.3} /></div>
          <div>
            <div className="brand-name">Vision2Retail</div>
            <div className="brand-caption">Store intelligence</div>
          </div>
        </Link>

        <div className="nav-section">Workspace</div>
        <Link href="/" className={`nav-link ${section === "overview" ? "active" : ""}`}>
          <LayoutDashboard size={16} /> Overview
        </Link>
        <Link href="/#recent-analyses" className={`nav-link ${section === "analyses" ? "active" : ""}`}>
          <Video size={16} /> Video analyses
        </Link>
        <Link href="/#platform" className="nav-link" aria-label="Retail insights — coming soon">
          <BarChart3 size={16} /> Retail insights
        </Link>

        <div className="nav-section" style={{ marginTop: 15 }}>System</div>
        <Link href="/#platform" className="nav-link" aria-label="Data pipeline — coming soon"><Database size={16} /> Data pipeline</Link>
        <Link href="/#platform" className="nav-link" aria-label="Configuration — coming soon"><Settings2 size={16} /> Configuration</Link>

        <div className="sidebar-bottom">
          <div className="sidebar-bottom-title"><ShieldCheck size={15} color="#69d3af" /> Local-first processing</div>
          <p>Video files and analytics are stored in your configured local deployment. Use authorized footage only.</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{pageName}</strong></div>
          <div className="topbar-right">
            <div className="system-status"><span className="status-dot" /> Local workspace</div>
            <div className="avatar">V2R</div>
          </div>
        </header>
        <ApiSourceBanner />
        {children}
      </main>
    </div>
  );
}
