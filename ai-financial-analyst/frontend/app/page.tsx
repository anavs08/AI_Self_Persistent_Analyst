"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DataSources from "@/components/DataSources";
import MemoryMonitor from "@/components/MemoryMonitor";
import Chat from "@/components/Chat";
import TickerFetch from "@/components/TickerFetch";
import Evaluation from "@/components/Evaluation";

const views: Record<string, React.ComponentType> = {
  data:       DataSources,
  memory:     MemoryMonitor,
  chat:       Chat,
  ticker:     TickerFetch,
  evaluation: Evaluation,
};

export default function Home() {
  const [active, setActive] = useState("data");
  const View = views[active];
  return (
    <div className="grid-bg" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar active={active} onNav={setActive} />
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <View />
      </main>
    </div>
  );
}
