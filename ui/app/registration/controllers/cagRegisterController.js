'use strict';

angular.module('bahmni.registration')
    .controller('CagRegisterController', ['$scope', '$location', '$stateParams', '$window', '$bahmniCookieStore', 'spinner', 'cagService', 'patientService', 'messagingService',
        function ($scope, $location, $stateParams, $window, $bahmniCookieStore, spinner, cagService, patientService, messagingService) {
            var isNew = !$stateParams.cagUuid || $stateParams.cagUuid === 'new' || $location.path() === '/cag/new';

            $scope.cagHostData = {
                isNew: isNew,
                cagUuid: isNew ? null : $stateParams.cagUuid
            };

            var toNativePromise = function (angularPromise) {
                return Promise.resolve(angularPromise);
            };

            var extractErrorMessage = function (error) {
                if (!error) {
                    return "Request failed";
                }
                if (error.message) {
                    return error.message;
                }
                if (error.data && error.data.error && error.data.error.message) {
                    return error.data.error.message;
                }
                if (error.status) {
                    return "Request failed (HTTP " + error.status + ")";
                }
                return "Request failed";
            };

            var getLoginLocation = function () {
                return $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName) || {};
            };

            $scope.cagHostApi = {
                getCag: function (uuid) {
                    var promise = cagService.getByUuid(uuid).then(function (cag) {
                        var members = cag.cagPatientList || [];
                        var checks = members.map(function (member) {
                            return cagService.getActiveVisitByAttender(member.uuid).then(function (activeVisit) {
                                return {memberUuid: member.uuid, activeVisit: activeVisit};
                            }, function () {
                                return {memberUuid: member.uuid, activeVisit: null};
                            });
                        });
                        return Promise.all(checks).then(function (results) {
                            var activeAttenderUuid = null;
                            var activeVisits = [];
                            results.forEach(function (item) {
                                if (item.activeVisit && !activeAttenderUuid) {
                                    activeAttenderUuid = item.activeVisit.attender && item.activeVisit.attender.uuid;
                                    activeVisits = item.activeVisit.visits || [];
                                }
                            });
                            cag.activeAttenderUuid = activeAttenderUuid || "";
                            cag.activeVisitPatientUuids = activeVisits.map(function (visit) {
                                return visit.patient && visit.patient.uuid;
                            }).filter(Boolean);
                            return cag;
                        });
                    });
                    spinner.forPromise(promise);
                    return toNativePromise(promise);
                },
                saveCag: function (payload, uuid) {
                    var promise = cagService.save(payload, uuid).then(function (saved) {
                        messagingService.showMessage('info', 'CAG saved');
                        return saved;
                    }, function (error) {
                        throw {message: extractErrorMessage(error)};
                    });
                    spinner.forPromise(promise);
                    return toNativePromise(promise);
                },
                searchPatients: function (query) {
                    var promise = patientService.searchByNameOrIdentifier(query, 20).then(function (response) {
                        var data = response && response.data ? response.data : response;
                        return (data && data.pageOfResults) || [];
                    });
                    spinner.forPromise(promise);
                    return toNativePromise(promise);
                },
                addMember: function (cagUuid, patientUuid) {
                    var promise = cagService.addPatient(cagUuid, patientUuid).then(function (result) {
                        messagingService.showMessage('info', 'Patient added to CAG');
                        return result;
                    }, function (error) {
                        throw {message: extractErrorMessage(error)};
                    });
                    spinner.forPromise(promise);
                    return toNativePromise(promise);
                },
                removeMember: function (patientUuid) {
                    var promise = cagService.removePatient(patientUuid).then(function (result) {
                        messagingService.showMessage('info', 'Patient removed from CAG');
                        return result;
                    }, function (error) {
                        throw {message: extractErrorMessage(error)};
                    });
                    spinner.forPromise(promise);
                    return toNativePromise(promise);
                },
                startVisit: function (cagUuid, attenderUuid, members) {
                    var location = getLoginLocation();
                    if (!location.uuid) {
                        return Promise.reject({message: "Login location not found"});
                    }
                    var promise = cagService.startVisit(
                        cagUuid,
                        attenderUuid,
                        members,
                        location.uuid,
                        location.name
                    ).then(function (result) {
                        messagingService.showMessage('info', 'CAG Visit Opened');
                        $location.path('/patient/' + attenderUuid + '/visit');
                        return result;
                    }, function (error) {
                        throw {message: extractErrorMessage(error)};
                    });
                    spinner.forPromise(promise);
                    return toNativePromise(promise);
                },
                enterVisit: function (patientUuid) {
                    $location.path('/patient/' + patientUuid + '/visit');
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                },
                openPatient: function (patientUuid) {
                    $window.open('#/patient/' + patientUuid, '_blank');
                },
                afterSave: function (savedUuid) {
                    if (savedUuid && $location.path() === '/cag/new') {
                        $location.url('/cag/' + savedUuid);
                        if (!$scope.$$phase) {
                            $scope.$apply();
                        }
                    }
                },
                backToSearch: function () {
                    $location.url('/search');
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                }
            };
        }]);
