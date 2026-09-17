import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import "./loginVersion.scss";

const VERSION_URLS = [
  "/bahmni_config/openmrs/apps/home/version.json",
  "/bahmni/home/version.json",
];

function formatVersion(data) {
  if (!data || !data.day || !data.month || !data.year) {
    return null;
  }
  return `Version :${data.day}-${data.month}-${data.year}`;
}

/** NOTE: react2angular may omit props at start — keep PropTypes so the bridge mounts. */
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

LoginVersion.propTypes = {
  hostData: PropTypes.object,
  hostApi: PropTypes.object,
};
