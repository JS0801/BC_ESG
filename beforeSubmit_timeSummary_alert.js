/**
* @NApiVersion 2.x
* @NScriptType UserEventScript
*/
define(['N/record', 'N/ui/dialog', 'N/ui/serverWidget'], function(record, dialog, serverWidget) {
  
  function afterSubmit(context) {
    var newRecord = context.newRecord; // Get the current record
    var serviceItemHours = {}; // Initialize an object to store the total hours per service item
    var recID = newRecord.id;

    try {

    var rec = record.load({type:'timesheet',id:recID,isDynamic:true})
    
    var lineCount = rec.getLineCount({ sublistId: 'timeitem' }); // Get the number of lines in the 'timeitem' sublist
    
    // Loop through each line in the sublist
    for (var i = 0; i < lineCount; i++) {
      // Get the Service Item for the current line
      var serviceItem = rec.getSublistText({
        sublistId: 'timeitem',
        fieldId: 'item', // Service Item field
        line: i
      });
      
      // Get the Hours for the current line
      var hours = rec.getSublistValue({
        sublistId: 'timeitem',
        fieldId: 'hourstotal', // Hours field
        line: i
      });
      
      // Sum the hours for each service item
      if (serviceItemHours[serviceItem]) {
        serviceItemHours[serviceItem] += hours;
      } else {
        serviceItemHours[serviceItem] = hours;
      }
    }
    
    // Build the summary text
    var summaryText = 'Summary of Hours by Service Item:\n';
    for (var item in serviceItemHours) {
      summaryText += 'Service Item: ' + item + ' | Total Hours: ' + serviceItemHours[item] + ' hours\n';
    }
    
    // Set the value to a custom field (if required for storage)
    rec.setValue({
      fieldId: 'custrecord_bc_timesheet_summary', // Custom field to store summary
      value: summaryText
    });
    log.debug('summaryText',summaryText)

    rec.save();    
      
      
    } catch (error) {
      log.error('error', error)
    }
  }
  
  return {
    afterSubmit: afterSubmit
  };
});
