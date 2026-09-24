/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/log'], function (record, log) {
    function onAction(context) {
        try {
            var vbId = context.newRecord.id;
            var cfg = getApprovalConfig(context.newRecord.type);
            var vbRec = record.load({
                type: cfg.recordType,
                id: vbId,
                isDynamic: false
            });

            var sublists = cfg.sublists;
            var linesUpdated = 0;

            sublists.forEach(function (sublistId) {
                var lineCount = vbRec.getLineCount({ sublistId: sublistId });

                for (var i = 0; i < lineCount; i++) {
                    var status = vbRec.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_bc_approval_status',
                        line: i
                    });

                    if (status != '2') {
                        vbRec.setSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approval_status',
                            line: i,
                            value: '2'
                        });
                        linesUpdated++;
                    }
                }
            });

            vbRec.setValue({ fieldId: cfg.allApprovedField, value: true });
            vbRec.setValue({ fieldId: 'approvalstatus', value: 2 });
            vbRec.setValue({ fieldId: cfg.stateField, value: 4 });
            var creator = vbRec.getValue({fieldId: 'custbody_bc_created_by'})
            var vbTranId = vbRec.getValue({fieldId: 'tranid'})
            try {
                var vbRecId = vbRec.save({ignoreMandatoryFields: true});
                if(creator){
                    /*email.send({
                        //author: authorId,
                        author: 7080, //Athena Santiago
                        recipients: creator,
                        subject: 'Vendor Bill has been approved',
                        body: 'Vendor Bill:  ' + vbTranId + ' has been approved.'
                    });*/
                }

            }catch (e) {
                log.debug('Error in saving approved lines', e)
            }

            log.debug('WFA: Approval finalized', linesUpdated);
        } catch (e) {
            log.debug('WFA error', e.message);
        }
    }


    // Route Expense Reports to their own fields; legacy bill URLs default to Vendor Bill.
    function getApprovalConfig(recordType) {
        var type = String(recordType || 'vendorbill').toLowerCase();
        if (type !== 'vendorbill' && type !== 'expensereport') {
            throw new Error('Unsupported transaction type: ' + type);
        }
        var isExpenseReport = type === 'expensereport';
        return {
            recordType: type,
            isExpenseReport: isExpenseReport,
            label: isExpenseReport ? 'Expense Report' : 'Vendor Bill',
            sublists: isExpenseReport ? ['expense'] : ['item', 'expense'],
            stateField: 'custbody_bc_vb_wf_state',
            allApprovedField: 'custbody_bc_vb_all_approved',
            allRejectedField: 'custbody_bc_vb_all_rejected',
            allNoProjectField: 'custbody_bc_all_no_project',
            expenseAccountField: isExpenseReport ? 'expenseaccount' : 'account'
        };
    }

    return { onAction };
});
