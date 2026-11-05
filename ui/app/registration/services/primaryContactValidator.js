'use strict';

// Warns when a patient is being saved without a Primary Contact, and lets the user either go
// back to the field or carry on without it. Wraps the save in $scope.create() and
// $scope.update(), so it covers every submit button on the form (Save, Start Visit, Enter
// Visit Details), and whichever one was clicked still takes effect after continuing.
angular.module('bahmni.registration')
    .factory('primaryContactValidator', ['$rootScope', '$document', 'ngDialog', function ($rootScope, $document, ngDialog) {
        var ATTRIBUTE_NAME = 'telephoneNumber'; // also the id of the rendered input (see attributeInformation.html)
        var DIALOG_TEMPLATE = 'views/primaryContactRequired.html'; // its strings are in locale_en.json
        var ANCHOR_CLASS = 'primary-contact-anchor';
        var ARROW_CLASS = 'primary-contact-arrow';
        var CONTINUE_WITHOUT_CONTACT = 'continueWithoutContact'; // passed to closeThisDialog() in DIALOG_TEMPLATE
        var removeArrow = angular.noop;

        // The field may sit in a collapsed section, where the arrow and focus would be invisible.
        var expandSectionContainingField = function () {
            var sections = $rootScope.patientConfiguration && $rootScope.patientConfiguration.getPatientAttributesSections();
            _.each(sections, function (section) {
                if (_.some(section.attributes, {name: ATTRIBUTE_NAME})) {
                    section.expand = true;
                }
            });
        };

        // The arrow is added here rather than in attributeInformation.html because that template
        // is shared by every attribute. It stays until the field has a value, even if the field
        // is later cleared: it only comes back on the next Save.
        var showArrow = function (input) {
            removeArrow();
            var anchor = angular.element(input.parentNode);
            var arrow = angular.element('<span aria-hidden="true"></span>').addClass(ARROW_CLASS);
            anchor.addClass(ANCHOR_CLASS).append(arrow);

            var field = angular.element(input);
            var removeArrowOnceFilled = function () {
                if (_.trim(input.value)) {
                    removeArrow();
                }
            };
            removeArrow = function () {
                arrow.remove();
                anchor.removeClass(ANCHOR_CLASS);
                field.off('input change', removeArrowOnceFilled);
                removeArrow = angular.noop;
            };
            field.on('input change', removeArrowOnceFilled);
        };

        // Uses its own dialog because messagingService renders every error in one shared template.
        // Anything but the continue button (including Esc) counts as going back to the field, so
        // a patient is never saved without the user choosing to. The promise keeps singleSubmit
        // locked while the dialog is open, so closeByNavigation is needed to always release it.
        var askUserToContinue = function (input) {
            return ngDialog.open({
                template: DIALOG_TEMPLATE,
                className: 'ngdialog-theme-default primary-contact-dialog',
                showClose: false,
                closeByNavigation: true
            }).closePromise.then(function (result) {
                if (result.value === CONTINUE_WITHOUT_CONTACT) {
                    removeArrow();
                    return true;
                }
                showArrow(input);
                input.scrollIntoView({block: 'center'});
                input.focus();
                return false;
            });
        };

        // Runs save, straight away if there is nothing to warn about, otherwise once the user has
        // chosen to continue. Returns a promise that settles when the save, if any, is finished.
        var validateThen = function (save) {
            var input = $document[0].getElementById(ATTRIBUTE_NAME);
            // Not on the form (not configured, or hidden by a show/hide rule) or read-only: the
            // user could never fill it in, so there is nothing to warn about.
            if (!input || input.disabled || _.trim(input.value)) {
                return save();
            }
            expandSectionContainingField();
            return askUserToContinue(input).then(function (shouldContinue) {
                return shouldContinue ? save() : undefined;
            });
        };

        return {
            validateThen: validateThen
        };
    }]);
