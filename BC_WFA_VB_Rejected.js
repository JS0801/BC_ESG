/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/log', 'N/email'], function (record, log, email) {
    function onAction(context) {
        try {
            var vbId = context.newRecord.id;
            var vbRec = record.load({
                type: record.Type.VENDOR_BILL,
                id: vbId,
                isDynamic: false
            });

            var sublists = ['item', 'expense'];
            var linesUpdated = 0;

            sublists.forEach(function (sublistId) {
                var lineCount = vbRec.getLineCount({ sublistId: sublistId });

                for (var i = 0; i < lineCount; i++) {
                    var status = vbRec.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_bc_approval_status',
                        line: i
                    });

                    if (status != '3') {
                        vbRec.setSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approval_status',
                            line: i,
                            value: '3'
                        });
                        linesUpdated++;
                    }
                }
            });

            vbRec.setValue({ fieldId: 'custbody_bc_vb_all_rejected', value: true });
            vbRec.setValue({ fieldId: 'approvalstatus', value: 3 });
            vbRec.setValue({ fieldId: 'custbody_bc_vb_wf_state', value: 5 });
            var creator = vbRec.getValue({fieldId: 'custbody_bc_created_by'})
            var vbTranId = vbRec.getValue({fieldId: 'tranid'})
            try {
                var vbRecId = vbRec.save({ignoreMandatoryFields: true});
                if(creator){
                    email.send({
                        //author: authorId,
                        author: 7173, //Athena Santiago
                        recipients: creator,
                        subject: 'Vendor Bill has been rejected',
                        body: 'Vendor Bill:  ' + vbTranId + ' has been rejected.'
                    });
                }

            }catch (e) {
                log.debug('Error in saving approved lines', e)
            }

            log.debug('WFA: Approval finalized', linesUpdated);
        } catch (e) {
            log.debug('WFA error', e.message);
        }
    }

  function getApprovalConfig(recordType) {
    var type = String(recordType || 'vendorbill').toLowerCase();

    if (type !== 'vendorbill' && type !== 'expensereport') {
        throw new Error('Unsupported transaction type: ' + type);
    }

    var isExpenseReport = type === 'expensereport';

    return {
        recordType: type,
        label: isExpenseReport ? 'Expense Report' : 'Vendor Bill',

        sublists: isExpenseReport
            ? ['expense']
            : ['item', 'expense'],

        stateField: isExpenseReport
            ? 'custbody_bc_er_wf_state'
            : 'custbody_bc_vb_wf_state',

        allApprovedField: isExpenseReport
            ? 'custbody_bc_er_all_approved'
            : 'custbody_bc_vb_all_approved',

        allRejectedField: isExpenseReport
            ? 'custbody_bc_er_all_rejected'
            : 'custbody_bc_vb_all_rejected',

        allNoProjectField: isExpenseReport
            ? 'custbody_bc_er_all_no_project'
            : 'custbody_bc_all_no_project',

        expenseAccountField: isExpenseReport
            ? 'expenseaccount'
            : 'account'
    };
}

    return { onAction };
});
