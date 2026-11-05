'use strict';

describe('primaryContactValidator', function () {
    var validator, ngDialog, closeDialog, closeDialogAndValidate, save, $rootScope, input, form;

    beforeEach(module('bahmni.registration'));

    beforeEach(module(function ($provide) {
        ngDialog = jasmine.createSpyObj('ngDialog', ['open']);
        $provide.value('ngDialog', ngDialog);
    }));

    beforeEach(inject(function (primaryContactValidator, _$rootScope_, $q) {
        validator = primaryContactValidator;
        $rootScope = _$rootScope_;
        save = jasmine.createSpy('save').and.returnValue('saveResult');
        ngDialog.open.and.callFake(function () {
            var closed = $q.defer();
            closeDialog = function (value) {
                closed.resolve({value: value});
                $rootScope.$digest();
            };
            return {closePromise: closed.promise};
        });
        closeDialogAndValidate = function (value) {
            validator.validateThen(save);
            closeDialog(value);
        };
        form = angular.element('<form><span><input type="text" id="telephoneNumber"></span></form>');
        angular.element(document.body).append(form);
        input = form.find('input')[0];
    }));

    afterEach(function () {
        form.remove();
    });

    var arrow = function () {
        return form[0].querySelector('.primary-contact-arrow');
    };

    var typeValue = function (value) {
        input.value = value;
        angular.element(input).triggerHandler('input');
    };

    it('should save straight away when the field has a value', function () {
        input.value = '0821234567';

        expect(validator.validateThen(save)).toBe('saveResult');
        expect(save).toHaveBeenCalled();
        expect(ngDialog.open).not.toHaveBeenCalled();
        expect(arrow()).toBeNull();
    });

    it('should warn instead of saving when the field is empty', function () {
        validator.validateThen(save);
        $rootScope.$digest();

        expect(ngDialog.open.calls.mostRecent().args[0].template).toBe('views/primaryContactRequired.html');
        expect(save).not.toHaveBeenCalled();
    });

    it('should treat whitespace as empty', function () {
        input.value = '   ';

        validator.validateThen(save);

        expect(ngDialog.open).toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
    });

    it('should release the submit lock if the dialog closes on navigation', function () {
        validator.validateThen(save);

        expect(ngDialog.open.calls.mostRecent().args[0].closeByNavigation).toBe(true);
    });

    it('should save without an arrow when the user continues without a contact', function () {
        var settled = jasmine.createSpy('settled');
        validator.validateThen(save).then(settled);

        closeDialog('continueWithoutContact');

        expect(save).toHaveBeenCalled();
        expect(settled).toHaveBeenCalledWith('saveResult');
        expect(arrow()).toBeNull();
    });

    it('should settle without saving, and point at the field, when the user goes back to add a contact', function () {
        var settled = jasmine.createSpy('settled');
        spyOn(input, 'focus');
        spyOn(input, 'scrollIntoView');
        validator.validateThen(save).then(settled);
        expect(input.focus).not.toHaveBeenCalled();

        closeDialog();

        expect(save).not.toHaveBeenCalled();
        expect(settled).toHaveBeenCalled();
        expect(arrow()).not.toBeNull();
        expect(input.scrollIntoView).toHaveBeenCalled();
        expect(input.focus).toHaveBeenCalled();
    });

    it('should not save when the dialog is dismissed with Esc', function () {
        closeDialogAndValidate('$escape');

        expect(save).not.toHaveBeenCalled();
    });

    it('should remove an earlier arrow when the user later continues without a contact', function () {
        closeDialogAndValidate();
        expect(arrow()).not.toBeNull();

        closeDialogAndValidate('continueWithoutContact');

        expect(save).toHaveBeenCalled();
        expect(arrow()).toBeNull();
    });

    it('should save straight away when the field is not on the form', function () {
        form.remove();

        validator.validateThen(save);

        expect(save).toHaveBeenCalled();
        expect(ngDialog.open).not.toHaveBeenCalled();
    });

    it('should save straight away when the field is read-only', function () {
        input.disabled = true;

        validator.validateThen(save);

        expect(save).toHaveBeenCalled();
    });

    it('should expand only the section containing the field', function () {
        var contactSection = {attributes: [{name: 'telephoneNumber'}], expand: false};
        var otherSection = {attributes: [{name: 'education'}], expand: false};
        $rootScope.patientConfiguration = {
            getPatientAttributesSections: function () {
                return {contact: contactSection, other: otherSection};
            }
        };

        validator.validateThen(save);

        expect(contactSection.expand).toBe(true);
        expect(otherSection.expand).toBe(false);
    });

    it('should show only one arrow when the user goes back repeatedly', function () {
        closeDialogAndValidate();
        closeDialogAndValidate();

        expect(form[0].querySelectorAll('.primary-contact-arrow').length).toBe(1);
    });

    it('should remove the arrow when a value is typed, but not for whitespace', function () {
        closeDialogAndValidate();

        typeValue('  ');
        expect(arrow()).not.toBeNull();

        typeValue('0');
        expect(arrow()).toBeNull();
    });

    it('should keep the arrow away if the field is cleared, until the next save', function () {
        closeDialogAndValidate();
        typeValue('0');

        typeValue('');
        expect(arrow()).toBeNull();

        closeDialogAndValidate();
        expect(arrow()).not.toBeNull();
    });
});
