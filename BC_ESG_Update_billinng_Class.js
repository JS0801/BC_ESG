/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function afterSubmit(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        var timesheetId = context.newRecord.id;
        log.debug("Timesheet ID", timesheetId);

        if (!timesheetId) return;

        try {
            var timebillSearch = search.create({
                type: "timebill",
                filters: [
                    ["timesheet", "anyof", timesheetId],
                    "AND",
                    [[["billingclass","noneof","@NONE@"],"AND",["custcol_bc_tm_labor_billing_class","anyof","@NONE@"]],"OR",["item","anyof","7","12"],"AND",["custcol_bc_time_type","anyof","@NONE@"]]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "custrecord10", join: "CUSTCOL1", label: "Billing Class" }),
                    search.createColumn({ name: "item", label: "item" })
                ]
            });

            var searchResults = timebillSearch.run().getRange({ start: 0, end: 1000 });
            log.debug("Search Result Count", searchResults.length);

            searchResults.forEach(function(result) {
                var timebillId = result.getValue({ name: "internalid" });
                var billingClass = result.getValue({ name: "custrecord10", join: "CUSTCOL1" });
                var item = result.getValue({name: 'item'})

                var timeType = '';
                 if (item == 7) timeType = 2
                 if (item == 12) timeType = 1

                if (timebillId && billingClass) {
                    record.submitFields({
                        type: "timebill",
                        id: timebillId,
                        values: {
                            "custcol_bc_tm_labor_billing_class": billingClass,
                            "custcol_bc_time_type": timeType
                        }
                    });
                    log.debug("Updated TimeBill", "ID: " + timebillId + " | Billing Class: " + billingClass);
                }
            });

        } catch (error) {
            log.error("Error Updating TimeBills", error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
