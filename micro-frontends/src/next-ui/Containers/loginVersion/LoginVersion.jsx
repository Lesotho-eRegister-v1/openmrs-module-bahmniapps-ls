import React, { useEffect, useState } from "react";
import "./loginVersion.scss";

const VERSION_URLS = [
  // Preferred: facility config (updateable without rebuilding apps)
  "/bahmni_config/openmrs/apps/home/version.json",
  // Fallback: shipped with Home app (same pattern as old 0.92)
  "version.json",
];

function formatVersion(data) {
  if (!data || !data.day || !data.month || !data.year) {
    return null;
  }
  return `Version :${data.day}-${data.month}-${data.year}`;
}

export function LoginVersion() {
  const [label, setLabel] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      for (const url of VERSION_URLS) {
        try {
          const response = await fetch(url, { credentials: "same-origin" });
          if (!response.ok) {
            continue;
          }
          const data = await response.json();
          const text = formatVersion(data);
          if (text && !cancelled) {
            setLabel(text);
            return;
          }
        } catch (e) {
          // try next URL
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!label) {
    return null;
  }

  return (
    <p id="eregisterversion" className="eregister-version">
      {label}
    </p>
  );
}
