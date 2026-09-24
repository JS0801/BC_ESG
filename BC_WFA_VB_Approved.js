/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/log'], function (record, log) {
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

            vbRec.setValue({ fieldId: 'custbody_bc_vb_all_approved', value: true });
            vbRec.setValue({ fieldId: 'approvalstatus', value: 2 });
            vbRec.setValue({ fieldId: 'custbody_bc_vb_wf_state', value: 4 });
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

    return { onAction };
});
