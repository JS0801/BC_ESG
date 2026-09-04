/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @contact sales@paifala.com
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
define(["require", "exports", "N/cache", "N/error", "N/format", "N/log", "N/ui/message", "N/record", "N/runtime", "../BCBudgetModels/BCTimeBill", "../BCBudgetModels/BCTimesheet", "../BCBudgetModels/BCEmployee", "../BCBudgetModels/BCResourceCost", "../BCBudgetServices/BCTimeBillService", "../BCBudgetServices/BCResourceCostService", "../BCBudgetServices/BCResourceRateTemplateService", "../BCBudgetServices/BCGlobalPreferencesService", "../BCBudgetServices/BCProjectService", "../BCBudgetServices/BCEmployeeService", "../BCBudgetServices/BCWorkCalendarService", "../BCBudgetModels/BCWorkCalendar", "../BCBudgetServices/BCCustomWorkCalendarService", "../BCBudgetModels/BCCustomWorkCalendar", "../BCBudgetServices/BCHolidayService", "../BCBudgetModels/BCHoliday", "../BCBudgetServices/BCOverTimeTemplateService", "../BCBudgetModels/BCOverTimeCostingSuitelet", "../BCBudgetModels/BCProjectCustomSegment", "../BCBudgetServices/BCCustomSegmentService", "../BCBudgetModels/BCProjectItem", "../BCBudgetModels/BCResourceCostingSuitelet", "../BCBudgetServices/BCTimeTypeService", "../BCBudgetModels/BCCostOvertimeDaily", "../BCBudgetServices/BCAccountPeriodService"], function (require, exports, cache, error, format, log, message, record, runtime, BCTimeBill_1, BCTimesheet_1, BCEmployee_1, BCResourceCost_1, BCTimeBillService_1, BCResourceCostService_1, BCResourceRateTemplateService_1, BCGlobalPreferencesService_1, BCProjectService_1, BCEmployeeService_1, BCWorkCalendarService_1, BCWorkCalendar_1, BCCustomWorkCalendarService_1, BCCustomWorkCalendar_1, BCHolidayService_1, BCHoliday_1, BCOverTimeTemplateService_1, BCOverTimeCostingSuitelet_1, BCProjectCustomSegment_1, BCCustomSegmentService_1, BCProjectItem_1, BCResourceCostingSuitelet_1, BCTimeTypeService_1, BCCostOvertimeDaily_1, BCAccountPeriodService_1) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getTimeBillsInDateCreatedOrder = exports.applyDailyThreshold = exports.applyWeeklyThreshold = exports.getWeekTimesBalance = exports.getWorkCalendarData = exports.handleOverTimeAllocation = exports.handleUpdateRelatedTimeRecord = exports.validateOTFields = exports.handleResourceCostJEDelete = exports.balanceJEAmounts = exports.handleResourceCostJEUpdate = exports.afterSubmit = exports.beforeSubmit = exports.getIsMissingTimeTypeMigrationRecords = exports.beforeLoad = void 0;
    var DAY_OF_WEEK_MAPPING = {
        0: "sunday",
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
    };
    // Time type is added just if necessary
    var FIELD_TO_TRIGGER_JE_UPDATE = [
        BCTimeBill_1.BCTimeBill.fields.mainProject,
        BCTimeBill_1.BCTimeBill.fields.trandate,
        BCTimeBill_1.BCTimeBill.fields.subsidiary,
        BCTimeBill_1.BCTimeBillLaborCost.fields.costCode,
        BCTimeBill_1.BCTimeBill.fields.memo,
        BCTimeBill_1.BCTimeBill.fields.hours,
    ];
    function beforeLoad(pContext) {
        var enableLaborJobCosting = new BCGlobalPreferencesService_1.BCGlobalPreferencesService().getActiveGlobalPreferences().enableLaborJobCosting;
        if (enableLaborJobCosting) {
            var isMissingMigrationTimebills = getIsMissingTimeTypeMigrationRecords();
            validateTimeTypeMigration(pContext, isMissingMigrationTimebills);
        }
    }
    exports.beforeLoad = beforeLoad;
    function getIsMissingTimeTypeMigrationRecords(timeBillService, timeTypeService) {
        var _a;
        if (timeBillService === void 0) { timeBillService = null; }
        if (timeTypeService === void 0) { timeTypeService = null; }
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        if (!timeTypeService)
            timeTypeService = new BCTimeTypeService_1.BCTimeTypeService();
        var filters = [
            [BCTimeBill_1.BCTimeBillLaborCost.fields.isOverTime, "is", true],
            "AND",
            [BCTimeBill_1.BCTimeBillLaborCost.fields.timeType, "anyof", "@NONE@"]
        ];
        var timeTypeDictionary = timeTypeService.getTimeTypeDictionary();
        var isMissingMigrationTimebills = ((_a = timeBillService.getAllBy(filters, timeTypeDictionary)) === null || _a === void 0 ? void 0 : _a.length) > 0;
        return isMissingMigrationTimebills;
    }
    exports.getIsMissingTimeTypeMigrationRecords = getIsMissingTimeTypeMigrationRecords;
    function validateTimeTypeMigration(pContext, isMissingMigrationTimebills, timeBillService) {
        if (timeBillService === void 0) { timeBillService = null; }
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        if (isMissingMigrationTimebills) {
            var triggerTimeTypeMigrationURL = timeBillService.resolveScriptURL({
                scriptId: BCResourceCostingSuitelet_1.BCResourceCostingSuitelet.scriptId,
                deploymentId: BCResourceCostingSuitelet_1.BCResourceCostingSuitelet.deploymentId,
                params: {
                    trigger: "migrate_time_type"
                }
            });
            pContext.form.addPageInitMessage({
                title: "Time Type Migration Required",
                message: "As part of a new update on the <b><i>BlueCollar Labor Job Costing</i></b> feature we required you to trigger the update of the existing records to be able to implement <b><i>Double Time</i></b> calculations.\n            <br>Please <a href='".concat(triggerTimeTypeMigrationURL, "' target=\"_blank\">click here</a> to trigger the migration. You can create, update, and delete timebills after this migration is completed."),
                type: message.Type.INFORMATION,
            });
        }
    }
    function beforeSubmit(pContext, timeBillService, globalPrefService) {
        var _a, _b, _c, _d, _e;
        if (timeBillService === void 0) { timeBillService = null; }
        if (globalPrefService === void 0) { globalPrefService = null; }
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        var isMissingMigrationTimebills = false;
        if ([pContext.UserEventType.CREATE, pContext.UserEventType.COPY].indexOf(pContext.type) !== -1) {
            pContext.newRecord.setValue(BCTimeBill_1.BCTimeBill.timeBillTimeAndMaterialsBillingFields.timeAndMaterialsBillingTransaction, null);
            pContext.newRecord.setValue(BCTimeBill_1.BCTimeBill.timeBillTimeAndMaterialsBillingFields.timeAndMaterialsBillingPerDiemTransaction, null);
        }
        try {
            if (!globalPrefService)
                globalPrefService = new BCGlobalPreferencesService_1.BCGlobalPreferencesService();
            var _f = globalPrefService.getActiveGlobalPreferences(), enableLaborJobCosting = _f.enableLaborJobCosting, disableOTCalculations = _f.disableOTCalculations;
            if (enableLaborJobCosting) {
                isMissingMigrationTimebills = getIsMissingTimeTypeMigrationRecords();
                if (isMissingMigrationTimebills) {
                    var timeTypeMigrationCache = cache.getCache({
                        name: BCTimesheet_1.BCTimesheet.cacheTimeTypeMigrationKey,
                        scope: cache.Scope.PUBLIC,
                    });
                    var timeTypeMigrationCacheValue = ((_a = pContext === null || pContext === void 0 ? void 0 : pContext.newRecord) === null || _a === void 0 ? void 0 : _a.id) ?
                        timeTypeMigrationCache.get({ key: (_c = (_b = pContext === null || pContext === void 0 ? void 0 : pContext.newRecord) === null || _b === void 0 ? void 0 : _b.id) === null || _c === void 0 ? void 0 : _c.toString() }) : "new-record";
                    if (timeTypeMigrationCacheValue != ((_e = (_d = pContext === null || pContext === void 0 ? void 0 : pContext.newRecord) === null || _d === void 0 ? void 0 : _d.id) === null || _e === void 0 ? void 0 : _e.toString())) {
                        if (runtime.executionContext === runtime.ContextType.USER_INTERFACE) {
                            var triggerTimeTypeMigrationURL = timeBillService.resolveScriptURL({
                                scriptId: BCResourceCostingSuitelet_1.BCResourceCostingSuitelet.scriptId,
                                deploymentId: BCResourceCostingSuitelet_1.BCResourceCostingSuitelet.deploymentId,
                                params: {
                                    trigger: "migrate_time_type"
                                }
                            });
                            throw new Error("As part of a new update on the <b><i>BlueCollar Labor Job Costing</i></b> feature we required you to trigger the update of the existing records to be able to implement <b><i>Double Time</i></b> calculations.\n                               Please <a href='".concat(triggerTimeTypeMigrationURL, "' target=\"_blank\">click here</a> to trigger the migration. You can create, update, and delete timebills after this migration is completed.</p>"));
                        }
                        else {
                            throw new Error("As part of a new update on the BlueCollar Labor Job Costing feature we required you to trigger the update of the existing records to be able to implement Double Time calculations. Please go to the BlueCollar Resource Costing to trigger the migration. You can create, update, and delete timebills after this migration is completed.");
                        }
                    }
                }
                if (!disableOTCalculations) {
                    try {
                        if (!isMissingMigrationTimebills)
                            validateOTFields(pContext);
                        handleResourceCostJEDelete(pContext);
                    }
                    catch (beforeSubmitError) {
                        log.error("message", beforeSubmitError.message);
                        log.error("stack", JSON.stringify(beforeSubmitError));
                        var UserEventType = pContext.UserEventType, type = pContext.type, newRecord = pContext.newRecord;
                        if ([UserEventType.CREATE].indexOf(type) != -1) { // If it fails during creation, delete the record
                            var timeBillItem = new BCTimeBill_1.BCTimeBill();
                            timeBillItem.id = newRecord.id.toString();
                            timeBillService.delete(timeBillItem);
                        }
                        throw error.create({
                            name: beforeSubmitError.name,
                            message: beforeSubmitError.message + " - UE -." + " Stack: " + beforeSubmitError.stack
                        });
                    }
                }
            }
        }
        catch (beforeSubmitError) {
            log.error("message", beforeSubmitError.message);
            log.error("stack", JSON.stringify(beforeSubmitError));
            if (isMissingMigrationTimebills || beforeSubmitError.message.indexOf("You can't delete an overtime allocation related to a straight time timesheet.") != -1)
                throw beforeSubmitError;
        }
    }
    exports.beforeSubmit = beforeSubmit;
    function afterSubmit(pContext, timeBillService, globalPrefService) {
        var _a, _b, _c, _d, _e, _f;
        if (timeBillService === void 0) { timeBillService = null; }
        if (globalPrefService === void 0) { globalPrefService = null; }
        try {
            if (!globalPrefService)
                globalPrefService = new BCGlobalPreferencesService_1.BCGlobalPreferencesService();
            var _g = globalPrefService.getActiveGlobalPreferences(), enableLaborJobCosting = _g.enableLaborJobCosting, disableOTCalculations = _g.disableOTCalculations;
            if (enableLaborJobCosting) {
                try {
                    var timeTypeMigrationCache = cache.getCache({
                        name: BCTimesheet_1.BCTimesheet.cacheTimeTypeMigrationKey,
                        scope: cache.Scope.PUBLIC,
                    });
                    var timeTypeMigrationCacheValue = timeTypeMigrationCache.get({
                        key: (_b = (_a = pContext === null || pContext === void 0 ? void 0 : pContext.newRecord) === null || _a === void 0 ? void 0 : _a.id) === null || _b === void 0 ? void 0 : _b.toString()
                    });
                    if (timeTypeMigrationCacheValue != ((_d = (_c = pContext === null || pContext === void 0 ? void 0 : pContext.newRecord) === null || _c === void 0 ? void 0 : _c.id) === null || _d === void 0 ? void 0 : _d.toString())) {
                        handleUpdateRelatedTimeRecord(pContext);
                        if (!disableOTCalculations)
                            handleOverTimeAllocation(pContext);
                    }
                    if (pContext.type != pContext.UserEventType.DELETE) {
                        handleResourceCostJEUpdate(pContext);
                    }
                    timeTypeMigrationCache.remove({
                        key: (_f = (_e = pContext === null || pContext === void 0 ? void 0 : pContext.newRecord) === null || _e === void 0 ? void 0 : _e.id) === null || _f === void 0 ? void 0 : _f.toString()
                    });
                }
                catch (afterSubmitError) {
                    log.error("message", afterSubmitError.message);
                    log.error("stack", JSON.stringify(afterSubmitError));
                    var UserEventType = pContext.UserEventType, type = pContext.type, newRecord = pContext.newRecord;
                    if ([UserEventType.CREATE].indexOf(type) != -1) { // If it fails during creation, delete the record
                        var timeBillItem = new BCTimeBill_1.BCTimeBill();
                        timeBillItem.id = newRecord.id.toString();
                        if (!timeBillService)
                            timeBillService = new BCTimeBillService_1.BCTimeBillService();
                        timeBillService.delete(timeBillItem);
                    }
                    throw error.create({
                        name: afterSubmitError.name,
                        message: afterSubmitError.message + " - UE -." + " Stack: " + afterSubmitError.stack
                    });
                }
            }
        }
        catch (enableLaborJobCostingError) {
            log.error("message", enableLaborJobCostingError.message);
            log.error("stack", JSON.stringify(enableLaborJobCostingError));
        }
    }
    exports.afterSubmit = afterSubmit;
    function handleResourceCostJEUpdate(pContext, resourceCostJournalId, relatedTimeBillsByJEData, resourceCostService, globalPrefService, timeBillService, projectService, employeeService, resRateTemplateService, customSegmentService, timeTypeService, accountPeriodService) {
        /**
         * CRUD Operation to BlueCollar Resource Cost Journal Entry
         */
        if (resourceCostJournalId === void 0) { resourceCostJournalId = null; }
        if (relatedTimeBillsByJEData === void 0) { relatedTimeBillsByJEData = null; }
        if (resourceCostService === void 0) { resourceCostService = null; }
        if (globalPrefService === void 0) { globalPrefService = null; }
        if (timeBillService === void 0) { timeBillService = null; }
        if (projectService === void 0) { projectService = null; }
        if (employeeService === void 0) { employeeService = null; }
        if (resRateTemplateService === void 0) { resRateTemplateService = null; }
        if (customSegmentService === void 0) { customSegmentService = null; }
        if (timeTypeService === void 0) { timeTypeService = null; }
        if (accountPeriodService === void 0) { accountPeriodService = null; }
        var newRecord = pContext.newRecord;
        var UserEventType = pContext.UserEventType, type = pContext.type;
        if (!resourceCostService)
            resourceCostService = new BCResourceCostService_1.BCResourceCostService();
        if (!globalPrefService)
            globalPrefService = new BCGlobalPreferencesService_1.BCGlobalPreferencesService();
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        if (!projectService)
            projectService = new BCProjectService_1.BCProjectService();
        if (!employeeService)
            employeeService = new BCEmployeeService_1.BCEmployeeService();
        if (!resRateTemplateService)
            resRateTemplateService = new BCResourceRateTemplateService_1.BCResourceRateTemplateService();
        if (!customSegmentService)
            customSegmentService = new BCCustomSegmentService_1.BCCustomSegmentService();
        if (!timeTypeService)
            timeTypeService = new BCTimeTypeService_1.BCTimeTypeService();
        if (!accountPeriodService)
            accountPeriodService = new BCAccountPeriodService_1.BCAccountingPeriodService();
        var recordId = newRecord.id;
        if ([UserEventType.DELETE].indexOf(type) != -1 && resourceCostJournalId && resourceCostJournalId != "" && Object.keys(relatedTimeBillsByJEData).length > 0 && relatedTimeBillsByJEData.lines.length > 0) {
            resourceCostService.update(relatedTimeBillsByJEData);
        }
        else if ([UserEventType.EDIT, UserEventType.XEDIT].indexOf(type) != -1) {
            var enableLaborJobCosting = globalPrefService.getActiveGlobalPreferences().enableLaborJobCosting;
            var timeBillCsegFields = timeBillService.getExistingTimeBillCseg([]);
            var resourceCostCsegFields = resourceCostService.getExistingResourceCostCseg([]);
            var triggerFields = enableLaborJobCosting
                ? __spreadArray(__spreadArray(__spreadArray([], FIELD_TO_TRIGGER_JE_UPDATE, true), [BCTimeBill_1.BCTimeBillLaborCost.fields.timeType], false), timeBillCsegFields, true) : __spreadArray(__spreadArray([], FIELD_TO_TRIGGER_JE_UPDATE, true), timeBillCsegFields, true);
            if (hasFieldsChanged(pContext, triggerFields)) {
                if (type == UserEventType.XEDIT)
                    newRecord = record.load({ type: newRecord.type, id: recordId });
                var oldResourceCostJournalsData = resourceCostService.getResourceCostJournalsByTimeBillId(recordId.toString());
                if ((oldResourceCostJournalsData === null || oldResourceCostJournalsData === void 0 ? void 0 : oldResourceCostJournalsData.length) > 0) {
                    var oldResourceCostJournalData_1 = null;
                    var closedPeriodJEIds_1 = [];
                    oldResourceCostJournalsData.forEach(function (currentJournalData) {
                        if (currentJournalData.accountingPeriodClosed) {
                            closedPeriodJEIds_1.push(currentJournalData.id);
                        }
                        else if (!oldResourceCostJournalData_1) {
                            oldResourceCostJournalData_1 = currentJournalData;
                        }
                    });
                    if (!oldResourceCostJournalData_1)
                        oldResourceCostJournalData_1 = oldResourceCostJournalsData[0];
                    var oldResourceCostJournalId = oldResourceCostJournalData_1.id;
                    // If there is a Resource Cost Journal Entry related to the Time Bill
                    if (oldResourceCostJournalId && oldResourceCostJournalId != "") {
                        var timeTypeDictionary = timeTypeService.getTimeTypeDictionary();
                        // If Accounting Period is Open, update record
                        if (!oldResourceCostJournalData_1.accountingPeriodClosed) {
                            var oldTranDate = new Date(oldResourceCostJournalData_1.tranDate);
                            oldTranDate = format.parse({ value: oldTranDate, type: format.Type.DATE });
                            var newTranDate = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.trandate) ? new Date(newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.trandate).toString()) : "";
                            newTranDate = format.parse({ value: newTranDate, type: format.Type.DATE });
                            var oldProject = oldResourceCostJournalData_1.project ? oldResourceCostJournalData_1.project : null;
                            var newProject = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.mainProject) ? newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.mainProject) : null;
                            if (oldTranDate.toString() != newTranDate.toString() || oldProject != newProject) {
                                relatedTimeBillsByJEData = resourceCostService.getAllRelatedTimeBillsByJE(oldResourceCostJournalId, timeTypeDictionary, recordId.toString());
                                if (relatedTimeBillsByJEData && relatedTimeBillsByJEData.lines) {
                                    if (relatedTimeBillsByJEData.lines.length == 0) {
                                        // Empty record, to be deleted
                                        var deleteData = new BCResourceCost_1.BCResourceCost();
                                        deleteData.id = oldResourceCostJournalId;
                                        resourceCostService.delete(deleteData);
                                    }
                                    else {
                                        // Update Old Resource Cost Journal Entry to remove the lines
                                        resourceCostService.update(relatedTimeBillsByJEData);
                                    }
                                }
                            }
                            // Update/Create New Resource Cost Journal Entry
                            // Always use full amounts (not delta); if there are closed-period JEs, prepend their
                            // reversal lines so upsert writes the complete correct amount for this time bill.
                            var allResourceCostData = getNewResourceCostData(newRecord, null, timeTypeDictionary, globalPrefService, timeBillService, resourceCostService, projectService, employeeService, resRateTemplateService, customSegmentService, timeBillCsegFields, resourceCostCsegFields);
                            resourceCostService.prependClosedPeriodReversals(allResourceCostData, recordId.toString(), closedPeriodJEIds_1, timeTypeDictionary, resourceCostCsegFields);
                            resourceCostService.upsert(allResourceCostData, timeTypeDictionary);
                        }
                        else { // If Accounting Period is Close, create a new record in the next Open Period
                            relatedTimeBillsByJEData = resourceCostService.getAllRelatedTimeBillsByJE(oldResourceCostJournalId, timeTypeDictionary, recordId.toString());
                            var rawTranDate = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.trandate);
                            var parsedTranDate = rawTranDate
                                ? format.parse({ value: new Date(rawTranDate.toString()), type: format.Type.DATE })
                                : null;
                            var nextOpenPeriodId_1 = accountPeriodService.getNextOpenAccountingPeriodId(parsedTranDate ? format.format({ value: parsedTranDate, type: format.Type.DATE }) : null);
                            var hasCsegChanged = timeBillCsegFields.length > 0 &&
                                hasFieldsChanged(pContext, timeBillCsegFields);
                            if (hasCsegChanged) {
                                // Segment changed (hours may also change): negative the old segments, positive the new segments
                                // Full-amount data for new segments (no closed-period delta adjustment)
                                var newFullAmountData_1 = getNewResourceCostData(newRecord, null, timeTypeDictionary, globalPrefService, timeBillService, resourceCostService, projectService, employeeService, resRateTemplateService, customSegmentService, timeBillCsegFields, resourceCostCsegFields);
                                resourceCostService.prependClosedPeriodReversals(newFullAmountData_1, recordId.toString(), closedPeriodJEIds_1, timeTypeDictionary, resourceCostCsegFields);
                                Object.keys(newFullAmountData_1).forEach(function (key) {
                                    newFullAmountData_1[key].postingPeriod = nextOpenPeriodId_1;
                                });
                                resourceCostService.upsert(newFullAmountData_1, timeTypeDictionary);
                            }
                            else {
                                // Hours changed, no segment change: create delta JE in next open period
                                var newDiffResourceCostData_1 = getNewResourceCostData(newRecord, closedPeriodJEIds_1, timeTypeDictionary, globalPrefService, timeBillService, resourceCostService, projectService, employeeService, resRateTemplateService, customSegmentService, timeBillCsegFields, resourceCostCsegFields);
                                Object.keys(newDiffResourceCostData_1).forEach(function (projectDateSubsidiaryKey) {
                                    newDiffResourceCostData_1[projectDateSubsidiaryKey].postingPeriod = nextOpenPeriodId_1;
                                });
                                resourceCostService.upsert(newDiffResourceCostData_1, timeTypeDictionary);
                            }
                        }
                    }
                }
            }
        }
    }
    exports.handleResourceCostJEUpdate = handleResourceCostJEUpdate;
    function hasFieldsChanged(pContext, fieldIds) {
        var isXedit = pContext.type === pContext.UserEventType.XEDIT;
        // In XEDIT, context.newRecord only includes modified fields
        // So we check if any of the fields exist in newRecord
        if (isXedit) {
            return fieldIds.some(function (fieldId) {
                try {
                    // will throw error if field not in newRecord (i.e., not modified)
                    var value = pContext.newRecord.getValue({ fieldId: fieldId });
                    return value !== undefined;
                }
                catch (e) {
                    return false;
                }
            });
        }
        // For EDIT (and others), compare newRecord and oldRecord values
        return fieldIds.some(function (fieldId) {
            var _a, _b, _c;
            var oldValue = (_b = (_a = pContext.oldRecord) === null || _a === void 0 ? void 0 : _a.getValue({ fieldId: fieldId })) === null || _b === void 0 ? void 0 : _b.toString();
            var newValue = (_c = pContext.newRecord.getValue({ fieldId: fieldId })) === null || _c === void 0 ? void 0 : _c.toString();
            return oldValue != newValue;
        });
    }
    function getNewResourceCostData(newRecord, closedPeriodJEIds, timeTypeDictionary, globalPrefService, timeBillService, resourceCostService, projectService, employeeService, resRateTemplateService, customSegmentService, timeBillCsegFields, resourceCostCsegFields) {
        if (closedPeriodJEIds === void 0) { closedPeriodJEIds = null; }
        if (globalPrefService === void 0) { globalPrefService = null; }
        if (timeBillService === void 0) { timeBillService = null; }
        if (resourceCostService === void 0) { resourceCostService = null; }
        if (projectService === void 0) { projectService = null; }
        if (employeeService === void 0) { employeeService = null; }
        if (resRateTemplateService === void 0) { resRateTemplateService = null; }
        if (customSegmentService === void 0) { customSegmentService = null; }
        if (timeBillCsegFields === void 0) { timeBillCsegFields = null; }
        if (resourceCostCsegFields === void 0) { resourceCostCsegFields = null; }
        if (!globalPrefService)
            globalPrefService = new BCGlobalPreferencesService_1.BCGlobalPreferencesService();
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        if (!resourceCostService)
            resourceCostService = new BCResourceCostService_1.BCResourceCostService();
        if (!projectService)
            projectService = new BCProjectService_1.BCProjectService();
        if (!employeeService)
            employeeService = new BCEmployeeService_1.BCEmployeeService();
        if (!resRateTemplateService)
            resRateTemplateService = new BCResourceRateTemplateService_1.BCResourceRateTemplateService();
        if (!customSegmentService)
            customSegmentService = new BCCustomSegmentService_1.BCCustomSegmentService();
        var _a = globalPrefService.getActiveGlobalPreferences(), postCostAllTimeEntries = _a.postCostAllTimeEntries, overrideCreditSegmentInResourceJe = _a.overrideCreditSegmentInResourceJe;
        var employee = newRecord.getValue({ fieldId: BCTimeBill_1.BCTimeBill.fields.employee });
        var currentTimeBillId = newRecord.id;
        var employeeDataToLook = {
            employeeId: null,
            fieldsIds: [],
            result: null
        };
        employeeDataToLook.employeeId = String(employee);
        employeeDataToLook.fieldsIds = [
            BCEmployee_1.BCEmployeeLaborCost.fields.resourceRateTemplate
        ];
        var resourceTemplateResult = employeeService.lookupFields(employeeDataToLook).result;
        var resourceTemplate = resourceTemplateResult && resourceTemplateResult && resourceTemplateResult[BCEmployee_1.BCEmployeeLaborCost.fields.resourceRateTemplate] && resourceTemplateResult[BCEmployee_1.BCEmployeeLaborCost.fields.resourceRateTemplate][0] ? resourceTemplateResult[BCEmployee_1.BCEmployeeLaborCost.fields.resourceRateTemplate][0].value : null;
        var allResourceCostData = {};
        if (resourceTemplate) {
            var employeesResourceMapping_1 = [{
                    employee: employee,
                    resourceCostTemplate: resourceTemplate
                }];
            var allRateTemplateData_1 = getResourceRateTemplateData([resourceTemplate], resRateTemplateService);
            var allTemplateCustSegmentTypes_1 = [];
            var _loop_1 = function (currentRateTemplateID) {
                var debitCount = 0;
                var creditCount = 0;
                var rateDetailName = null;
                allRateTemplateData_1[currentRateTemplateID].forEach(function (rateTemplateData) {
                    var key = Object.keys(rateTemplateData)[0];
                    if (key == 'debit')
                        debitCount++;
                    else if (key == 'credit')
                        creditCount++;
                    if (!rateDetailName)
                        rateDetailName = rateTemplateData[key].rateDetailName;
                    if (allTemplateCustSegmentTypes_1.indexOf(rateTemplateData[key].custSegmentType) == -1) {
                        allTemplateCustSegmentTypes_1.push(rateTemplateData[key].custSegmentType);
                    }
                });
                if (debitCount != creditCount || debitCount == 0 || creditCount == 0)
                    throw new Error("The Resource Rate Detail called \"".concat(rateDetailName, "\" has an invalid configuration. The number of debit and credit lines must be the same, and each type should have at least one line"));
            };
            for (var _i = 0, _b = Object.keys(allRateTemplateData_1).filter(function (id) { return id != "resourceRateData"; }); _i < _b.length; _i++) {
                var currentRateTemplateID = _b[_i];
                _loop_1(currentRateTemplateID);
            }
            var allTimesBillsCseg = timeBillCsegFields !== null && timeBillCsegFields !== void 0 ? timeBillCsegFields : timeBillService.getExistingTimeBillCseg([]);
            var allResourceCostCseg = resourceCostCsegFields !== null && resourceCostCsegFields !== void 0 ? resourceCostCsegFields : resourceCostService.getExistingResourceCostCseg([]);
            var allTemplateResourceCostCseg = resourceCostService.getExistingResourceCostCseg(allTemplateCustSegmentTypes_1);
            var allCsegToSearch = allTimesBillsCseg.concat(allResourceCostCseg.concat(allTemplateResourceCostCseg).filter(function (value, index, self) {
                return self.indexOf(value) === index;
            }));
            var csegAllColumnsIds_1 = customSegmentService.getColumnsIdsMappingById(allCsegToSearch);
            var csegTimebillsColumnsIds_1 = [];
            allTimesBillsCseg.forEach(function (currentCsegId) {
                if (csegAllColumnsIds_1[currentCsegId])
                    csegTimebillsColumnsIds_1.push(csegAllColumnsIds_1[currentCsegId]);
            });
            var csegResourceCostColumnsIds_1 = [];
            allResourceCostCseg.forEach(function (currentCsegId) {
                if (csegAllColumnsIds_1[currentCsegId])
                    csegResourceCostColumnsIds_1.push(csegAllColumnsIds_1[currentCsegId]);
            });
            var csegTemplateCostColumnsIds_1 = [];
            allTemplateResourceCostCseg.forEach(function (currentCsegId) {
                if (csegAllColumnsIds_1[currentCsegId])
                    csegTemplateCostColumnsIds_1.push(csegAllColumnsIds_1[currentCsegId]);
            });
            var allTimesBills = timeBillService.getAllTimeBillByIds(timeTypeDictionary, currentTimeBillId, csegTimebillsColumnsIds_1, postCostAllTimeEntries, null, null);
            var projectIds = allTimesBills.map(function (timeBill) { return timeBill.project.value; }).filter(function (projectId) { return projectId != null; });
            var projectsMapping_1 = {};
            var projectFilteredByFields_1 = customSegmentService.getCustomSegmentFilters(BCProjectCustomSegment_1.BCProjectCustomSegment.type);
            var filteredByInProjects_1 = {};
            if (projectIds.length > 0) {
                var filters = [
                    [BCProjectItem_1.BCProjectItem.fields.internalId, "anyof", projectIds]
                ];
                projectService.getAllBy(filters).forEach(function (p) {
                    projectsMapping_1[p.id] = p;
                });
                filteredByInProjects_1 = projectService.getFilteredByValues(projectIds, projectFilteredByFields_1);
            }
            var subsidiaryByProjectMapping_1 = {};
            if (projectIds.length > 0) {
                var subsidiaryByProject = projectService.getSubsidiaryByProject(projectIds);
                subsidiaryByProject.forEach(function (currentProject) {
                    subsidiaryByProjectMapping_1[currentProject.id] = currentProject.subsidiary && currentProject.subsidiary.value ? currentProject.subsidiary.value : null;
                });
            }
            var existingAmountPerTimeBill_1 = {};
            if (closedPeriodJEIds && closedPeriodJEIds.length > 0) {
                // Substract amount from existing JE by timebill, and populate next open accounting period
                existingAmountPerTimeBill_1 = resourceCostService.getExistingAmountPerTimeBill(currentTimeBillId, closedPeriodJEIds);
            }
            allTimesBills.forEach(function (curentTimeBill) {
                var resourceTemplateId = null;
                for (var i = 0; i < employeesResourceMapping_1.length; i++) {
                    if (employeesResourceMapping_1[i]["employee"] === curentTimeBill.employee.value) {
                        resourceTemplateId = employeesResourceMapping_1[i]["resourceCostTemplate"].trim();
                        break;
                    }
                }
                var project = curentTimeBill.project.value;
                var tranDate = curentTimeBill.date;
                var subsidiary = curentTimeBill.subsidiary.value;
                if (resourceTemplateId) {
                    allRateTemplateData_1[resourceTemplateId].forEach(function (rateTemplateData) {
                        var _a, _b, _c, _d, _e, _f, _g;
                        if (Object.keys(rateTemplateData).length > 0) {
                            if (!allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)]) {
                                allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)] = new BCResourceCost_1.BCResourceCost();
                                allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)].lines = [];
                                allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)].project = projectsMapping_1[project];
                                if (project)
                                    allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)].project.filteredBy = filteredByInProjects_1[project];
                                allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)].tranDate = tranDate;
                                allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)].subsidiary = subsidiary;
                            }
                            var account = rateTemplateData.credit ? rateTemplateData.credit.account : rateTemplateData.debit.account;
                            //segments
                            var classId = resolveSegmentValue(!!rateTemplateData.debit, overrideCreditSegmentInResourceJe, curentTimeBill.class, (_a = rateTemplateData.debit) === null || _a === void 0 ? void 0 : _a.class, (_b = rateTemplateData.credit) === null || _b === void 0 ? void 0 : _b.class);
                            var department = resolveSegmentValue(!!rateTemplateData.debit, overrideCreditSegmentInResourceJe, (_c = curentTimeBill.department) === null || _c === void 0 ? void 0 : _c.value, (_d = rateTemplateData.debit) === null || _d === void 0 ? void 0 : _d.department, (_e = rateTemplateData.credit) === null || _e === void 0 ? void 0 : _e.department);
                            var location_1 = resolveSegmentValue(!!rateTemplateData.debit, overrideCreditSegmentInResourceJe, curentTimeBill.location, (_f = rateTemplateData.debit) === null || _f === void 0 ? void 0 : _f.location, (_g = rateTemplateData.credit) === null || _g === void 0 ? void 0 : _g.location);
                            var stCost = roundToTwoDecimals(curentTimeBill.hours * (rateTemplateData.credit ? rateTemplateData.credit.rate : rateTemplateData.debit.rate));
                            var otCost = roundToTwoDecimals(curentTimeBill.hours * (rateTemplateData.credit ? rateTemplateData.credit.overTimeRate : rateTemplateData.debit.overTimeRate));
                            var dtCost = roundToTwoDecimals(curentTimeBill.hours * (rateTemplateData.credit ? rateTemplateData.credit.doubleTimeRate : rateTemplateData.debit.doubleTimeRate));
                            var _h = getExistingJELine(allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)].lines, { account: account, classId: classId, department: department, location: location_1 }), newJournalLine_1 = _h.journalEntry, isNew = _h.isNew;
                            newJournalLine_1.timeTracking = curentTimeBill.id;
                            newJournalLine_1.project = curentTimeBill.project.value;
                            newJournalLine_1.costCode = rateTemplateData.debit ? (curentTimeBill.costCode.value || rateTemplateData.debit.costCode) : rateTemplateData.credit.costCode;
                            newJournalLine_1.account = account;
                            newJournalLine_1.debit = rateTemplateData.debit ? true : false;
                            newJournalLine_1.credit = rateTemplateData.credit ? true : false;
                            newJournalLine_1.costs = +(newJournalLine_1.costs + stCost).toFixed(2);
                            newJournalLine_1.timeType = curentTimeBill.timeType;
                            newJournalLine_1.isOverTime = curentTimeBill.isOverTime;
                            newJournalLine_1.isDoubleTime = curentTimeBill.isDoubleTime;
                            newJournalLine_1.overTimeCost = +(newJournalLine_1.overTimeCost + otCost).toFixed(2);
                            newJournalLine_1.doubleTimeCost = +(dtCost + newJournalLine_1.doubleTimeCost).toFixed(2);
                            newJournalLine_1.memo = curentTimeBill.memo;
                            newJournalLine_1.department = department;
                            newJournalLine_1.class = classId;
                            newJournalLine_1.location = location_1;
                            var locationFields = resourceCostService.resolveJournalLineLocationFields(rateTemplateData, curentTimeBill.location, overrideCreditSegmentInResourceJe);
                            newJournalLine_1.updateDebitLocation = locationFields.updateDebitLocation;
                            newJournalLine_1.updateCreditLocation = locationFields.updateCreditLocation;
                            newJournalLine_1.rateAccountDetailId = locationFields.rateAccountDetailId;
                            if (rateTemplateData.debit || (rateTemplateData.credit && overrideCreditSegmentInResourceJe)) {
                                Object.keys(curentTimeBill.cseg || {}).forEach(function (csegKey) {
                                    if (csegResourceCostColumnsIds_1.indexOf(csegKey) !== -1) {
                                        newJournalLine_1.cseg[csegKey] = curentTimeBill.cseg[csegKey];
                                    }
                                });
                            }
                            else if (rateTemplateData.credit) {
                                Object.keys(curentTimeBill.cseg || {}).forEach(function (csegKey) {
                                    if (csegTemplateCostColumnsIds_1.indexOf(csegKey) !== -1) {
                                        newJournalLine_1.cseg[csegKey] = curentTimeBill.cseg[csegKey];
                                    }
                                });
                            }
                            // Validate if missing filters in project
                            if (project && project != "" && newJournalLine_1.debit && projectFilteredByFields_1.length > 0 && filteredByInProjects_1[project] && Object.keys(filteredByInProjects_1[project]).length) {
                                var projectCsegKeysToValidate = Object.keys(filteredByInProjects_1[project]);
                                for (var _i = 0, projectCsegKeysToValidate_1 = projectCsegKeysToValidate; _i < projectCsegKeysToValidate_1.length; _i++) {
                                    var currentCsegKey = projectCsegKeysToValidate_1[_i];
                                    if (filteredByInProjects_1[project][currentCsegKey].length == 0)
                                        throw new Error("Project ".concat(project, " is filtered by \"").concat(currentCsegKey, "\" but none is configured"));
                                    else {
                                        // Validate NetSuite native segments Class, Department, Location, and Subsidiary
                                        var nativeCsegKeys = ["class", "department", "location", "subsidiary"];
                                        if ((currentCsegKey.indexOf("cseg") == 0 && Object.keys(curentTimeBill.cseg).indexOf("line.".concat(currentCsegKey)) != -1 && filteredByInProjects_1[project][currentCsegKey].indexOf(curentTimeBill.cseg["line.".concat(currentCsegKey)]) == -1)
                                            ||
                                                (currentCsegKey.indexOf("cseg") == -1 && nativeCsegKeys.indexOf(currentCsegKey) != -1
                                                    &&
                                                        ((currentCsegKey == "subsidiary" && filteredByInProjects_1[project][currentCsegKey].indexOf(subsidiary) == -1)
                                                            ||
                                                                (Object.keys(newJournalLine_1).indexOf(currentCsegKey) != -1 && filteredByInProjects_1[project][currentCsegKey].indexOf(newJournalLine_1[currentCsegKey] ? newJournalLine_1[currentCsegKey].toString() : newJournalLine_1[currentCsegKey]) == -1))))
                                            throw new Error("Project ".concat(project, " is filtered by \"").concat(currentCsegKey, "\" but it is not correctly configured on the Time Tracking record \"").concat(curentTimeBill.id, "\""));
                                    }
                                }
                            }
                            if (isNew)
                                allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)].lines.push(newJournalLine_1);
                        }
                    });
                }
                balanceJEAmounts(allResourceCostData["".concat(project, "-").concat(tranDate, "-").concat(subsidiary)].lines, existingAmountPerTimeBill_1[curentTimeBill.id]);
            });
        }
        return allResourceCostData;
    }
    function roundToTwoDecimals(num) {
        var epsilon = 1e-10; // substitute for Number.EPSILON
        return +(Math.round((num + epsilon) * 100) / 100).toFixed(2);
    }
    function getExistingJELine(jeLines, _a) {
        var account = _a.account, classId = _a.classId, department = _a.department, location = _a.location;
        var isNew = true;
        var existingJournalLine = {
            id: "",
            timeTracking: null,
            project: null,
            costCode: null,
            account: null,
            debit: null,
            credit: null,
            costs: null,
            timeType: { text: null, value: null },
            isOverTime: null,
            isDoubleTime: null,
            overTimeCost: null,
            doubleTimeCost: null,
            memo: null,
            name: null,
            department: null,
            class: null,
            location: null,
            updateDebitLocation: null,
            updateCreditLocation: null,
            rateAccountDetailId: null,
            cseg: {},
        };
        jeLines.forEach(function (currentJELine) {
            if (currentJELine.account == account &&
                currentJELine.class == classId &&
                currentJELine.department == department &&
                currentJELine.location == location) {
                isNew = false;
                existingJournalLine = currentJELine;
            }
        });
        return { journalEntry: existingJournalLine, isNew: isNew };
    }
    function balanceJEAmounts(jeLines, existingAmountForTimeBill) {
        jeLines.forEach(function (currentJELine) {
            var account = currentJELine.account;
            var classId = currentJELine.class;
            var department = currentJELine.department;
            var location = currentJELine.location;
            var key = "".concat(account || null, "-").concat(classId || null, "-").concat(department || null, "-").concat(location || null);
            var expectedAmount = +((currentJELine.isOverTime ? currentJELine.overTimeCost : (currentJELine.isDoubleTime ? currentJELine.doubleTimeCost : currentJELine.costs)) * (currentJELine.credit ? 1 : -1));
            var currentBalance = +(existingAmountForTimeBill && existingAmountForTimeBill[key] ? existingAmountForTimeBill[key] : 0);
            var newAmount = +(-(expectedAmount - currentBalance));
            if (newAmount > 0) {
                currentJELine.credit = false;
                currentJELine.debit = true;
            }
            else {
                newAmount = newAmount * -1;
                // Clear costCode when flipping a debit line to credit during closed-period delta rebalance
                // Intentional: do not allow cost codes on credit JE lines
                if (currentJELine.debit)
                    currentJELine.costCode = null;
                currentJELine.credit = true;
                currentJELine.debit = false;
            }
            if (currentJELine.isOverTime)
                currentJELine.overTimeCost = newAmount;
            else if (currentJELine.isDoubleTime)
                currentJELine.doubleTimeCost = newAmount;
            else
                currentJELine.costs = newAmount;
        });
    }
    exports.balanceJEAmounts = balanceJEAmounts;
    function getResourceRateTemplateData(resourceTemplateIds, resRateTemplateService) {
        if (resRateTemplateService === void 0) { resRateTemplateService = null; }
        if (!resRateTemplateService)
            resRateTemplateService = new BCResourceRateTemplateService_1.BCResourceRateTemplateService();
        var allRateTemplateData = resRateTemplateService.getResourceRateData(resourceTemplateIds);
        return allRateTemplateData;
    }
    function handleResourceCostJEDelete(pContext, timeBillService, resourceCostService, timeTypeService) {
        if (timeBillService === void 0) { timeBillService = null; }
        if (resourceCostService === void 0) { resourceCostService = null; }
        if (timeTypeService === void 0) { timeTypeService = null; }
        var UserEventType = pContext.UserEventType, type = pContext.type, newRecord = pContext.newRecord;
        if (!timeTypeService)
            timeTypeService = new BCTimeTypeService_1.BCTimeTypeService();
        var timeTypeDictionary = timeTypeService.getTimeTypeDictionary();
        var recordId = newRecord.id;
        if (type == UserEventType.DELETE) {
            if (!timeBillService)
                timeBillService = new BCTimeBillService_1.BCTimeBillService();
            if (!resourceCostService)
                resourceCostService = new BCResourceCostService_1.BCResourceCostService();
            var resourceCostJournalDataResult = resourceCostService.getResourceCostJournalsByTimeBillId(recordId.toString());
            var resourceCostJournalData = (resourceCostJournalDataResult === null || resourceCostJournalDataResult === void 0 ? void 0 : resourceCostJournalDataResult.length) > 0 ? resourceCostJournalDataResult[0] : null;
            if (resourceCostJournalData) {
                var resourceCostJournalId = resourceCostJournalData.id;
                if (resourceCostJournalId) {
                    var getRelatedTimeBillsByJEData = resourceCostService.getAllRelatedTimeBillsByJE(resourceCostJournalId, timeTypeDictionary, recordId.toString());
                    var relatedTimeBillIds_1 = [];
                    getRelatedTimeBillsByJEData.lines.forEach(function (currentJELine) {
                        if (relatedTimeBillIds_1.indexOf(currentJELine.timeTracking) == -1) {
                            relatedTimeBillIds_1.push(currentJELine.timeTracking);
                        }
                    });
                    if (resourceCostJournalId && relatedTimeBillIds_1.length == 0) { // No other timesheets, delete JE
                        var deleteData = new BCResourceCost_1.BCResourceCost();
                        deleteData.id = resourceCostJournalId;
                        resourceCostService.delete(deleteData);
                    }
                    else { // There are other timesheets, update JE
                        handleResourceCostJEUpdate(pContext, resourceCostJournalId, getRelatedTimeBillsByJEData);
                    }
                }
            }
        }
    }
    exports.handleResourceCostJEDelete = handleResourceCostJEDelete;
    function validateOTFields(pContext, timeBillService) {
        if (timeBillService === void 0) { timeBillService = null; }
        var oldRecord = pContext.oldRecord;
        var newRecord = pContext.newRecord, UserEventType = pContext.UserEventType, type = pContext.type;
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        if ([UserEventType.CREATE, UserEventType.COPY].indexOf(type) != -1) {
            var timestamp = newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.fields.timestamp);
            var timeType = newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.fields.timeType);
            var isOverDoubleTime = timeType != "";
            var overDoubleTimeFrom = newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.fields.overDoubleTimeFrom);
            var hours = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.hours);
            var memo = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.memo);
            var tranDate = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.trandate);
            var cacheKey = timeBillService.createTimesheetCacheKey(isOverDoubleTime, timestamp, (isOverDoubleTime ? overDoubleTimeFrom : "ST"), hours, memo, tranDate);
            var timesheetCache = cache.getCache({
                name: BCTimesheet_1.BCTimesheet.cacheOTAllocationKey,
                scope: cache.Scope.PUBLIC,
            });
            var timesheetCacheValue = timesheetCache.get({
                key: cacheKey
            });
            var createdByUserFlag = !(timesheetCacheValue && timesheetCacheValue != "" && timesheetCacheValue === cacheKey);
            if (createdByUserFlag) {
                newRecord.setValue(BCTimeBill_1.BCTimeBillLaborCost.fields.timeType, null);
                newRecord.setValue(BCTimeBill_1.BCTimeBillLaborCost.fields.overDoubleTimeFrom, null);
            }
        }
        else if ([UserEventType.EDIT, UserEventType.XEDIT].indexOf(type) != -1) {
            var overDoubleTimeFrom = newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.fields.overDoubleTimeFrom);
            if (overDoubleTimeFrom && overDoubleTimeFrom == newRecord.id) {
                overDoubleTimeFrom = null;
                newRecord.setValue({ fieldId: BCTimeBill_1.BCTimeBillLaborCost.fields.overDoubleTimeFrom, value: overDoubleTimeFrom });
            }
            var cacheKey = "".concat(BCTimesheet_1.BCTimesheet.cacheTSUpdate).concat(newRecord.id);
            var timesheetCache = cache.getCache({
                name: BCTimesheet_1.BCTimesheet.cacheOTAllocationKey,
                scope: cache.Scope.PUBLIC,
            });
            var timesheetCacheValue = timesheetCache.get({
                key: cacheKey
            });
            var editedByUserFlag = !(timesheetCacheValue && timesheetCacheValue != "" && timesheetCacheValue === cacheKey);
            if (editedByUserFlag) {
                var fieldsToRollback = [BCTimeBill_1.BCTimeBillLaborCost.fields.timeType, BCTimeBill_1.BCTimeBillLaborCost.fields.overDoubleTimeFrom];
                if (type == UserEventType.XEDIT)
                    oldRecord = record.load({
                        type: oldRecord.type,
                        id: oldRecord.id,
                    });
                fieldsToRollback.forEach(function (currentField) {
                    newRecord.setValue(currentField, oldRecord.getValue({ fieldId: currentField }));
                });
            }
            else {
                if (overDoubleTimeFrom) {
                    var cacheKey_1 = "".concat(BCTimesheet_1.BCTimesheet.cacheOTTimesheetValuesProcessed).concat(newRecord.id);
                    var oldHours = +oldRecord.getValue({ fieldId: BCTimeBill_1.BCTimeBill.fields.hours }).toString().split(":")[0];
                    var oldMinutes = oldRecord.getValue({ fieldId: BCTimeBill_1.BCTimeBill.fields.hours }).toString().split(":")[1] ? (+oldRecord.getValue({ fieldId: BCTimeBill_1.BCTimeBill.fields.hours }).toString().split(":")[1]) / 60 : 0;
                    var oldNumericHours = oldHours + oldMinutes;
                    var newHours = +newRecord.getValue({ fieldId: BCTimeBill_1.BCTimeBill.fields.hours }).toString().split(":")[0];
                    var newMinutes = newRecord.getValue({ fieldId: BCTimeBill_1.BCTimeBill.fields.hours }).toString().split(":")[1] ? (+newRecord.getValue({ fieldId: BCTimeBill_1.BCTimeBill.fields.hours }).toString().split(":")[1]) / 60 : 0;
                    var newNumericHours = newHours + newMinutes;
                    var timesheetCache_1 = cache.getCache({
                        name: BCTimesheet_1.BCTimesheet.cacheOTTimesheetValuesProcessed,
                        scope: cache.Scope.PUBLIC,
                    });
                    var cachedValue = timesheetCache_1.get({ key: cacheKey_1 });
                    if (cachedValue) {
                        var _a = JSON.parse(cachedValue), cachedHours = _a.hours, difference = _a.difference;
                        if (cachedHours && oldNumericHours.toString() != cachedHours) {
                            newRecord.setValue(BCTimeBill_1.BCTimeBill.fields.hours, newNumericHours + difference);
                        }
                        else {
                            var newDifference = newNumericHours - oldNumericHours;
                            timesheetCache_1.put({
                                key: cacheKey_1,
                                value: JSON.stringify({
                                    hours: cachedHours,
                                    difference: newDifference
                                }),
                                ttl: 300 // 5 min
                            });
                        }
                    }
                }
            }
        }
        else if ([UserEventType.DELETE].indexOf(type) != -1) {
            var recordId = newRecord.id;
            var timeBillDataToLook = {
                timeBillId: null,
                fieldsIds: [],
                result: null
            };
            timeBillDataToLook.timeBillId = recordId.toString();
            timeBillDataToLook.fieldsIds = [
                BCTimeBill_1.BCTimeBill.fields.timesheet
            ];
            var timeBillDataResult = timeBillService.lookupFields(timeBillDataToLook).result;
            var relatedWeeklyTimesheetId = timeBillDataResult && timeBillDataResult && timeBillDataResult[BCTimeBill_1.BCTimeBill.fields.timesheet] && timeBillDataResult[BCTimeBill_1.BCTimeBill.fields.timesheet][0] ? timeBillDataResult[BCTimeBill_1.BCTimeBill.fields.timesheet][0].value : null;
            var cacheKey = "".concat(BCTimesheet_1.BCTimesheet.cacheTSGetWeekly).concat(recordId);
            var timesheetCache = cache.getCache({
                name: BCTimesheet_1.BCTimesheet.cacheGetWeeklyName,
                scope: cache.Scope.PUBLIC,
            });
            timesheetCache.put({
                key: cacheKey,
                value: relatedWeeklyTimesheetId
            });
        }
    }
    exports.validateOTFields = validateOTFields;
    function handleUpdateRelatedTimeRecord(pContext, timeBillService, timeTypeService) {
        var _a, _b, _c;
        if (timeBillService === void 0) { timeBillService = null; }
        if (timeTypeService === void 0) { timeTypeService = null; }
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        if (!timeTypeService)
            timeTypeService = new BCTimeTypeService_1.BCTimeTypeService();
        var timeTypeDictionary = timeTypeService.getTimeTypeDictionary();
        var newRecord = pContext.newRecord;
        var UserEventType = pContext.UserEventType, type = pContext.type;
        if ([UserEventType.EDIT, UserEventType.XEDIT].indexOf(type) != -1) {
            if (type == UserEventType.XEDIT)
                newRecord = record.load({
                    type: newRecord.type,
                    id: newRecord.id,
                });
            var fieldsIdsToCopy = [
                BCTimeBill_1.BCTimeBill.fields.employee,
                BCTimeBill_1.BCTimeBill.fields.trandate,
                BCTimeBill_1.BCTimeBill.fields.mainProject,
                BCTimeBill_1.BCTimeBill.fields.memo,
                BCTimeBill_1.BCTimeBill.fields.subsidiary,
                BCTimeBill_1.BCTimeBillLaborCost.fields.costCode,
                BCTimeBill_1.BCTimeBill.fields.location,
                BCTimeBill_1.BCTimeBill.fields.department,
                BCTimeBill_1.BCTimeBill.fields.class,
                BCTimeBill_1.BCTimeBill.fields.type
            ];
            var allFieldsIds = newRecord.getFields();
            //Get all cseg ids to be copied
            var csegFields = allFieldsIds.filter(function (fieldId) {
                return fieldId.indexOf("cseg") != -1;
            });
            fieldsIdsToCopy = fieldsIdsToCopy.concat(csegFields);
            var fieldsDataToCopy_1 = {};
            fieldsIdsToCopy.forEach(function (currentField) {
                var fieldValue = newRecord.getValue({ fieldId: currentField });
                fieldsDataToCopy_1[currentField] = fieldValue;
            });
            if (fieldsDataToCopy_1 && Object.keys(fieldsDataToCopy_1).length > 0) {
                var overDoubleTimeFrom = (_a = newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.fields.overDoubleTimeFrom)) === null || _a === void 0 ? void 0 : _a.toString(); // There's an straight time record related to this over time record
                var timeBillsIds = [(_b = newRecord.id) === null || _b === void 0 ? void 0 : _b.toString()];
                if (overDoubleTimeFrom)
                    timeBillsIds.push(overDoubleTimeFrom);
                var relatedTimeBillsIds = getAllRelatedTimeBills((_c = newRecord.id) === null || _c === void 0 ? void 0 : _c.toString(), timeBillsIds, timeTypeDictionary);
                if (overDoubleTimeFrom)
                    relatedTimeBillsIds.push(overDoubleTimeFrom);
                if (relatedTimeBillsIds.length > 0)
                    relatedTimeBillsIds.forEach(function (currentTimeBillId) {
                        var submitFieldsModel = new BCTimeBill_1.BCTimeBillSubmitFields();
                        submitFieldsModel.timeBillId = currentTimeBillId;
                        submitFieldsModel.fieldsIdsValues = fieldsDataToCopy_1;
                        timeBillService.submitFields(submitFieldsModel);
                    });
            }
        }
    }
    exports.handleUpdateRelatedTimeRecord = handleUpdateRelatedTimeRecord;
    function getAllRelatedTimeBills(newRecordId, prevRelatedRecordsIds, timeTypeDictionary, timeBillService) {
        if (timeBillService === void 0) { timeBillService = null; }
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        var relatedLength = prevRelatedRecordsIds.length;
        var isfirstCall = true;
        while (isfirstCall || relatedLength != prevRelatedRecordsIds.length) {
            relatedLength = prevRelatedRecordsIds.length;
            isfirstCall = false;
            var filters = [
                [BCTimeBill_1.BCTimeBillLaborCost.fields.internalId, "anyof", prevRelatedRecordsIds],
                "OR",
                [BCTimeBill_1.BCTimeBillLaborCost.fields.overDoubleTimeFrom, "anyof", prevRelatedRecordsIds]
            ];
            var timeBills = timeBillService.getAllBy(filters, timeTypeDictionary);
            // There's another timebill record related to this one
            if (timeBills.length > 0) {
                var newRelatedTimeBills = timeBills
                    .map(function (currentTimeBill) { return currentTimeBill.id; })
                    .filter(function (value) { return value != null; });
                var newOverDoubleFromTimeBills = timeBills
                    .map(function (currentTimeBill) { return currentTimeBill.overDoubleTimeFrom; })
                    .filter(function (value) { return value != null; });
                prevRelatedRecordsIds = prevRelatedRecordsIds.concat(newRelatedTimeBills).concat(newOverDoubleFromTimeBills);
                // Remove repeated ids
                prevRelatedRecordsIds = prevRelatedRecordsIds.filter(function (value, index, self) {
                    return self.indexOf(value) === index;
                });
            }
        }
        prevRelatedRecordsIds = prevRelatedRecordsIds.filter(function (id, index, self) { return id != null && id !== newRecordId.toString() && self.indexOf(id) === index; });
        return prevRelatedRecordsIds;
    }
    function handleOverTimeAllocation(pContext, employeeService, workCalendarService, customWorkCalendarService, holidayService, overTimeTemplateService, timeBillService, timeTypeService) {
        if (employeeService === void 0) { employeeService = null; }
        if (workCalendarService === void 0) { workCalendarService = null; }
        if (customWorkCalendarService === void 0) { customWorkCalendarService = null; }
        if (holidayService === void 0) { holidayService = null; }
        if (overTimeTemplateService === void 0) { overTimeTemplateService = null; }
        if (timeBillService === void 0) { timeBillService = null; }
        if (timeTypeService === void 0) { timeTypeService = null; }
        var UserEventType = pContext.UserEventType, type = pContext.type, oldRecord = pContext.oldRecord;
        var newRecord = pContext.newRecord;
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        if (!timeTypeService)
            timeTypeService = new BCTimeTypeService_1.BCTimeTypeService();
        var timeTypesDictionary = timeTypeService.getTimeTypeDictionary();
        if ([UserEventType.CREATE, UserEventType.COPY, UserEventType.EDIT, UserEventType.XEDIT].indexOf(type) != -1) {
            if (type == UserEventType.XEDIT)
                newRecord = record.load({
                    type: newRecord.type,
                    id: newRecord.id,
                });
            var recordId_1 = newRecord.id;
            var oldHours = oldRecord === null || oldRecord === void 0 ? void 0 : oldRecord.getValue(BCTimeBill_1.BCTimeBill.fields.hours);
            var newHours = newRecord === null || newRecord === void 0 ? void 0 : newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.hours);
            if (oldHours != newHours) {
                var timestamp = newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.fields.timestamp);
                var timeType = newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.fields.timeType);
                var isOverDoubleTime = timeType != "";
                var overDoubleTimeFrom = newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.fields.overDoubleTimeFrom);
                var memo = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.memo);
                var tranDate = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.trandate);
                if (timeType != timeTypesDictionary.doubleTime) {
                    if (!employeeService)
                        employeeService = new BCEmployeeService_1.BCEmployeeService();
                    var employee = newRecord.getValue(BCTimeBill_1.BCTimeBill.fields.employee);
                    var employeeDataToLook = {
                        employeeId: null,
                        fieldsIds: [],
                        result: null
                    };
                    employeeDataToLook.employeeId = String(employee);
                    employeeDataToLook.fieldsIds = [
                        BCEmployee_1.BCEmployeeLaborCost.fields.costOvertimeTemplate
                    ];
                    var employeeDataResult = employeeService.lookupFields(employeeDataToLook).result;
                    var overTimeTemplateId = employeeDataResult && employeeDataResult[BCEmployee_1.BCEmployeeLaborCost.fields.costOvertimeTemplate] && employeeDataResult[BCEmployee_1.BCEmployeeLaborCost.fields.costOvertimeTemplate][0] ? employeeDataResult[BCEmployee_1.BCEmployeeLaborCost.fields.costOvertimeTemplate][0].value : null;
                    if (overTimeTemplateId) {
                        var nativeWorkCalendarId = null;
                        var customWorkCalendarId = null;
                        var useBCWorkCalendar = false;
                        try {
                            employeeDataToLook.fieldsIds = [
                                BCEmployee_1.BCEmployeeLaborCost.fields.workCalendar,
                                BCEmployee_1.BCEmployeeLaborCost.fields.bcWorkCalendar,
                                BCEmployee_1.BCEmployeeLaborCost.fields.useBCWorkCalendar,
                            ];
                            var employeeDataResult_1 = employeeService.lookupFields(employeeDataToLook).result;
                            nativeWorkCalendarId = employeeDataResult_1 && employeeDataResult_1[BCEmployee_1.BCEmployeeLaborCost.fields.workCalendar] && employeeDataResult_1[BCEmployee_1.BCEmployeeLaborCost.fields.workCalendar][0] ? employeeDataResult_1[BCEmployee_1.BCEmployeeLaborCost.fields.workCalendar][0].value : null;
                            customWorkCalendarId = employeeDataResult_1 && employeeDataResult_1[BCEmployee_1.BCEmployeeLaborCost.fields.bcWorkCalendar] && employeeDataResult_1[BCEmployee_1.BCEmployeeLaborCost.fields.bcWorkCalendar][0] ? employeeDataResult_1[BCEmployee_1.BCEmployeeLaborCost.fields.bcWorkCalendar][0].value : null;
                            useBCWorkCalendar = employeeDataResult_1 && employeeDataResult_1[BCEmployee_1.BCEmployeeLaborCost.fields.useBCWorkCalendar] ? true : false;
                        }
                        catch (error) {
                            employeeDataToLook.fieldsIds = [
                                BCEmployee_1.BCEmployeeLaborCost.fields.bcWorkCalendar,
                                BCEmployee_1.BCEmployeeLaborCost.fields.useBCWorkCalendar,
                            ];
                            var employeeDataResult_2 = employeeService.lookupFields(employeeDataToLook).result;
                            customWorkCalendarId = employeeDataResult_2 && employeeDataResult_2[BCEmployee_1.BCEmployeeLaborCost.fields.bcWorkCalendar] && employeeDataResult_2[BCEmployee_1.BCEmployeeLaborCost.fields.bcWorkCalendar][0] ? employeeDataResult_2[BCEmployee_1.BCEmployeeLaborCost.fields.bcWorkCalendar][0].value : null;
                            useBCWorkCalendar = employeeDataResult_2 && employeeDataResult_2[BCEmployee_1.BCEmployeeLaborCost.fields.useBCWorkCalendar] ? true : false;
                        }
                        var recordsIdsToUpdate_1 = [];
                        if (!workCalendarService)
                            workCalendarService = new BCWorkCalendarService_1.BCWorkCalendarService();
                        if (!customWorkCalendarService)
                            customWorkCalendarService = new BCCustomWorkCalendarService_1.BCCustomWorkCalendarService();
                        if (!holidayService)
                            holidayService = new BCHolidayService_1.BCHolidayService();
                        var workCalendarAllData = getWorkCalendarData(nativeWorkCalendarId, customWorkCalendarId, useBCWorkCalendar, workCalendarService, customWorkCalendarService, holidayService);
                        var workCalendarData = Object.keys(workCalendarAllData).length === 1 ? workCalendarAllData[Object.keys(workCalendarAllData)[0]] : null;
                        var holidaysDates_1 = [];
                        var dateFormat_1 = runtime.getCurrentUser().getPreference({ name: "DATEFORMAT" });
                        if (workCalendarData) {
                            workCalendarData.holidays.forEach(function (currentHoliday) {
                                var parsedHolidayDate = currentHoliday.date && currentHoliday.date != "" ? format.parse({ value: currentHoliday.date, type: format.Type.DATE }) : null;
                                var holidayDateFormated = null;
                                if (parsedHolidayDate != null)
                                    holidayDateFormated = format.format({
                                        value: parsedHolidayDate,
                                        type: format.Type.DATE,
                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-ignore
                                        options: { dateformat: dateFormat_1 }
                                    });
                                var holiDayDate = new Date(holidayDateFormated).toString();
                                holidaysDates_1.push(holiDayDate);
                            });
                        }
                        if (!overTimeTemplateService)
                            overTimeTemplateService = new BCOverTimeTemplateService_1.BCOverTimeTemplateService();
                        var overTimeTemplate = overTimeTemplateService.getOverTimeData([overTimeTemplateId])[overTimeTemplateId];
                        if (Object.keys(overTimeTemplate).length == 0)
                            throw "No Over Time Template Data Found.";
                        var timeBillDataToLook = {
                            timeBillId: null,
                            fieldsIds: [],
                            result: null
                        };
                        timeBillDataToLook.timeBillId = recordId_1.toString();
                        timeBillDataToLook.fieldsIds = [
                            BCTimeBill_1.BCTimeBill.fields.timesheet
                        ];
                        var timeBillDataResult = timeBillService.lookupFields(timeBillDataToLook).result;
                        var relatedWeeklyTimesheetId = timeBillDataResult && timeBillDataResult && timeBillDataResult[BCTimeBill_1.BCTimeBill.fields.timesheet] && timeBillDataResult[BCTimeBill_1.BCTimeBill.fields.timesheet][0] ? timeBillDataResult[BCTimeBill_1.BCTimeBill.fields.timesheet][0].value : null;
                        if (!relatedWeeklyTimesheetId)
                            throw error.create({ name: "No Weekly Timesheet ID Found", message: "No Weekly Timesheet ID Found on time bill id = " + recordId_1 });
                        var weekTimesBalanceResult = getWeekTimesBalance(relatedWeeklyTimesheetId, holidaysDates_1, recordId_1, timeTypesDictionary, timeBillService);
                        var weekTimeTypeBalance = weekTimesBalanceResult.weekTimeTypeBalance;
                        var newTimeBillDayOfWeek = weekTimesBalanceResult.newTimeBillDayOfWeek;
                        var _a = getTimeBillsInDateCreatedOrder(JSON.parse(JSON.stringify(weekTimeTypeBalance))), timeBillsInDateOrderByDay = _a.timeBillsInDateOrderByDay, dateByDay = _a.dateByDay; // Deep copy of weekTimeTypeBalance
                        var daysOrder_1 = Object.keys(timeBillsInDateOrderByDay.straightTime).concat(Object.keys(timeBillsInDateOrderByDay.overTime));
                        daysOrder_1 = daysOrder_1.filter(function (day, index) { return daysOrder_1.indexOf(day) === index; }); // Remove repeated days
                        var cacheKey = ([UserEventType.CREATE, UserEventType.COPY].indexOf(type) != -1) ?
                            timeBillService.createTimesheetCacheKey(isOverDoubleTime, timestamp, (isOverDoubleTime ? overDoubleTimeFrom : "ST"), newHours, memo, tranDate)
                            :
                                "".concat(BCTimesheet_1.BCTimesheet.cacheTSUpdate).concat(newRecord.id);
                        var timesheetCache = cache.getCache({
                            name: BCTimesheet_1.BCTimesheet.cacheOTAllocationKey,
                            scope: cache.Scope.PUBLIC,
                        });
                        var timesheetCacheValue = timesheetCache.get({
                            key: cacheKey
                        });
                        var editedByUserFlag = !(timesheetCacheValue && timesheetCacheValue != "" && timesheetCacheValue === cacheKey);
                        if (editedByUserFlag) {
                            weekTimeTypeBalance = applyDailyThreshold(timeTypesDictionary, weekTimeTypeBalance, overTimeTemplate.daily, recordId_1, newTimeBillDayOfWeek, holidaysDates_1, dateByDay);
                            if (overTimeTemplate.weekly.applyWeekly)
                                weekTimeTypeBalance = applyWeeklyThreshold(weekTimeTypeBalance, overTimeTemplate.weekly, recordId_1);
                            var dataToUpsert = createAllocationDataForUpsert(weekTimeTypeBalance, daysOrder_1);
                            if (dataToUpsert.length > 0) {
                                var recordsUpdated = postToUpsertEndpoint(dataToUpsert, timeBillService).recordsUpdated;
                                if (recordsUpdated.length > 0)
                                    recordsIdsToUpdate_1 = recordsIdsToUpdate_1.concat(recordsUpdated);
                            }
                        }
                        else {
                            timesheetCache.remove({
                                key: cacheKey
                            });
                        }
                        recordsIdsToUpdate_1 = recordsIdsToUpdate_1.filter(function (currentRecordId, index) { return recordsIdsToUpdate_1.indexOf(currentRecordId) === index; }); // Remove repeated ids
                        var processedIds = recordsIdsToUpdate_1;
                        recordsIdsToUpdate_1 = recordsIdsToUpdate_1.filter(function (currentRecordId) { return currentRecordId.toString() != recordId_1.toString(); }); // Remove recordId from array
                        return { processedIds: processedIds, recordsIdsToUpdate: recordsIdsToUpdate_1 };
                    }
                }
            }
            else {
                var cacheKey = "".concat(BCTimesheet_1.BCTimesheet.cacheTSUpdate).concat(newRecord.id);
                var timesheetCache = cache.getCache({
                    name: BCTimesheet_1.BCTimesheet.cacheOTAllocationKey,
                    scope: cache.Scope.PUBLIC,
                });
                timesheetCache.remove({
                    key: cacheKey
                });
            }
        }
        else if ([UserEventType.DELETE].indexOf(type) != -1) {
            var recordId = oldRecord.id;
            var cacheKey = "".concat(BCTimesheet_1.BCTimesheet.cacheTSGetWeekly).concat(recordId);
            var timesheetCache = cache.getCache({
                name: BCTimesheet_1.BCTimesheet.cacheGetWeeklyName,
                scope: cache.Scope.PUBLIC,
            });
            //Get weekly from cache
            var timesheetCacheValue = timesheetCache.get({
                key: cacheKey
            });
            if (!timesheetCacheValue) {
                throw error.create({ name: "No Weekly Timesheet ID Found", message: "No Weekly Timesheet ID Found on recently deleted time bill id = " + recordId });
            }
            else {
                var deleteCacheKey = "".concat(BCTimesheet_1.BCTimesheet.cacheTSDelete).concat(recordId);
                var timesheetCache_2 = cache.getCache({
                    name: BCTimesheet_1.BCTimesheet.cacheOTAllocationKey,
                    scope: cache.Scope.PUBLIC,
                });
                var timesheetCacheValue_1 = timesheetCache_2.get({
                    key: deleteCacheKey
                });
                var deletedByUserFlag = !(timesheetCacheValue_1 && timesheetCacheValue_1 != "" && timesheetCacheValue_1 === deleteCacheKey);
                if (deletedByUserFlag) {
                    var timeBillsData = timeBillService.getAllBy([[BCTimeBill_1.BCTimeBill.fields.timesheet, "anyof", recordId]], timeTypesDictionary);
                    var recordsIdsToUpdate = timeBillsData.map(function (timeBill) { return timeBill.id; });
                    return { processedIds: recordsIdsToUpdate, recordsIdsToUpdate: recordsIdsToUpdate };
                }
                else {
                    timesheetCache_2.remove({
                        key: deleteCacheKey
                    });
                }
            }
        }
        return { processedIds: [], recordsIdsToUpdate: [] };
    }
    exports.handleOverTimeAllocation = handleOverTimeAllocation;
    function getWorkCalendarData(nativeWorkCalendarId, customWorkCalendarId, useBCWorkCalendar, workCalendarService, customWorkCalendarService, holidayService) {
        if (workCalendarService === void 0) { workCalendarService = null; }
        if (customWorkCalendarService === void 0) { customWorkCalendarService = null; }
        if (holidayService === void 0) { holidayService = null; }
        if (!workCalendarService)
            workCalendarService = new BCWorkCalendarService_1.BCWorkCalendarService();
        if (!customWorkCalendarService)
            customWorkCalendarService = new BCCustomWorkCalendarService_1.BCCustomWorkCalendarService();
        if (!holidayService)
            holidayService = new BCHolidayService_1.BCHolidayService();
        if (!useBCWorkCalendar && nativeWorkCalendarId) {
            var workCalendarFilter = [
                [BCWorkCalendar_1.BCWorkCalendar.fields.internalId, "anyof", nativeWorkCalendarId]
            ];
            return workCalendarService.getMapById(workCalendarFilter);
        }
        else {
            if (customWorkCalendarId) {
                var customWorkCalendarFilter = [
                    [BCCustomWorkCalendar_1.BCCustomWorkCalendar.fields.internalId, "anyof", customWorkCalendarId]
                ];
                var customWorkCalendarData = customWorkCalendarService.getMapById(customWorkCalendarFilter);
                var holidayFilter = [
                    [BCHoliday_1.BCHoliday.fields.bcWorkCalendar, "anyof", customWorkCalendarId]
                ];
                var holidaysData = holidayService.getAllBy(holidayFilter);
                customWorkCalendarData[customWorkCalendarId].holidays = holidaysData;
                return customWorkCalendarData;
            }
        }
        return {};
    }
    exports.getWorkCalendarData = getWorkCalendarData;
    function getWeekTimesBalance(relatedWeeklyTimesheetId, holidaysDates, newTimeBillId, timeTypesDictionary, timeBillService) {
        if (timeBillService === void 0) { timeBillService = null; }
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        var newTimeBillDayOfWeek = null;
        var newTimeBillIndex = null;
        var timeBillsData = timeBillService.getAllBy([[BCTimeBill_1.BCTimeBill.fields.timesheet, "anyof", relatedWeeklyTimesheetId]], timeTypesDictionary);
        var weekTimeTypeBalance = {
            straightTime: {
                monday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                tuesday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                wednesday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                thursday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                friday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                saturday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                sunday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
            },
            overTime: {
                monday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                tuesday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                wednesday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                thursday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                friday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                saturday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                sunday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
            },
            doubleTime: {
                monday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                tuesday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                wednesday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                thursday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                friday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                saturday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
                sunday: { date: null, dateString: null, totalHours: 0, holiday: false, timeBills: [] },
            },
        };
        var straightTimeBillsWith0Hours = [];
        timeBillsData.forEach(function (currentTimeBill) {
            var currentTimeBillCopy = JSON.parse(JSON.stringify(currentTimeBill));
            var parsedTimeBillDate = currentTimeBillCopy.date && currentTimeBillCopy.date != "" ? format.parse({ value: currentTimeBillCopy.date, type: format.Type.DATE }) : null;
            var dateFormat = runtime.getCurrentUser().getPreference({ name: "DATEFORMAT" });
            var timeBillDateFormated = null;
            if (parsedTimeBillDate != null)
                timeBillDateFormated = format.format({
                    value: parsedTimeBillDate,
                    type: format.Type.DATE,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    options: { dateformat: dateFormat }
                });
            var timeBillDate = format.parse({ value: timeBillDateFormated, type: format.Type.DATE });
            var dayOfWeek = timeBillDate.getDay();
            var isHoliday = false;
            isHoliday = holidaysDates.indexOf(timeBillDate.toString()) != -1 ? true : false;
            var timeType = currentTimeBillCopy.isOverTime ? "overTime" : (currentTimeBillCopy.isDoubleTime ? "doubleTime" : "straightTime");
            weekTimeTypeBalance[timeType][DAY_OF_WEEK_MAPPING[dayOfWeek]].date = timeBillDate;
            weekTimeTypeBalance[timeType][DAY_OF_WEEK_MAPPING[dayOfWeek]].dateString = timeBillDate.toString();
            weekTimeTypeBalance[timeType][DAY_OF_WEEK_MAPPING[dayOfWeek]].totalHours += currentTimeBillCopy.hours;
            weekTimeTypeBalance[timeType][DAY_OF_WEEK_MAPPING[dayOfWeek]].holiday = isHoliday;
            weekTimeTypeBalance[timeType][DAY_OF_WEEK_MAPPING[dayOfWeek]].timeBills.push({
                id: currentTimeBillCopy.id,
                hours: +currentTimeBillCopy.hours.toFixed(2),
                date: new Date(format.format({
                    value: format.parse({ value: currentTimeBillCopy.date, type: format.Type.DATE }),
                    type: format.Type.DATE,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    options: { dateformat: dateFormat }
                })),
                createdDate: new Date(format.format({
                    value: format.parse({ value: currentTimeBillCopy.createdDate, type: format.Type.DATE }),
                    type: format.Type.DATE,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    options: { dateformat: dateFormat }
                })),
                toUpdateCreate: false,
                overDoubleTimeFrom: (currentTimeBillCopy.isOverTime || currentTimeBillCopy.isDoubleTime) && currentTimeBillCopy.overDoubleTimeFrom ? currentTimeBillCopy.overDoubleTimeFrom : null,
            });
            if (+currentTimeBillCopy.hours.toFixed(2) == 0)
                straightTimeBillsWith0Hours.push(currentTimeBillCopy.id);
            if (currentTimeBillCopy.id.toString() === newTimeBillId.toString()) {
                newTimeBillDayOfWeek = DAY_OF_WEEK_MAPPING[dayOfWeek];
                newTimeBillIndex = weekTimeTypeBalance[timeType][DAY_OF_WEEK_MAPPING[dayOfWeek]].timeBills.length - 1;
            }
        });
        // Update related timeBills with 0 hours
        for (var timeType in weekTimeTypeBalance) {
            for (var dayOfWeek in weekTimeTypeBalance[timeType]) {
                var dayData = weekTimeTypeBalance[timeType][dayOfWeek];
                if (dayData.timeBills && dayData.timeBills.length > 0) {
                    dayData.timeBills.forEach(function (timeBill) {
                        if (straightTimeBillsWith0Hours.indexOf(timeBill.id) != -1 || straightTimeBillsWith0Hours.indexOf(timeBill.overDoubleTimeFrom) != -1)
                            timeBill.toUpdateCreate = true;
                    });
                }
            }
        }
        return { weekTimeTypeBalance: weekTimeTypeBalance, newTimeBillDayOfWeek: newTimeBillDayOfWeek, newTimeBillIndex: newTimeBillIndex };
    }
    exports.getWeekTimesBalance = getWeekTimesBalance;
    function applyWeeklyThreshold(weekTimeTypeBalance, overTimeWeeklyTemplate, newTimeBillId) {
        var weeklyThreshold = overTimeWeeklyTemplate.threshold;
        var totalHours = 0;
        var newHours = 0;
        var straightTimeData = weekTimeTypeBalance.straightTime;
        var reversedDaysOfWeek = __spreadArray([], Object.keys(straightTimeData), true).reverse();
        reversedDaysOfWeek.forEach(function (dayOfWeek) {
            var dayData = straightTimeData[dayOfWeek];
            if (dayData.timeBills && dayData.timeBills.length > 0) {
                dayData.timeBills.forEach(function (timeBill) {
                    if (timeBill.id.toString() != newTimeBillId.toString()) {
                        totalHours += timeBill.hours;
                    }
                    else if (timeBill.id && timeBill.id.toString() === newTimeBillId.toString()) {
                        newHours = timeBill.hours;
                    }
                });
            }
        });
        if (totalHours >= weeklyThreshold) {
            reversedDaysOfWeek.forEach(function (dayOfWeek) {
                var dayData = straightTimeData[dayOfWeek];
                if (dayData.timeBills && dayData.timeBills.length > 0) {
                    dayData.timeBills.forEach(function (timeBill) {
                        if (timeBill.id && timeBill.id.toString() === newTimeBillId.toString()) {
                            timeBill.toUpdateCreate = true;
                            if (weekTimeTypeBalance.overTime[dayOfWeek].date == null) {
                                weekTimeTypeBalance.overTime[dayOfWeek].date = dayData.date;
                                weekTimeTypeBalance.overTime[dayOfWeek].dateString = dayData.dateString;
                                weekTimeTypeBalance.overTime[dayOfWeek].holiday = dayData.holiday;
                            }
                            // Move the timeBill to the overTime object
                            var index = null;
                            for (var x = 0; x < weekTimeTypeBalance.overTime[dayOfWeek].timeBills.length; x++) {
                                var currentOverTimeTimeBill = weekTimeTypeBalance.overTime[dayOfWeek].timeBills[x];
                                if (currentOverTimeTimeBill.overDoubleTimeFrom && currentOverTimeTimeBill.overDoubleTimeFrom.toString() === newTimeBillId.toString())
                                    index = x;
                            }
                            if (index === null) {
                                // Copy the timeBill to the overTime object
                                weekTimeTypeBalance.overTime[dayOfWeek].timeBills.push(JSON.parse(JSON.stringify(timeBill)));
                                index = weekTimeTypeBalance.overTime[dayOfWeek].timeBills.length - 1;
                                weekTimeTypeBalance.overTime[dayOfWeek].timeBills[index].overDoubleTimeFrom = newTimeBillId.toString();
                            }
                            else {
                                // Update the hours for the overTime object
                                weekTimeTypeBalance.overTime[dayOfWeek].timeBills[index].hours += timeBill.hours;
                            }
                            weekTimeTypeBalance.overTime[dayOfWeek].timeBills[index].overDoubleTimeFrom = newTimeBillId.toString();
                            // Update the totalHours for the overTime day
                            weekTimeTypeBalance.overTime[dayOfWeek].totalHours += timeBill.hours;
                            // Update the totalHours for the straightTime day
                            straightTimeData[dayOfWeek].totalHours -= timeBill.hours;
                            //Remove the timeBill time from the straightTime object
                            timeBill.hours = 0;
                        }
                    });
                }
            });
        }
        else if (totalHours < weeklyThreshold && (totalHours + newHours) > weeklyThreshold) {
            reversedDaysOfWeek.forEach(function (dayOfWeek) {
                var dayData = straightTimeData[dayOfWeek];
                if (dayData.timeBills && dayData.timeBills.length > 0) {
                    dayData.timeBills.forEach(function (timeBill) {
                        if (timeBill.id && timeBill.id.toString() === newTimeBillId.toString()) {
                            var newOverTimeHours = (totalHours + newHours) - weeklyThreshold;
                            var newStraightTimeHours = newHours - newOverTimeHours;
                            timeBill.toUpdateCreate = true;
                            if (weekTimeTypeBalance.overTime[dayOfWeek].date == null) {
                                weekTimeTypeBalance.overTime[dayOfWeek].date = dayData.date;
                                weekTimeTypeBalance.overTime[dayOfWeek].dateString = dayData.dateString;
                                weekTimeTypeBalance.overTime[dayOfWeek].holiday = dayData.holiday;
                            }
                            // Move the timeBill to the overTime object
                            var index = null;
                            for (var x = 0; x < weekTimeTypeBalance.overTime[dayOfWeek].timeBills.length; x++) {
                                var currentOverTimeTimeBill = weekTimeTypeBalance.overTime[dayOfWeek].timeBills[x];
                                if (currentOverTimeTimeBill.overDoubleTimeFrom && currentOverTimeTimeBill.overDoubleTimeFrom.toString() === newTimeBillId.toString())
                                    index = x;
                            }
                            if (index === null) {
                                // Copy the timeBill to the overTime object
                                weekTimeTypeBalance.overTime[dayOfWeek].timeBills.push(JSON.parse(JSON.stringify(timeBill)));
                                index = weekTimeTypeBalance.overTime[dayOfWeek].timeBills.length - 1;
                                weekTimeTypeBalance.overTime[dayOfWeek].timeBills[index].overDoubleTimeFrom = newTimeBillId.toString();
                                weekTimeTypeBalance.overTime[dayOfWeek].timeBills[index].hours = newOverTimeHours;
                                // Remove the id from the timeBill because is a new record to be created, so no id is the way to identify it
                                weekTimeTypeBalance.overTime[dayOfWeek].timeBills[index].id = null;
                            }
                            else {
                                weekTimeTypeBalance.overTime[dayOfWeek].timeBills[index].hours += newOverTimeHours;
                            }
                            weekTimeTypeBalance.overTime[dayOfWeek].timeBills[index].overDoubleTimeFrom = newTimeBillId.toString();
                            // Update the totalHours for the overTime day
                            weekTimeTypeBalance.overTime[dayOfWeek].totalHours += newOverTimeHours;
                            // Update the totalHours for the straightTime day
                            timeBill.hours = newStraightTimeHours;
                            straightTimeData[dayOfWeek].totalHours -= newOverTimeHours;
                        }
                    });
                }
            });
        }
        return weekTimeTypeBalance;
    }
    exports.applyWeeklyThreshold = applyWeeklyThreshold;
    function applyDailyThreshold(timeTypesDictionary, weekTimeTypeBalance, overTimeDailyTemplate, newTimeBillId, newTimeBillDayOfWeek, holidaysDates, dateByDay, timeBillService) {
        if (timeBillService === void 0) { timeBillService = null; }
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        var dayThresholds = getDailyThresholdsAndApply(newTimeBillDayOfWeek, overTimeDailyTemplate, holidaysDates, dateByDay);
        var availableLevels = (Object.keys(new BCCostOvertimeDaily_1.OverTimeDayThreshold()).length / 2);
        var timeBillIdUpdated = newTimeBillId;
        var previousLevelDidNotApply = false;
        var _loop_2 = function (currentLevel) {
            var totalHours = 0; // Total hours from other timebills not related to current timebill
            var newHours = 0;
            var currentTimeKey = BCTimeBillService_1.TIME_TYPES_KEY[currentLevel - (previousLevelDidNotApply ? 2 : 1)];
            var extraTimeKey = BCTimeBillService_1.TIME_TYPES_KEY[currentLevel];
            var dayData = weekTimeTypeBalance[currentTimeKey][newTimeBillDayOfWeek];
            if (dayData.timeBills && dayData.timeBills.length > 0) {
                dayData.timeBills.forEach(function (timeBill) {
                    var _a, _b;
                    if ((timeBill.id && ((_a = timeBill === null || timeBill === void 0 ? void 0 : timeBill.id) === null || _a === void 0 ? void 0 : _a.toString()) != (timeBillIdUpdated === null || timeBillIdUpdated === void 0 ? void 0 : timeBillIdUpdated.toString())) ||
                        (!timeBill.id && (timeBill === null || timeBill === void 0 ? void 0 : timeBill.overDoubleTimeFrom) && ((_b = timeBill === null || timeBill === void 0 ? void 0 : timeBill.overDoubleTimeFrom) === null || _b === void 0 ? void 0 : _b.toString()) != timeBillIdUpdated.toString())) {
                        totalHours += timeBill.hours;
                    }
                    else {
                        newHours = timeBill.hours;
                    }
                });
            }
            var previousLevelThreshold = dayThresholds["lvl".concat(currentLevel - 1, "ApplyDaily")] ? (dayThresholds["lvl".concat(currentLevel - 1, "Threshold")] || 0) : 0;
            if (dayThresholds["lvl".concat(currentLevel, "ApplyDaily")]) {
                if (totalHours >= (dayThresholds["lvl".concat(currentLevel, "Threshold")] - previousLevelThreshold)) {
                    if (dayData.timeBills && dayData.timeBills.length > 0) {
                        dayData.timeBills.forEach(function (timeBill) {
                            if ((timeBill.id && timeBill.id.toString() === timeBillIdUpdated.toString()) ||
                                (!timeBill.id && timeBill.overDoubleTimeFrom && timeBill.overDoubleTimeFrom.toString() === timeBillIdUpdated.toString())) {
                                timeBill.toUpdateCreate = true;
                                if (weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].date == null) {
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].date = dayData.date;
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].dateString = dayData.dateString;
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].holiday = dayData.holiday;
                                }
                                // Move the timeBill to the over/double time object
                                var index = null;
                                for (var x = 0; x < weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills.length; x++) {
                                    var currentOverTimeTimeBill = weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[x];
                                    if (currentOverTimeTimeBill.overDoubleTimeFrom && currentOverTimeTimeBill.overDoubleTimeFrom.toString() === timeBillIdUpdated.toString())
                                        index = x;
                                }
                                if (index === null) {
                                    // Copy the timeBill to the overTime object
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills.push(JSON.parse(JSON.stringify(timeBill)));
                                    index = weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills.length - 1;
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].overDoubleTimeFrom = timeBillIdUpdated.toString();
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].timeType = timeTypesDictionary[extraTimeKey];
                                }
                                else {
                                    // Update the hours for the overTime object
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].hours += timeBill.hours;
                                }
                                // Update toUpdateCreate flag to true
                                weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].toUpdateCreate = true;
                                // Update the totalHours for the over/double time day
                                weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].totalHours += timeBill.hours;
                                // Update the totalHours for the straightTime day
                                weekTimeTypeBalance[currentTimeKey][newTimeBillDayOfWeek].totalHours -= timeBill.hours;
                                //Remove the timeBill time from the straightTime object
                                timeBill.hours = 0;
                            }
                        });
                    }
                }
                else if (totalHours < (dayThresholds["lvl".concat(currentLevel, "Threshold")] - previousLevelThreshold) && (totalHours + newHours) > (dayThresholds["lvl".concat(currentLevel, "Threshold")] - previousLevelThreshold)) {
                    if (dayData.timeBills && dayData.timeBills.length > 0) {
                        dayData.timeBills.forEach(function (timeBill) {
                            var _a, _b;
                            if ((timeBill.id && timeBill.id.toString() === timeBillIdUpdated.toString()) ||
                                (!timeBill.id && timeBill.overDoubleTimeFrom && timeBill.overDoubleTimeFrom.toString() === timeBillIdUpdated.toString())) {
                                var newExtraTimeHours = (totalHours + newHours) - (dayThresholds["lvl".concat(currentLevel, "Threshold")] - previousLevelThreshold);
                                var newCurrentTimeHours = newHours - newExtraTimeHours;
                                timeBill.toUpdateCreate = true;
                                if (weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].date == null) {
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].date = dayData.date;
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].dateString = dayData.dateString;
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].holiday = dayData.holiday;
                                }
                                var index = null;
                                for (var x = 0; x < weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills.length; x++) {
                                    var currentOverTimeTimeBill = weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[x];
                                    if (currentOverTimeTimeBill.overDoubleTimeFrom && currentOverTimeTimeBill.overDoubleTimeFrom.toString() === timeBillIdUpdated.toString())
                                        index = x;
                                }
                                if (index === null) {
                                    // Copy the timeBill to the overTime object
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills.push(JSON.parse(JSON.stringify(timeBill)));
                                    index = weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills.length - 1;
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].overDoubleTimeFrom = timeBillIdUpdated.toString();
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].timeType = timeTypesDictionary[extraTimeKey];
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].hours = newExtraTimeHours;
                                    // Remove the id from the timeBill because is a new record to be created, so no id is the way to identify it
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].id = null;
                                }
                                else {
                                    weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].hours += newExtraTimeHours;
                                }
                                // Update toUpdateCreate flag to true
                                weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].timeBills[index].toUpdateCreate = true;
                                // Update the totalHours for the overTime day
                                weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek].totalHours += newExtraTimeHours;
                                // Update the totalHours for the straightTime day
                                timeBill.hours = newCurrentTimeHours;
                                weekTimeTypeBalance[currentTimeKey][newTimeBillDayOfWeek].totalHours -= newExtraTimeHours;
                                timeBillIdUpdated = ((_b = (_a = weekTimeTypeBalance[extraTimeKey][newTimeBillDayOfWeek]) === null || _a === void 0 ? void 0 : _a.timeBills[index]) === null || _b === void 0 ? void 0 : _b.id) || timeBillIdUpdated;
                            }
                        });
                    }
                }
            }
            else {
                previousLevelDidNotApply = true;
            }
        };
        for (var currentLevel = 1; currentLevel <= availableLevels; currentLevel++) {
            _loop_2(currentLevel);
        }
        return weekTimeTypeBalance;
    }
    exports.applyDailyThreshold = applyDailyThreshold;
    function createAllocationDataForUpsert(weekTimeTypeBalance, daysOrder) {
        var allDataToUpsert = [];
        var _loop_3 = function (timeType) {
            daysOrder.forEach(function (dayOfWeek) {
                var dayData = weekTimeTypeBalance[timeType][dayOfWeek];
                if (dayData && dayData != null && dayData.timeBills) {
                    dayData.timeBills.forEach(function (timeBill) {
                        if (timeBill && timeBill.toUpdateCreate) {
                            // Search if a related timeBill exists
                            var timeBillIndex = null;
                            for (var x = 0; x < allDataToUpsert.length; x++) {
                                var currentDataToUpsert = allDataToUpsert[x];
                                if ((["overTime", "doubleTime"].indexOf(timeType) != -1 && (timeBill.overDoubleTimeFrom === currentDataToUpsert.straightTimeId || timeBill.overDoubleTimeFrom === currentDataToUpsert.overTimeId))
                                    || (timeType == "straightTime" && timeBill.id === currentDataToUpsert.straightTimeId))
                                    timeBillIndex = x;
                            }
                            if (timeBillIndex === null) {
                                allDataToUpsert.push({
                                    straightTime: 0,
                                    straightTimeId: timeBill.overDoubleTimeFrom,
                                    overTime: 0,
                                    overTimeId: null,
                                    doubleTime: 0,
                                    doubleTimeId: null,
                                });
                                timeBillIndex = allDataToUpsert.length - 1;
                            }
                            allDataToUpsert[timeBillIndex][timeType] += timeBill.hours;
                            allDataToUpsert[timeBillIndex]["".concat(timeType, "Id")] = timeBill.id;
                        }
                    });
                }
            });
        };
        for (var timeType in weekTimeTypeBalance) {
            _loop_3(timeType);
        }
        allDataToUpsert.forEach(function (dataToUpsert) {
            if (dataToUpsert.straightTimeId == dataToUpsert.overTimeId && dataToUpsert.straightTime == 0 && dataToUpsert.overTime > 0)
                dataToUpsert.overTimeId = null;
            else if (dataToUpsert.straightTimeId == dataToUpsert.overTimeId && dataToUpsert.straightTime > 0 && dataToUpsert.overTime == 0)
                dataToUpsert.straightTimeId = null;
            else if (dataToUpsert.straightTimeId == dataToUpsert.doubleTimeId && dataToUpsert.straightTime == 0 && dataToUpsert.doubleTime > 0)
                dataToUpsert.doubleTimeId = null;
            else if (dataToUpsert.straightTimeId == dataToUpsert.doubleTimeId && dataToUpsert.straightTime > 0 && dataToUpsert.doubleTime == 0)
                dataToUpsert.straightTimeId = null;
        });
        var availableLevels = (Object.keys(new BCCostOvertimeDaily_1.OverTimeDayThreshold()).length / 2);
        allDataToUpsert.forEach(function (currentTimeToUpsert) {
            var _loop_4 = function (currentLevel) {
                var currentTimeKey = BCTimeBillService_1.TIME_TYPES_KEY[currentLevel - 1];
                var hours = currentTimeToUpsert[currentTimeKey];
                var timeBillId = currentTimeToUpsert["".concat(currentTimeKey, "Id")];
                if (!hours && timeBillId) {
                    daysOrder.forEach(function (dayOfWeek) {
                        var dayData = weekTimeTypeBalance[currentTimeKey][dayOfWeek];
                        dayData.timeBills.forEach(function (timeBill) {
                            if (timeBill.id === timeBillId && timeBill.hours != 0 && !timeBill.toUpdateCreate)
                                currentTimeToUpsert[currentTimeKey] = timeBill.hours;
                        });
                    });
                }
            };
            for (var currentLevel = 1; currentLevel <= availableLevels; currentLevel++) {
                _loop_4(currentLevel);
            }
        });
        return allDataToUpsert;
    }
    function getDailyThresholdsAndApply(newTimeBillDayOfWeek, overTimeDailyTemplate, holidaysDates, dateByDay) {
        var isHoliday = holidaysDates.indexOf(new Date(dateByDay[newTimeBillDayOfWeek]).toString()) != -1 ? true : false;
        if (isHoliday) {
            var availableLevels = (Object.keys(new BCCostOvertimeDaily_1.OverTimeDayThreshold()).length / 2);
            var thresholdsToReturn = new BCCostOvertimeDaily_1.OverTimeDayThreshold();
            for (var currentLevel = 1; currentLevel <= availableLevels; currentLevel++) {
                var dailyThreshold = overTimeDailyTemplate[newTimeBillDayOfWeek]["lvl".concat(currentLevel, "Threshold")];
                var applyDaily = overTimeDailyTemplate[newTimeBillDayOfWeek]["lvl".concat(currentLevel, "ApplyDaily")];
                var holidayThreshold = overTimeDailyTemplate.holiday["lvl".concat(currentLevel, "Threshold")];
                var holidayApplyDaily = overTimeDailyTemplate.holiday["lvl".concat(currentLevel, "ApplyDaily")];
                if ((!applyDaily && holidayApplyDaily) ||
                    (applyDaily && holidayApplyDaily && holidayThreshold < dailyThreshold)) {
                    thresholdsToReturn["lvl".concat(currentLevel, "Threshold")] = holidayThreshold;
                }
                else if ((applyDaily && !holidayApplyDaily) ||
                    (applyDaily && holidayApplyDaily && dailyThreshold < holidayThreshold)) {
                    thresholdsToReturn["lvl".concat(currentLevel, "Threshold")] = dailyThreshold;
                }
                else {
                    thresholdsToReturn["lvl".concat(currentLevel, "Threshold")] = holidayThreshold;
                }
                thresholdsToReturn["lvl".concat(currentLevel, "ApplyDaily")] = applyDaily || holidayApplyDaily;
            }
            return thresholdsToReturn;
        }
        else {
            return overTimeDailyTemplate[newTimeBillDayOfWeek];
        }
    }
    function getTimeBillsInDateCreatedOrder(timeBillsData) {
        var timeBillsInDateCreatedOrder = { straightTime: [], overTime: [], doubleTime: [] };
        var timeBillsInDateOrder = { straightTime: [], overTime: [], doubleTime: [] };
        var timeBillsInDateOrderByDay = { straightTime: [], overTime: [], doubleTime: [] };
        var dateByDay = {};
        var _loop_5 = function (timeType) {
            var _loop_6 = function (dayOfWeek) {
                var day = timeBillsData[timeType][dayOfWeek];
                if (day.timeBills && day.timeBills.length > 0) {
                    // Map the day key and indexId to each timeBill object based on its position in timeBills array
                    day.timeBills.forEach(function (timeBill, index) {
                        timeBill.day = dayOfWeek;
                        timeBill.indexId = index;
                        timeBillsInDateCreatedOrder[timeType].push(JSON.parse(JSON.stringify(timeBill)));
                        timeBillsInDateCreatedOrder[timeType][timeBillsInDateCreatedOrder[timeType].length - 1].date = new Date(timeBillsInDateCreatedOrder[timeType][timeBillsInDateCreatedOrder[timeType].length - 1].date);
                        timeBillsInDateCreatedOrder[timeType][timeBillsInDateCreatedOrder[timeType].length - 1].createdDate = new Date(timeBillsInDateCreatedOrder[timeType][timeBillsInDateCreatedOrder[timeType].length - 1].createdDate);
                        timeBillsInDateOrder[timeType].push(JSON.parse(JSON.stringify(timeBill)));
                        timeBillsInDateOrder[timeType][timeBillsInDateOrder[timeType].length - 1].date = new Date(timeBillsInDateOrder[timeType][timeBillsInDateOrder[timeType].length - 1].date);
                        timeBillsInDateOrder[timeType][timeBillsInDateOrder[timeType].length - 1].createdDate = new Date(timeBillsInDateOrder[timeType][timeBillsInDateOrder[timeType].length - 1].createdDate);
                        timeBillsInDateOrderByDay[timeType].push(JSON.parse(JSON.stringify(timeBill)));
                        timeBillsInDateOrderByDay[timeType][timeBillsInDateOrderByDay[timeType].length - 1].date = new Date(timeBillsInDateOrderByDay[timeType][timeBillsInDateOrderByDay[timeType].length - 1].date);
                        timeBillsInDateOrderByDay[timeType][timeBillsInDateOrderByDay[timeType].length - 1].createdDate = new Date(timeBillsInDateOrderByDay[timeType][timeBillsInDateOrderByDay[timeType].length - 1].createdDate);
                        dateByDay[dayOfWeek] = timeBill.date;
                    });
                }
            };
            for (var dayOfWeek in timeBillsData[timeType]) {
                _loop_6(dayOfWeek);
            }
        };
        // Extract timeBills from each day and combine them into one array
        for (var timeType in timeBillsData) {
            _loop_5(timeType);
        }
        timeBillsInDateOrder = orderByFieldIdIndex(timeBillsInDateCreatedOrder, "createdDate");
        timeBillsInDateOrder = orderByFieldIdIndex(timeBillsInDateOrder, "date");
        timeBillsInDateOrderByDay = orderByFieldIdIndex(timeBillsInDateOrderByDay, "date");
        var groupedTimeBills = {
            straightTime: {},
            overTime: {},
            doubleTime: {},
        };
        // Group timeBills by day of the week for both straightTime and overTime
        for (var _i = 0, _a = Object.keys(groupedTimeBills); _i < _a.length; _i++) {
            var key = _a[_i];
            for (var _b = 0, _c = timeBillsInDateOrderByDay[key]; _b < _c.length; _b++) {
                var timeBill = _c[_b];
                var dayOfWeek = timeBill.day;
                // Create an array for the dayOfWeek if it doesn't exist
                if (!groupedTimeBills[key][dayOfWeek]) {
                    groupedTimeBills[key][dayOfWeek] = [];
                }
                // Add the timeBill to the corresponding dayOfWeek array
                groupedTimeBills[key][dayOfWeek].push(timeBill);
            }
        }
        return { timeBillsInDateCreatedOrder: timeBillsInDateCreatedOrder, timeBillsInDateOrder: timeBillsInDateOrder, timeBillsInDateOrderByDay: groupedTimeBills, dateByDay: dateByDay };
    }
    exports.getTimeBillsInDateCreatedOrder = getTimeBillsInDateCreatedOrder;
    function orderByFieldIdIndex(timeBillsArrayToOrder, fieldToOrderBy) {
        for (var timeType in timeBillsArrayToOrder) {
            // Sort the combined array first by fieldToOrderBy in ascending order,
            // then by id in ascending order, and finally by indexId in ascending order
            timeBillsArrayToOrder[timeType].sort(function (a, b) {
                var dateComparison = a[fieldToOrderBy].getTime() - b[fieldToOrderBy].getTime();
                if (dateComparison === 0) {
                    var idComparison = a.id.toString().localeCompare(b.id);
                    if (idComparison === 0) {
                        // If dates and ids are equal, compare by indexId
                        return a.index - b.index;
                    }
                    return idComparison;
                }
                return dateComparison;
            });
        }
        return timeBillsArrayToOrder;
    }
    function postToUpsertEndpoint(dataToUpsert, timeBillService) {
        if (timeBillService === void 0) { timeBillService = null; }
        if (!timeBillService)
            timeBillService = new BCTimeBillService_1.BCTimeBillService();
        var timeBillsData = [];
        var recordsUpdated = [];
        var params = {
            over_time_cost_data: dataToUpsert,
        };
        var appEndpoint = timeBillService.resolveScriptURL({
            scriptId: new BCOverTimeCostingSuitelet_1.BCOverTimeCostingSuitelet().scriptId,
            deploymentId: new BCOverTimeCostingSuitelet_1.BCOverTimeCostingSuitelet().deploymentId,
            params: {
                handler: "overtime",
                dataset: "upsert_ue",
            },
            returnExternalUrl: true,
        });
        var response = timeBillService.postUpsertOverTimeAllocationEndpoint({ url: appEndpoint, body: JSON.stringify(params) });
        if (response.code !== 200) {
            throw new Error("Error calling script ".concat(runtime.getCurrentScript().id, ", deployment ").concat(runtime.getCurrentScript().deploymentId, " - Status code ").concat(response.code));
        }
        else {
            var body = response.body;
            if (body.indexOf("<!--") != -1) {
                body = body.substring(0, body.indexOf("<!--"));
            }
            var data = JSON.parse(body);
            if (data.errors.length !== 0) {
                throw data.errors.join(". ");
            }
            timeBillsData = timeBillsData.concat(data.data.timeBillsData);
            recordsUpdated = recordsUpdated.concat(data.data.recordsUpdated);
        }
        return { timeBillsData: timeBillsData, recordsUpdated: recordsUpdated };
    }
    function resolveSegmentValue(isDebit, overrideCredit, timeBillValue, debitTemplateValue, creditTemplateValue) {
        if (isDebit)
            return timeBillValue || debitTemplateValue;
        if (overrideCredit)
            return timeBillValue || creditTemplateValue;
        return creditTemplateValue;
    }
});
