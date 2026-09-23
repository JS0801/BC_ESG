/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/runtime', 'N/url', 'N/email', 'N/redirect'], function (ui, record, runtime, url, email, redirect) {

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
                var form = ui.createForm({title: 'Vendor Bill Lines for Approval'});
                form.addSubmitButton({label: 'Submit'});

                form.clientScriptFileId = 27150;

                // Add hidden field for Bill ID
                form.addField({
                    id: 'custpage_bill_id',
                    label: 'Bill ID',
                    type: ui.FieldType.SELECT,
                    source: 'transaction'
                }).updateDisplayType({displayType: ui.FieldDisplayType.INLINE}).defaultValue = vbId;

                // Add header dropdown for action
                var actionField = form.addField({
                    id: 'custpage_action',
                    label: 'Action',
                    type: ui.FieldType.SELECT
                });
                actionField.addSelectOption({value: '', text: ' '});
                actionField.addSelectOption({value: 'approve', text: 'Approve All Selected Lines'});
                actionField.addSelectOption({value: 'reject', text: 'Reject All Selected Lines'});
                actionField.isMandatory = true;

                if (action) {
                    actionField.defaultValue = action;
                }

                // Add sublist
                var sublist = form.addSublist({
                    id: 'custpage_lines',
                    type: ui.SublistType.LIST,
                    label: 'Lines for Review'
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
                }).updateDisplayType({displayType: ui.FieldDisplayType.ENTRY});

                var vbRec = record.load({type: record.Type.VENDOR_BILL, id: vbId});
                var sublists = ['item', 'expense'];
                var lineIndex = 0;

                sublists.forEach(function (sublistId) {
                    var count = vbRec.getLineCount({sublistId});
                    for (var i = 0; i < count; i++) {
                        var approver = vbRec.getSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_project_manager',
                            line: i
                        });
                        var status = vbRec.getSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approval_status',
                            line: i
                        });

                        if (status !== '1') continue; // Only pending lines
                        if (!isAdmin) {
                            // Not admin → show only lines assigned to current user
                            if (approver != currentUserId) continue;
                        }
                        //if (approver && approver != currentUserId && !isAdmin) continue;

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
                        lineIndex++;
                    }
                });

                response.writePage(form);

                var remaining = runtime.getCurrentScript().getRemainingUsage();
                log.debug('Remaining Usage -- GET', remaining);
                response.writePage(form);

            } catch (e) {
                log.debug('Suitelet GET Error', e);
                response.write('Error loading page: ' + e.message);
            }

        } else {
            try {
                var vbId = request.parameters.custpage_bill_id;
                var vbRec = record.load({type: record.Type.VENDOR_BILL, id: vbId, isDynamic: false});
                var action = request.parameters.custpage_action;
                var lineCount = request.getLineCount({group: 'custpage_lines'});
                var selectedCount = 0;

                if (!action) throw new Error('Please select an action at the top of the page.');
                var rejectedLines = [];

                for (var i = 0; i < lineCount; i++) {
                    var checked = request.getSublistValue({group: 'custpage_lines', name: 'select', line: i});
                    if (checked === 'T') {
                        selectedCount++;
                        var sublistId = request.getSublistValue({
                            group: 'custpage_lines',
                            name: 'sublistid',
                            line: i
                        }).toLowerCase();
                        var index = request.getSublistValue({
                            group: 'custpage_lines',
                            name: 'index',
                            line: i
                        });
                        var comment = request.getSublistValue({
                            group: 'custpage_lines',
                            name: 'remarks',
                            line: i
                        }) || '';

                        if (action === 'approve') {
                            vbRec.setSublistValue({
                                sublistId,
                                fieldId: 'custcol_bc_approval_status',
                                line: index,
                                value: 2
                            });
                        } else if (action === 'reject') {
                            if (!comment.trim()) throw new Error('Approver remarks are required for all rejected lines.');
                            vbRec.setSublistValue({
                                sublistId,
                                fieldId: 'custcol_bc_approval_status',
                                line: index,
                                value: 3
                            });
                            vbRec.setSublistValue({
                                sublistId,
                                fieldId: 'custcol_bc_approver_comment',
                                line: index,
                                value: comment
                            });

                            // Collect rejected line details for email
                            rejectedLines.push({
                                lineNumber: parseInt(index, 10) + 1, // Line # visible in UI
                                project: vbRec.getSublistText({
                                    sublistId,
                                    fieldId: 'cseg_bc_project',
                                    line: index
                                }) || 'No Project',
                                amount: vbRec.getSublistText({sublistId, fieldId: 'amount', line: index}),
                                remarks: comment
                            });

                        }
                    }
                }

                if (selectedCount === 0) throw new Error('Please select at least one line.');

                vbRec.save();

                // Re-check if all lines now approved
                var allApproved = true;
                var sublists = ['item', 'expense'];
                sublists.forEach(function (sublistId) {
                    var count = vbRec.getLineCount({sublistId});
                    for (var i = 0; i < count; i++) {
                        var status = vbRec.getSublistValue({sublistId, fieldId: 'custcol_bc_approval_status', line: i});
                        if (status != '2') {
                            allApproved = false;
                            break;
                        }
                    }
                });

                if (allApproved) {
                    record.submitFields({
                        type: record.Type.VENDOR_BILL,
                        id: vbId,
                        values: {custbody_bc_vb_all_approved: true}
                    });
                }

                // Re-check if all lines now rejected
                var allRejected = true;
                var sublists = ['item', 'expense'];
                sublists.forEach(function (sublistId) {
                    var count = vbRec.getLineCount({sublistId});
                    for (var i = 0; i < count; i++) {
                        var status = vbRec.getSublistValue({sublistId, fieldId: 'custcol_bc_approval_status', line: i});
                        if (status != '3') {
                            allRejected = false;
                            break;
                        }
                    }
                });

                if (allRejected) {
                    record.submitFields({
                        type: record.Type.VENDOR_BILL,
                        id: vbId,
                        values: {custbody_bc_vb_all_rejected: true}
                    });
                }

                if (rejectedLines.length > 0) {
                    var creatorId = vbRec.getValue({fieldId: 'custbody_bc_created_by'});
                    if (creatorId) {
                        var subject = 'Vendor Bill Lines Rejected (Bill #' + vbRec.getValue({fieldId: 'tranid'}) + ')';
                        var body = 'Hi,<br/><br/>';
                        body += 'The following lines were rejected on Vendor Bill ' + vbRec.getValue({fieldId: 'tranid'}) + ':<br/><br/>';

                        body += '<br/><table border="1" cellpadding="7" cellspacing="3" style="border-collapse: collapse;">';
                        body += '<tr><th>Line #</th><th>Project</th><th>Amount</th><th>Approver Remarks</th></tr>';

                        rejectedLines.forEach(function (line) {
                            body += '<tr>';
                            body += '<td>' + line.lineNumber + '</td>';
                            body += '<td>' + line.project + '</td>';
                            body += '<td>' + line.amount + '</td>';
                            body += '<td>' + line.remarks + '</td>';
                            body += '</tr>';
                        });

                        body += '</table>';

                        var vbUrl = url.resolveRecord({
                            recordType: record.Type.VENDOR_BILL,
                            recordId: vbId,
                            isEditMode: false
                        });
                        body += '<p>Please review and resubmit the rejected lines if needed.</p>';
                        body += '<p><a href="' + vbUrl + '" target="_blank">View Vendor Bill</a></p>';

                        email.send({
                            author: 7173, // Accounts Payable
                            recipients: creatorId,
                            subject: subject,
                            body: body
                        });

                        log.debug('Rejection Email Sent', 'Sent to creator (Employee ID: ' + creatorId + ')');
                    } else {
                        log.debug('Rejection Email Skipped', 'No creator found on VB');
                    }
                }

                redirect.toRecord({type: record.Type.VENDOR_BILL, id: vbId});

            } catch (e) {
                log.debug('Suitelet POST Error', e);
                response.write('Error submitting: ' + e.message);
            }
        }
    }

    return {onRequest};
});
