import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import "./cagRegister.scss";

const EMPTY_CAG = {
  name: "",
  description: "",
  village: "",
  constituency: "",
  district: "",
};

function memberLabel(member) {
  return member.display || member.identifier || member.uuid || "Member";
}

function normalizeMembers(list, activeAttenderUuid, activeVisitPatientUuids) {
  const visitUuids = activeVisitPatientUuids || [];
  const hasActiveVisit = Boolean(activeAttenderUuid);

  return (list || []).map((member) => {
    const onActiveVisit = visitUuids.includes(member.uuid);
    let presentMember =
      member.presentMember !== undefined ? member.presentMember : true;
    let absenteeReason = member.absenteeReason || "";

    if (hasActiveVisit && !onActiveVisit) {
      presentMember = false;
      absenteeReason = absenteeReason || "absent";
    } else if (!hasActiveVisit) {
      presentMember = true;
      absenteeReason = "";
    }

    return {
      ...member,
      presentMember,
      absenteeReason,
    };
  });
}

/** NOTE: react2angular may pass hostApi as undefined initially — always optional-chain. */
export function CagRegister(props) {
  const isNew = Boolean(props.hostData?.isNew);
  const cagUuid = props.hostData?.cagUuid || null;

  const [form, setForm] = useState(EMPTY_CAG);
  const [members, setMembers] = useState([]);
  const [activeAttenderUuid, setActiveAttenderUuid] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [busyPatientUuid, setBusyPatientUuid] = useState(null);
  const [startingVisitUuid, setStartingVisitUuid] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [uuid, setUuid] = useState(cagUuid);

  const visitLocked = Boolean(activeAttenderUuid);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!props.hostApi?.getCag) {
        return;
      }
      if (isNew || !cagUuid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const cag = await props.hostApi.getCag(cagUuid);
        if (cancelled) {
          return;
        }
        const attender = cag?.activeAttenderUuid || "";
        const visitPatientUuids = cag?.activeVisitPatientUuids || [];
        setUuid(cag?.uuid || cagUuid);
        setActiveAttenderUuid(attender);
        setForm({
          name: cag?.name || "",
          description: cag?.description || "",
          village: cag?.village || "",
          constituency: cag?.constituency || "",
          district: cag?.district || "",
        });
        setMembers(
          normalizeMembers(cag?.cagPatientList || [], attender, visitPatientUuids)
        );
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Could not load CAG.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isNew, cagUuid, props.hostApi, props.hostApi?.getCag]);

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePresent = (memberUuid, present) => {
    if (visitLocked) {
      return;
    }
    setMembers((prev) =>
      prev.map((m) =>
        m.uuid === memberUuid
          ? {
              ...m,
              presentMember: present,
              absenteeReason: present ? "" : m.absenteeReason || "",
            }
          : m
      )
    );
  };

  const setAbsenteeReason = (memberUuid, reason) => {
    if (visitLocked) {
      return;
    }
    setMembers((prev) =>
      prev.map((m) =>
        m.uuid === memberUuid ? { ...m, absenteeReason: reason } : m
      )
    );
  };

  const saveCag = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("CAG name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        village: form.village.trim(),
        constituency: form.constituency.trim(),
        district: form.district.trim(),
        cagPatientList: members.map((m) => ({
          uuid: m.uuid,
          display: memberLabel(m),
        })),
      };
      const saved = await props.hostApi?.saveCag?.(payload, uuid);
      setInfo("Saved.");
      if (saved?.uuid) {
        setUuid(saved.uuid);
        props.hostApi?.afterSave?.(saved.uuid);
      }
    } catch (e) {
      setError(e?.message || "Could not save CAG.");
    } finally {
      setSaving(false);
    }
  };

  const searchPatients = async (event) => {
    if (event) {
      event.preventDefault();
    }
    if (!patientQuery.trim()) {
      return;
    }
    setError(null);
    try {
      const results =
        (await props.hostApi?.searchPatients?.(patientQuery.trim())) || [];
      setPatientSuggestions(results);
      if (!results.length) {
        setInfo("No patients found.");
      } else {
        setInfo(null);
      }
    } catch (e) {
      setPatientSuggestions([]);
      setError(e?.message || "Patient search failed.");
    }
  };

  const addMember = async (patient) => {
    if (!patient?.uuid) {
      return;
    }
    if (members.some((m) => m.uuid === patient.uuid)) {
      setInfo("Patient is already in this CAG.");
      return;
    }
    const display =
      patient.display ||
      [patient.identifier, patient.givenName, patient.familyName]
        .filter(Boolean)
        .join(" - ") ||
      patient.uuid;

    if (!uuid) {
      setMembers((prev) =>
        prev.concat([
          {
            uuid: patient.uuid,
            display,
            presentMember: true,
            absenteeReason: "",
          },
        ])
      );
      setPatientSuggestions([]);
      setPatientQuery("");
      setInfo("Member added. Save the CAG to keep changes.");
      return;
    }

    setBusyPatientUuid(patient.uuid);
    setError(null);
    try {
      await props.hostApi?.addMember?.(uuid, patient.uuid);
      setMembers((prev) =>
        prev.concat([
          {
            uuid: patient.uuid,
            display,
            presentMember: true,
            absenteeReason: "",
          },
        ])
      );
      setPatientSuggestions([]);
      setPatientQuery("");
      setInfo("Member added.");
    } catch (e) {
      setError(e?.message || "Could not add member.");
    } finally {
      setBusyPatientUuid(null);
    }
  };

  const removeMember = async (member) => {
    if (!member?.uuid || visitLocked) {
      return;
    }
    if (!uuid) {
      setMembers((prev) => prev.filter((m) => m.uuid !== member.uuid));
      return;
    }
    setBusyPatientUuid(member.uuid);
    setError(null);
    try {
      await props.hostApi?.removeMember?.(member.uuid);
      setMembers((prev) => prev.filter((m) => m.uuid !== member.uuid));
      setInfo("Member removed.");
    } catch (e) {
      setError(e?.message || "Could not remove member.");
    } finally {
      setBusyPatientUuid(null);
    }
  };

  const startVisit = async (member) => {
    if (!uuid || !member?.uuid || !member.presentMember || visitLocked) {
      return;
    }
    setStartingVisitUuid(member.uuid);
    setError(null);
    setInfo(null);
    try {
      await props.hostApi?.startVisit?.(uuid, member.uuid, members);
    } catch (e) {
      setError(e?.message || "Could not start CAG visit.");
      setStartingVisitUuid(null);
    }
  };

  const enterVisit = (member) => {
    if (!member?.uuid) {
      return;
    }
    props.hostApi?.enterVisit?.(member.uuid);
  };

  if (loading) {
    return (
      <div className="cag-page">
        <div className="cag-message">Loading CAG…</div>
      </div>
    );
  }

  return (
    <div className="cag-page">
      <div className="cag-topbar">
        <button
          type="button"
          className="cag-link-btn"
          onClick={() => props.hostApi?.backToSearch?.()}
        >
          ← Back to search
        </button>
      </div>

      <form className="cag-shell" onSubmit={saveCag}>
        <section className="cag-section">
          <h2 className="cag-section__title">
            {uuid ? "Edit CAG" : "Create New CAG"}
          </h2>

          <div className="cag-row">
            <label className="cag-label" htmlFor="cag-name">
              CAG Name
            </label>
            <div className="cag-control">
              <input
                id="cag-name"
                type="text"
                value={form.name}
                onChange={updateField("name")}
                required
              />
            </div>
          </div>

          <div className="cag-row">
            <label className="cag-label" htmlFor="cag-description">
              CAG Description
            </label>
            <div className="cag-control">
              <textarea
                id="cag-description"
                value={form.description}
                onChange={updateField("description")}
                placeholder="CAG description"
              />
            </div>
          </div>
        </section>

        <section className="cag-section">
          <h2 className="cag-section__title">Address Information</h2>

          <div className="cag-row">
            <label className="cag-label" htmlFor="cag-village">
              Village
            </label>
            <div className="cag-control">
              <input
                id="cag-village"
                type="text"
                value={form.village}
                onChange={updateField("village")}
              />
            </div>
          </div>

          <div className="cag-row">
            <label className="cag-label" htmlFor="cag-constituency">
              Constituency
            </label>
            <div className="cag-control">
              <input
                id="cag-constituency"
                type="text"
                value={form.constituency}
                onChange={updateField("constituency")}
              />
            </div>
          </div>

          <div className="cag-row">
            <label className="cag-label" htmlFor="cag-district">
              District
            </label>
            <div className="cag-control">
              <input
                id="cag-district"
                type="text"
                value={form.district}
                onChange={updateField("district")}
              />
            </div>
          </div>
        </section>

        <section className="cag-section">
          <h2 className="cag-section__title">
            CAG Members List{" "}
            {uuid && members.length > 0 && (
              <span className="cag-note">
                (Note: If member absent for visit, turn toggle off)
              </span>
            )}
          </h2>

          {members.length === 0 ? (
            <div className="cag-message">No members yet.</div>
          ) : (
            <ul className="cag-member-list">
              {members.map((member) => {
                const isAttender = activeAttenderUuid === member.uuid;
                const showStart =
                  uuid && member.presentMember && !visitLocked;
                const showEnter =
                  uuid && member.presentMember && isAttender;
                const showRefill =
                  uuid &&
                  member.presentMember &&
                  visitLocked &&
                  !isAttender;
                const showAbsentReason = uuid && !member.presentMember;

                return (
                  <li key={member.uuid} className="cag-member-row">
                    {uuid && (
                      <label className="cag-switch">
                        <input
                          type="checkbox"
                          checked={Boolean(member.presentMember)}
                          disabled={visitLocked}
                          onChange={(e) =>
                            togglePresent(member.uuid, e.target.checked)
                          }
                        />
                        <span className="cag-switch__slider" />
                      </label>
                    )}

                    <button
                      type="button"
                      className="cag-member-name"
                      onClick={() => props.hostApi?.openPatient?.(member.uuid)}
                    >
                      {memberLabel(member)}
                    </button>

                    <div className="cag-member-actions">
                      {showStart && (
                        <button
                          type="button"
                          className="cag-visit-btn"
                          disabled={startingVisitUuid === member.uuid}
                          onClick={() => startVisit(member)}
                        >
                          {startingVisitUuid === member.uuid
                            ? "Starting…"
                            : "Start Visit (Present Member)"}
                        </button>
                      )}
                      {showEnter && (
                        <button
                          type="button"
                          className="cag-visit-btn"
                          onClick={() => enterVisit(member)}
                        >
                          Enter Present Member Visit Details
                        </button>
                      )}
                      {showRefill && (
                        <p className="cag-refill">
                          Sent Present Member for refill
                        </p>
                      )}
                      {showAbsentReason && (
                        <input
                          type="text"
                          className="cag-absent-reason"
                          value={member.absenteeReason || ""}
                          disabled={visitLocked}
                          placeholder="Reason Absent for visit"
                          onChange={(e) =>
                            setAbsenteeReason(member.uuid, e.target.value)
                          }
                        />
                      )}
                    </div>

                    {!visitLocked && (
                      <button
                        type="button"
                        className="cag-remove"
                        disabled={busyPatientUuid === member.uuid}
                        onClick={() => removeMember(member)}
                        title="Remove"
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!visitLocked && (
            <div className="cag-add-member">
              <label className="cag-add-label" htmlFor="cag-patient-query">
                Add Patient to CAG List
              </label>
              <div className="cag-add-row">
                <input
                  id="cag-patient-query"
                  type="text"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Search patient"
                />
                <button
                  type="button"
                  className="cag-add-btn"
                  onClick={searchPatients}
                >
                  +
                </button>
              </div>
              {patientSuggestions.length > 0 && (
                <ul className="cag-suggestions">
                  {patientSuggestions.map((patient) => (
                    <li key={patient.uuid}>
                      <button
                        type="button"
                        disabled={busyPatientUuid === patient.uuid}
                        onClick={() => addMember(patient)}
                      >
                        {patient.identifier || "—"} — {patient.givenName}{" "}
                        {patient.familyName}
                        {patient.age != null ? ` (${patient.age} yrs)` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <div className="cag-footer">
          <button type="submit" className="cag-save" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      {error && <div className="cag-message cag-message--error">{error}</div>}
      {info && !error && (
        <div className="cag-message cag-message--ok">{info}</div>
      )}
    </div>
  );
}

CagRegister.propTypes = {
  hostData: PropTypes.shape({
    isNew: PropTypes.bool,
    cagUuid: PropTypes.string,
  }),
  hostApi: PropTypes.shape({
    getCag: PropTypes.func,
    saveCag: PropTypes.func,
    searchPatients: PropTypes.func,
    addMember: PropTypes.func,
    removeMember: PropTypes.func,
    startVisit: PropTypes.func,
    enterVisit: PropTypes.func,
    openPatient: PropTypes.func,
    afterSave: PropTypes.func,
    backToSearch: PropTypes.func,
  }),
};
