'use strict';

angular.module('bahmni.registration')
    .service('cagService', ['$http', function ($http) {
        var baseUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL + '/cag';
        var cagPatientUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL + '/cagPatient';

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

        var save = function (cag, uuid) {
            var url = uuid ? (baseUrl + '/' + uuid) : baseUrl;
            return $http.post(url, cag, {
                withCredentials: true,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).then(function (response) {
                return response.data;
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

        return {
            getAll: getAll,
            getByUuid: getByUuid,
            save: save,
            addPatient: addPatient,
            removePatient: removePatient
        };
    }]);
