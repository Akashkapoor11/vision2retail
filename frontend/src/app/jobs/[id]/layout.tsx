import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const short = id.slice(0, 8);
  return {
    title: `Analysis ${short} \u2014 Vision2Retail`,
    description: `Video analysis report for job ${id}. Object detection, tracking, heatmap and activity timeline.`,
  };
}

export default function JobLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}