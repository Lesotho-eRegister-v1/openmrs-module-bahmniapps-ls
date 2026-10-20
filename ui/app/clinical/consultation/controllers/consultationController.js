"use strict";

angular.module("bahmni.clinical").controller("ConsultationController", [
  "$scope",
  "$rootScope",
  "$state",
  "$location",
  "$translate",
  "clinicalAppConfigService",
  "diagnosisService",
  "urlHelper",
  "contextChangeHandler",
  "spinner",
  "encounterService",
  "messagingService",
  "sessionService",
  "retrospectiveEntryService",
  "patientContext",
  "$q",
  "patientVisitHistoryService",
  "$stateParams",
  "$window",
  "visitHistory",
  "clinicalDashboardConfig",
  "appService",
  "ngDialog",
  "$filter",
  "configurations",
  "visitConfig",
  "conditionsService",
  "configurationService",
  "auditLogService",
  "confirmBox",
  "virtualConsultService",
  "adhocTeleconsultationService",
  "observationsService",
  "$http",
  "$timeout",
  function (
    $scope,
    $rootScope,
    $state,
    $location,
    $translate,
    clinicalAppConfigService,
    diagnosisService,
    urlHelper,
    contextChangeHandler,
    spinner,
    encounterService,
    messagingService,
    sessionService,
    retrospectiveEntryService,
    patientContext,
    $q,
    patientVisitHistoryService,
    $stateParams,
    $window,
    visitHistory,
    clinicalDashboardConfig,
    appService,
    ngDialog,
    $filter,
    configurations,
    visitConfig,
    conditionsService,
    configurationService,
    auditLogService,
    confirmBox,
    virtualConsultService,
    adhocTeleconsultationService,
    observationsService,
    $http,
    $timeout
  ) {
    var ERROR = 1;
    var DateUtil = Bahmni.Common.Util.DateUtil;
    var getPreviousActiveCondition =
      Bahmni.Common.Domain.Conditions.getPreviousActiveCondition;
    $scope.togglePrintList = false;
    $scope.patient = patientContext.patient;
    $scope.showDashboardMenu = false;
    $scope.showMobileMenu = false;
    $scope.stateChange = function () {
      return $state.current.name === "patient.dashboard.show";
    };
    $scope.showComment = true;
    $scope.showSaveAndContinueButton = true;

    $scope.visitHistory = visitHistory;
    $scope.consultationBoardLink =
      clinicalAppConfigService.getConsultationBoardLink();
    $scope.showControlPanel = false;
    $scope.clinicalDashboardConfig = clinicalDashboardConfig;
    $scope.lastvisited = null;

    $scope.openConsultationInNewTab = function () {
      $window.open("#" + $scope.consultationBoardLink, "_blank");
    };

    $scope.toggleMobileMenu = function () {
      $scope.showMobileMenu = !$scope.showMobileMenu;
    };

    $scope.toggleDashboardMenu = function () {
      $scope.showDashboardMenu = !$scope.showDashboardMenu;
    };

    $scope.showDashboard = function (dashboard) {
      if (!clinicalDashboardConfig.isCurrentTab(dashboard)) {
        $scope.$parent.$broadcast("event:switchDashboard", dashboard);
      }
      $scope.showDashboardMenu = false;
    };

    var setPrintAction = function (event, tab) {
      tab.print = function () {
        $rootScope.$broadcast(event, tab);
      };
    };
    var setDashboardPrintAction = _.partial(
      setPrintAction,
      "event:printDashboard",
      _
    );
    var setVisitTabPrintAction = function (tab) {
      tab.print = function () {
        var url = $state.href("patient.dashboard.visitPrint", {
          visitUuid: visitHistory.activeVisit.uuid,
          tab: tab.title,
          print: "print",
        });
        window.open(url, "_blank");
      };
    };

    clinicalDashboardConfig.allowAdhocTeleConsultation = appService
      .getAppDescriptor()
      .getConfigValue("allowAdhocTeleConsultation");

    $scope.startAdhocTeleconsultationLink = function () {
      adhocTeleconsultationService
        .generateAdhocTeleconsultationLink({
          patientUuid: $scope.patient.uuid,
          provider: $rootScope.currentUser.username,
        })
        .then(function (data) {
          if (!(data && data.data)) {
            messagingService.showMessage(
              "error",
              "{{'TELECON_ERROR_KEY' | translate }}"
            );
          }
          virtualConsultService.launchMeeting(data.data.uuid, data.data.link);
          if (
            data.data.notificationResults &&
            data.data.notificationResults.length > 0
          ) {
            var message = data.data.notificationResults[0].message;
            var status = data.data.notificationResults[0].status;
            if (status === ERROR) {
              messagingService.showMessage("error", message);
            } else {
              messagingService.showMessage("info", message);
            }
          }
        });
    };

    _.each(visitConfig.tabs, setVisitTabPrintAction);
    _.each(clinicalDashboardConfig.tabs, setDashboardPrintAction);
    $scope.printList = _.concat(clinicalDashboardConfig.tabs, visitConfig.tabs);

    clinicalDashboardConfig.quickPrints = appService
      .getAppDescriptor()
      .getConfigValue("quickPrints");
    $scope.printDashboard = function (tab) {
      if (tab) {
        tab.print();
      } else {
        clinicalDashboardConfig.currentTab.print();
      }
    };

    $scope.allowConsultation = function () {
      return appService
        .getAppDescriptor()
        .getConfigValue("allowConsultationWhenNoOpenVisit");
    };

    $scope.closeDashboard = function (dashboard) {
      clinicalDashboardConfig.closeTab(dashboard);
      $scope.$parent.$parent.$broadcast(
        "event:switchDashboard",
        clinicalDashboardConfig.currentTab
      );
    };

    $scope.closeAllDialogs = function () {
      ngDialog.closeAll();
    };

    $scope.availableBoards = [];
    $scope.configName = $stateParams.configName;

    $scope.getTitle = function (board) {
      return $filter("titleTranslate")(board);
    };

    $scope.showBoard = function (boardIndex) {
      $rootScope.collapseControlPanel();
      return buttonClickAction($scope.availableBoards[boardIndex]);
    };

    $scope.gotoPatientDashboard = function () {
      if (!isFormValid()) {
        $scope.$parent.$parent.$broadcast("event:errorsOnForm");
        return $q.when({});
      }
      if (contextChangeHandler.execute()["allow"]) {
        var params = {
          configName: $scope.configName,
          patientUuid: patientContext.patient.uuid,
          encounterUuid: undefined,
        };
        if ($scope.dashboardDirty) {
          params["dashboardCachebuster"] = Math.random();
        }
        $state.go("patient.dashboard.show", params);
      }
    };

    var isLongerName = function (value) {
      return value ? value.length > 18 : false;
    };

    $scope.getShorterName = function (value) {
      return isLongerName(value) ? value.substring(0, 15) + "..." : value;
    };

    $scope.isInEditEncounterMode = function () {
      return (
        $stateParams.encounterUuid !== undefined &&
        $stateParams.encounterUuid !== "active"
      );
    };

    $scope.enablePatientSearch = function () {
      return (
        appService
          .getAppDescriptor()
          .getConfigValue("allowPatientSwitchOnConsultation") === true
      );
    };

    var setCurrentBoardBasedOnPath = function () {
      var currentPath = $location.url();
      var board = _.find($scope.availableBoards, function (board) {
        if (board.url === "treatment") {
          return _.includes(
            currentPath,
            board.extensionParams
              ? board.extensionParams.tabConfigName
              : board.url
          );
        }
        return _.includes(currentPath, board.url);
      });
      if (board) {
        _.map($scope.availableBoards, function (availableBoard) {
          availableBoard.isSelectedTab = false;
        });
        $scope.currentBoard = board;
        $scope.currentBoard.isSelectedTab = true;
      }
    };

    var vitalsPrefillEnabled =
      appService.getAppDescriptor().getConfigValue("enableVitalsPrefill") !==
      false;
    // Default to true for troubleshooting; set logVitalsDebug=false in config to silence.
    var vitalsDebugLogging =
      appService.getAppDescriptor().getConfigValue("logVitalsDebug") !== false;
    var vitalsConceptCache = null;
    var pendingVitalsObservations = null;
    var vitalsControlIdByConcept = {
      "5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA": "14", // Pulse
      "5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA": "15", // SpO2
      "5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA": "16", // Respiratory rate
      "9bb0795c-4ff0-0305-1990-000000000020": "17", // Temperature (F)
      "5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA": "17", // Temperature (C) fallback
      "631f9e92-b15f-41da-a6ba-4f4cd67f36b7": "18", // Blood Pressure group
      "5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA": "19", // Systolic
      "5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA": "20", // Diastolic
      "159633AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA": "21", // Body position
    };

    var normalizeName = function (val) {
      return (val || "").toString().toLowerCase().replace(/\s+/g, "");
    };

    var buildVitalsConceptNames = function (conceptInfo) {
      var names = [];
      if (conceptInfo && conceptInfo.names) {
        names = names.concat(conceptInfo.names);
      }
      names = names.concat(_.keys(vitalsControlIdByConcept));
      names.push(Bahmni.Common.Constants.vitalsConceptName);
      return _.uniq(names);
    };

    var getVitalsConceptInfo = function () {
      var defaultConceptNames = [
        Bahmni.Common.Constants.vitalsConceptName,
        Bahmni.Common.Constants.heightConceptName,
        Bahmni.Common.Constants.weightConceptName,
        Bahmni.Common.Constants.bmiConceptName,
        Bahmni.Common.Constants.bmiStatusConceptName,
      ];

      var flattenConceptNames = function (concept) {
        var identifiers = [];
        var traverse = function (node) {
          if (!node) {
            return;
          }
          var nodeName =
            node.name && node.name.name ? node.name.name : node.name;
          if (nodeName) {
            identifiers.push(nodeName);
          }
          if (node.uuid) {
            identifiers.push(node.uuid);
          }
          (node.setMembers || []).forEach(function (member) {
            traverse(member);
          });
        };
        traverse(concept);
        return _.uniq(identifiers);
      };

      var searchRepresentation = "custom:(uuid)";
      var memberRepresentation =
        "custom:(uuid,name,setMembers:(uuid,name,setMembers:(uuid,name)))";

      var searchConceptByName = function (conceptName) {
        return $http.get(Bahmni.Common.Constants.conceptUrl, {
          params: { q: conceptName, v: searchRepresentation, limit: 1 },
          cache: true,
        });
      };

      var fetchConceptSet = function (conceptUuid) {
        return $http.get(
          Bahmni.Common.Constants.conceptUrl + "/" + conceptUuid,
          {
            params: { v: memberRepresentation },
            cache: true,
          }
        );
      };

      if (vitalsConceptCache) {
        return vitalsConceptCache;
      }

      vitalsConceptCache = searchConceptByName(
        Bahmni.Common.Constants.vitalsConceptName
      )
        .then(function (response) {
          var vitalsConcept =
            response &&
            response.data &&
            response.data.results &&
            response.data.results[0];
          if (!(vitalsConcept && vitalsConcept.uuid)) {
            return { names: defaultConceptNames };
          }
          return fetchConceptSet(vitalsConcept.uuid).then(function (
            conceptResponse
          ) {
            var conceptWithMembers = conceptResponse && conceptResponse.data;
            var configuredNames = flattenConceptNames(conceptWithMembers);
            // Body position is sometimes nested under Blood Pressure; ensure it is included even if naming differs.
            if (!_.includes(configuredNames, "Body position")) {
              configuredNames.push("Body position");
            }
            return {
              names: _.uniq(defaultConceptNames.concat(configuredNames)),
              concept: conceptWithMembers,
            };
          });
        })
        .catch(function (error) {
          if (vitalsDebugLogging) {
            console.warn(
              "Unable to load vitals concept set; falling back to defaults",
              error
            );
          }
          return { names: defaultConceptNames };
        });
      return vitalsConceptCache;
    };

    var logRegistrationVitals = function () {
      var visitUuid = visitHistory.activeVisit && visitHistory.activeVisit.uuid;

      var collectLeafValues = function (observation, vitalsValues) {
        if (observation.groupMembers && observation.groupMembers.length > 0) {
          observation.groupMembers.forEach(function (member) {
            collectLeafValues(member, vitalsValues);
          });
          return;
        }
        if (observation.concept && observation.concept.name) {
          vitalsValues[observation.concept.name] =
            observation.getDisplayValue();
        }
      };

      var mapVitals = function (data) {
        var mapped = new Bahmni.Common.Obs.ObservationMapper().map(
          data || [],
          []
        );
        var vitalsValues = {};
        mapped.forEach(function (obs) {
          collectLeafValues(obs, vitalsValues);
        });
        return vitalsValues;
      };

      var logIfPresent = function (response, sourceLabel) {
        var vitalsValues = mapVitals(response && response.data);
        if (!_.isEmpty(vitalsValues)) {
          if (vitalsDebugLogging) {
            console.log(
              "Vitals (" + sourceLabel + ") for patient",
              $scope.patient.uuid,
              ":",
              vitalsValues
            );
          }
          return true;
        }
        if (vitalsDebugLogging) {
          console.log(
            "No vitals found (" + sourceLabel + ") for patient",
            $scope.patient.uuid,
            "visit",
            visitUuid || "N/A"
          );
        }
        return false;
      };

      var observationHasValue = function (observation) {
        if (!observation) {
          return false;
        }
        if (
          observation.value !== undefined &&
          observation.value !== null &&
          observation.value !== ""
        ) {
          return true;
        }
        return _.some(observation.groupMembers, observationHasValue);
      };

      var prefillVitalsIfEmpty = function (response, vitalsConcept) {
        if (!vitalsPrefillEnabled || $scope.isInEditEncounterMode()) {
          if (vitalsDebugLogging) {
            console.log("Vitals prefill skipped (disabled or edit mode)");
          }
          return;
        }
        $scope.consultation.observations =
          $scope.consultation.observations || [];
        var hasExistingObs = _.some(
          $scope.consultation.observations,
          observationHasValue
        );
        if (hasExistingObs) {
          if (vitalsDebugLogging) {
            console.log(
              "Vitals prefill skipped (observations already present)"
            );
          }
          return;
        }
        var vitalsObs = response && response.data;
        if (!vitalsObs || vitalsObs.length === 0) {
          if (vitalsDebugLogging) {
            console.log("Vitals prefill skipped (no vitals data to prefill)");
          }
          return;
        }
        var stripIdsForPrefill = function (obs) {
          if (!obs) {
            return;
          }
          delete obs.uuid;
          delete obs.encounterUuid;
          delete obs.encounterDateTime;
          delete obs.observationDateTime;
          delete obs.obsDatetime;
          delete obs.orderUuid;
          delete obs.accessionNumber;
          delete obs.auditInfo;
          if (obs.groupMembers && obs.groupMembers.length) {
            obs.groupMembers.forEach(stripIdsForPrefill);
          }
        };

        var cleaned = angular.copy(vitalsObs);
        // If response is wrapped under Vitals root, flatten to its members (Form 2.0 expects top-level controls).
        if (
          cleaned.length === 1 &&
          cleaned[0].concept &&
          vitalsConcept &&
          cleaned[0].concept.uuid === vitalsConcept.uuid &&
          cleaned[0].groupMembers
        ) {
          cleaned = cleaned[0].groupMembers;
          if (vitalsDebugLogging) {
            console.log(
              "Flattened Vitals root to group members for form attachment"
            );
          }
        }
        if (cleaned && cleaned.forEach) {
          cleaned.forEach(stripIdsForPrefill);
        }
        // Keep only concepts we can map to form controls.
        var filterForForm = function (obsArray) {
          var filtered = [];
          _.each(obsArray, function (obs) {
            if (!obs || !obs.concept || !obs.concept.uuid) {
              return;
            }
            var conceptUuid = obs.concept.uuid;
            if (
              conceptUuid === "631f9e92-b15f-41da-a6ba-4f4cd67f36b7" &&
              obs.groupMembers
            ) {
              // BP group: keep and filter members
              var clonedGroup = angular.copy(obs);
              clonedGroup.groupMembers = filterForForm(obs.groupMembers);
              filtered.push(clonedGroup);
            } else if (vitalsControlIdByConcept[conceptUuid]) {
              filtered.push(obs);
            }
          });
          return filtered;
        };

        cleaned = filterForForm(cleaned);

        $scope.consultation.observations = cleaned;
        // Push into the Vitals template so the form binds these observations.
        var setFormPathForVitalsForm = function (
          observations,
          formName,
          formVersion
        ) {
          if (!observations || !observations.forEach) {
            return;
          }
          var version = formVersion || "1";
          var pathPrefix = formName + "." + version;
          var applyPath = function (obs) {
            if (!obs || !obs.concept || !obs.concept.uuid) {
              return;
            }
            var controlId = vitalsControlIdByConcept[obs.concept.uuid];
            if (controlId) {
              obs.formFieldPath = pathPrefix + "/" + controlId + "-0";
            } else {
              obs.formFieldPath = pathPrefix;
            }
            obs.formFieldNamespace = "Bahmni";
            if (obs.groupMembers && obs.groupMembers.length) {
              obs.groupMembers.forEach(applyPath);
            }
          };

          observations.forEach(applyPath);
        };

        var attachToTemplates = function (obsToApply) {
          var targetConceptNames = [
            Bahmni.Common.Constants.vitalsConceptName,
            (vitalsConcept && vitalsConcept.name && vitalsConcept.name.name) ||
              (vitalsConcept && vitalsConcept.name),
          ].filter(Boolean);
          var targetNormalized = targetConceptNames.map(normalizeName);
          var templates = $scope.consultation.selectedObsTemplate || [];
          // Remove Registration Details (or other non-vitals) forms from consideration/display.
          templates = _.filter(templates, function (t) {
            var normLabel = normalizeName(t.label);
            var normConcept = normalizeName(t.conceptName);
            var isRegistration =
              _.includes(["registrationdetails", "registration"], normLabel) ||
              _.includes(
                ["registrationdetails", "registration"],
                normConcept
              ) ||
              t.formUuid === "7f659037-5aa5-44cc-aced-32a4d6ed113e";
            if (isRegistration) {
              t.isAdded = false;
              t.isOpen = false;
              t.observations = [];
            }
            return !isRegistration;
          });
          $scope.consultation.selectedObsTemplate = templates;
          var attached = false;
          if (vitalsDebugLogging) {
            var templateDebug = templates.map(function (t) {
              return {
                conceptName: t.conceptName,
                label: t.label,
                formUuid: t.formUuid,
                isForm: !!t.formUuid,
                obsCount: t.observations && t.observations.length,
                normConcept: normalizeName(t.conceptName),
                normLabel: normalizeName(t.label),
              };
            });
            console.log(
              "Attempting to attach to templates; targets:",
              targetConceptNames,
              "templates:",
              JSON.stringify(templateDebug)
            );
          }
          _.each(templates, function (template) {
            var normConcept = normalizeName(template.conceptName);
            var normLabel = normalizeName(template.label);
            var matches =
              _.includes(targetConceptNames, template.conceptName) ||
              _.includes(targetConceptNames, template.label) ||
              _.includes(targetNormalized, normConcept) ||
              _.includes(targetNormalized, normLabel);
            if (!matches) {
              return;
            }
            var obsCopy = angular.copy(obsToApply);
            if (template.formUuid) {
              // Form-based template: stamp formFieldPath with control ids from Vitals form definition.
              var formName =
                template.formName ||
                template.label ||
                template.conceptName ||
                "Vitals";
              var formVersion = template.formVersion || template.version || "1";
              setFormPathForVitalsForm(obsCopy, formName, formVersion);
              obsCopy.forEach(stripIdsForPrefill);
            }
            template.observations = obsCopy;
            template.isAdded = true;
            template.isLoaded = true;
            template.isOpen = true;
            template.collapseInnerSections = false;
            attached = true;
            if (vitalsDebugLogging) {
              console.log(
                "Attached vitals observations to template",
                template.conceptName || template.label,
                obsCopy
              );
            }
          });
          return attached;
        };

        var attachedNow = attachToTemplates(cleaned);
        if (!attachedNow) {
          pendingVitalsObservations = cleaned;
          if (!$scope._vitalsTemplateWatcher) {
            $scope._vitalsTemplateWatcher = $scope.$watch(
              function () {
                return ($scope.consultation.selectedObsTemplate || []).length;
              },
              function (newVal) {
                if (newVal > 0 && pendingVitalsObservations) {
                  var attachedLater = attachToTemplates(
                    pendingVitalsObservations
                  );
                  if (attachedLater) {
                    pendingVitalsObservations = null;
                    if (vitalsDebugLogging) {
                      console.log(
                        "Attached vitals observations after templates loaded"
                      );
                    }
                  } else if (vitalsDebugLogging) {
                    console.log(
                      "Templates loaded but vitals still not attached; templates:",
                      JSON.stringify(
                        ($scope.consultation.selectedObsTemplate || []).map(
                          function (t) {
                            return {
                              conceptName: t.conceptName,
                              label: t.label,
                              formUuid: t.formUuid,
                            };
                          }
                        )
                      )
                    );
                  }
                }
              }
            );
          }
          if (vitalsDebugLogging) {
            console.log("Vitals templates not ready; will attach on load");
          }
        }
        if (vitalsDebugLogging) {
          console.log("Prefilled vitals observations", cleaned);
        }
        $timeout(function () {
          $rootScope.$broadcast("event:observationsUpdated");
        }, 0);
      };

      // Pull concept names from configured vitals concept set to keep in sync with site-specific setup.
      getVitalsConceptInfo()
        .then(function (conceptInfo) {
          // Explicitly target the Vitals form concepts to ensure all required fields are fetched.
          var conceptNames = _.uniq([
            "Pulse",
            "5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "Arterial blood oxygen saturation (pulse oximeter)",
            "5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "Respiratory rate",
            "5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "Temperature (C)",
            "5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "9bb0795c-4ff0-0305-1990-000000000020", // Temperature (F)
            "Blood Pressure",
            "631f9e92-b15f-41da-a6ba-4f4cd67f36b7",
            "Systolic blood pressure",
            "5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "Diastolic blood pressure",
            "5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "Body position",
            "159633AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          ]);
          var vitalsConcept = conceptInfo.concept;
          if (vitalsDebugLogging) {
            // Surface the list to help troubleshooting missing concepts in logs.
            console.log("Using vitals concept filters:", conceptNames);
          }
          // Prefer active-visit vitals; if none, fall back to patient-latest across recent visits.
          return observationsService
            .fetch(
              $scope.patient.uuid,
              conceptNames,
              "latest",
              null,
              visitUuid,
              null,
              null,
              $stateParams.enrollment
            )
            .then(function (visitResponse) {
              if (vitalsDebugLogging) {
                console.log(
                  "Fetched active-visit vitals raw",
                  visitResponse && visitResponse.data
                );
              }
              var hasVisit = logIfPresent(visitResponse, "active-visit");
              if (hasVisit) {
                prefillVitalsIfEmpty(visitResponse, vitalsConcept);
                return;
              }
              return observationsService
                .fetch(
                  $scope.patient.uuid,
                  conceptNames,
                  "latest",
                  3,
                  null,
                  null,
                  null,
                  $stateParams.enrollment
                )
                .then(function (response) {
                  if (vitalsDebugLogging) {
                    console.log(
                      "Fetched patient-latest vitals raw",
                      response && response.data
                    );
                  }
                  logIfPresent(response, "patient-latest");
                  prefillVitalsIfEmpty(response, vitalsConcept);
                });
            });
        })
        .catch(function (error) {
          console.error(
            "Unable to fetch vitals for patient",
            $scope.patient.uuid,
            error
          );
        });
    };

    var initialize = function () {
      var appExtensions = clinicalAppConfigService.getAllConsultationBoards();
      $scope.adtNavigationConfig = {
        forwardUrl: Bahmni.Clinical.Constants.adtForwardUrl,
        title: $translate.instant("CLINICAL_GO_TO_DASHBOARD_LABEL"),
        privilege: Bahmni.Clinical.Constants.adtPrivilege,
      };
      $scope.availableBoards = $scope.availableBoards.concat(appExtensions);
      $scope.showSaveConfirmDialogConfig = appService
        .getAppDescriptor()
        .getConfigValue("showSaveConfirmDialog");
      var adtNavigationConfig = appService
        .getAppDescriptor()
        .getConfigValue("adtNavigationConfig");
      Object.assign($scope.adtNavigationConfig, adtNavigationConfig);
      setCurrentBoardBasedOnPath();
      logRegistrationVitals();
    };

    $scope.shouldDisplaySaveConfirmDialogForStateChange = function (
      toState,
      toParams,
      fromState,
      fromParams
    ) {
      if (toState.name.match(/patient.dashboard.show.*/)) {
        return fromParams.patientUuid != toParams.patientUuid;
      }
      return true;
    };

    var cleanUpListenerStateChangeStart = $scope.$on(
      "$stateChangeStart",
      function (event, toState, toParams, fromState, fromParams) {
        if ($scope.showSaveConfirmDialogConfig) {
          if (
            $rootScope.hasVisitedConsultation &&
            $scope.shouldDisplaySaveConfirmDialogForStateChange(
              toState,
              toParams,
              fromState,
              fromParams
            )
          ) {
            if ($scope.showConfirmationPopUp) {
              event.preventDefault();
              spinner.hide(toState.spinnerToken);
              ngDialog.close();
              $scope.toStateConfig = { toState: toState, toParams: toParams };
              $scope.displayConfirmationDialog();
            }
          }
        }
        setCurrentBoardBasedOnPath();
      }
    );

    $scope.adtNavigationURL = function (visitUuid) {
      return appService
        .getAppDescriptor()
        .formatUrl($scope.adtNavigationConfig.forwardUrl, {
          patientUuid: $scope.patient.uuid,
          visitUuid: visitUuid,
        });
    };

    var cleanUpListenerErrorsOnForm = $scope.$on(
      "event:errorsOnForm",
      function () {
        $scope.showConfirmationPopUp = true;
      }
    );

    $scope.displayConfirmationDialog = function (event) {
      if (
        $rootScope.hasVisitedConsultation &&
        $scope.showSaveConfirmDialogConfig
      ) {
        if (event) {
          event.preventDefault();
          $scope.targetUrl = event.currentTarget.getAttribute("href");
        }
        ngDialog.openConfirm({
          template: "../common/ui-helper/views/saveConfirmation.html",
          scope: $scope,
        });
      }
      if ($scope.showTeleConsultationWindow) {
        var childScope = {};
        childScope.message =
          "Please end teleconsultation before moving out of this window";
        childScope.ok = okEvent;
        if (event) {
          event.preventDefault();
          confirmBox({
            scope: childScope,
            actions: [{ name: "ok", display: "Ok" }],
            className: "ngdialog-theme-default delete-program-popup",
          });
        }
      }
    };

    var okEvent = function (closeDialog) {
      closeDialog();
    };

    var cleanUpListenerStateChangeSuccess = $scope.$on(
      "$stateChangeSuccess",
      function (event, toState, toParams, fromState) {
        if (toState.name.match(/patient.dashboard.show.+/)) {
          $rootScope.hasVisitedConsultation = true;
          $scope.showConfirmationPopUp = true;
          if ($scope.showSaveConfirmDialogConfig) {
            $rootScope.$broadcast("event:pageUnload");
          }
        }
        if (
          toState.name === fromState.name &&
          fromState.name === "patient.dashboard.show"
        ) {
          $rootScope.hasVisitedConsultation = false;
        }
      }
    );

    $scope.$on("$destroy", function () {
      cleanUpListenerStateChangeSuccess();
      cleanUpListenerErrorsOnForm();
      cleanUpListenerStateChangeStart();
    });

    $scope.cancelTransition = function () {
      $scope.showConfirmationPopUp = true;
      ngDialog.close();
      delete $scope.targetUrl;
    };

    $scope.saveAndContinue = function () {
      $scope.showConfirmationPopUp = false;
      $scope.save($scope.toStateConfig);
      $window.onbeforeunload = null;
      ngDialog.close();
    };

    $scope.continueWithoutSaving = function () {
      $scope.showConfirmationPopUp = false;
      if ($scope.targetUrl) {
        $window.open($scope.targetUrl, "_self");
      }
      $window.onbeforeunload = null;
      $state.go($scope.toStateConfig.toState, $scope.toStateConfig.toParams);
      ngDialog.close();
    };

    var getUrl = function (board) {
      var urlPrefix = urlHelper.getPatientUrl();
      var url =
        "/" +
        $stateParams.configName +
        (board.url ? urlPrefix + "/" + board.url : urlPrefix);
      var queryParams = [];
      if ($state.params.encounterUuid) {
        queryParams.push("encounterUuid=" + $state.params.encounterUuid);
      }
      if ($state.params.programUuid) {
        queryParams.push("programUuid=" + $state.params.programUuid);
      }

      if ($state.params.enrollment) {
        queryParams.push("enrollment=" + $state.params.enrollment);
      }

      if ($state.params.dateEnrolled) {
        queryParams.push("dateEnrolled=" + $state.params.dateEnrolled);
      }

      if ($state.params.dateCompleted) {
        queryParams.push("dateCompleted=" + $state.params.dateCompleted);
      }

      var extensionParams = board.extensionParams;
      angular.forEach(
        extensionParams,
        function (extensionParamValue, extensionParamKey) {
          queryParams.push(extensionParamKey + "=" + extensionParamValue);
        }
      );

      if (!_.isEmpty(queryParams)) {
        url = url + "?" + queryParams.join("&");
      }

      $scope.lastConsultationTabUrl.url = url;
      return $location.url(url);
    };

    $scope.openConsultation = function () {
      if ($scope.showSaveConfirmDialogConfig) {
        $rootScope.$broadcast("event:pageUnload");
      }
      $scope.closeAllDialogs();
      $scope.collapseControlPanel();
      $rootScope.hasVisitedConsultation = true;
      switchToConsultationTab();
    };

    var switchToConsultationTab = function () {
      if ($scope.lastConsultationTabUrl.url) {
        $location.url($scope.lastConsultationTabUrl.url);
      } else {
        // Default tab
        getUrl($scope.availableBoards[0]);
      }
    };

    var contextChange = function () {
      return contextChangeHandler.execute();
    };

    var buttonClickAction = function (board) {
      if ($scope.currentBoard === board) {
        return;
      }
      if (!isFormValid()) {
        $scope.$parent.$broadcast("event:errorsOnForm");
        return;
      }

      contextChangeHandler.reset();
      _.map($scope.availableBoards, function (availableBoard) {
        availableBoard.isSelectedTab = false;
      });

      $scope.currentBoard = board;
      $scope.currentBoard.isSelectedTab = true;
      return getUrl(board);
    };

    var preSaveEvents = function () {
      var observationForms = $scope.consultation.observationForms;
      var addedObservationForms = _.filter(observationForms, function (form) {
        return form.isAdded;
      });
      _.each(addedObservationForms, function (form) {
        if (form.component && form.events && form.events.onFormSave) {
          try {
            form.component.state.data = runEventScript(
              form.component.state.data,
              form.events.onFormSave,
              form.component.props && form.component.props.patient
            );
          } catch (error) {
            throw error;
          }
        }
      });
    };

    var preSavePromise = function () {
      var deferred = $q.defer();
      var observationFilter = new Bahmni.Common.Domain.ObservationFilter();
      $scope.consultation.preSaveHandler.fire();
      $scope.lastvisited = $scope.consultation.lastvisited;
      var selectedObsTemplate = $scope.consultation.selectedObsTemplate;
      var _consultationForCopy = _.omit($scope.consultation, 'selectedObsTemplate');
      var tempConsultation = angular.copy(_consultationForCopy);
      tempConsultation.selectedObsTemplate = $scope.consultation.selectedObsTemplate;
      tempConsultation.observations = observationFilter.filter(
        tempConsultation.observations
      );
      tempConsultation.consultationNote = observationFilter.filter([
        tempConsultation.consultationNote,
      ])[0];
      tempConsultation.labOrderNote = observationFilter.filter([
        tempConsultation.labOrderNote,
      ])[0];

      addFormObservations(tempConsultation);
      storeTemplatePreference(selectedObsTemplate);
      var visitTypeForRetrospectiveEntries =
        clinicalAppConfigService.getVisitTypeForRetrospectiveEntries();
      var defaultVisitType = clinicalAppConfigService.getDefaultVisitType();
      var encounterData = new Bahmni.Clinical.EncounterTransactionMapper().map(
        tempConsultation,
        $scope.patient,
        sessionService.getLoginLocationUuid(),
        retrospectiveEntryService.getRetrospectiveEntry(),
        visitTypeForRetrospectiveEntries,
        defaultVisitType,
        $scope.isInEditEncounterMode(),
        $state.params.enrollment
      );
      deferred.resolve(encounterData);
      return deferred.promise;
    };

    var saveConditions = function () {
      return conditionsService
        .save($scope.consultation.conditions, $scope.patient.uuid)
        .then(function () {
          return conditionsService.getConditions($scope.patient.uuid);
        })
        .then(function (savedConditions) {
          return savedConditions;
        });
    };

    var storeTemplatePreference = function (selectedObsTemplate) {
      var templates = [];
      _.each(selectedObsTemplate, function (template) {
        var templateName = template.formName || template.conceptName;
        var isTemplateAlreadyPresent = _.find(templates, function (template) {
          return template === templateName;
        });
        if (_.isUndefined(isTemplateAlreadyPresent)) {
          templates.push(templateName);
        }
      });

      var data = {
        patientUuid: $scope.patient.uuid,
        providerUuid: $rootScope.currentProvider.uuid,
        templates: templates,
      };

      if (!_.isEmpty(templates)) {
        localStorage.setItem("templatePreference", JSON.stringify(data));
      }
    };

    var discontinuedDrugOrderValidation = function (removableDrugs) {
      var discontinuedDrugOrderValidationMessage;
      _.find(removableDrugs, function (drugOrder) {
        if (!drugOrder.dateStopped) {
          if (drugOrder._effectiveStartDate < moment()) {
            discontinuedDrugOrderValidationMessage =
              "Please make sure that " +
              drugOrder.concept.name +
              " has a stop date between " +
              DateUtil.getDateWithoutTime(drugOrder._effectiveStartDate) +
              " and " +
              DateUtil.getDateWithoutTime(DateUtil.now());
            return true;
          } else {
            discontinuedDrugOrderValidationMessage =
              drugOrder.concept.name +
              " should have stop date as today's date since it is a future drug order";
            return true;
          }
        }
      });
      return discontinuedDrugOrderValidationMessage;
    };

    var addFormObservations = function (tempConsultation) {
      if (tempConsultation.observationForms) {
        _.remove(tempConsultation.observations, function (observation) {
          return observation.formNamespace;
        });
        _.each(
          $scope.consultation.observationForms,
          function (observationForm) {
            if (observationForm.component && observationForm.isAdded) {
              var formObservations = observationForm.component.getValue();
              _.each(formObservations.observations, function (obs) {
                tempConsultation.observations.push(obs);
              });
            }
          }
        );
      }
    };

    var isObservationFormValid = function () {
      var valid = true;
      _.each($scope.consultation.observationForms, function (observationForm) {
        if (valid && observationForm.component) {
          var value = observationForm.component.getValue();
          if (value.errors) {
            messagingService.showMessage(
              "error",
              "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}"
            );
            valid = false;
          }
        }
      });
      return valid;
    };

    var isFormValid = function () {
      var contxChange = contextChange();
      var shouldAllow = contxChange["allow"];
      var discontinuedDrugOrderValidationMessage =
        discontinuedDrugOrderValidation($scope.consultation.discontinuedDrugs);
      if (!shouldAllow) {
        var errorMessage = contxChange["errorMessage"]
          ? contxChange["errorMessage"]
          : "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}";
        messagingService.showMessage("error", errorMessage);
      } else if (discontinuedDrugOrderValidationMessage) {
        var errorMessage = discontinuedDrugOrderValidationMessage;
        messagingService.showMessage("error", errorMessage);
      }
      return (
        shouldAllow &&
        !discontinuedDrugOrderValidationMessage &&
        isObservationFormValid()
      );
    };

    var copyConsultationToScope = function (consultationWithDiagnosis) {
      consultationWithDiagnosis.preSaveHandler =
        $scope.consultation.preSaveHandler;
      consultationWithDiagnosis.postSaveHandler =
        $scope.consultation.postSaveHandler;
      $scope.$parent.consultation = consultationWithDiagnosis;
      $scope.$parent.consultation.postSaveHandler.fire();
      $scope.dashboardDirty = true;
    };

    var encounterTypeUuid = configurations
      .encounterConfig()
      .getPatientDocumentEncounterTypeUuid();
    $scope.patientDocumentsPromise = encounterService
      .getEncountersForEncounterType($scope.patient.uuid, encounterTypeUuid)
      .then(function (response) {
        return new Bahmni.Clinical.PatientFileObservationsMapper().map(
          response.data.results
        );
      });

    $scope.save = function (toStateConfig) {
      if (!isFormValid()) {
        $scope.$parent.$parent.$broadcast("event:errorsOnForm");
        return $q.when({});
      }
      try {
        var alerts = angular.copy($rootScope.cdssAlerts) || [];
        var activeAlerts = alerts.filter(function (alert) {
          return alert.indicator === "critical" && alert.isActive;
        });

        if (activeAlerts && activeAlerts.length > 0) {
          messagingService.showMessage(
            "error",
            "{{ 'CDSS_ALERT_SAVE_ERROR' | translate }}"
          );
          return $q.when({});
        }

        if (alerts && alerts.length > 0) {
          var cdssAlerts = alerts.map(function (cdssAlert) {
            cdssAlert.isActive = false;
            return cdssAlert;
          });
          $rootScope.cdssAlerts = cdssAlerts;
        }
        preSaveEvents();
        return spinner.forPromise(
          $q
            .all([
              preSavePromise(),
              encounterService.getEncounterType(
                $state.params.programUuid,
                sessionService.getLoginLocationUuid()
              ),
            ])
            .then(function (results) {
              var encounterData = results[0];
              encounterData.encounterTypeUuid = results[1].uuid;
              var params = angular.copy($state.params);
              params.cachebuster = Math.random();
              return encounterService
                .create(encounterData)
                .then(function (saveResponse) {
                  $state.dirtyConsultationForm = false;
                  $state.orderRemoved = false;
                  $state.orderCreated = false;
                  $scope.$parent.$broadcast("event:changes-saved");
                  var messageParams = {
                    encounterUuid: saveResponse.data.encounterUuid,
                    encounterType: saveResponse.data.encounterType,
                  };
                  auditLogService.log(
                    $scope.patient.uuid,
                    "EDIT_ENCOUNTER",
                    messageParams,
                    "MODULE_LABEL_CLINICAL_KEY"
                  );
                  var consultationMapper = new Bahmni.ConsultationMapper(
                    configurations.dosageFrequencyConfig(),
                    configurations.dosageInstructionConfig(),
                    configurations.consultationNoteConcept(),
                    configurations.labOrderNotesConcept(),
                    $scope.followUpConditionConcept
                  );
                  var consultation = consultationMapper.map(saveResponse.data);
                  consultation.lastvisited = $scope.lastvisited;
                  return consultation;
                })
                .then(function (savedConsultation) {
                  return spinner.forPromise(
                    diagnosisService
                      .populateDiagnosisInformation(
                        $scope.patient.uuid,
                        savedConsultation
                      )
                      .then(function (consultationWithDiagnosis) {
                        return saveConditions()
                          .then(
                            function (savedConditions) {
                              consultationWithDiagnosis.conditions =
                                savedConditions;
                              messagingService.showMessage(
                                "info",
                                "{{'CLINICAL_SAVE_SUCCESS_MESSAGE_KEY' | translate}}"
                              );
                            },
                            function () {
                              consultationWithDiagnosis.conditions =
                                $scope.consultation.conditions;
                            }
                          )
                          .then(function () {
                            copyConsultationToScope(consultationWithDiagnosis);
                            if ($scope.targetUrl) {
                              return $window.open($scope.targetUrl, "_self");
                            }
                            return $state.transitionTo(
                              toStateConfig
                                ? toStateConfig.toState
                                : $state.current,
                              toStateConfig ? toStateConfig.toParams : params,
                              {
                                inherit: false,
                                notify: true,
                                reload: toStateConfig !== undefined,
                              }
                            );
                          })
                          .then(function () {
                            $rootScope.$broadcast("event:save-successful");
                          });
                      })
                  );
                })
                .catch(function (error) {
                  var message =
                    Bahmni.Clinical.Error.translate(error) ||
                    "{{'CLINICAL_SAVE_FAILURE_MESSAGE_KEY' | translate}}";
                  messagingService.showMessage("error", message);
                });
            })
        );
      } catch (error) {
        var displayErrors = function (error) {
          if (angular.isArray(error)) {
            _.each(error, function (errorObj) {
              messagingService.showMessage(
                "error",
                errorObj.message || "[ERROR]"
              );
            });
          } else {
            messagingService.showMessage("error", error.message || "[ERROR]");
          }
        };
        return spinner.forPromise(Promise.resolve(displayErrors(error)));
      }
    };

    $scope.$on("patientContext:goToPatientDashboard", function () {
      $scope.gotoPatientDashboard();
    });

    initialize();
  },
]);
