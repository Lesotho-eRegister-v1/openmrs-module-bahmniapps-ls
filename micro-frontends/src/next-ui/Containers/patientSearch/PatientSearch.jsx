import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import "./patientSearch.scss";

const DOMAINS = [
  { id: "local", label: "Local" },
  { id: "national", label: "National" },
];

const EMPTY_FORM = {
  givenName: "",
  familyName: "",
  nationalId: "",
  gender: "",
};

function parseExtraIdentifiers(raw) {
  if (!raw) {
    return {};
  }
  if (typeof raw === "object") {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function normalizeResults(pageOfResults = []) {
  return pageOfResults.map((row) => {
    const extraIdentifiers = parseExtraIdentifiers(row.extraIdentifiers);
    return {
      ...row,
      extraIdentifiers,
      nationalId:
        extraIdentifiers["National ID"] ||
        extraIdentifiers.nationalId ||
        row.nationalId ||
        "",
      ecid: extraIdentifiers.ECID || extraIdentifiers.ecid || "",
    };
  });
}

function hasSearchCriteria(form) {
  return Boolean(
    (form.givenName && form.givenName.trim()) ||
      (form.familyName && form.familyName.trim()) ||
      (form.nationalId && form.nationalId.trim())
  );
}

/** NOTE: react2angular may pass hostApi as undefined initially — always optional-chain. */
export function PatientSearch(props) {
  const initialDomain = props.hostData?.domain || "local";
  const [domain, setDomain] = useState(initialDomain);
  const [form, setForm] = useState(EMPTY_FORM);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importingEcid, setImportingEcid] = useState(null);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (props.hostData?.domain && props.hostData.domain !== domain) {
      setDomain(props.hostData.domain);
    }
  }, [props.hostData?.domain]);

  const canSearch = useMemo(() => hasSearchCriteria(form) && !loading, [form, loading]);

  const changeDomain = (nextDomain) => {
    if (nextDomain === domain) {
      return;
    }
    setDomain(nextDomain);
    setResults([]);
    setError(null);
    setSearched(false);
    setForm(EMPTY_FORM);
    props.hostApi?.onDomainChange?.(nextDomain);
  };

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const clearForm = () => {
    setForm(EMPTY_FORM);
    setResults([]);
    setError(null);
    setSearched(false);
  };

  const runSearch = async (event) => {
    event.preventDefault();
    if (!canSearch) {
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const response = await props.hostApi?.searchNational?.({
        givenName: form.givenName.trim(),
        familyName: form.familyName.trim(),
        nationalId: form.nationalId.trim(),
        gender: form.gender || undefined,
      });
      const page = normalizeResults(response?.pageOfResults || []);
      setResults(page);
    } catch (e) {
      setResults([]);
      setError(
        e?.message ||
          (e?.status === 404
            ? "National MPI endpoint not found on this server (404)."
            : "National search failed. Check MPI connectivity and try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  const importPatient = async (patient) => {
    if (!patient) {
      return;
    }
    setImportingEcid(patient.ecid || patient.identifier || "importing");
    setError(null);
    try {
      await props.hostApi?.importPatient?.(patient);
    } catch (e) {
      setError(e?.message || "Could not import patient from national registry.");
    } finally {
      setImportingEcid(null);
    }
  };

  return (
    <div className="ns-root">
      <div className="ns-domain" role="tablist" aria-label="Patient search domain">
        {DOMAINS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={domain === item.id}
            className={
              "ns-domain__btn" +
              (domain === item.id ? " ns-domain__btn--active" : "")
            }
            onClick={() => changeDomain(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {domain === "national" && (
        <div className="ns-panel">
          <h3 className="ns-panel__title">National patient search</h3>
          <p className="ns-panel__hint">
            Search the national MPI / HIE. Import a match to open or register
            the patient locally.
          </p>

          <form className="ns-form" onSubmit={runSearch}>
            <div className="ns-field">
              <label htmlFor="ns-national-id">National ID</label>
              <input
                id="ns-national-id"
                type="text"
                value={form.nationalId}
                onChange={updateField("nationalId")}
                placeholder="National ID"
                autoComplete="off"
              />
            </div>
            <div className="ns-field">
              <label htmlFor="ns-given-name">First name</label>
              <input
                id="ns-given-name"
                type="text"
                value={form.givenName}
                onChange={updateField("givenName")}
                placeholder="First name"
                autoComplete="off"
              />
            </div>
            <div className="ns-field">
              <label htmlFor="ns-family-name">Surname</label>
              <input
                id="ns-family-name"
                type="text"
                value={form.familyName}
                onChange={updateField("familyName")}
                placeholder="Surname"
                autoComplete="off"
              />
            </div>
            <div className="ns-field">
              <label htmlFor="ns-gender">Gender</label>
              <select
                id="ns-gender"
                value={form.gender}
                onChange={updateField("gender")}
              >
                <option value="">Any</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="ns-actions">
              <button
                type="submit"
                className="ns-btn ns-btn--primary"
                disabled={!canSearch}
              >
                {loading ? "Searching…" : "Search"}
              </button>
              <button
                type="button"
                className="ns-btn ns-btn--ghost"
                onClick={clearForm}
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </form>

          {error && <div className="ns-status ns-status--error">{error}</div>}
          {!error && loading && (
            <div className="ns-status">Searching national registry…</div>
          )}
          {!error && !loading && searched && results.length === 0 && (
            <div className="ns-status">No national matches found.</div>
          )}

          {results.length > 0 && (
            <div className="ns-table-wrap">
              <table className="ns-table">
                <thead>
                  <tr>
                    <th>Identifier</th>
                    <th>National ID</th>
                    <th>Name</th>
                    <th>Surname</th>
                    <th>Gender</th>
                    <th>Age</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((patient, index) => {
                    const key =
                      patient.ecid ||
                      patient.uuid ||
                      patient.identifier ||
                      String(index);
                    const busy =
                      importingEcid &&
                      importingEcid ===
                        (patient.ecid || patient.identifier || "importing");
                    return (
                      <tr key={key}>
                        <td>{patient.identifier || "—"}</td>
                        <td>{patient.nationalId || "—"}</td>
                        <td>{patient.givenName || "—"}</td>
                        <td>{patient.familyName || "—"}</td>
                        <td>{patient.gender || "—"}</td>
                        <td>{patient.age || "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="ns-link"
                            disabled={Boolean(importingEcid)}
                            onClick={() => importPatient(patient)}
                          >
                            {busy ? "Importing…" : "Import"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

PatientSearch.propTypes = {
  hostData: PropTypes.shape({
    domain: PropTypes.string,
  }),
  hostApi: PropTypes.shape({
    onDomainChange: PropTypes.func,
    searchNational: PropTypes.func,
    importPatient: PropTypes.func,
  }),
};
