"use client";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

export default function PortalShell({ role, eyebrow, title, subtitle, children }) {
  const [userLabel, setUserLabel] = useState(role === "admin" ? "Admin" : "Patient");

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("sch_user") || "null");
      if (stored?.name) setUserLabel(stored.name);
    } catch {
      // ignore malformed/missing localStorage value, keep default label
    }
  }, []);

  return (
    <div className="shell">
      <Sidebar role={role} userLabel={userLabel} />
      <main className="main">
        <div className="topbar">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-sub">{subtitle}</p>}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
