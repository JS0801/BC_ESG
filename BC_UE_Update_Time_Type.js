/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {

    function beforeSubmit(context) {
        try {
            var rec = context.newRecord;

            var itemId = rec.getValue('item');
            if (!itemId) {
                log.debug('No item selected yet');
                return;
            }

            var itemRec = record.load({
                type: 'serviceitem',
                id: itemId,
                isDynamic: false
            });

            var timeTypeValue = itemRec.getValue('custitem_bc_time_type_item');
            log.debug('Item Time Type Value', timeTypeValue);

            if (timeTypeValue) {
                rec.setValue({
                    fieldId: 'custcol_bc_time_type',
                    value: timeTypeValue
                });
            }else{
                    rec.setValue({
                            fieldId: 'custcol_bc_time_type',
                            value: ''
                    });
            }

        } catch (e) {
            log.error('User Event Error', e.message);
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
