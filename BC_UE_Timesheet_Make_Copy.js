/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(["N/record", "N/ui/serverWidget", "N/url"], (record, serverWidget, url) => {

    function beforeLoad(context) {
        if (context.type === context.UserEventType.VIEW) {
            try {
                let form = context.form;
                let recId = context.newRecord.id;

                let suiteletUrl = url.resolveScript({
                    scriptId: "customscript_bc_sl_timesheet_copy",
                    deploymentId: "customdeploy_bc_sl_timesheet_copy",
                    params: {timesheetId: recId}
                });

                form.addButton({
                    id: "custpage_make_copy",
                    label: "Make Copy",
                    functionName: `window.open('${suiteletUrl}')`
                });
            } catch (e) {
                log.debug('error', e)
            }
        }
    }

    return {beforeLoad};
});
