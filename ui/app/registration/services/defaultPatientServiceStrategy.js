'use strict';

angular.module('bahmni.registration')
    .service('patientServiceStrategy', ['$http', '$q', '$rootScope', function ($http, $q, $rootScope) {
        var openmrsUrl = Bahmni.Registration.Constants.openmrsUrl;
        var baseOpenMRSRESTURL = Bahmni.Registration.Constants.baseOpenMRSRESTURL;

        var search = function (config) {
            var defer = $q.defer();
            var patientSearchUrl = Bahmni.Common.Constants.bahmniCommonsSearchUrl + "/patient";
            if (config && config.params.identifier) {
                patientSearchUrl = Bahmni.Common.Constants.bahmniCommonsSearchUrl + "/patient/lucene";
            }
            var onResults = function (result) {
                defer.resolve(result);
            };
            $http.get(patientSearchUrl, config).success(onResults)
                .error(function (error) {
                    defer.reject(error);
                });
            return defer.promise;
        };

        var searchHIE = function (config) {
            var defer = $q.defer();
            var patientSearchUrl = Bahmni.Common.Constants.bahmniSearchUrl + "/mpipatient";
            if (config && config.params.identifier) {
                patientSearchUrl = Bahmni.Common.Constants.bahmniSearchUrl + "/mpipatient/exact";
            }
            $http.get(patientSearchUrl, config).success(function (result) {
                defer.resolve(result);
            }).error(function (data, status) {
                defer.reject({
                    data: data,
                    status: status,
                    message: status === 404
                        ? "National MPI endpoint is not available on this OpenMRS (404). The /mpipatient API is missing from the local backend."
                        : ("National search failed (HTTP " + status + ").")
                });
            });
            return defer.promise;
        };

        var importPatient = function (patient, config) {
            var defer = $q.defer();
            var extraIdentifiers = patient && patient.extraIdentifiers;
            if (extraIdentifiers && typeof extraIdentifiers === "string") {
                try {
                    extraIdentifiers = JSON.parse(extraIdentifiers);
                } catch (e) {
                    extraIdentifiers = {};
                }
            }
            var patientEcid = (extraIdentifiers && (extraIdentifiers.ECID || extraIdentifiers.ecid)) || patient.ecid;
            if (!patientEcid) {
                defer.reject({message: "Missing ECID for national patient import"});
                return defer.promise;
            }
            var importPatientUrl = Bahmni.Common.Constants.bahmniSearchUrl + "/mpipatient?patientEcid=" + encodeURIComponent(patientEcid);
            $http.post(importPatientUrl, config || {withCredentials: true}).success(function (result) {
                defer.resolve(result);
            }).error(function (error) {
                defer.reject(error);
            });
            return defer.promise;
        };

        var getByUuid = function (uuid) {
            var url = openmrsUrl + "/ws/rest/v1/patientprofile/" + uuid;
            var config = {
                method: "GET",
                params: {v: "full"},
                withCredentials: true
            };

            var defer = $q.defer();
            $http.get(url, config).success(function (result) {
                defer.resolve(result);
            });
            return defer.promise;
        };

        var create = function (patient, jumpAccepted) {
            var data = new Bahmni.Registration.CreatePatientRequestMapper(moment()).mapFromPatient($rootScope.patientConfiguration.attributeTypes, patient);
            var url = baseOpenMRSRESTURL + "/bahmnicore/patientprofile";
            return $http.post(url, data, {
                withCredentials: true,
                headers: {"Accept": "application/json", "Content-Type": "application/json", "Jump-Accepted": jumpAccepted}
            });
        };

        var update = function (patient, openMRSPatient, attributeTypes) {
            var deferred = $q.defer();
            var data = new Bahmni.Registration.UpdatePatientRequestMapper(moment()).mapFromPatient(attributeTypes, openMRSPatient, patient);
            var url = baseOpenMRSRESTURL + "/bahmnicore/patientprofile/" + openMRSPatient.uuid;
            var config = {
                withCredentials: true,
                headers: {"Accept": "application/json", "Content-Type": "application/json"}
            };
            $http.post(url, data, config).then(function (result) {
                deferred.resolve(result);
            }, function (reason) {
                deferred.resolve(reason);
            });
            return deferred.promise;
        };

        var generateIdentifier = function (patient) {
            var data = {"identifierSourceName": patient.identifierPrefix ? patient.identifierPrefix.prefix : ""};
            var url = openmrsUrl + "/ws/rest/v1/idgen";
            var config = {
                withCredentials: true,
                headers: {"Accept": "text/plain", "Content-Type": "application/json"}
            };
            return $http.post(url, data, config);
        };

        return {
            search: search,
            searchHIE: searchHIE,
            importPatient: importPatient,
            get: getByUuid,
            create: create,
            update: update,
            generateIdentifier: generateIdentifier
        };
    }]);
