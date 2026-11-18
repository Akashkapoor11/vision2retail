"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TimelineItem = { time_seconds: number; estimated_people_count: number; detection_count: number };

export function ActivityChart({ data }: { data: TimelineItem[] }) {
  const chartData = data.map((item) => ({
    time: `${Math.floor(item.time_seconds / 60)}:${String(Math.floor(item.time_seconds % 60)).padStart(2, "0")}`,
    people: item.estimated_people_count,
    detections: item.detection_count,
  }));

  if (!chartData.length) {
    return <div className="empty-state"><strong>No timeline data yet</strong>Upload and process a video to populate sampled-frame metrics.</div>;
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="peopleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3867f5" stopOpacity={0.23} />
              <stop offset="95%" stopColor="#3867f5" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#edf1f7" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "#929eb0", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={25} />
          <YAxis allowDecimals={false} tick={{ fill: "#929eb0", fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ border: "1px solid #e5ebf3", borderRadius: 10, fontSize: 11 }} />
          <Area type="monotone" dataKey="people" name="Estimated people per sampled frame" stroke="#3867f5" strokeWidth={2.2} fill="url(#peopleFill)" activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="detections" name="Detections in sampled frame" stroke="#18a883" strokeWidth={1.8} fill="transparent" activeDot={{ r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClassCountChart({ counts }: { counts: Record<string, number> }) {
  const data = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  if (!data.length) {
    return <div className="empty-state"><strong>No class breakdown yet</strong>Class counts appear after a video finishes processing.</div>;
  }

  return (
    <div className="chart-wrap" style={{ height: 245 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 10, bottom: 0 }}>
          <CartesianGrid stroke="#edf1f7" strokeDasharray="3 4" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "#929eb0", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={82} tick={{ fill: "#697990", fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ border: "1px solid #e5ebf3", borderRadius: 10, fontSize: 11 }} />
          <Bar dataKey="count" name="Sampled detections" fill="#3867f5" radius={[0, 5, 5, 0]} barSize={17} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
