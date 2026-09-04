/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @contact sales@bluecollar.cloud
 *
 * Copyright © 2025 Blue Collar Cloud.
 * All rights reserved.
 */
define(["require", "exports", "N/log", "../BCBudgetModels/BCTransactionModel", "../BCBudgetServices/BCTransactionService", "../BCBudgetModels/BCSalesOrder"], function (require, exports, log, BCTransactionModel_1, BCTransactionService_1, BCSalesOrder_1) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.afterSubmit = exports.beforeLoad = void 0;
    var validTransactionTypes = ['vendorbill', 'vendorcredit', 'creditcardcharge', 'purchaseorder', 'check', 'journalentry', 'expensereport', 'inventoryadjustment', 'salesorder', 'invoice', 'cashsale', 'customerpayment', 'customerdeposit', 'customerrefund', 'cashrefund', 'estimate', 'itemfulfillment', 'itemreceipt', 'returnauthorization', 'vendorreturnauthorization', 'inventorytransfer', 'transferorder', 'intercompanyjournalentry', 'workorder', 'opportunity', 'deposit', 'advintercompanyjournalentry', 'customerdeposit', 'paycheck', 'vendorpayment', 'intercompanytransferorder', 'creditmemo', 'customsale_bc_field_ticket'];
    function beforeLoad(pContext) {
        try {
            switch (pContext.type) {
                case pContext.UserEventType.CREATE:
                case pContext.UserEventType.COPY:
                    if (validTransactionTypes.indexOf("".concat(pContext.newRecord.type)) > -1) {
                        handleClearUITransactionTMBillingFields(pContext);
                    }
                    break;
                default:
                    break;
            }
        }
        catch (beforeLoadError) {
            log.error("message", beforeLoadError.message);
            log.error("stack", JSON.stringify(beforeLoadError));
        }
    }
    exports.beforeLoad = beforeLoad;
    function afterSubmit(pContext) {
        try {
            switch (pContext.type) {
                case pContext.UserEventType.CREATE:
                case pContext.UserEventType.COPY:
                    if (validTransactionTypes.indexOf("".concat(pContext.newRecord.type)) > -1) {
                        handleClearTransactionTMBillingFields(pContext);
                    }
                    break;
                default:
                    break;
            }
        }
        catch (beforeLoadError) {
            log.error("message", beforeLoadError.message);
            log.error("stack", JSON.stringify(beforeLoadError));
        }
    }
    exports.afterSubmit = afterSubmit;
    function handleClearUITransactionTMBillingFields(pContext, transactionService) {
        if (transactionService === void 0) { transactionService = null; }
        try {
            if (!transactionService) {
                transactionService = new BCTransactionService_1.BCTransactionService();
            }
            var sublists = getSublists(pContext);
            transactionService.clearFromUITimeAndMaterialsBillingTransaction(pContext.newRecord, sublists);
        }
        catch (error) {
            log.error("Error", error.message);
            log.error("Stack", JSON.stringify(error));
        }
    }
    function getSublists(pContext) {
        var record = pContext.newRecord;
        var sublists = record.getSublists();
        return sublists;
    }
    function handleClearTransactionTMBillingFields(pContext, transactionService) {
        if (transactionService === void 0) { transactionService = null; }
        try {
            if (!transactionService) {
                transactionService = new BCTransactionService_1.BCTransactionService();
            }
            var filters = [
                [BCTransactionModel_1.Transaction.fields.internalId, "anyof", pContext.newRecord.id],
                "AND",
                [BCTransactionModel_1.Transaction.timeBillTimeAndMaterialsBillingFields.timeAndMaterialsBillingTransaction, "noneof", "@NONE@"],
                "AND",
                [[[BCTransactionModel_1.Transaction.fields.type, "noneof", BCTransactionModel_1.Transaction.getJournalSearchTypes()], "AND", [BCTransactionModel_1.Transaction.fields.mainLine, "is", "F"]], "OR", [BCTransactionModel_1.Transaction.fields.type, "anyof", BCTransactionModel_1.Transaction.getJournalSearchTypes()]]
            ];
            var transactionPaged = { page: 0, size: 1000, total: 0, data: [] };
            transactionPaged = transactionService.getAllByPaged(filters, transactionPaged, true);
            if (transactionPaged.data.length > 0) {
                var newSalesOrder = new BCSalesOrder_1.BCSalesOrder();
                newSalesOrder.id = null;
                var bcTransactionLines_1 = [];
                transactionPaged.data.forEach(function (m) {
                    var bcTransaction = new BCTransactionModel_1.Transaction(m.id, m.id);
                    bcTransaction.line = m.line || m.lineNumber;
                    bcTransaction.recordType = m.recordType;
                    bcTransaction.sublist = m.sublist;
                    bcTransactionLines_1.push(bcTransaction);
                });
                transactionService.updateTimeAndMaterialsBillingTransaction(bcTransactionLines_1, newSalesOrder);
            }
        }
        catch (error) {
            log.error("Error", error.message);
            log.error("Stack", JSON.stringify(error));
        }
    }
});
