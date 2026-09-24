/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/url'], function (record, runtime, url) {
    function beforeLoad(context) {
        try {
            if (context.type !== context.UserEventType.VIEW) return;

            var form = context.form;
            var rec = context.newRecord;
            var cfg = getApprovalConfig(rec.type);
            log.debug('VB ID', rec.id)

            // === Current User Info ===
            var currentUser = runtime.getCurrentUser();
            var currentUserId = currentUser.id;
            var currentUserRole = currentUser.role;
            log.debug('Current User', { id: currentUserId, role: currentUserRole });

            // === Record Info ===
            var currentWfState = rec.getValue(cfg.stateField);
            var creator = rec.getValue('custbody_bc_created_by');
            var isCreator = (currentUserId == creator);


            // === Workflow States ===
            var pendingApprovalState = 2; // Pending Approval
            var approvedState = 4;        // Approved
            var rejectedState = 5;        // Rejected

            // === Role Flags ===
            var isAdmin = (currentUserRole == 3 || currentUserRole == 1426 || currentUserRole == 1931);
            var isPM = isPMRole(currentUserRole);
            var isRegularEmployee = !isAdmin && !isPM;

            // === Line Flags ===
            var hasRejectedLines = false;
            var hasPendingLines = false;
            var isPMWithPendingLines = false;

            var sublists = cfg.sublists;
            for (var s = 0; s < sublists.length; s++) {
                var sublistId = sublists[s];
                var lineCount = rec.getLineCount({ sublistId: sublistId });

                for (var i = 0; i < lineCount; i++) {
                    var approver = rec.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_bc_project_manager',
                        line: i
                    });
                    var status = rec.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_bc_approval_status',
                        line: i
                    });

                    if (status == 1) { // Pending Approval
                        hasPendingLines  = true;
                        if (isPM && approver == currentUserId) {
                            isPMWithPendingLines = true;
                        }
                    }

                    if (status == 3) { // Rejected
                        hasRejectedLines = true;
                    }
                }
            }

            log.debug('State & Flags', {
                currentWfState,
                isAdmin,
                isPM,
                isRegularEmployee,
                isCreator,
                hasRejectedLines,
                hasPendingLines,
                isPMWithPendingLines
            });

            // === Edit Button Visibility ===
            var canEdit = false;

            if (currentWfState == 1) {
                canEdit = true;
            }else if (currentWfState == pendingApprovalState) {
                if (isAdmin) {
                    canEdit = true;
                } else if (isCreator && hasRejectedLines) {
                    canEdit = true; // Creator edits for resubmission
                }
            } else if (currentWfState == rejectedState) {
                if (isAdmin || isCreator) {
                    canEdit = true; // Admin and Creator can edit rejected
                }
            } else if (currentWfState == approvedState) {
                if (isAdmin) {
                    canEdit = true; // Only Admin edits approved
                }
            } else if(currentWfState == ''){
                canEdit = true;
            }

            log.debug('canEdit', canEdit);

            if (!canEdit) {
                form.removeButton('edit'); // Hide Edit button for others
            }


            // ===== Approve / Reject Buttons =====
            var canSeeApproveReject = false;
            if (currentWfState != 1 && hasPendingLines) {
                if (isAdmin) {
                    canSeeApproveReject = true;
                } else if (isPM && isPMWithPendingLines) {
                    canSeeApproveReject = true;
                }
            }

            // ===== Resubmit Button =====
            var canSeeResubmit = false;
            if (currentWfState == pendingApprovalState) { // Only in Pending Approval state
                if (
                    (isCreator && hasRejectedLines && isRegularEmployee) || // Creator + regular employee
                    (isCreator && hasRejectedLines && isAdmin) ||           // Creator + Admin role
                    (!isCreator && isAdmin && hasRejectedLines)             // Admin (not creator) with rejected lines
                ) {
                    canSeeResubmit = true;
                }
            }

            log.debug('canSeeApproveReject', canSeeApproveReject);
            log.debug('canSeeResubmit', canSeeResubmit);

            // ===== Button Visibility =====
            if (canSeeApproveReject) {
                var approveSuiteletUrl = url.resolveScript({
                    scriptId: 'customscript_bc_sl_app_rej_vb',
                    deploymentId: 'customdeploy_bc_sl_app_rej_vb',
                    params: cfg.isExpenseReport
                        ? { billid: rec.id, recordtype: cfg.recordType }
                        : { billid: rec.id }
                });

                form.addButton({
                    id: 'custpage_btn_approve_lines',
                    label: 'Approve Lines',
                    functionName: `window.open('${approveSuiteletUrl}&action=approve', '_blank')`
                });

                form.addButton({
                    id: 'custpage_btn_reject_lines',
                    label: 'Reject Lines',
                    functionName: `window.open('${approveSuiteletUrl}&action=reject', '_blank')`
                });
            }


            // Add Resubmit button
            if (canSeeResubmit) {
                var resubmitSuiteletUrl = url.resolveScript({
                    scriptId: 'customscript_bc_sl_vb_resubmit_lines',
                    deploymentId: 'customdeploy_bc_sl_vb_resubmit_lines',
                    params: cfg.isExpenseReport
                        ? { billid: rec.id, recordtype: cfg.recordType }
                        : { billid: rec.id }
                });

                form.addButton({
                    id: 'custpage_btn_resubmit_lines',
                    label: 'Resubmit Rejected Lines',
                    functionName: `window.open('${resubmitSuiteletUrl}&action=resubmit', '_blank')`
                });
            }
        }catch (e) {
            log.debug('before load error', e)
        }
    }

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT) return;

        var vbRec = context.newRecord;
        var cfg = getApprovalConfig(vbRec.type);
        var sublists = cfg.sublists;

        // check header wf state
        var currentWfState = vbRec.getValue(cfg.stateField);

        for (var x = 0; x < sublists.length; x++) {
            var sublistId = sublists[x];
            var lineCount = vbRec.getLineCount({sublistId: sublistId});

            for (var i = 0; i < lineCount; i++) {
                try {
                    var projectId = vbRec.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'cseg_bc_project',
                        line: i
                    });

                    if (projectId) {
                        var pm = getProjectManager(projectId);
                        if (pm) {
                            vbRec.setSublistValue({
                                sublistId: sublistId,
                                fieldId: 'custcol_bc_project_manager',
                                line: i,
                                value: pm
                            });
                        }

                        vbRec.setSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_proj_line_num',
                            line: i,
                            value: i + 1
                        });
                    }

                    // === NEW LOGIC ===
                    if (parseInt(currentWfState, 10) === 2) {
                        var statusVal = vbRec.getSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custcol_bc_approval_status',
                            line: i
                        });

                        if (!statusVal || statusVal === '') {
                            if (projectId) {
                                vbRec.setSublistValue({
                                    sublistId: sublistId,
                                    fieldId: 'custcol_bc_approval_status',
                                    line: i,
                                    value: 1 // Pending Approval
                                });
                            } else {
                                vbRec.setSublistValue({
                                    sublistId: sublistId,
                                    fieldId: 'custcol_bc_approval_status',
                                    line: i,
                                    value: 2 // Approved
                                });
                            }
                        }
                    }
                    // === END NEW LOGIC ===

                } catch (e) {
                    log.debug('Error', e)
                }
            }
        }
    }

    function getProjectManager(projectId) {
        try {
            var projectRec = record.load({
                type: 'customrecord_cseg_bc_project',
                id: projectId,
                isDynamic: false
            });

            return projectRec.getValue({fieldId: 'custrecord_bc_proj_manager'});
        } catch (e) {
            log.debug('Failed to load project', e.message);
            return null;
        }
    }

    function isPMRole(roleId) {
        var pmRoles = [1318, 1321, 1424, 1928]; //PM role internal IDs
        return pmRoles.includes(parseInt(roleId, 10));
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
            allApprovedField: 'custbody_bc_vb_all_approved',
            allRejectedField: 'custbody_bc_vb_all_rejected',
            allNoProjectField: 'custbody_bc_all_no_project',
            expenseAccountField: isExpenseReport ? 'expenseaccount' : 'account'
        };
    }

    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit
    };
});
