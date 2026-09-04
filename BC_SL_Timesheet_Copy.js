/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/ui/serverWidget', 'N/redirect', 'N/search', 'N/runtime', 'N/format'], function (record, serverWidget, redirect, search, runtime, format) {
    function onRequest(context) {
        if (context.request.method === 'GET') {
            try {
                log.debug('--- START GET ---', '--- START GET ---')
                //Load Timesheet to be copied
                var timesheetRec = record.load({
                    type: record.Type.TIME_SHEET,
                    id: context.request.parameters.timesheetId,
                    isDynamic: false
                });
                var lineCount = timesheetRec.getLineCount({sublistId: 'timeitem'});
                log.debug('lineCount', lineCount);

                //Get all timesheet sublist details
                var timeSheetDataObj = []
                for (var i = 0; i < lineCount; i++) {
                    var projectId = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'cseg_bc_project',
                        line: i
                    });
                    var projectText = timesheetRec.getSublistText({
                        sublistId: 'timeitem',
                        fieldId: 'cseg_bc_project',
                        line: i
                    });
                    var costCodeId = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'cseg_bc_cost_code',
                        line: i
                    });
                    var costCodeText = timesheetRec.getSublistText({
                        sublistId: 'timeitem',
                        fieldId: 'cseg_bc_cost_code',
                        line: i
                    });
                    var taskId = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'casetaskevent',
                        line: i
                    });
                    var taskText = timesheetRec.getSublistText({
                        sublistId: 'timeitem',
                        fieldId: 'casetaskevent',
                        line: i
                    });
                    var itemId = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'item',
                        line: i
                    });
                    var itemText = timesheetRec.getSublistText({
                        sublistId: 'timeitem',
                        fieldId: 'item',
                        line: i
                    });
                    var laborCodeId = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'custcol1',
                        line: i
                    });
                    var laborCodeText = timesheetRec.getSublistText({
                        sublistId: 'timeitem',
                        fieldId: 'custcol1',
                        line: i
                    });
                    var shiftId = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'custcol_bc_tm_billing_shift',
                        line: i
                    });
                    var shiftText = timesheetRec.getSublistText({
                        sublistId: 'timeitem',
                        fieldId: 'custcol_bc_tm_billing_shift',
                        line: i
                    });
                    var isBillable = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'isbillable',
                        line: i
                    });
                    var isNonBillable = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'custcol_bc_billable_delete',
                        line: i
                    });
                    var isNonBillableForTm = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'custcol_bc_tm_line_non_billable',
                        line: i
                    });
                    var timeTypeId = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'custcol_bc_time_type',
                        line: i
                    });
                    var timeTypeText = timesheetRec.getSublistText({
                        sublistId: 'timeitem',
                        fieldId: 'custcol_bc_time_type',
                        line: i
                    });
                    var approvalStatus = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'approvalstatus',
                        line: i
                    });
                    var type = timesheetRec.getSublistValue({
                        sublistId: 'timeitem',
                        fieldId: 'timetype',
                        line: i
                    });

                    var timeSheetLine = {
                        projectId: projectId || '',
                        projectText: projectText || '',
                        costCodeId: costCodeId || costCodeId,
                        costCodeText: costCodeText || costCodeText,
                        taskId: taskId || '',
                        taskText: taskText || '',
                        itemId: itemId || '',
                        itemText: itemText || '',
                        laborCodeId: laborCodeId || '',
                        laborCodeText: laborCodeText || '',
                        shiftId: shiftId || '',
                        shiftText: shiftText || '',
                        isBillable: isBillable ? 'T' : 'F',
                        isNonBillable: isNonBillable ? true : false,
                        isNonBillableForTm: isNonBillableForTm ? 'T' : 'F',
                        timeTypeId: timeTypeId || '',
                        timeTypeText: timeTypeText || '',
                        approvalStatus: approvalStatus || '',
                        type: type || ''
                    }
                    log.debug('timsheetLine', timeSheetLine)

                    for (var d = 0; d <= 6; d++) {
                        var hoursValue = timesheetRec.getSublistValue({
                            sublistId: 'timeitem',
                            fieldId: 'hours' + d,
                            line: i
                        });
                        timeSheetLine['hours' + d] = hoursValue !== null && hoursValue !== undefined ? hoursValue.toString() : '';

                        var memoValue = timesheetRec.getSublistValue({
                            sublistId: 'timeitem',
                            fieldId: 'memo' + d,
                            line: i
                        });
                        timeSheetLine['memo' + d] = memoValue !== null && memoValue !== undefined ? memoValue : '';
                    }

                    timeSheetDataObj.push(timeSheetLine)
                }

                log.debug('Time Sheet Data', JSON.stringify(timeSheetDataObj));

                //Suitelet User Interface
                var form = serverWidget.createForm({
                    title: 'Make Copy of Timesheet'
                });
                form.clientScriptFileId = 18797;

                var sourceEmployeeId = timesheetRec.getValue('employee');

                //Employee field
                var empField = form.addField({
                    id: 'custpage_employee',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Employee',
                });
                empField.isMandatory = true;
                empField.addSelectOption({value: '', text: ''});

                var employeeSearch = search.create({
                    type: search.Type.EMPLOYEE,
                    filters: [
                        ['isinactive', 'is', 'F'],
                        'AND',
                        ['internalid', 'noneof', sourceEmployeeId]
                    ],
                    columns: [
                        'internalid',
                        'entityid'
                    ]
                });

                employeeSearch.run().each(function (result) {
                    var id = result.getValue({name: 'internalid'});
                    var name = result.getValue({name: 'entityid'});
                    empField.addSelectOption({value: id, text: name});
                    return true;
                });

                //Date field (Week for New Timesheet)
                var dateField = form.addField({
                    id: 'custpage_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'Week Of'
                });
                dateField.isMandatory = true;

                //Create sublist for timesheet preview
                var sublist = form.addSublist({
                    id: 'custpage_timesheet_sublist',
                    label: 'Time Entries Preview',
                    type: serverWidget.SublistType.LIST
                });

                sublist.addField({
                    id: 'custpage_billable',
                    label: 'Billable',
                    type: serverWidget.FieldType.CHECKBOX
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

                //Add sublist fields
                sublist.addField({
                    id: 'custpage_project',
                    label: 'Customer/Project',
                    type: serverWidget.FieldType.TEXT
                });
                sublist.addField({id: 'custpage_cost_code', label: 'Cost Code', type: serverWidget.FieldType.TEXT});
                sublist.addField({id: 'custpage_task', label: 'Case/Task/Event', type: serverWidget.FieldType.TEXT});
                sublist.addField({id: 'custpage_item', label: 'Service Item', type: serverWidget.FieldType.TEXT});
                sublist.addField({
                    id: 'custpage_nonbillable',
                    label: 'Non-Billable',
                    type: serverWidget.FieldType.CHECKBOX
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                sublist.addField({id: 'custpage_time_type', label: 'Time Type', type: serverWidget.FieldType.TEXT});
                sublist.addField({
                    id: 'custpage_labor_code',
                    label: 'Labor Code Value',
                    type: serverWidget.FieldType.TEXT
                });
                sublist.addField({id: 'custpage_shift', label: 'Shift', type: serverWidget.FieldType.TEXT});
                sublist.addField({
                    id: 'custpage_nonbillable_tm',
                    label: 'Non-Billable For T&M',
                    type: serverWidget.FieldType.CHECKBOX
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

                var dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                for (var d = 0; d < 7; d++) {

                    sublist.addField({
                        id: 'custpage_hours' + d,
                        label: dayLabels[d],
                        type: serverWidget.FieldType.TEXT
                    });
                    sublist.addField({
                        id: 'custpage_memo' + d,
                        label: dayLabels[d] + ' Memo',
                        type: serverWidget.FieldType.TEXT
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                }

                sublist.addField({
                    id: 'custpage_project_id',
                    label: 'Project ID',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({
                    id: 'custpage_cost_code_id',
                    label: 'Cost Code ID',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({
                    id: 'custpage_task_id',
                    label: 'Task/Event ID',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({
                    id: 'custpage_item_id',
                    label: 'Service Item ID',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({
                    id: 'custpage_time_type_id',
                    label: 'Time Type ID',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({
                    id: 'custpage_labor_code_id',
                    label: 'Labor Code ID',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({
                    id: 'custpage_shift_id',
                    label: 'Shift ID',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({
                    id: 'custpage_approval_status',
                    label: 'Approval Status',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({
                    id: 'custpage_type',
                    label: 'Type',
                    type: serverWidget.FieldType.TEXT
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});

                //Populate sublist fields
                for (var i = 0; i < timeSheetDataObj.length; i++) {
                    var line = timeSheetDataObj[i];

                    var projectTextValue = line.projectText || ' ';
                    sublist.setSublistValue({id: 'custpage_project', line: i, value: projectTextValue});

                    var projectIdValue = line.projectId || ' ';
                    sublist.setSublistValue({id: 'custpage_project_id', line: i, value: projectIdValue});

                    var costCodeTextValue = line.costCodeText || ' ';
                    sublist.setSublistValue({id: 'custpage_cost_code', line: i, value: costCodeTextValue});

                    var costCodeIdValue = line.costCodeId || ' ';
                    sublist.setSublistValue({id: 'custpage_cost_code_id', line: i, value: costCodeIdValue});

                    var taskTextValue = line.taskText || ' ';
                    sublist.setSublistValue({id: 'custpage_task', line: i, value: taskTextValue});

                    var taskIdValue = line.taskId || ' ';
                    sublist.setSublistValue({id: 'custpage_task_id', line: i, value: taskIdValue});

                    var itemTextValue = line.itemText || ' ';
                    sublist.setSublistValue({id: 'custpage_item', line: i, value: itemTextValue});

                    var itemIdValue = line.itemId || ' ';
                    sublist.setSublistValue({id: 'custpage_item_id', line: i, value: itemIdValue});

                    var laborCodeTextValue = line.laborCodeText || ' ';
                    sublist.setSublistValue({id: 'custpage_labor_code', line: i, value: laborCodeTextValue});

                    var laborCodeIdValue = line.laborCodeId || ' ';
                    sublist.setSublistValue({id: 'custpage_labor_code_id', line: i, value: laborCodeIdValue});

                    var timeTypeTextValue = line.timeTypeText || ' ';
                    sublist.setSublistValue({id: 'custpage_time_type', line: i, value: timeTypeTextValue});

                    var timeTypeIdValue = line.timeTypeId || ' ';
                    sublist.setSublistValue({id: 'custpage_time_type_id', line: i, value: timeTypeIdValue});

                    var shiftTextValue = line.shiftText || ' ';
                    sublist.setSublistValue({id: 'custpage_shift', line: i, value: shiftTextValue});

                    var shiftIdValue = line.shiftId || ' ';
                    sublist.setSublistValue({id: 'custpage_shift_id', line: i, value: shiftIdValue});

                    var isBillableValue = line.isBillable || 'F';
                    sublist.setSublistValue({id: 'custpage_billable', line: i, value: isBillableValue});

                    var isNonBillableValue = (line.isNonBillable === true || line.isNonBillable === 'T') ? 'T' : 'F';
                    sublist.setSublistValue({id: 'custpage_nonbillable', line: i, value: isNonBillableValue});

                    var isNonBillableTmValue = (line.isNonBillableForTm === true || line.isNonBillableForTm === 'T') ? 'T' : 'F';
                    sublist.setSublistValue({id: 'custpage_nonbillable_tm', line: i, value: isNonBillableTmValue});

                    var approvalStatusValue = line.approvalStatus || ' ';
                    sublist.setSublistValue({id: 'custpage_approval_status', line: i, value: approvalStatusValue});

                    var typeValue = line.type || ' ';
                    sublist.setSublistValue({id: 'custpage_type', line: i, value: typeValue});

                    for (var d = 0; d < 7; d++) {
                        var hoursField = 'hours' + d;
                        var memoField = 'memo' + d;

                        var hoursValue = line[hoursField] || ' ';
                        var memoValue = line[memoField] || ' ';

                        sublist.setSublistValue({id: 'custpage_hours' + d, line: i, value: hoursValue});
                        sublist.setSublistValue({id: 'custpage_memo' + d, line: i, value: memoValue});
                    }
                }

                form.addSubmitButton({
                    label: 'Submit'
                });

                var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
                log.debug('Remaining Usage', remainingUsage);
                context.response.writePage(form)

            } catch (e) {
                log.debug("Error in GET request for Copy Timesheet", e.message);
                context.response.write({output: "Error: " + e.message});
            }

        } 
         else if (context.request.method === 'POST') {
    try {
        log.debug('--- START POST ---', '--- START POST ---');

        var request = context.request;
        var employeeId = request.parameters.custpage_employee;
        var weekOf = request.parameters.custpage_date;

        function hasValue(value) {
            return value !== null && value !== undefined && value !== '' && value !== ' ';
        }

        function toBool(value) {
            return value === true || value === 'T' || value === 'true';
        }

        function firstSelectValue(value) {
            return value && Array.isArray(value) && value.length > 0 ? value[0].value : null;
        }

        function getLineValue(name, line) {
            return request.getSublistValue({
                group: 'custpage_timesheet_sublist',
                name: name,
                line: line
            });
        }

        function setValueIfPresent(rec, fieldId, value) {
            if (hasValue(value) || value === false || value === 0) {
                rec.setValue({
                    fieldId: fieldId,
                    value: value
                });
            }
        }

        function addDays(baseDate, days) {
            var date = new Date(baseDate.getTime());
            date.setDate(date.getDate() + days);
            return date;
        }

        var weekStartDate = format.parse({
            value: weekOf,
            type: format.Type.DATE
        });

        var employeeSearch = search.lookupFields({
            type: search.Type.EMPLOYEE,
            id: employeeId,
            columns: ['custentity10', 'custentity_bc_tm_billing_class_emp']
        });

        var laborCodeId = firstSelectValue(employeeSearch.custentity10);
        var billingClass = firstSelectValue(employeeSearch.custentity_bc_tm_billing_class_emp);

        var lineCount = request.getLineCount({
            group: 'custpage_timesheet_sublist'
        });

        log.debug('lineCount', lineCount);

        if (lineCount <= 0) {
            context.response.write('ERROR: No lines selected!');
            return;
        }

        var createdTimeEntryIds = [];

        for (var i = 0; i < lineCount; i++) {
            var projectId = getLineValue('custpage_project_id', i);
            var costCodeId = getLineValue('custpage_cost_code_id', i);
            var taskId = getLineValue('custpage_task_id', i);
            var serviceItemId = getLineValue('custpage_item_id', i);
            var isBillable = getLineValue('custpage_billable', i);
            var isNonBillable = getLineValue('custpage_nonbillable', i);
            var isNonBillableTm = getLineValue('custpage_nonbillable_tm', i);
            var timeType = getLineValue('custpage_time_type_id', i);
            var shiftId = getLineValue('custpage_shift_id', i);
            var approvalStatus = getLineValue('custpage_approval_status', i);
            var type = getLineValue('custpage_type', i);

            if (!hasValue(serviceItemId)) {
                log.debug('Skipping line without service item', i);
                continue;
            }

            for (var d = 0; d <= 6; d++) {
                var hours = getLineValue('custpage_hours' + d, i);
                var memo = getLineValue('custpage_memo' + d, i);
                var hoursNum = parseFloat(hours);

                if (isNaN(hoursNum) || hoursNum <= 0) {
                    continue;
                }

                var timeEntry = record.create({
                    type: record.Type.TIME_BILL,
                    isDynamic: false
                });

                setValueIfPresent(timeEntry, 'employee', employeeId);
                setValueIfPresent(timeEntry, 'trandate', addDays(weekStartDate, d));

                // If your NetSuite customer field is different from cseg_bc_project,
                // replace this customer value with the actual customer/project internal ID.
                setValueIfPresent(timeEntry, 'customer', projectId);

                setValueIfPresent(timeEntry, 'item', serviceItemId);
                setValueIfPresent(timeEntry, 'hours', hoursNum);
                setValueIfPresent(timeEntry, 'memo', hasValue(memo) ? memo : '-');

                setValueIfPresent(timeEntry, 'cseg_bc_project', projectId);
                setValueIfPresent(timeEntry, 'cseg_bc_cost_code', costCodeId);
                setValueIfPresent(timeEntry, 'casetaskevent', taskId);
                setValueIfPresent(timeEntry, 'isbillable', toBool(isBillable));
                setValueIfPresent(timeEntry, 'custcol_bc_billable_delete', toBool(isNonBillable));
                setValueIfPresent(timeEntry, 'custcol_bc_tm_line_non_billable', toBool(isNonBillableTm));
                setValueIfPresent(timeEntry, 'custcol_bc_time_type', timeType);
                setValueIfPresent(timeEntry, 'custcol1', laborCodeId);
                setValueIfPresent(timeEntry, 'billingclass', billingClass);
                setValueIfPresent(timeEntry, 'custcol_bc_tm_billing_shift', shiftId);
                setValueIfPresent(timeEntry, 'approvalstatus', approvalStatus);
                setValueIfPresent(timeEntry, 'timetype', type);

                var timeEntryId = timeEntry.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: false
                });

                createdTimeEntryIds.push(timeEntryId);
                log.debug('Time Entry Created', timeEntryId);
            }
        }

        if (createdTimeEntryIds.length === 0) {
            context.response.write('ERROR: No valid time entries found!');
            return;
        }

        var form = serverWidget.createForm({
            title: 'Time Entries Created Successfully'
        });

        form.addField({
            id: 'custpage_created_message',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
        }).defaultValue = '<div>Created ' + createdTimeEntryIds.length + ' time entries.</div>';

        form.addButton({
            id: 'custpage_back',
            label: 'Back',
            functionName: 'history.back()'
        });

        log.debug('Created Time Entry IDs', createdTimeEntryIds.join(', '));
        log.debug('Remaining Usage', runtime.getCurrentScript().getRemainingUsage());

        context.response.writePage(form);

    } catch (e) {
        log.debug('Error in POST request for Copy Time Entries', e.message);
        context.response.write({ output: 'Error: ' + e.message });
    }
}
    }

    return {onRequest: onRequest};
});
