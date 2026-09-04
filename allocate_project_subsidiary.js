/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {

    function beforeSubmit(context) {
        try {
            const SUBLIST_MAP = {
                journalentry: ['line'],
                check: ['expense', 'item'],
                expensereport: ['expense'],
                timesheet: ['timeitem'],
                invoice: ['item'],
                itemfulfillment: ['item'],
                itemreceipt: ['item'],
                purchaseorder: ['item'],
                vendorbill: ['item', 'expense'],
                vendorcredit: ['expense', 'item'],
                vendorreturnauthorization: ['item', 'expense']
            };

            const newRec = context.newRecord;
            const recType = newRec.type.toLowerCase();
            const sublists = SUBLIST_MAP[recType];

            if (recType == "timebill") {
              const laborCodeId = newRec.getValue('custcol1');
              const projectId = newRec.getValue('cseg_bc_project');

              log.debug('laborCodeId', laborCodeId);
              log.debug('projectId', projectId);
              
              if (laborCodeId) {
                const fieldLookUp = search.lookupFields({
                  type:'customrecord744',
                  id: laborCodeId,
                  columns: ['custrecord10']   
                });

                const labourbillingclass = fieldLookUp.custrecord10[0].value;

                if (labourbillingclass) {
                  newRec.setValue({ fieldId: 'custcol_bc_tm_labor_billing_class', value: labourbillingclass });
                  log.debug('updating labor billing class on time', labourbillingclass);
                }
              }

              if (projectId) {
                log.debug('Selected Project ID', projectId);

                var projectRec = record.load({
                    type: 'customrecord_cseg_bc_project',
                    id: projectId,
                    isDynamic: false
                });

                var subsidiary = projectRec.getValue({
                    fieldId: 'custrecord_bc_proj_subsidiary'
                });

                if (subsidiary) {
                    newRec.setValue({
                        fieldId: 'custcol_bc_tran_subsidary',
                        value: subsidiary
                    });

                    log.debug('Subsidiary Set on time rec', subsidiary);
                }
              } 
            }

            if (!sublists || sublists.length === 0) {
                log.debug('No sublist mapping found', `Record type: ${recType}`);
                return;
            }

            const projectIds = new Set();

            // STEP 1: Collect all unique project IDs from all sublists
            sublists.forEach(function (sublistId) {
                const lineCount = newRec.getLineCount({ sublistId });

                for (let i = 0; i < lineCount; i++) {
                    let pid = newRec.getSublistValue({
                        sublistId,
                        fieldId: 'cseg_bc_project',
                        line: i
                    });
                    if (pid) projectIds.add(pid);
                }
            });

            log.debug("Unique Project Count", projectIds.size);

            // If no projects found, exit
            if (projectIds.size === 0) return;

            // STEP 2: Make ONE search to fetch all project subsidiaries
            const projectLookup = {};
            search.create({
                type: 'customrecord_cseg_bc_project',
                filters: [
                    ['internalid', 'anyof', Array.from(projectIds)]
                ],
                columns: ['internalid', 'custrecord_bc_proj_subsidiary']
            }).run().each(result => {
                const pid = result.getValue('internalid');
                const sub = result.getValue('custrecord_bc_proj_subsidiary');
                projectLookup[pid] = sub || '';
                return true;
            });

            log.debug("Project Lookup Map", projectLookup);

            // STEP 3: Update sublist lines using lookup map
            sublists.forEach(function (sublistId) {
                const lineCount = newRec.getLineCount({ sublistId });

                for (let i = 0; i < lineCount; i++) {
                    const pid = newRec.getSublistValue({
                        sublistId,
                        fieldId: 'cseg_bc_project',
                        line: i
                    });
                    if (!pid) continue;

                    const subsidiary = projectLookup[pid];
                    if (!subsidiary) continue;

                    newRec.setSublistValue({
                        sublistId,
                        fieldId: 'custcol_bc_tran_subsidary',
                        line: i,
                        value: subsidiary
                    });
                }
            });

            // sublists.forEach(function(sublistId) {
            //     const lineCount = newRec.getLineCount({ sublistId: sublistId });

            //     if (!lineCount || lineCount <= 0) {
            //         log.debug('No lines to process', `Sublist: ${sublistId}`);
            //         return;
            //     }

            //     log.debug('Processing Sublist', `${sublistId} with ${lineCount} lines`);

            //     for (let i = 0; i < lineCount; i++) {
            //         const projectId = newRec.getSublistValue({
            //             sublistId: sublistId,
            //             fieldId: 'cseg_bc_project',
            //             line: i
            //         });

            //         if (!projectId) continue;

            //         const projectRec = record.load({
            //             type: 'customrecord_cseg_bc_project',
            //             id: projectId,
            //             isDynamic: false
            //         });

            //         const subsidiary = projectRec.getValue({
            //             fieldId: 'custrecord_bc_proj_subsidiary'
            //         });

            //         if (subsidiary) {
            //             newRec.setSublistValue({
            //                 sublistId: sublistId,
            //                 fieldId: 'custcol_bc_tran_subsidary',
            //                 line: i,
            //                 value: subsidiary
            //             });
            //             log.debug(`Line ${i + 1} in ${sublistId}`, `Subsidiary set: ${subsidiary}`);
            //         }
            //     }
            // });

            log.debug('Completed', 'All project subsidiaries updated.');
        } catch (e) {
            log.error('Error in beforeSubmit', e);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
