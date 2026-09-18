'use strict';

angular.module('bahmni.registration')
    .service('cagService', ['$http', '$q', function ($http, $q) {
        var baseUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL + '/cag';
        var cagPatientUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL + '/cagPatient';
        var cagVisitUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL + '/cagVisit';

        // Same concept/visit UUIDs used by the old CAG registration visit flow
        var VISIT_TYPE_UUID = "da0fffe2-a9c9-489a-b9b0-a5405032c465";
        var ENCOUNTER_TYPE_UUID = "81888515-3f10-11e4-adec-0800271c1b75";
        var REGISTRATION_CONCEPT_UUID = "84f626d0-3f10-11e4-adec-0800271c1b75";
        var PATIENT_TYPE_CONCEPT_UUID = "9b1fa8e6-8209-4fcd-abd2-142887fc83e0";
        var HTC_PATIENT_CODED_UUID = "a3e3fdfe-e03c-401d-a3fd-1c2553fefe53";
        var HTC_BUDDY_CODED_UUID = "60c86ea4-5a2d-4d72-8190-32e47d06e0fa";
        var NO_SIGNS_CONCEPT_UUID = "4a2cec08-4512-4635-b1de-b3b698f56346";
        var NO_SIGNS_CODED_UUID = "562fee67-96c5-4b80-ba02-ba8805a28693";
        var BP_SYSTOLIC_UUID = "c36e9c8b-3f10-11e4-adec-0800271c1b75";
        var BP_DIASTOLIC_UUID = "c379aa1d-3f10-11e4-adec-0800271c1b75";
        var PULSE_UUID = "90f53912-95d5-4b5c-a9eb-81f3f937225e";

        var getAll = function () {
            return $http.get(baseUrl, {
                params: {v: 'full'},
                withCredentials: true
            }).then(function (response) {
                return (response.data && response.data.results) || [];
            });
        };

        var getByUuid = function (uuid) {
            return $http.get(baseUrl + '/' + uuid, {
                params: {v: 'full'},
                withCredentials: true
            }).then(function (response) {
                return response.data;
            });
        };

        // CAG module often persists successfully then 500s while serializing
        // Person <-> User creator graphs in the response body.
        var recoverAfterSaveSerializationFailure = function (error, cag, uuid) {
            if (!error || error.status !== 500) {
                return $q.reject(error);
            }
            if (uuid) {
                return getByUuid(uuid);
            }
            if (cag && cag.name) {
                return getAll().then(function (results) {
                    var match = _.find(results, function (item) {
                        return item && item.name === cag.name;
                    });
                    return match ? match : $q.reject(error);
                });
            }
            return $q.reject(error);
        };

        var save = function (cag, uuid) {
            var url = uuid ? (baseUrl + '/' + uuid) : baseUrl;
            return $http.post(url, cag, {
                withCredentials: true,
                // CAG module often 500s on response serialization after a successful write
                disableErrors: true,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).then(function (response) {
                return response.data;
            }, function (error) {
                return recoverAfterSaveSerializationFailure(error, cag, uuid);
            });
        };

        var addPatient = function (cagUuid, patientUuid) {
            return $http.post(cagPatientUrl, {
                cag: {uuid: cagUuid},
                patient: {uuid: patientUuid}
            }, {
                withCredentials: true,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).then(function (response) {
                return response.data;
            });
        };

        var removePatient = function (patientUuid) {
            return $http.delete(cagPatientUrl + '/' + patientUuid, {
                withCredentials: true
            });
        };

        var getActiveVisitByAttender = function (patientUuid) {
            return $http.get(cagVisitUrl, {
                params: {
                    attenderuuid: patientUuid,
                    isactive: true
                },
                withCredentials: true
            }).then(function (response) {
                var results = (response.data && response.data.results) || [];
                return results.length ? results[0] : null;
            });
        };

        var closeVisit = function (cagVisitUuid) {
            var dateStopped = new Date().toISOString().slice(0, 19).replace("T", " ");
            return $http.post(cagVisitUrl + '/' + cagVisitUuid, {
                dateStopped: dateStopped
            }, {
                withCredentials: true,
                // Same CAG module response-serialization 500 as save
                disableErrors: true,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).then(function (response) {
                return response.data;
            }, function (error) {
                if (error && error.status === 500) {
                    return {uuid: cagVisitUuid, dateStopped: dateStopped, isActive: false};
                }
                return $q.reject(error);
            });
        };

        var buildPresentVisit = function (patientUuid, locationUuid, dateStarted) {
            return {
                patient: {uuid: patientUuid},
                visitType: VISIT_TYPE_UUID,
                location: {uuid: locationUuid},
                startDatetime: dateStarted,
                encounters: [{
                    encounterDatetime: dateStarted,
                    encounterType: ENCOUNTER_TYPE_UUID,
                    patient: patientUuid,
                    location: locationUuid,
                    obs: [{
                        concept: {conceptId: 55, uuid: REGISTRATION_CONCEPT_UUID},
                        obsDatetime: dateStarted,
                        person: {uuid: patientUuid},
                        location: {uuid: locationUuid},
                        groupMembers: [
                            {
                                concept: {conceptId: 4964, uuid: PATIENT_TYPE_CONCEPT_UUID},
                                valueCoded: HTC_PATIENT_CODED_UUID,
                                valueCodedName: "HTC, Patient",
                                obsDatetime: dateStarted,
                                person: {uuid: patientUuid},
                                location: {uuid: locationUuid}
                            },
                            {
                                concept: {conceptId: 3710, uuid: NO_SIGNS_CONCEPT_UUID},
                                valueCoded: NO_SIGNS_CODED_UUID,
                                valueCodedName: "No signs",
                                obsDatetime: dateStarted,
                                person: {uuid: patientUuid},
                                location: {uuid: locationUuid}
                            },
                            {
                                concept: {conceptId: 128, uuid: BP_SYSTOLIC_UUID},
                                valueNumeric: 120,
                                obsDatetime: dateStarted,
                                person: {uuid: patientUuid},
                                location: {uuid: locationUuid}
                            },
                            {
                                concept: {conceptId: 131, uuid: BP_DIASTOLIC_UUID},
                                valueNumeric: 73,
                                obsDatetime: dateStarted,
                                person: {uuid: patientUuid},
                                location: {uuid: locationUuid}
                            },
                            {
                                concept: {conceptId: 2086, uuid: PULSE_UUID},
                                valueNumeric: 24,
                                obsDatetime: dateStarted,
                                person: {uuid: patientUuid},
                                location: {uuid: locationUuid}
                            }
                        ]
                    }]
                }]
            };
        };

        var buildBuddyVisit = function (patientUuid, locationUuid, dateStarted) {
            return {
                patient: patientUuid,
                visitType: VISIT_TYPE_UUID,
                location: locationUuid,
                startDatetime: dateStarted,
                encounters: [{
                    encounterDatetime: dateStarted,
                    encounterType: ENCOUNTER_TYPE_UUID,
                    patient: patientUuid,
                    location: locationUuid,
                    obs: [{
                        concept: {conceptId: 55, uuid: REGISTRATION_CONCEPT_UUID},
                        obsDatetime: dateStarted,
                        person: {uuid: patientUuid},
                        location: {uuid: locationUuid},
                        groupMembers: [{
                            concept: {conceptId: 4964, uuid: PATIENT_TYPE_CONCEPT_UUID},
                            valueCoded: HTC_BUDDY_CODED_UUID,
                            valueCodedName: "HTC, Buddy",
                            obsDatetime: dateStarted,
                            person: {uuid: patientUuid},
                            location: {uuid: locationUuid}
                        }]
                    }]
                }]
            };
        };

        var startVisit = function (cagUuid, attenderUuid, members, locationUuid, locationName) {
            var dateStarted = new Date().toISOString().slice(0, 19).replace("T", " ");
            var absentees = {};
            var visits = [];

            _.each(members || [], function (member) {
                if (member.presentMember === false) {
                    absentees[member.uuid] = member.absenteeReason || "absent";
                    return;
                }
                if (member.uuid === attenderUuid) {
                    visits.push(buildPresentVisit(member.uuid, locationUuid, dateStarted));
                } else {
                    visits.push(buildBuddyVisit(member.uuid, locationUuid, dateStarted));
                }
            });

            var payload = {
                cag: {uuid: cagUuid},
                dateStarted: dateStarted,
                locationName: locationName,
                attender: {uuid: attenderUuid},
                absentees: absentees,
                visits: visits
            };

            return $http.post(cagVisitUrl, payload, {
                withCredentials: true,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).then(function (response) {
                return response.data;
            });
        };

        return {
            getAll: getAll,
            getByUuid: getByUuid,
            save: save,
            addPatient: addPatient,
            removePatient: removePatient,
            getActiveVisitByAttender: getActiveVisitByAttender,
            closeVisit: closeVisit,
            startVisit: startVisit
        };
    }]);
