/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/search', 'N/log', 'N/record'], function (search, log, record) {

  function afterSubmit(context) {
    try {
      const isDelete = context.type === context.UserEventType.DELETE;
      const isCreate = context.type === context.UserEventType.CREATE;
      const isEdit = context.type === context.UserEventType.EDIT;

      const rec = isDelete ? context.oldRecord : context.newRecord;
      const timeId = rec.id;
      const timeType = rec.type;

      const existingJE = rec.getValue('custcol_bc_interco_labor');
      log.debug('existingJE',existingJE)
      if (isDelete) {
        if (existingJE) {
          try {
            record.delete({ type: 'advintercompanyjournalentry', id: existingJE });
            log.audit('Deleted related Intercompany JE due to Time record deletion', existingJE);
          } catch (e) {
            log.error('Failed to delete JE on time record delete', e);
          }
        }
        return;
      }

      if (isEdit && existingJE) {
        const oldRec = context.oldRecord;

        const fieldsToCheck = [
          { field: 'subsidiary', oldVal: oldRec.getValue('subsidiary'), newVal: rec.getValue('subsidiary') },
          { field: 'employee', oldVal: oldRec.getValue('employee'), newVal: rec.getValue('employee') },
          { field: 'cseg_bc_project', oldVal: oldRec.getValue('cseg_bc_project'), newVal: rec.getValue('cseg_bc_project') },
          { field: 'custcol_bc_time_type', oldVal: oldRec.getValue('custcol_bc_time_type'), newVal: rec.getValue('custcol_bc_time_type') },
          { field: 'custcol_bc_tm_billing_shift', oldVal: oldRec.getValue('custcol_bc_tm_billing_shift'), newVal: rec.getValue('custcol_bc_tm_billing_shift') },
          { field: 'custcol_bc_tm_labor_billing_class', oldVal: oldRec.getValue('custcol_bc_tm_labor_billing_class'), newVal: rec.getValue('custcol_bc_tm_labor_billing_class') },
          { field: 'custcol_bc_tran_subsidary', oldVal: oldRec.getValue('custcol_bc_tran_subsidary'), newVal: rec.getValue('custcol_bc_tran_subsidary') },
          { field: 'cseg_bc_cost_code', oldVal: oldRec.getValue('cseg_bc_cost_code'), newVal: rec.getValue('cseg_bc_cost_code') },
          { field: 'hours', oldVal: parseFloat(oldRec.getValue('hours') || 0), newVal: parseFloat(rec.getValue('hours') || 0) }
        ];
        const override = rec.getValue('custcol_override');
        const hasChanged = fieldsToCheck.some(field => field.oldVal !== field.newVal);

        log.debug('hasChanged', hasChanged);
        log.debug('override', override);
        
        if (!hasChanged && !override) {
          log.audit('No relevant field changes detected. Skipping JE update.', { timeId });
          return;
        }
      }

      const approvalStatus = rec.getValue('approvalstatus');
      const isApproved = approvalStatus === '3';

      if (!isApproved) {
        log.debug('Time entry not approved. Skipping Interco JE creation.', timeId);
        return;
      }

      const recordSubsidiary = rec.getValue('subsidiary');
      const headerProject = rec.getValue('cseg_bc_project');
      const headerEmployee = rec.getValue('employee');

      var item
      try {
        item = rec.getText('custcol_bc_time_type') || 'ST';
      } catch (error) {
        item = rec.getValue('custcol_bc_time_type') || 'ST';
      }
      
      var trandate = rec.getValue('trandate');
      const shift = rec.getValue('custcol_bc_tm_billing_shift');
      let billingClassLine = rec.getValue('custcol_bc_tm_labor_billing_class');
      const custcolSub = rec.getValue('custcol_bc_tran_subsidary');
      const hours = parseFloat(rec.getValue('hours')) || 0;
      const costCode = rec.getValue('cseg_bc_cost_code');

      if (!custcolSub || custcolSub === recordSubsidiary) {
        log.debug('No interco processing needed', { custcolSub, recordSubsidiary });
        // custcolSub = 10;
        return;
      }

      if (!billingClassLine) {
        const empLookup = search.lookupFields({
          type: 'employee',
          id: headerEmployee,
          columns: ['custentity_bc_tm_billing_class_emp']
        });
        billingClassLine = empLookup.custentity_bc_tm_billing_class_emp?.[0]?.value || null;
      }

      const customerID = search.lookupFields({
        type: 'customrecord_cseg_bc_project',
        id: headerProject,
        columns: ['custrecord_bc_proj_customer']
      }).custrecord_bc_proj_customer?.[0]?.value || null;

      const customerSubsidiary = customerID ? search.lookupFields({
        type: 'customer',
        id: customerID,
        columns: ['subsidiary']
      }).subsidiary?.[0]?.value || null : null;

      var customrecord_bc_interco_markupSearchObj = search.create({
          type: "customrecord_bc_interco_markup",
          filters:
          [
            ["custrecord_intercompany_temp_subsidary","anyof",custcolSub], 
            "AND", 
            ["custrecord_bc_interco_effective_date","onorbefore",convertISOToMMDDYYYY(trandate)],
             "AND", 
            ["isinactive","is","F"]
          ],
          columns:
          [
            search.createColumn({name: "internalid", label: "Internal ID"}),
            search.createColumn({name: "custrecord_bc_interco_effective_date", label: "Effective Date"})
          ]
      });
      
      let intercompanyLaborRuleTemplateId;
      customrecord_bc_interco_markupSearchObj.run().each(function(result){
          // .run().each has a limit of 4,000 results
          log.debug('result for finding template', result);
          intercompanyLaborRuleTemplateId = result.id;
          return true;
      });

      log.debug('intercompanyLaborRuleTemplateId', intercompanyLaborRuleTemplateId);

      var allRules = [];
      if (intercompanyLaborRuleTemplateId) {
         const ruleSearch = search.create({
           type: 'customrecord_bc_interco_labor',
           filters: [
             ["custrecord_bc_interco_labor","anyof",intercompanyLaborRuleTemplateId]
           ],
           columns: [
            'custrecord_bc_interco_labor_rate',
            'custrecord_bc_interco_labor_debit',
            'custrecord_bc_interco_labor_credit',
            'custrecord_bc_interco_labor_employee', 
            'custrecord_bc_interco_labor_project',  
            'custrecord_bc_interco_labor_customer',
            'custrecord_bc_interco_labor_time_type',
            'custrecord_bc_interco_labor_class'
          ]
        }); 
         allRules = ruleSearch.run().getRange({ start: 0, end: 1000 }) || [];
      } else {
         log.debug('No template found');
      }

      //If no rule found and JE exists, delete it and clear field
      if (allRules.length === 0) {
        log.debug('No matching rule found for interco labor after changes', {
          timeId,
          item,
          shift,
          billingClassLine,
          headerEmployee,
          headerProject,
          customerID,
          hours,
          costCode
        });

        if (existingJE) {
          try {
            record.delete({ type: 'advintercompanyjournalentry', id: existingJE });
            log.audit('Deleted outdated Interco JE due to missing rule on edit', existingJE);

            record.submitFields({
              type: timeType,
              id: timeId,
              values: { custcol_bc_interco_labor: '' },
              options: { enablesourcing: false, ignoreMandatoryFields: true }
            });
          } catch (e) {
            log.error('Failed to delete outdated JE when rule not found on edit', e);
          }
        }

        return;
      }

      const result = pickBestRule(allRules, headerEmployee, headerProject, customerID, item, billingClassLine);

      let rateOfBestPickRule = 0;

      if (result) {
        rateOfBestPickRule = Number(result.getValue('custrecord_bc_interco_labor_rate'));
      }

      log.debug('rateOfBestPickRule', rateOfBestPickRule);

      if (rateOfBestPickRule === 0) {
        log.debug('Delete JE due to 0 rate', existingJE);
        if (existingJE) {
          record.delete({ type: 'advintercompanyjournalentry', id: existingJE });
        }

        record.submitFields({
          type: timeType,
          id: timeId,
          values: { custcol_bc_interco_labor: '' },
          options: { enablesourcing: false, ignoreMandatoryFields: true }
        });

        return;
      }

      const res = result;
      log.audit('Updating res JE', res);

      const rate = parseFloat(res.getValue('custrecord_bc_interco_labor_rate')) || 0;
      const debitAcct = res.getValue('custrecord_bc_interco_labor_debit');
      const creditAcct = res.getValue('custrecord_bc_interco_labor_credit');
      const amount = rate * hours;

      const INTERCO_PAYABLE_ACCOUNT = 1094;
      const INTERCO_RECEIVABLE_ACCOUNT = 1095;

      const intercoCustomer = getIntercoEntity(custcolSub, 'customer');
      const intercoVendor = getIntercoEntity(recordSubsidiary, 'vendor');

      if (!amount || !debitAcct || !creditAcct || !intercoCustomer || !intercoVendor) {
        log.error('Missing data for JE creation', { amount, debitAcct, creditAcct, intercoCustomer, intercoVendor });
        return;
      }

      let jeRec;

      if (existingJE) {
        log.audit('Updating existing JE', existingJE);
        jeRec = record.load({ type: 'advintercompanyjournalentry', id: existingJE, isDynamic: true });
        jeRec.setValue({ fieldId: 'trandate', value: new Date(trandate) });

        const lineCount = jeRec.getLineCount({ sublistId: 'line' });
        for (let i = lineCount - 1; i >= 0; i--) {
          jeRec.removeLine({ sublistId: 'line', line: i });
        }
      } else {
        jeRec = record.create({ type: 'advintercompanyjournalentry', isDynamic: true });
        jeRec.setValue({ fieldId: 'subsidiary', value: recordSubsidiary });
        // jeRec.setValue({ fieldId: 'trandate', value: new Date() });
        jeRec.setValue({ fieldId: 'trandate', value: new Date(trandate) });
        jeRec.setValue({ fieldId: 'memo', value: 'Auto Interco from Time Tracking ' + timeId });
      }

      jeRec.setValue("custbody11",timeId);
      jeRec.setValue({ fieldId: 'custbody_intercompany_labor_rule', value: res.id });
      jeRec.setValue({ fieldId: 'approvalstatus', value: isApproved ? 2 : 1 });

      addLine(jeRec, recordSubsidiary, INTERCO_RECEIVABLE_ACCOUNT, amount, 'debit', intercoCustomer, headerProject, costCode, 'Labor Debit',custcolSub);
      addLine(jeRec, recordSubsidiary, creditAcct, amount, 'credit', null, headerProject, costCode, 'Credit',null);
      addLine(jeRec, custcolSub, INTERCO_PAYABLE_ACCOUNT, amount, 'credit', intercoVendor, headerProject, costCode, 'Payable',recordSubsidiary);
      addLine(jeRec, custcolSub, debitAcct, amount, 'debit', null, headerProject, costCode, 'Labor Cost',null);

      const jeId = jeRec.save();
      log.audit('Saved Interco JE', jeId);

      if (!existingJE) {
        record.submitFields({
          type: timeType,
          id: timeId,
          values: { custcol_bc_interco_labor: jeId },
          options: { enablesourcing: false, ignoreMandatoryFields: true }
        });
      }

    } catch (e) {
      log.error('Error in afterSubmit - Interco JE Sync', e);
    }
  }

  function pickBestRule(rules, headerEmployee, headerProject, customerID, item, classbill) {
    if (!rules || rules.length === 0) return null;

    log.debug('item', item);
    log.debug('classbill', classbill);

    const filteredRules = rules.filter(rule => {
      var ruleType = rule.getValue('custrecord_bc_interco_labor_time_type');
      var ruleClass = rule.getValue('custrecord_bc_interco_labor_class');
      if(!ruleClass){
        ruleClass = classbill;
      }

      if (ruleType == 1) ruleType = 'ST';
      if (ruleType == 2) ruleType = 'OT';
      if (ruleType == 3) ruleType = 'DT';

      // log.debug('rule type', ruleType);
      
      return ruleType === item && ruleClass === classbill;
    });

    log.debug('filteredRules', filteredRules);

    if (filteredRules.length === 0) filteredRules = rules;
  
    const categories = [[], [], [], [], []];
  
    filteredRules.forEach(rule => {
      const ruleEmpArr  = rule.getValue('custrecord_bc_interco_labor_employee') || '';
      const ruleProjArr = rule.getValue('custrecord_bc_interco_labor_project') || '';
      const ruleCustArr = rule.getValue('custrecord_bc_interco_labor_customer') || '';

      const empId = ruleEmpArr && ruleEmpArr !== '' ? ruleEmpArr : null;
      const projId = ruleProjArr && ruleProjArr !== '' ? ruleProjArr : null;
      const custId = ruleCustArr && ruleCustArr !== '' ? ruleCustArr : null;

      const projMatch = projId === headerProject;
      const empMatch = empId === headerEmployee;
      const empGeneric = !empId;

      const projGeneric = !projId;

      if (projMatch && empMatch) categories[0].push(rule);
      else if (projMatch && empGeneric) categories[1].push(rule);
      else if (projGeneric && empMatch) categories[2].push(rule);
      else if (projGeneric && empGeneric) {
          if (projMatch) {
              categories[1].push(rule);
          } else {
              categories[3].push(rule);
          }

          if (empMatch) {
              categories[2].push(rule);
          } else {
              categories[3].push(rule);
          }
      }
    });

    log.debug('categories', categories);

    // Pick the first non-empty category, sorted by rule order
    for (let cat of categories) {
      if (cat.length > 0) {
          cat.sort((a,b) => {
              const aOrder = parseInt(a.getValue('custrecord_bc_interco_labor_rule_order') || 9999);
              const bOrder = parseInt(b.getValue('custrecord_bc_interco_labor_rule_order') || 9999);

              log.debug('Order A: ' + aOrder + ' Order B: ' + bOrder)
              return aOrder - bOrder;
          });
          return cat[0];
      }
    }

    return undefined;
  }
      
   
  function addLine(jeRec, subsidiary, account, amount, type, entity, project, costCode, memo,dueSub) {
    jeRec.selectNewLine({ sublistId: 'line' });
    jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'linesubsidiary', value: subsidiary });
    jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: account });
    if (type === 'debit') {
      jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: amount });
    } else {
      jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: amount });
    }
    
    
    if (project && (account != 693 && type === 'debit')) jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'cseg_bc_project', value: project });
    if (costCode && (account != 693  && type === 'debit')) jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'cseg_bc_cost_code', value: costCode });
    if (project && (account != 1094 && type === 'credit')) jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'cseg_bc_project', value: project });
    if (costCode && (account != 1094  && type === 'credit')) jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'cseg_bc_cost_code', value: costCode });
    if (memo) jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'memo', value: memo });
    if (entity)jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'entity', value: entity });
    if(!dueSub){
     jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'eliminate', value: false });
    }
    jeRec.commitLine({ sublistId: 'line' });
  }

  function getIntercoEntity(subsidiaryId, type) {
    try {
      const entitySearch = search.create({
        type: type,
        filters: [
          ['isinactive', 'is', 'F'],
          'AND',
          ['representingsubsidiary', 'anyof', subsidiaryId]
        ],
        columns: ['internalid']
      });
      const result = entitySearch.run().getRange({ start: 0, end: 1 });
      return result.length ? parseInt(result[0].getValue('internalid'), 10) : null;
    } catch (e) {
      log.error('Failed to get intercompany entity', { type, subsidiaryId, error: e });
      return null;
    }
  }

  function convertISOToMMDDYYYY(isoString) {
  if (!isoString) return '';
    
  var date = new Date(isoString);
  var month = ('0' + (date.getMonth() + 1)).slice(-2); // Months are 0-based
  var day = ('0' + date.getDate()).slice(-2);
  var year = date.getFullYear();

  return month + '/' + day + '/' + year;
}

  return { afterSubmit };
});
