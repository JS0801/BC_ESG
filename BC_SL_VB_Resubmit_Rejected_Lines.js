/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define([
    'N/ui/serverWidget',
    'N/record',
    'N/search',
    'N/runtime',
    'N/url',
    'N/email',
    'N/redirect'
], function (ui, record, search, runtime, url, email, redirect) {

    function onRequest(context) {
        var request = context.request;
        var response = context.response;
        var vbId = request.parameters.billid;
        var action = request.parameters.action;
        var currentUser = runtime.getCurrentUser();
        var currentUserId = currentUser.id;
        var isAdmin = currentUser.role == 3 || currentUser.role == 1426 || currentUser.role == 1931;

        if (request.method === 'GET') {
            try {
                var form = ui.createForm({title: 'Resubmit Rejected Vendor Bill Lines'});
                form.addSubmitButton({label: 'Resubmit for Approval'});

                form.addField({
                    id: 'custpage_bill_id',
                    label: 'Bill ID',
                    type: ui.FieldType.SELECT,
                    source: 'transaction'
                }).updateDisplayType({displayType: ui.FieldDisplayType.INLINE}).defaultValue = vbId;

                var sublist = form.addSublist({
                    id: 'custpage_lines',
                    type: ui.SublistType.LIST,
                    label: 'Rejected lines'
                });
                sublist.addMarkAllButtons();

                sublist.addField({id: 'select', type: ui.FieldType.CHECKBOX, label: 'Select'});
                sublist.addField({id: 'line', type: ui.FieldType.INTEGER, label: 'Line #'});
                sublist.addField({id: 'index', type: ui.FieldType.INTEGER, label: 'Index'});
                sublist.addField({id: 'sublistid', type: ui.FieldType.TEXT, label: 'Sublist ID'});
                sublist.addField({id: 'proj', type: ui.FieldType.TEXT, label: 'Blue Collar Project'});
                sublist.addField({id: 'projmanager', type: ui.FieldType.TEXT, label: 'Project Manager'});
                sublist.addField({id: 'costcode', type: ui.FieldType.TEXT, label: 'Cost Code'});
                sublist.addField({id: 'account', type: ui.FieldType.TEXT, label: 'Account'});
                sublist.addField({id: 'description', type: ui.FieldType.TEXTAREA, label: 'Description'});
                sublist.addField({id: 'amt', type: ui.FieldType.CURRENCY, label: 'Amount'});
                sublist.addField({
                    id: 'remarks',
                    type: ui.FieldType.TEXTAREA,
                    label: 'Approver Remarks'
                })

                var vbRec = record.load({type: record.Type.VENDOR_BILL, id: vbId});
                var sublists = ['item', 'expense'];
                var lineIndex = 0;

                sublists.forEach(function (sublistId) {
                    var count = vbRec.getLineCount({sublistId});
                    for (var i = 0; i < count; i++) {
                        var approver = vbRec.getSublistValue({
                            sublistId,
                            fieldId: 'custcol_bc_project_manager',
                            line: i
                        });
                        var status = vbRec.getSublistValue({sublistId, fieldId: 'custcol_bc_approval_status', line: i});

                        if (status !== '3') continue;

                        var creator = vbRec.getValue('custbody_bc_created_by');
                        if (creator != currentUserId && !isAdmin) continue;

                        var pm = vbRec.getSublistText({sublistId, fieldId: 'custcol_bc_project_manager', line: i});

                        sublist.setSublistValue({id: 'line', line: lineIndex, value: (i + 1).toString()});
                        sublist.setSublistValue({id: 'index', line: lineIndex, value: i});
                        sublist.setSublistValue({id: 'sublistid', line: lineIndex, value: sublistId.toUpperCase()});
                        sublist.setSublistValue({
                            id: 'proj',
                            line: lineIndex,
                            value: vbRec.getSublistText({sublistId, fieldId: 'cseg_bc_project', line: i}) || ' '
                        });
                        sublist.setSublistValue({
                            id: 'projmanager',
                            line: lineIndex,
                            value: vbRec.getSublistText({
                                sublistId,
                                fieldId: 'custcol_bc_project_manager',
                                line: i
                            }) || ' '
                        });
                        sublist.setSublistValue({
                            id: 'costcode',
                            line: lineIndex,
                            value: vbRec.getSublistText({sublistId, fieldId: 'cseg_bc_cost_code', line: i}) || ' '
                        });

                        log.debug('sublistId', sublistId)

                        //ACCOUNT
                        var accountValue = ' ';
                        if (sublistId == 'expense') {
                            accountValue = vbRec.getSublistText({
                                sublistId: sublistId,
                                fieldId: 'account',
                                line: i
                            });
                        }
                        accountValue = String(accountValue || ' '); // Force to string
                        log.debug('accountValue', accountValue)

                        sublist.setSublistValue({
                            id: 'account',
                            line: lineIndex,
                            value: accountValue
                        });

                        var lineMemo = ' '
                        if (sublistId == 'expense') {
                            lineMemo = vbRec.getSublistValue({
                                sublistId: sublistId,
                                fieldId: 'memo',
                                line: i
                            });
                        } else {
                            lineMemo = vbRec.getSublistValue({
                                sublistId: sublistId,
                                fieldId: 'description',
                                line: i
                            });
                        }
                        sublist.setSublistValue({
                            id: 'description',
                            line: lineIndex,
                            value: lineMemo || ' '
                        });

                        sublist.setSublistValue({
                            id: 'amt',
                            line: lineIndex,
                            value: vbRec.getSublistValue({sublistId, fieldId: 'amount', line: i})
                        });

                        sublist.setSublistValue({
                            id: 'remarks',
                            line: lineIndex,
                            value: vbRec.getSublistValue({sublistId, fieldId: 'custcol_bc_approver_comment', line: i})
                        });
                        lineIndex++;
                    }
                });

                var remaining = runtime.getCurrentScript().getRemainingUsage();
                log.debug('Remaining Usage', remaining);

                response.writePage(form);

            } catch (e) {
                log.debug('Get Error', e)
            }

        } else {

            try {
                var vbId = request.parameters.custpage_bill_id;
                var vbRec = record.load({type: record.Type.VENDOR_BILL, id: vbId, isDynamic: false});
                var vbTranId = vbRec.getValue('tranid')
                var accountId = runtime.accountId.replace('_', '-');
                var vbUrl = url.resolveRecord({
                    recordType: vbRec.type,
                    recordId: vbId,
                    isEditMode: false
                });
                vbUrl = 'https://' + accountId + '.app.netsuite.com' + vbUrl;

                var lineCount = request.getLineCount({group: 'custpage_lines'});
                var selectedCount = 0;
                var pmLines = {};

                for (var i = 0; i < lineCount; i++) {
                    var checked = request.getSublistValue({group: 'custpage_lines', name: 'select', line: i});
                    log.debug('Selected ' + checked);
                    if (checked === 'T') {
                        selectedCount++;
                        var sublistId = request.getSublistValue({
                            group: 'custpage_lines',
                            name: 'sublistid',
                            line: i
                        }).toLowerCase();
                        var index = request.getSublistValue({group: 'custpage_lines', name: 'index', line: i});
                        log.debug('index', index)

                        vbRec.setSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approval_status',
                            line: index,
                            value: 1 // Pending
                        });
                        vbRec.setSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approver_comment',
                            line: index,
                            value: ''
                        });

                        var pmId = vbRec.getSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_project_manager',
                            line: index
                        });
                        if (pmId) {
                            if (!pmLines[pmId]) pmLines[pmId] = [];
                            pmLines[pmId].push({
                                lineNumber: parseInt(index, 10) + 1,
                                project: vbRec.getSublistText({
                                    sublistId,
                                    fieldId: 'cseg_bc_project',
                                    line: index
                                }) || 'No Project',
                                costCode: vbRec.getSublistText({
                                    sublistId,
                                    fieldId: 'cseg_bc_cost_code',
                                    line: index
                                }) || '',
                                amount: vbRec.getSublistText({sublistId, fieldId: 'amount', line: index}),
                                description: sublistId === 'expense'
                                    ? vbRec.getSublistValue({sublistId, fieldId: 'memo', line: index}) || ''
                                    : vbRec.getSublistValue({sublistId, fieldId: 'description', line: index}) || ''
                            });
                        }
                    }
                }

                if (selectedCount == 0) {
                    throw new Error('Please select at least one line to resubmit for approval.');
                }

                vbRec.save();

                // Send per-PM emails
                Object.keys(pmLines).forEach(function (pmId) {
                    var lines = pmLines[pmId];

                    var htmlBody = 'Hi,<br/><br/>The following Vendor Bill lines have been resubmitted for your approval:<br/><br/>';
                    htmlBody += '<p>View the Vendor Bill: <a href="' + vbUrl + '" target="_blank">' + vbTranId + '</a></p>';

                    htmlBody += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-size: 12px;">';
                    htmlBody += '<tr style="background-color:#f2f2f2;"><th>Line #</th><th>Project</th><th>Cost Code</th><th>Amount</th><th>Description</th></tr>';

                    lines.forEach(function (line) {
                        htmlBody += '<tr>';
                        htmlBody += '<td align="center">' + line.lineNumber + '</td>';
                        htmlBody += '<td>' + line.project + '</td>';
                        htmlBody += '<td>' + line.costCode + '</td>';
                        htmlBody += '<td align="right">' + line.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }) + '</td>';
                        htmlBody += '<td>' + line.description + '</td>';
                        htmlBody += '</tr>';
                    });

                    htmlBody += '</table>';
                    htmlBody += '<p style="font-size: 10px; color: #555;"><a href="https://4696675-sb1.app.netsuite.com/app/common/search/searchresults.nl?searchid=899&whence=" target="_blank">View all Vendor Bills pending your approval</a></p>';

                    try {
                        email.send({
                            author: currentUserId,
                            recipients: pmId,
                            subject: 'Vendor Bill Lines Resubmitted for Your Approval - ' + vbTranId,
                            body: htmlBody,
                            isHtml: true
                        });
                        log.debug('Resubmit Email Sent', 'To PM ID: ' + pmId);
                    } catch (e) {
                        log.debug('Email Error', e.message);
                    }
                });

                redirect.toRecord({type: record.Type.VENDOR_BILL, id: vbId});

            } catch (e) {
                log.debug('Error', e)
            }
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

    return {onRequest};
});
