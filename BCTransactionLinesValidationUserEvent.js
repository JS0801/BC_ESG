/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @contact sales@bluecollar.cloud
 *
 * Copyright (C) 2026 BlueCollar Cloud Solutions
 * All rights reserved
 */
define(["require", "exports", "N/log", "N/error", "../BCBudgetModels/BCBudgetItem", "../BCBudgetModels/BCTransactionModel", "../BCBudgetServices/BCBudgetItemService", "../BCBudgetServices/BCItemService", "../BCBudgetServices/BCProjectService", "../BCBudgetModels/BCProjectItem", "../BCBudgetModels/BCResourceCost", "../BCBudgetServices/BCAccountService", "../BCBudgetModels/BCAccount", "../BCBudgetServices/BCCostCodeService", "../BCBudgetModels/BCCostCode", "../BCBudgetModels/BCTimeBill", "../BCBudgetServices/BCGlobalPreferencesService", "../BCBudgetModels/BCEmployee", "../BCBudgetServices/BCEmployeeService", "../BCBudgetServices/BCResourceRateTemplateService", "../BCBudgetModels/BCSalesOrder", "../BCBudgetModels/BCJournalEntry", "../BCBudgetServices/BCProjectAdvancedPreferencesService"], function (require, exports, log, error, BCBudgetItem_1, BCTransactionModel_1, BCBudgetItemService_1, BCItemService_1, BCProjectService_1, BCProjectItem_1, BCResourceCost_1, BCAccountService_1, BCAccount_1, BCCostCodeService_1, BCCostCode_1, BCTimeBill_1, BCGlobalPreferencesService_1, BCEmployee_1, BCEmployeeService_1, BCResourceRateTemplateService_1, BCSalesOrder_1, BCJournalEntry_1, BCProjectAdvancedPreferencesService_1) {
    var _a;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateResRateTemplateAccounts = exports.validateLines = exports.isAllowedEmptyCostCode = exports.beforeSubmit = exports.hasBCFieldsPopulated = void 0;
    var cache = {};
    var costTypesMapping = {};
    var itemCache = {};
    var itemTypeCache = {};
    var itemAccountNameCache = {};
    var costCodeCache = {};
    var accountCache = {};
    var projectCache = {};
    var accountChildrenCache = {};
    var projectDataCache = {};
    var RECORD_TYPES_TO_VALIDATE_COST_CODE = ["salesorder", "itemfulfillment", "transferorder", "vendorbill", "creditcardcharge", "check", "cashsale", "cashrefund", "returnauthorization"];
    var SUBLIST_CONFIG = (_a = {
            itemfulfillment: { costSublist: "item", accSublist: "" },
            returnauthorization: { costSublist: "item", accSublist: "" },
            transferorder: { costSublist: "item", accSublist: "" },
            salesorder: { costSublist: "item", accSublist: "" },
            cashsale: { costSublist: "item", accSublist: "" },
            cashrefund: { costSublist: "item", accSublist: "" },
            journalentry: { costSublist: "", accSublist: "line" }
        },
        _a[BCResourceCost_1.BCResourceCost.type] = { costSublist: "", accSublist: "line" },
        _a.itemreceipt = { costSublist: "item", accSublist: "expense" },
        _a.purchaseorder = { costSublist: "item", accSublist: "expense" },
        _a.vendorbill = { costSublist: "item", accSublist: "expense" },
        _a.vendorcredit = { costSublist: "item", accSublist: "expense" },
        _a.expensereport = { costSublist: "expense", accSublist: "expense" },
        _a.inventoryadjustment = { costSublist: "inventory", accSublist: "" },
        _a.creditcardcharge = { costSublist: "item", accSublist: "expense" },
        _a.check = { costSublist: "item", accSublist: "expense" },
        _a);
    /**
     * Get flat array of sublists for a record type (used by hasBCFieldsPopulated).
     */
    function getSublistsForRecordType(recordType) {
        var config = SUBLIST_CONFIG[recordType];
        if (!config)
            return [];
        return [config.costSublist, config.accSublist].filter(Boolean);
    }
    /**
     * Get sublist config for a record type with default fallback.
     */
    function getSublistConfig(recordType) {
        return SUBLIST_CONFIG[recordType] || { costSublist: "", accSublist: "" };
    }
    /**
     * Record types that should have header project copied to lines.
     * This preserves the original scope of copyHeaderProjectToLines (excludes transferorder,
     * BCResourceCost.type, creditcardcharge, and check which were not in the original implementation).
     */
    var COPY_HEADER_PROJECT_RECORD_TYPES = [
        "itemfulfillment", "returnauthorization", "salesorder", "cashsale",
        "cashrefund", "journalentry", "itemreceipt", "purchaseorder",
        "vendorbill", "vendorcredit", "expensereport", "inventoryadjustment"
    ];
    /**
     * Check if any BlueCollar fields (BC Project or Cost Code) are populated on the record.
     * This allows early exit to avoid unnecessary governance consumption when processing
     * non-BlueCollar transactions.
     * @param rec The record to check
     * @returns true if any BC fields are populated, false otherwise
     */
    function hasBCFieldsPopulated(rec) {
        var _a, _b, _c, _d, _e, _f;
        try {
            // Check header-level BC Project
            var headerProject = (_a = rec.getValue) === null || _a === void 0 ? void 0 : _a.call(rec, BC_PROJECT_FIELD);
            if (headerProject)
                return true;
            var recordType = ((_b = rec.type) === null || _b === void 0 ? void 0 : _b.toString()) || "";
            var sublists = getSublistsForRecordType(recordType);
            // Check each sublist for BC Project or Cost Code
            for (var _i = 0, sublists_1 = sublists; _i < sublists_1.length; _i++) {
                var sublistId = sublists_1[_i];
                try {
                    var lineCount = (_d = (_c = rec.getLineCount) === null || _c === void 0 ? void 0 : _c.call(rec, sublistId)) !== null && _d !== void 0 ? _d : 0;
                    for (var i = 0; i < lineCount; i++) {
                        var bcProject = (_e = rec.getSublistValue) === null || _e === void 0 ? void 0 : _e.call(rec, { fieldId: BC_PROJECT_FIELD, sublistId: sublistId, line: i });
                        if (bcProject)
                            return true;
                        var costCode = (_f = rec.getSublistValue) === null || _f === void 0 ? void 0 : _f.call(rec, { fieldId: COST_CODE_FIELD, sublistId: sublistId, line: i });
                        if (costCode)
                            return true;
                    }
                }
                catch (e) {
                    // Sublist may not exist on this record type, skip it
                }
            }
            return false;
        }
        catch (e) {
            // In case of any error, default to processing the record to avoid skipping valid records
            return true;
        }
    }
    exports.hasBCFieldsPopulated = hasBCFieldsPopulated;
    var RECORD_TYPES_NON_INVENTORY_COST_CODE = ["salesorder", "itemfulfillment", "transferorder", "cashsale", "cashrefund", "returnauthorization"];
    var BC_PROJECT_FIELD = BCTransactionModel_1.Transaction.fields.bcProject.replace(/line\./g, "");
    var COST_CODE_FIELD = BCTransactionModel_1.Transaction.fields.costCode.replace(/line\./g, "");
    var BODY_LEVEL_ACCOUNT_RECORDS = [];
    var itemTypeDictionary = {
        purchaseorder: ["NonInvtPart", "Service", "OthCharge", "Expense"],
        vendorbill: ["NonInvtPart", "Service", "OthCharge", "Expense"],
        itemreceipt: ["NonInvtPart", "Service", "OthCharge", "Expense"],
        vendorcredit: ["NonInvtPart", "Service", "OthCharge", "Expense"],
        itemfulfillment: ["InvtPart"],
        returnauthorization: ["InvtPart"],
        transferorder: ["InvtPart"],
        salesorder: ["InvtPart"],
        cashsale: ["InvtPart"],
        cashrefund: ["InvtPart"],
        inventoryadjustment: ["InvtPart"],
        creditcardcharge: ["NonInvtPart", "Service", "OthCharge", "Expense"],
        check: ["NonInvtPart", "Service", "OthCharge", "Expense"],
    };
    function beforeSubmit(pContext) {
        if (pContext.UserEventType.DELETE != pContext.type) {
            // Early exit: Skip processing if no BlueCollar fields (BC Project or Cost Code) are populated
            // This prevents unnecessary governance unit consumption for non-BlueCollar transactions
            if (!hasBCFieldsPopulated(pContext.newRecord)) {
                return;
            }
            copyHeaderProjectToLines(pContext);
            // To avoid checking validations for time bill lines when trying to set an error message
            if (pContext.newRecord.type == BCTimeBill_1.BCTimeBill.type && pContext.newRecord.getValue(BCTimeBill_1.BCTimeBillLaborCost.flagToIgnoreValidations))
                return;
            // When Bypass BC Validation is enabled, skip all validations (only Journal Entry record)
            if (pContext.newRecord.type === BCJournalEntry_1.BCJournalEntry.type) {
                var bypassBCValidation = pContext.newRecord.getValue({ fieldId: BCJournalEntry_1.BCJournalEntry.fields.bypassBCValidation });
                if (bypassBCValidation === true || bypassBCValidation === "T")
                    return;
            }
            var result = validateLines(pContext);
            if (result.error) {
                showMessage("Invalid Transaction Lines", result.msg);
            }
        }
    }
    exports.beforeSubmit = beforeSubmit;
    function isPerDiemLine(rec, sublistId, line) {
        try {
            return rec.type === BCSalesOrder_1.BCSalesOrder.type && sublistId === "item" && rec.getSublistValue({ fieldId: BCSalesOrder_1.BCSalesOrderLine.tmFields.isPerDiem, sublistId: sublistId, line: line }) === true;
        }
        catch (error) {
            // If the field is not found, return false
            return false;
        }
    }
    function isAllowedEmptyCostCode(rec, sublistId, line, itemService) {
        var _a;
        if (itemService === void 0) { itemService = new BCItemService_1.BCItemService(); }
        if (isPerDiemLine(rec, sublistId, line)) {
            return true;
        }
        var recordType = rec.type;
        if (recordType == "itemfulfillment") {
            var fulfill = rec.getSublistValue({ fieldId: "itemreceive", sublistId: sublistId, line: line });
            // if the item will not be fulfilled, allow it to have an empty cost code
            if (!fulfill) {
                return true;
            }
        }
        var itemId = (_a = rec.getSublistValue({ fieldId: "item", sublistId: sublistId, line: line })) === null || _a === void 0 ? void 0 : _a.toString();
        if (RECORD_TYPES_TO_VALIDATE_COST_CODE.indexOf(recordType) !== -1 && itemId) {
            // Lazy fallback: populateItemCache may not have run in all calling contexts (e.g. direct test calls)
            if (itemTypeCache[itemId.toString()] === undefined) {
                var itemData = itemService.getItemAccount(itemId.toString());
                var itemAccountObj = itemData.itemAccount;
                itemTypeCache[itemId.toString()] = itemData.itemType[0]["value"];
                var itemAccountV = itemAccountObj["value"];
                if (itemAccountV) {
                    itemCache[itemId.toString()] = itemAccountV;
                    itemAccountNameCache[itemId.toString()] = itemAccountObj["text"];
                }
            }
            if (RECORD_TYPES_NON_INVENTORY_COST_CODE.indexOf(recordType) !== -1)
                return itemTypeCache[itemId.toString()] !== "InvtPart";
            else
                return itemTypeCache[itemId.toString()] === "InvtPart";
        }
        return false;
    }
    exports.isAllowedEmptyCostCode = isAllowedEmptyCostCode;
    function copyHeaderProjectToLines(pContext) {
        try {
            var rec = pContext.newRecord;
            // Only process record types that were in the original implementation
            if (COPY_HEADER_PROJECT_RECORD_TYPES.indexOf(rec.type) === -1) {
                return;
            }
            // Get sublists from shared config
            var _a = getSublistConfig(rec.type), costSublist = _a.costSublist, accSublist = _a.accSublist;
            var headerProjectValue = rec.getValue(BC_PROJECT_FIELD);
            // Cost Code Lists Validation
            if (costSublist && headerProjectValue) {
                var lines = rec.getLineCount(costSublist);
                for (var i = 0; i < lines; i++) {
                    var costCode = rec.getSublistValue({ fieldId: COST_CODE_FIELD, sublistId: costSublist, line: i });
                    rec.setSublistValue({ fieldId: BC_PROJECT_FIELD, sublistId: costSublist, line: i, value: headerProjectValue });
                    rec.setSublistValue({ fieldId: COST_CODE_FIELD, sublistId: costSublist, line: i, value: costCode });
                }
            }
            // Account Lists Validation
            if (accSublist && headerProjectValue) {
                var lines = rec.getLineCount(accSublist);
                for (var i = 0; i < lines; i++) {
                    var costCode = rec.getSublistValue({ fieldId: COST_CODE_FIELD, sublistId: accSublist, line: i });
                    var account = rec.getSublistValue({ fieldId: BCTransactionModel_1.Transaction.fields.account, sublistId: accSublist, line: i });
                    rec.setSublistValue({ fieldId: BC_PROJECT_FIELD, sublistId: accSublist, line: i, value: headerProjectValue });
                    rec.setSublistValue({ fieldId: COST_CODE_FIELD, sublistId: accSublist, line: i, value: costCode });
                    if (account)
                        rec.setSublistValue({ fieldId: BCTransactionModel_1.Transaction.fields.account, sublistId: accSublist, line: i, value: account });
                }
            }
        }
        catch (error) {
            log.error("Error", error.message);
            log.error("Stack", JSON.stringify(error));
        }
    }
    function validateLines(pContext, services) {
        var _a;
        if (services === void 0) { services = {}; }
        var _b = services.projectSvc, projectSvc = _b === void 0 ? new BCProjectService_1.BCProjectService() : _b, _c = services.accountSvc, accountSvc = _c === void 0 ? new BCAccountService_1.BCAccountService() : _c, _d = services.costCodeSvc, costCodeSvc = _d === void 0 ? new BCCostCodeService_1.CostCodeService() : _d, _e = services.globalPrefSvc, globalPrefSvc = _e === void 0 ? new BCGlobalPreferencesService_1.BCGlobalPreferencesService() : _e, _f = services.employeeSvc, employeeSvc = _f === void 0 ? new BCEmployeeService_1.BCEmployeeService() : _f, _g = services.resRateTemplateSvc, resRateTemplateSvc = _g === void 0 ? new BCResourceRateTemplateService_1.BCResourceRateTemplateService() : _g, _h = services.budgetItemSvc, budgetItemSvc = _h === void 0 ? new BCBudgetItemService_1.BCBudgetItemService() : _h, _j = services.itemService, itemService = _j === void 0 ? new BCItemService_1.BCItemService() : _j, _k = services.projectAdvancedPrefSvc, projectAdvancedPrefSvc = _k === void 0 ? new BCProjectAdvancedPreferencesService_1.BCProjectAdvancedPreferencesService() : _k;
        var errorFlag = false;
        var errorMsg = '';
        try {
            var rec = pContext.newRecord;
            var recordType = rec.type;
            var itemTypesToCheck = itemTypeDictionary[recordType];
            if (rec.type === BCTimeBill_1.BCTimeBill.type) {
                var enableLaborJobCosting = globalPrefSvc.getActiveGlobalPreferences().enableLaborJobCosting;
                if (enableLaborJobCosting) {
                    errorMsg += validateResRateTemplateAccounts(rec, errorMsg, employeeSvc, resRateTemplateSvc, costCodeSvc, projectSvc, accountSvc, budgetItemSvc, projectAdvancedPrefSvc);
                    if (errorMsg != "") {
                        errorFlag = true;
                    }
                }
            }
            // Get sublists from shared config
            var _l = getSublistConfig(recordType), costSublist = _l.costSublist, accSublist = _l.accSublist;
            // Cost Code Lists Validation
            if (costSublist) {
                var lines = rec.getLineCount(costSublist);
                var costProjectIds = collectUniqueProjectIds(lines, rec, costSublist, false);
                populateProjectCache(costProjectIds, projectSvc);
                populateBudgetItemCache(costProjectIds, budgetItemSvc);
                populateItemCache(lines, rec, costSublist, itemService);
                populateAccountHierarchyCache(lines, rec, costSublist, false, accountSvc);
                var rawCostHeaderProject = rec.getValue(BC_PROJECT_FIELD);
                var costHeaderProjectId = rawCostHeaderProject ? rawCostHeaderProject.toString() : null;
                var _loop_1 = function (i) {
                    var rawCostProject = rec.getSublistValue({ fieldId: BC_PROJECT_FIELD, sublistId: costSublist, line: i });
                    var bcProjectId = rawCostProject ? rawCostProject.toString() : null;
                    var rawCostCode = rec.getSublistValue({ fieldId: COST_CODE_FIELD, sublistId: costSublist, line: i });
                    var costCodeId = rawCostCode ? rawCostCode.toString() : null;
                    // if not project id at line level, try at header level
                    if (!bcProjectId) {
                        bcProjectId = costHeaderProjectId;
                    }
                    if (costCodeId) {
                        if (bcProjectId) {
                            var count = cache[bcProjectId].filter(function (d) { return d.costCode.value === costCodeId; }).length;
                            if (count === 0 && !validateUnlockBudgetFeature(bcProjectId, projectAdvancedPrefSvc)) {
                                errorFlag = true;
                                errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Invalid Cost Code - Sublist = '".concat(costSublist.toUpperCase(), "', Line ").concat(i + 1);
                            }
                        }
                        else {
                            errorFlag = true;
                            errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Cost Code Need Associated Project - Sublist = '".concat(costSublist.toUpperCase(), "', Line ").concat(i + 1);
                        }
                    }
                    else {
                        if (bcProjectId) {
                            if (!isAllowedEmptyCostCode(rec, costSublist, i, itemService)) {
                                // If project and missing cost code, raise an exception
                                errorFlag = true;
                                errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Project must associate a cost code - Sublist = '".concat(costSublist.toUpperCase(), "', Line ").concat(i + 1);
                            }
                        }
                    }
                    // Budget Account List Validation
                    var itemToReview = rec.getSublistValue({ fieldId: BCTransactionModel_1.Transaction.lineFields.item, sublistId: costSublist, line: i });
                    if (itemToReview) {
                        if (bcProjectId) {
                            // Search Item Account
                            var itemAccountName = (_a = itemAccountNameCache[itemToReview.toString()]) !== null && _a !== void 0 ? _a : "";
                            var itemAccount_1 = itemCache[itemToReview.toString()];
                            if (itemAccount_1 && itemTypesToCheck.indexOf(itemTypeCache[itemToReview.toString()]) !== -1) {
                                var count = 0;
                                if (costCodeId) {
                                    count = cache[bcProjectId].filter(function (d) { return (d.costCode.value === costCodeId && d.costType.value === itemAccount_1); }).length;
                                    // Check the entire hierarchy against the pre-populated children cache
                                    if (count === 0) {
                                        var costCodeAccounts = cache[bcProjectId].filter(function (d) { return (d.costCode.value === costCodeId); }).map(function (d) { return d.costType.value; });
                                        if (costCodeAccounts.length > 0) {
                                            count = getCountAccountInHierarchy(costCodeAccounts, String(itemAccount_1));
                                        }
                                    }
                                }
                                else {
                                    if (isAllowedEmptyCostCode(rec, costSublist, i, itemService)) {
                                        count = 1;
                                    }
                                }
                                if (count === 0 && !validateUnlockBudgetFeature(bcProjectId, projectAdvancedPrefSvc)) {
                                    errorFlag = true;
                                    errorMsg += (errorMsg != "" ? "\n" : "") + "Error: The Item COGS or Expense Account = '".concat(itemAccountName, "' Does Not Match Any Budget Item of the Project, Sublist = '").concat(costSublist.toUpperCase(), "', Line ").concat(i + 1);
                                }
                                if (errorFlag && rec.type === "itemreceipt") {
                                    var projectResponse = getProjectDetails(bcProjectId, projectSvc);
                                    var projectName = projectResponse.length > 0 && projectResponse[0].name ? projectResponse[0].name.toString() : "";
                                    var costCodeResponse = getCostCodeDetails(costCodeId, costCodeSvc);
                                    var costCodeName = costCodeResponse.length > 0 && costCodeResponse[0].name ? costCodeResponse[0].name.toString() : "";
                                    if (!costTypesMapping[itemAccount_1]) {
                                        var accountResponse = getAccountDetails(itemAccount_1, accountSvc);
                                        costTypesMapping[itemAccount_1] = accountResponse.length > 0 && accountResponse[0].name ? accountResponse[0].name.toString() : "";
                                    }
                                    errorMsg += (errorMsg != "" ? "\n" : "") + getValidCostCodeAccountCombinations(rec.id, projectName, bcProjectId, costCodeName, costCodeId);
                                }
                            }
                        }
                    }
                };
                for (var i = 0; i < lines; i++) {
                    _loop_1(i);
                }
            }
            // Account Lists Validation
            if (accSublist) {
                var lines = rec.getLineCount(accSublist);
                var accProjectIds = collectUniqueProjectIds(lines, rec, accSublist, true);
                populateProjectCache(accProjectIds, projectSvc);
                populateBudgetItemCache(accProjectIds, budgetItemSvc);
                populateAccountHierarchyCache(lines, rec, accSublist, true, accountSvc);
                var rawAccHeaderProject = rec.getValue(BC_PROJECT_FIELD);
                var accHeaderProjectId = rawAccHeaderProject ? rawAccHeaderProject.toString() : null;
                var isBodyLevelAccount = BODY_LEVEL_ACCOUNT_RECORDS.indexOf(rec.type.toString()) !== -1;
                var bodyAccountId = isBodyLevelAccount ? rec.getValue({ fieldId: BCTransactionModel_1.Transaction.fields.account }) : null;
                var _loop_2 = function (i) {
                    var rawAccProject = rec.getSublistValue({ fieldId: BC_PROJECT_FIELD, sublistId: accSublist, line: i });
                    var bcProjectId = rawAccProject ? rawAccProject.toString() : null;
                    // if not project id at line level, try at header level, when Resource Costing JE, don't use the header project because not all lines will have a project
                    if (!bcProjectId && rec.type != BCResourceCost_1.BCResourceCost.type) {
                        bcProjectId = accHeaderProjectId;
                    }
                    var accountId = rec.getSublistValue({ fieldId: getDefaultAccountFieldName(rec.type.toString()), sublistId: accSublist, line: i });
                    // If it matches, get the account value from the body
                    if (isBodyLevelAccount)
                        accountId = bodyAccountId;
                    var rawAccCostCode = rec.getSublistValue({ fieldId: COST_CODE_FIELD, sublistId: accSublist, line: i });
                    var costCodeId = rawAccCostCode ? rawAccCostCode.toString() : null;
                    // Cost Codes Validation
                    if (costCodeId) {
                        if (bcProjectId) {
                            var count = cache[bcProjectId].filter(function (d) { return d.costCode.value === costCodeId; }).length;
                            if (count === 0 && !validateUnlockBudgetFeature(bcProjectId, projectAdvancedPrefSvc)) {
                                errorFlag = true;
                                errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Invalid Cost Code - Sublist = '".concat(accSublist.toUpperCase(), "', Line ").concat(i + 1);
                            }
                        }
                        else if (rec.type != BCResourceCost_1.BCResourceCost.type) {
                            errorFlag = true;
                            errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Cost Code Need Associated Project - Sublist = '".concat(accSublist.toUpperCase(), "', Line ").concat(i + 1);
                        }
                    }
                    else {
                        if (bcProjectId && !isAllowedEmptyCostCode(rec, accSublist, i, itemService)) {
                            // If project and missing cost code, raise an exception
                            errorFlag = true;
                            errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Project must associate a cost code - Sublist = '".concat(accSublist.toUpperCase(), "', Line ").concat(i + 1);
                        }
                    }
                    // Accounts Validation
                    if (accountId) {
                        if (bcProjectId) {
                            var count = 0;
                            if (costCodeId) {
                                count = cache[bcProjectId].filter(function (d) { return (d.costCode.value === costCodeId && d.costType.value === accountId); }).length;
                                // Check the entire hierarchy against the pre-populated children cache
                                if (count === 0) {
                                    var costCodeAccounts = cache[bcProjectId].filter(function (d) { return (d.costCode.value === costCodeId); }).map(function (d) { return d.costType.value; });
                                    if (costCodeAccounts.length > 0) {
                                        count = getCountAccountInHierarchy(costCodeAccounts, String(accountId));
                                    }
                                }
                            }
                            else {
                                // If project and missing cost code, raise an exception
                                errorFlag = true;
                                errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Project must associate a cost code - Sublist = '".concat(accSublist.toUpperCase(), "', Line ").concat(i + 1);
                            }
                            if (count === 0 && !validateUnlockBudgetFeature(bcProjectId, projectAdvancedPrefSvc)) {
                                // Defer name lookups until we actually need them for the error message
                                var projectName = lookupProjectName(bcProjectId, projectSvc);
                                var accountName = lookupAccountName(String(accountId), accountSvc);
                                var costCodeName = lookupCostCodeName(costCodeId, costCodeSvc);
                                errorFlag = true;
                                errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Missing Cost Code | Cost Type combination in the project \"".concat(projectName, "\" budget: ").concat(costCodeName, " | ").concat(accountName, " - Sublist ").concat(accSublist, ", Line ").concat(i + 1);
                            }
                        }
                    }
                };
                for (var i = 0; i < lines; i++) {
                    _loop_2(i);
                }
            }
            return {
                error: errorFlag,
                msg: errorMsg
            };
        }
        catch (error) {
            log.error("Error", error.message);
            log.error("Stack", JSON.stringify(error));
            errorFlag = false;
            errorMsg = "";
        }
        return {
            error: errorFlag,
            msg: errorMsg
        };
    }
    exports.validateLines = validateLines;
    function validateResRateTemplateAccounts(rec, errorMsg, employeeSvc, resRateTemplateSvc, costCodeSvc, projectSvc, accountSvc, budgetItemSvc, projectAdvancedPrefSvc) {
        if (employeeSvc === void 0) { employeeSvc = null; }
        if (resRateTemplateSvc === void 0) { resRateTemplateSvc = null; }
        if (costCodeSvc === void 0) { costCodeSvc = null; }
        if (projectSvc === void 0) { projectSvc = null; }
        if (accountSvc === void 0) { accountSvc = null; }
        if (budgetItemSvc === void 0) { budgetItemSvc = null; }
        if (projectAdvancedPrefSvc === void 0) { projectAdvancedPrefSvc = null; }
        if (!projectAdvancedPrefSvc)
            projectAdvancedPrefSvc = new BCProjectAdvancedPreferencesService_1.BCProjectAdvancedPreferencesService();
        if (!employeeSvc)
            employeeSvc = new BCEmployeeService_1.BCEmployeeService();
        if (!resRateTemplateSvc)
            resRateTemplateSvc = new BCResourceRateTemplateService_1.BCResourceRateTemplateService();
        if (!costCodeSvc)
            costCodeSvc = new BCCostCodeService_1.CostCodeService();
        if (!projectSvc)
            projectSvc = new BCProjectService_1.BCProjectService();
        if (!accountSvc)
            accountSvc = new BCAccountService_1.BCAccountService();
        if (!budgetItemSvc)
            budgetItemSvc = new BCBudgetItemService_1.BCBudgetItemService();
        var rawProjectVal = rec.getValue(BC_PROJECT_FIELD);
        var bcProjectId = rawProjectVal ? rawProjectVal.toString() : null;
        var employeeField = null;
        if (rec.type === BCTimeBill_1.BCTimeBill.type) {
            employeeField = BCTimeBill_1.BCTimeBill.fields.employee;
        }
        if (!employeeField) {
            errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Missing Employee field ID for the \"".concat(rec.type, "\" transaction type");
        }
        else {
            var _a = getAccountFromResRateTemplate(rec.getValue(employeeField).toString(), employeeSvc, resRateTemplateSvc), accountsIds = _a.accountsIds, message = _a.message;
            if (message != "")
                return message;
            if (accountsIds.length > 0) {
                var rawCostCode = rec.getValue(COST_CODE_FIELD);
                var costCodeId_1 = rawCostCode ? rawCostCode.toString() : null;
                var costCodeResponse = getCostCodeDetails(costCodeId_1, costCodeSvc);
                var costCodeName_1 = costCodeResponse.length > 0 && costCodeResponse[0].name ? costCodeResponse[0].name.toString() : "";
                var projectResponse = getProjectDetails(bcProjectId, projectSvc);
                var projectName_1 = projectResponse.length > 0 && projectResponse[0].name ? projectResponse[0].name.toString() : "";
                // Pre-load budget items once before the forEach loop
                if (bcProjectId !== null && bcProjectId !== "") {
                    populateBudgetItemCache([bcProjectId], budgetItemSvc);
                }
                accountsIds.forEach(function (accountId) {
                    if (!costTypesMapping[accountId]) {
                        var accountResponse = getAccountDetails(accountId, accountSvc);
                        costTypesMapping[accountId] = accountResponse.length > 0 && accountResponse[0].name ? accountResponse[0].name.toString() : "";
                    }
                    // Cost Codes Validation
                    if (costCodeId_1 !== null && costCodeId_1 !== "") {
                        if (bcProjectId !== null && bcProjectId !== "") {
                            var count = cache[bcProjectId].filter(function (d) { return d.costCode.value === costCodeId_1; }).length;
                            if (count === 0 && !validateUnlockBudgetFeature(bcProjectId, projectAdvancedPrefSvc)) {
                                errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Invalid Cost Code: ".concat(costCodeName_1, " - For ").concat(rec.id ? "transaction record ID = ".concat(rec.id) : "new transaction record");
                            }
                        }
                    }
                    // Accounts Validation
                    if (accountId !== null && accountId !== "") {
                        if (bcProjectId !== null && bcProjectId !== "") {
                            var count = 0;
                            if (costCodeId_1 != "" && costCodeId_1 != null) {
                                count = cache[bcProjectId].filter(function (d) { return (d.costCode.value === costCodeId_1 && d.costType.value === accountId); }).length;
                                // Check the entire hierarchy against the pre-populated children cache
                                if (count === 0) {
                                    var costCodeAccounts = cache[bcProjectId].filter(function (d) { return (d.costCode.value === costCodeId_1); }).map(function (d) { return d.costType.value; });
                                    if (costCodeAccounts.length > 0) {
                                        ensureAccountHierarchyCached(costCodeAccounts, accountSvc);
                                        count = getCountAccountInHierarchy(costCodeAccounts, String(accountId));
                                    }
                                }
                            }
                            if (count === 0 && !validateUnlockBudgetFeature(bcProjectId, projectAdvancedPrefSvc)) {
                                if (rec.type == BCTimeBill_1.BCTimeBill.type) {
                                    errorMsg += (errorMsg != "" ? "\n" : "") + getValidCostCodeAccountCombinations(rec.id, projectName_1, bcProjectId, costCodeName_1, costCodeId_1);
                                }
                                else {
                                    errorMsg += (errorMsg != "" ? "\n" : "") + "Error : Missing Cost Code | Cost Type combination in the project \"".concat(projectName_1, "\" budget: ").concat(costCodeName_1, " | ").concat(costTypesMapping[accountId], " - For ").concat(rec.id ? "transaction record ID = ".concat(rec.id) : "new transaction record");
                                }
                            }
                        }
                    }
                });
            }
        }
        return errorMsg;
    }
    exports.validateResRateTemplateAccounts = validateResRateTemplateAccounts;
    function getAccountFromResRateTemplate(employeeId, employeeSvc, resRateTemplateSvc) {
        if (employeeSvc === void 0) { employeeSvc = null; }
        if (resRateTemplateSvc === void 0) { resRateTemplateSvc = null; }
        var message = "";
        var accountsIds = [];
        var employeeFilters = [
            [BCEmployee_1.BCEmployee.fields.internalId, "anyof", employeeId]
        ];
        var employeeColumns = [
            BCEmployee_1.BCEmployee.fields.internalId,
            BCEmployee_1.BCEmployeeLaborCost.fields.resourceRateTemplate
        ];
        var resRateTemResult = employeeSvc.getAllMapByColumns(employeeFilters, employeeColumns);
        var resourceTemplateIds = resRateTemResult.map(function (currentResult) { if (currentResult[BCEmployee_1.BCEmployeeLaborCost.fields.resourceRateTemplate] && currentResult[BCEmployee_1.BCEmployeeLaborCost.fields.resourceRateTemplate].value)
            return currentResult[BCEmployee_1.BCEmployeeLaborCost.fields.resourceRateTemplate].value; });
        resourceTemplateIds = resourceTemplateIds.filter(function (el) { return el != null; });
        if (resourceTemplateIds.length == 0)
            return { accountsIds: [], message: message };
        var allRateTemplateData = resRateTemplateSvc.getResourceRateData(resourceTemplateIds);
        for (var _i = 0, _a = Object.keys(allRateTemplateData).filter(function (id) { return id != "resourceRateData"; }); _i < _a.length; _i++) {
            var currentRateTemplateID = _a[_i];
            allRateTemplateData[currentRateTemplateID].forEach(function (rateTemplateData) {
                var _a;
                var key = Object.keys(rateTemplateData)[0];
                if (key === 'debit') {
                    var accountId = (_a = rateTemplateData[key].account) === null || _a === void 0 ? void 0 : _a.toString();
                    if (accountId && accountsIds.indexOf(accountId) === -1)
                        accountsIds.push(accountId);
                }
            });
        }
        return { accountsIds: accountsIds, message: message };
    }
    function getValidCostCodeAccountCombinations(recordId, projectName, bcProjectId, costCodeName, costCodeId) {
        var validCostTypes = {};
        cache[bcProjectId].forEach(function (d) {
            if (d.costCode.value === costCodeId)
                validCostTypes[d.costType.value] = d.costType.text;
        });
        var message = "For ".concat(recordId ? "transaction record ID = ".concat(recordId) : "new transaction record", "\n\nCost code \"").concat(costCodeName, "\" for project \"").concat(projectName, "\" has the following cost types available:\n\n");
        var costTypesKeys = Object.keys(validCostTypes).sort();
        if (costTypesKeys.length > 0) {
            costTypesKeys.forEach(function (k) {
                message += "\t- ".concat(validCostTypes[k], "\n");
            });
        }
        else {
            message += "\t- No cost types available\n";
        }
        var accountCostTypesKeys = Object.keys(costTypesMapping).sort();
        if (accountCostTypesKeys.length > 0) {
            message += "\nThe cost types needed are:\n\n";
            accountCostTypesKeys.forEach(function (k) {
                message += "\t- ".concat(costTypesMapping[k], "\n");
            });
        }
        message += "\nPlease reach out to project manager to update budget or select another cost code.";
        return message;
    }
    function showMessage(pName, pMessage) {
        throw error.create({ name: pName, message: pMessage });
    }
    function getCostCodeDetails(costCodeId, costCodeSvc) {
        var costCodeResponse = [];
        if (costCodeId) {
            if (!costCodeCache[costCodeId]) {
                costCodeResponse = costCodeSvc.getAllBy([[BCCostCode_1.CostCode.fields.internalId, "anyof", costCodeId]]);
                costCodeCache[costCodeId] = costCodeResponse;
            }
            else {
                costCodeResponse = costCodeCache[costCodeId];
            }
        }
        return costCodeResponse;
    }
    function getAccountDetails(accountId, accountSvc) {
        var accountResponse = [];
        if (accountId) {
            if (!accountCache[accountId]) {
                accountResponse = accountSvc.getAllBy([
                    [BCAccount_1.Account.fields.internalId, "anyof", accountId],
                    "AND",
                    [BCAccount_1.Account.fields.isInactive, "is", "F"]
                ]);
                accountCache[accountId] = accountResponse;
            }
            else {
                accountResponse = accountCache[accountId];
            }
        }
        return accountResponse;
    }
    function populateItemCache(lines, rec, sublistId, itemSvc) {
        var _a;
        var itemIds = [];
        for (var i = 0; i < lines; i++) {
            var itemId = (_a = rec.getSublistValue({ fieldId: BCTransactionModel_1.Transaction.lineFields.item, sublistId: sublistId, line: i })) === null || _a === void 0 ? void 0 : _a.toString();
            if (itemId && itemTypeCache[itemId] === undefined && itemIds.indexOf(itemId) === -1) {
                itemIds.push(itemId);
            }
        }
        if (itemIds.length === 0)
            return;
        var batchData = itemSvc.getItemAccountBatch(itemIds);
        Object.entries(batchData).forEach(function (_a) {
            var _b, _c, _d;
            var itemId = _a[0], data = _a[1];
            itemTypeCache[itemId] = Array.isArray(data.itemType) && data.itemType.length > 0
                ? data.itemType[0]["value"]
                : "";
            var accountV = (_b = data.itemAccount) === null || _b === void 0 ? void 0 : _b.value;
            if (accountV) {
                itemCache[itemId] = accountV;
                itemAccountNameCache[itemId] = (_d = (_c = data.itemAccount) === null || _c === void 0 ? void 0 : _c.text) !== null && _d !== void 0 ? _d : "";
            }
        });
    }
    function collectUniqueProjectIds(lines, rec, sublistId, isAccountSublist) {
        var projectIds = [];
        var rawHeaderVal = rec.getValue(BC_PROJECT_FIELD);
        var headerProjectId = rawHeaderVal ? rawHeaderVal.toString() : null;
        for (var i = 0; i < lines; i++) {
            var rawSublistProject = rec.getSublistValue({ fieldId: BC_PROJECT_FIELD, sublistId: sublistId, line: i });
            var bcProjectId = rawSublistProject ? rawSublistProject.toString() : null;
            // if not project id at line level, try at header level, when isAccountSublist and Resource Costing JE, don't use the header project because not all lines will have a project
            if (!bcProjectId && (!isAccountSublist || (isAccountSublist && rec.type != BCResourceCost_1.BCResourceCost.type))) {
                bcProjectId = headerProjectId;
            }
            if (bcProjectId && projectIds.indexOf(bcProjectId) === -1) {
                projectIds.push(bcProjectId);
            }
        }
        return projectIds;
    }
    function populateProjectCache(projectIds, projectSvc) {
        if (projectIds.length === 0)
            return;
        var missingProjectIds = projectIds.filter(function (id) { return !projectCache[id]; });
        if (missingProjectIds.length > 0) {
            var projectsResponse = projectSvc.getAllBy([
                [BCProjectItem_1.BCProjectItem.fields.internalId, "anyof", missingProjectIds],
                "AND",
                [BCProjectItem_1.BCProjectItem.fields.isInactive, "is", "F"]
            ]);
            projectsResponse.forEach(function (project) {
                projectCache[project.id] = [project];
            });
        }
    }
    function populateBudgetItemCache(projectIds, budgetItemSvc) {
        var missingIds = projectIds.filter(function (id) { return !cache[id]; });
        if (missingIds.length === 0)
            return;
        // 1 search instead of N (one per unique project)
        var allItems = budgetItemSvc.getAllBy([[BCBudgetItem_1.BCBudgetItem.fields.project, "anyof", missingIds]]);
        // Initialize empty arrays for all projects (including those with no items)
        missingIds.forEach(function (id) { cache[id] = []; });
        // Group results by project
        allItems.forEach(function (item) {
            var _a, _b;
            var projectId = (_b = (_a = item.project) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.toString();
            if (projectId && Array.isArray(cache[projectId])) {
                cache[projectId].push(item);
            }
        });
    }
    function getProjectDetails(bcProjectId, projectSvc) {
        var projectResponse = [];
        if (bcProjectId) {
            if (!projectCache[bcProjectId]) {
                projectResponse = projectSvc.getAllBy([
                    [BCProjectItem_1.BCProjectItem.fields.internalId, "anyof", bcProjectId],
                    "AND",
                    [BCProjectItem_1.BCProjectItem.fields.isInactive, "is", "F"]
                ]);
                projectCache[bcProjectId] = projectResponse;
            }
            else {
                projectResponse = projectCache[bcProjectId];
            }
        }
        return projectResponse;
    }
    function getCountAccountInHierarchy(allowedParents, accountId) {
        var visited = {};
        var queue = [];
        for (var i = 0; i < allowedParents.length; i++) {
            var id = allowedParents[i];
            if (id && !visited[id]) {
                visited[id] = true;
                queue.push(id);
            }
        }
        while (queue.length > 0) {
            var parentId = queue.shift();
            if (parentId === accountId)
                return 1;
            var children = accountChildrenCache[parentId];
            if (!children)
                continue;
            for (var i = 0; i < children.length; i++) {
                var childId = children[i];
                if (childId === accountId)
                    return 1;
                if (!visited[childId]) {
                    visited[childId] = true;
                    queue.push(childId);
                }
            }
        }
        return 0;
    }
    function ensureAccountHierarchyCached(parentIds, accountSvc) {
        if (!accountSvc.getChildrenAccountsRecursively) {
            log.error("Missing method", "The account service does not implement getChildrenAccountsRecursively");
            return;
        }
        var missing = [];
        for (var i = 0; i < parentIds.length; i++) {
            var id = parentIds[i];
            if (id && !(id in accountChildrenCache) && missing.indexOf(id) === -1) {
                missing.push(id);
            }
        }
        if (missing.length === 0)
            return;
        // Mark all queried parents as seen so we don't re-query when they have no children
        missing.forEach(function (id) { accountChildrenCache[id] = []; });
        var result = accountSvc.getChildrenAccountsRecursively(missing);
        for (var parentId in result) {
            accountChildrenCache[parentId] = result[parentId];
        }
    }
    function populateAccountHierarchyCache(lines, rec, sublistId, isAccountSublist, accountSvc) {
        var _a, _b;
        if (lines === 0)
            return;
        var headerProjectRaw = rec.getValue(BC_PROJECT_FIELD);
        var headerProjectId = headerProjectRaw ? headerProjectRaw.toString() : null;
        var parentIds = [];
        var seen = {};
        for (var i = 0; i < lines; i++) {
            var rawProject = rec.getSublistValue({ fieldId: BC_PROJECT_FIELD, sublistId: sublistId, line: i });
            var bcProjectId = rawProject ? rawProject.toString() : null;
            if (!bcProjectId && (!isAccountSublist || rec.type != BCResourceCost_1.BCResourceCost.type)) {
                bcProjectId = headerProjectId;
            }
            if (!bcProjectId)
                continue;
            var rawCostCode = rec.getSublistValue({ fieldId: COST_CODE_FIELD, sublistId: sublistId, line: i });
            var costCodeId = rawCostCode ? rawCostCode.toString() : null;
            if (!costCodeId)
                continue;
            var items = cache[bcProjectId];
            if (!items)
                continue;
            for (var j = 0; j < items.length; j++) {
                var d = items[j];
                var parentId = ((_a = d.costCode) === null || _a === void 0 ? void 0 : _a.value) === costCodeId ? (_b = d.costType) === null || _b === void 0 ? void 0 : _b.value : null;
                if (parentId && !seen[parentId]) {
                    seen[parentId] = true;
                    parentIds.push(parentId);
                }
            }
        }
        ensureAccountHierarchyCached(parentIds, accountSvc);
    }
    function lookupProjectName(projectId, projectSvc) {
        if (!projectId)
            return "";
        var r = getProjectDetails(projectId, projectSvc);
        return r.length > 0 && r[0].name ? r[0].name.toString() : "";
    }
    function lookupAccountName(accountId, accountSvc) {
        if (!accountId || accountId === "null" || accountId === "undefined")
            return "";
        var r = getAccountDetails(accountId, accountSvc);
        return r.length > 0 && r[0].name ? r[0].name.toString() : "";
    }
    function lookupCostCodeName(costCodeId, costCodeSvc) {
        if (!costCodeId)
            return "";
        var r = getCostCodeDetails(costCodeId, costCodeSvc);
        return r.length > 0 && r[0].name ? r[0].name.toString() : "";
    }
    function getDefaultAccountFieldName(recordType) {
        if (recordType === "expensereport")
            return "expenseaccount";
        return BCTransactionModel_1.Transaction.fields.account;
    }
    function validateUnlockBudgetFeature(pProjectId, projectAdvancedPrefSvc) {
        var _a, _b;
        if (!projectAdvancedPrefSvc.getByProjectId) {
            log.error("Missing method", "The project advanced preferences service does not implement getByProjectId");
            return false;
        }
        // Validate if the project has the unlock budget preference enabled
        if (!projectDataCache[pProjectId]) {
            var projectAdvancePref = projectAdvancedPrefSvc.getByProjectId(pProjectId);
            projectDataCache[pProjectId] = {
                unlockBudget: projectAdvancePref ? projectAdvancePref.unlockBudget : false
            };
        }
        return (_b = (_a = projectDataCache[pProjectId]) === null || _a === void 0 ? void 0 : _a.unlockBudget) !== null && _b !== void 0 ? _b : false;
    }
});
