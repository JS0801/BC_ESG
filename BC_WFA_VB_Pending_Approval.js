/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/runtime', 'N/email', 'N/url', 'N/search'], function (record, runtime, email, url, search) {

    function onAction(context) {
        var vbRec = context.newRecord;
        var cfg = getApprovalConfig(vbRec.type);
        /*var vbRec = record.load({
            type: cfg.recordType,
            id: context.newRecord.id,
            isDynamic: false
        });*/
        var sublists = cfg.sublists;
        var pmList = [];
        var hasAnyProject = false;

        try {

            for (var s = 0; s < sublists.length; s++) {
                var sublistId = sublists[s];
                var lineCount = vbRec.getLineCount({sublistId: sublistId});

                for (var i = 0; i < lineCount; i++) {
                    var projectId = vbRec.getSublistValue({sublistId: sublistId, fieldId: 'cseg_bc_project', line: i});
                    var approverId = vbRec.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_bc_project_manager',
                        line: i
                    });

                    var statusToSet;
                    if (!approverId) {
                        statusToSet = 2; //Auto-approve if no approver
                    } else {
                        statusToSet = 1;
                        hasAnyProject = true;

                        //Add approver to email list if not already added
                        if (pmList.indexOf(approverId) == -1) {
                            pmList.push(approverId);
                        }
                    }

                    /*var status = vbRec.getSublistValue({sublistId: sublistId, fieldId: 'custcol_bc_approval_status', line: i});
                    if (status != 2) {
                        /*vbRec.setSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approval_status',
                            line: i,
                            value: '1' // Pending
                        });*/

                    if (cfg.isExpenseReport && !vbRec.isDynamic) {
                        vbRec.setSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approval_status',
                            line: i,
                            value: statusToSet
                        });
                    } else {
                        vbRec.selectLine({sublistId: sublistId, line: i});
                        vbRec.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approval_status',
                            value: statusToSet
                        });
                        vbRec.commitLine({sublistId: sublistId});
                    }

                    /*var alreadyAdded = false;
                    for (var j = 0; j < pmList.length; j++) {
                        if (pmList[j] == approverId) {
                            alreadyAdded = true;
                            break;
                        }
                    }
                    if (!alreadyAdded) {
                        pmList.push(approverId);
                    }*/
                }
            }

            // Set header flags
            var allAutoApproved = (pmList.length === 0);
            vbRec.setValue({fieldId: cfg.allApprovedField, value: false});
            vbRec.setValue({fieldId: cfg.allRejectedField, value: false});
            vbRec.setValue({fieldId: cfg.allNoProjectField, value: !hasAnyProject});
            vbRec.setValue({fieldId: 'approvalstatus', value: 1});
            vbRec.setValue({fieldId: cfg.stateField, value: 2}); //Pending Approval wf state

            // Save the Vendor Bill
            // var vbId = vbRec.save({ignoreMandatoryFields: true});
        } catch (e) {
            log.debug('Set line status to Pending Approval error', e)
        }

        try {
            // Send email per approver
            log.debug('pmList', pmList)
            log.debug('# of recipients', pmList.length)

            if (!allAutoApproved && pmList.length > 0) {
                var authorId = runtime.getCurrentUser().id;
                var accountId = runtime.accountId.replace('_', '-');
                var vbUrl = url.resolveRecord({
                    recordType: vbRec.type,
                    recordId: vbRec.id,
                    isEditMode: false
                });
                vbUrl = 'https://' + accountId + '.app.netsuite.com' + vbUrl;
                var vbTranId = vbRec.getValue({fieldId: 'tranid'})

                log.debug('pmList', pmList);
                log.debug('# of recipients', pmList.length);

                for (var i = 0; i < pmList.length; i++) {
                    var pmId = pmList[i];
                    /*var htmlBody = 'Hi, <p>You have lines pending your approval.</p>' +
                        '<p>Bill Number: <b><a href="' + vbUrl + '" target="_blank"> ' + vbTranId + '</a></b></p>' +
                        '<p style="font-size: 9px; color: #555;"><a href="https://4696675-sb1.app.netsuite.com/app/common/search/searchresults.nl?searchid=899&whence=" target="_blank">' +
                        'View all Vendor Bills pending your approval</a></p>';*/

                    // Build email HTML body for this PM
                    var htmlBody = 'Hi,<br/><br/>';
                    htmlBody += 'You have lines pending your approval for ' + cfg.label + ' <b>' + vbTranId + '</b>:<br/><br/>';
                    htmlBody += '<p>View the ' + cfg.label + ': <a href="' + vbUrl + '" target="_blank">' + vbTranId + '</a></p>';

                    htmlBody += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-size: 12px;">';
                    htmlBody += '<tr style="background-color:#f2f2f2;">';
                    htmlBody += '<th>Line #</th><th>Project</th><th>Cost Code</th><th>Amount</th><th>Description</th>';
                    htmlBody += '</tr>';

                    for (var s = 0; s < sublists.length; s++) {
                        var sublistId = sublists[s];
                        var lineCount = vbRec.getLineCount({ sublistId: sublistId });

                        for (var l = 0; l < lineCount; l++) {
                            var lineApprover = vbRec.getSublistValue({
                                sublistId: sublistId,
                                fieldId: 'custcol_bc_project_manager',
                                line: l
                            });
                            var status = vbRec.getSublistValue({
                                sublistId: sublistId,
                                fieldId: 'custcol_bc_approval_status',
                                line: l
                            });

                            if (lineApprover == pmId && status == 1) {
                                var lineNum = l + 1;
                                var project = vbRec.getSublistText({
                                    sublistId: sublistId,
                                    fieldId: 'cseg_bc_project',
                                    line: l
                                }) || 'No Project';
                                var costCode = vbRec.getSublistText({
                                    sublistId: sublistId,
                                    fieldId: 'cseg_bc_cost_code',
                                    line: l
                                }) || '';
                                var amount = vbRec.getSublistText({
                                    sublistId: sublistId,
                                    fieldId: 'amount',
                                    line: l
                                }) || 0;
                                var desc = sublistId === 'expense'
                                    ? vbRec.getSublistValue({ sublistId, fieldId: 'memo', line: l }) || ''
                                    : vbRec.getSublistValue({ sublistId, fieldId: 'description', line: l }) || '';

                                htmlBody += '<tr>';
                                htmlBody += '<td align="center">' + lineNum + '</td>';
                                htmlBody += '<td>' + project + '</td>';
                                htmlBody += '<td>' + costCode + '</td>';
                                htmlBody += '<td align="right">' + amount + '</td>';
                                htmlBody += '<td>' + desc + '</td>';
                                htmlBody += '</tr>';
                            }
                        }
                    }

                    htmlBody += '</table>';
                    if (!cfg.isExpenseReport) {
                    htmlBody += '<p style="font-size: 10px; color: #555;"><a href="https://4696675.app.netsuite.com/app/common/search/searchresults.nl?searchid=933&whence=" target="_blank">View all Vendor Bills pending your approval</a></p>';
                    }


                    try {
                        email.send({
                            //author: authorId,
                            author: 7173, // Accounts Payable
                            recipients: [pmId],
                            subject: cfg.label + ' ' + vbTranId + ' : Awaiting Your Approval',
                            body: htmlBody,
                            isHtml: true
                        });
                    } catch (e) {
                        log.debug('Email send failed', {
                            approverId: pmId,
                            error: e.message
                        });
                    }
                }
            }else if(allAutoApproved){
                log.debug('Emails skipped', 'All lines auto-approved. No notifications sent.');
            }
        } catch (e) {
            log.debug('Send email error', e)
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
            stateField: isExpenseReport ? 'custbody_bc_er_wf_state' : 'custbody_bc_vb_wf_state',
            allApprovedField: isExpenseReport ? 'custbody_bc_er_all_approved' : 'custbody_bc_vb_all_approved',
            allRejectedField: isExpenseReport ? 'custbody_bc_er_all_rejected' : 'custbody_bc_vb_all_rejected',
            allNoProjectField: isExpenseReport ? 'custbody_bc_er_all_no_project' : 'custbody_bc_all_no_project',
            expenseAccountField: isExpenseReport ? 'expenseaccount' : 'account'
        };
    }

    return {onAction};
});
