'use strict';

angular.module('bahmni.registration')
    .controller('CagRegisterController', ['$scope', '$location', '$stateParams', '$window', 'spinner', 'cagService', 'patientService', 'messagingService',
        function ($scope, $location, $stateParams, $window, spinner, cagService, patientService, messagingService) {
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

            $scope.cagHostApi = {
                getCag: function (uuid) {
                    var promise = cagService.getByUuid(uuid);
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
