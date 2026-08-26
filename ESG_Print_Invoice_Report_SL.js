/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

define(['N/render', 'N/record', 'N/xml', 'N/file', 'N/task', 'N/search', 'N/runtime', 'N/url', 'N/config', 'N/format'], function(render, record, xml, file, task, search, runtime, url, config, format) {

  function onRequest(context) {

    var response = context.response;

    if (context.request.method == 'GET'){

      var recId = context.request.parameters.recID;
      var projectId = context.request.parameters.projID
      log.debug('recId', recId)

      if (!recId || !projectId) return;

      var loadedRecord = record.load({
        type: 'invoice',
        id: recId
      });

      var loadedProj = record.load({
        type: 'customrecord_cseg_bc_project',
        id: projectId
      });

      var contractAmt = loadedRecord.getValue({fieldId: 'custbody_bc_contract_value'}) || loadedProj.getValue({fieldId: 'custrecord_bc_not_to_exceed'})

      var resultArray = [];
      var contractId = '';
      var subaddress = '';

      var invoiceSearchObj = search.create({
        type: "invoice",
        filters:
        [
          ["type","anyof","CustInvc"],
          "AND",
          ["item","noneof","@NONE@"],
          "AND",
          ["internalid","anyof",recId],
          "AND",
          ["mainline","is","F"],
          "AND",
          ["taxline","is","F"],
          "AND",
          [["custcol_bc_tm_source_transaction.mainline","is","T"],"OR",["custcol_bc_tm_source_transaction","anyof","@NONE@"]]
        ],
        columns:
        [
          search.createColumn({name: "lineuniquekey",summary: "GROUP",  label: "Line Unique Key"}),
          search.createColumn({
            name: "formulatext",
            summary: "MAX",
            formula: "CASE     WHEN {custcol_bc_tm_time_bill} IS NOT NULL OR {custcol_bc_employee} IS NOT NULL  THEN 'Direct Labor'     ELSE {custcol2}   END",
            label: "Group",
            sort: search.Sort.ASC
          }),
          // search.createColumn({
          //   name: "formulatext1",
          //   summary: "MAX",
          //   formula: "CASE    WHEN {custcol_bc_tm_time_bill} IS NOT NULL         THEN {custcol_bc_tm_time_bill.custcol_bc_tm_labor_billing_class} || '---' || {custcol_bc_tm_time_bill.employee}    WHEN {custcol_bc_employee} IS NOT NULL         THEN {custcol_bc_employee.billingclass} || '---' || {custcol_bc_employee}    WHEN {custcol_bc_tm_source_transaction.type} IS NOT NULL  THEN {custcol_bc_tm_source_transaction.name} || '---' || {custcol_bc_tm_source_transaction.trandate} || '---' || CASE              WHEN {custcol_bc_tm_source_transaction.tranid} IS NOT NULL THEN                  {custcol_bc_tm_source_transaction.tranid}              ELSE                  {custcol_bc_tm_source_transaction.transactionnumber}          END    ELSE         {memo}|| '---' END",
          //   label: "First Column"
          // }),
          search.createColumn({
            name: "formulatext1",
            summary: "MAX",
            formula: "CASE    WHEN {custcol_bc_tm_time_bill} IS NOT NULL         THEN {custcol_bc_tm_time_bill.custcol_bc_tm_labor_billing_class} || '---' || {custcol_bc_tm_time_bill.employee}    WHEN {custcol_bc_employee} IS NOT NULL         THEN {custcol_bc_employee.billingclass} || '---' || {custcol_bc_employee}    ELSE         REPLACE({memo}, '\n', '<br/>')|| '---' END",
            label: "First Column"
          }),
          search.createColumn({
            name: "formulatext2",
            summary: "MAX",
            formula: "CASE      WHEN LOWER({memo}) LIKE '%markup%'      THEN 'markup'  END",
            label: "Mark Up"
          }),
          search.createColumn({name: "quantity",summary: "MAX", label: "Quantity"}),
          search.createColumn({name: "rate",summary: "MAX", label: "Item Rate"}),
          search.createColumn({name: "line.cseg_bc_project", summary: "GROUP", label: "Blue Collar Project"}),
          search.createColumn({name: "line.cseg_bc_cost_code", summary: "GROUP", label: "Cost Code"}),
          search.createColumn({name: "grossamount",summary: "MAX", label: "Amount"}),
          search.createColumn({
             name: "formulatextJS",
             summary: "MAX",
             formula: "CASE     WHEN {subsidiary.address2} IS NULL THEN         {subsidiary.address1} || '<br/>' ||         {subsidiary.city} || ' ' || {subsidiary.state} || ' ' || {subsidiary.zip} || '<br/>' ||         {subsidiary.country} ||         CASE WHEN {subsidiary.phone} IS NOT NULL THEN '<br/>Phone: ' || {subsidiary.phone} END ||         CASE WHEN {subsidiary.fax} IS NOT NULL THEN '<br/>Fax: ' || {subsidiary.fax} END    ELSE         {subsidiary.address1} || '<br/>' || {subsidiary.address2} || '<br/>' ||         {subsidiary.city} || ' ' || {subsidiary.state} || ' ' || {subsidiary.zip} || '<br/>' ||         {subsidiary.country} ||         CASE WHEN {subsidiary.phone} IS NOT NULL THEN '<br/>Phone: ' || {subsidiary.phone} END ||         CASE WHEN {subsidiary.fax} IS NOT NULL THEN '<br/>Fax: ' || {subsidiary.fax} END END",
             label: "Formula (Text)"
          })
        ]
      });
      var searchResultCount = invoiceSearchObj.runPaged().count;
      log.debug("invoiceSearchObj result count",searchResultCount);
      invoiceSearchObj.run().each(function(result){
        log.debug('result', result)

        contractId = result.getValue({name: "custrecord_bc_proj_contract", join: "cseg_bc_project", summary: "MAX"}) || ''
        subaddress = result.getValue({name: "formulatextJS", summary: "MAX"})

        var groupValue = result.getValue({name: 'formulatext', summary: "MAX"}) || '';
        var memoValue = result.getValue({name: 'formulatext1', summary: "MAX"}) || '';
        var markupValue = result.getValue({name: 'formulatext2', summary: "MAX"});

        resultArray.push({
          line: result.getValue({name: 'lineuniquekey', summary: "GROUP"}),
          group: groupValue.replace(/&/g, '&amp;'),
          memo: memoValue.replace(/&/g, '&amp;'),
          descriptionKey: normalizeRollupValue(memoValue),
          markup: markupValue,
          qty: markupValue ? '' : parseFloat(result.getValue({name: 'quantity', summary: "MAX"})),
          rate: result.getValue({name: 'rate', summary: "MAX"}),
          amount: result.getValue({name: 'grossamount', summary: "MAX"}),
          project: result.getValue({name: 'line.cseg_bc_project', summary: "GROUP"}) || '',
          costcode: result.getValue({name: 'line.cseg_bc_cost_code', summary: "GROUP"}) || ''
        })

        return true;
      });

      log.debug('resultArray', resultArray)
      var finalArray = processData(resultArray);
      log.debug('finalArray', finalArray)

      var templateId = 'CUSTTMPL_202_4696675_825';

      var billtoDate = 0;
      var usedIDs = [];

      var invoiceSearchObj = search.create({
        type: "invoice",
        filters:
        [
          ["type","anyof","CustInvc"],
          "AND",
          ["cseg_bc_project","anyof",projectId],
          "AND",
          ["mainline","is","T"]
        ],
        columns:
        [
          search.createColumn({
            name: "amount",
            summary: "SUM",
            label: "Amount"
          }),
          search.createColumn({
            name: "custbody_bc_bill_to_date",
            summary: "SUM",
            label: "Bill To"
          })
        ]
      });
      var searchResultCount = invoiceSearchObj.runPaged().count;
      log.debug("invoiceSearchObj result count",searchResultCount);
      invoiceSearchObj.run().each(function(result){
        billtoDate = parseFloat(result.getValue({name:"custbody_bc_bill_to_date", summary: "SUM"})) || parseFloat(result.getValue({name:"amount", summary: "SUM"}))
        return true;
      });
      log.debug('billtoDate', billtoDate)

      var invoiceSearchObj = search.create({
        type: "invoice",
        filters:
        [
          ["type","anyof","CustInvc"],
          "AND",
          ["line.cseg_bc_project","anyof",projectId],
          "AND",
          ["cseg_bc_project","anyof","@NONE@"],
          "AND",
          ["mainline","is","F"]
        ],
        columns:
        [
          search.createColumn({
            name: "amount",
            summary: "SUM",
            label: "Amount"
          }),
          search.createColumn({
            name: "custbody_bc_bill_to_date",
            summary: "SUM",
            label: "Bill To"
          })
        ]
      });
      var searchResultCount = invoiceSearchObj.runPaged().count;
      log.debug("invoiceSearchObj result count",searchResultCount);
      invoiceSearchObj.run().each(function(result){
        var amountMax =  parseFloat(result.getValue({name:"custbody_bc_bill_to_date", summary: "SUM"})) || parseFloat(result.getValue({name:"amount", summary: "SUM"}))
        if (amountMax > 0) {
          billtoDate = parseFloat(billtoDate) + parseFloat(amountMax)
        }
        return true;
      });
      log.debug('billtoDate', billtoDate)

      // Create a renderer and set the template
      var renderer = render.create();
      renderer.setTemplateByScriptId(templateId);
      renderer.addRecord('record', loadedRecord);
      renderer.addRecord('project', record.load({type: 'customrecord_cseg_bc_project', id: projectId}));
      log.debug('billtoDate', billtoDate)

      var contractamount = contractAmt;
      if (projectId && contractamount == 0) {
        var customrecord_cseg_bc_projectSearchObj = search.create({
          type: "customrecord_cseg_bc_project",
          filters:
          [
            ["custrecord_bc_proj_contract","noneof","@NONE@"],
            "AND",
            ["custrecord_bc_proj_contract.mainline","is","T"],
            "AND",
            ["internalid","anyof",projectId]
          ],
          columns:
          [
            search.createColumn({
              name: "amount",
              join: "CUSTRECORD_BC_PROJ_CONTRACT",
              label: "Amount"
            })
          ]
        });
        var searchResultCount = customrecord_cseg_bc_projectSearchObj.runPaged().count;
        log.debug("customrecord_cseg_bc_projectSearchObj result count",searchResultCount);
        customrecord_cseg_bc_projectSearchObj.run().each(function(result){
          contractamount = result.getValue({name: "amount", join: "CUSTRECORD_BC_PROJ_CONTRACT"})
          log.debug('contractamount', contractamount)
          return true;
        });
      }

      var invoiceContractAmount = loadedRecord.getValue({fieldId: 'custbody_bc_contract_value'})
      if(invoiceContractAmount != '' && invoiceContractAmount != null){
        contractamount = invoiceContractAmount
      }
      log.debug('invoiceContractAmount', invoiceContractAmount)

      var invoiceBilledToDate = loadedRecord.getValue({fieldId: 'custbody_bc_bill_to_date'})
      if(invoiceBilledToDate != '' && invoiceBilledToDate != null){
        billtoDate = invoiceBilledToDate
      }
      log.debug('invoiceBilledToDate', invoiceBilledToDate)

      var remainingamt = parseFloat(contractamount) - parseFloat(billtoDate);
      log.debug('remainingamt', remainingamt)

      var subrec = record.load({type: 'subsidiary', id: loadedRecord.getValue("subsidiary")})
      var logo = subrec.getValue('logo')

      if (!logo) {
        var subrec = record.load({type: 'subsidiary', id: 1})
        var logo = subrec.getValue('logo')
      }

      log.debug('logo',logo)

      var xmlTemplateFile = renderer.templateContent;
      xmlTemplateFile = xmlTemplateFile.replace('${billtoDate}', formatCurrency(billtoDate));
      xmlTemplateFile = xmlTemplateFile.replace('${contractamount}', formatCurrency(contractamount));
      xmlTemplateFile = xmlTemplateFile.replace('${remainingamt}', formatCurrency(remainingamt));

      if (logo) {
        var fileUrl = file.load({id: logo}).url;
        log.debug('fileUrl', fileUrl)
        xmlTemplateFile = xmlTemplateFile.replace('${logoURL}', fileUrl.replace(/&/g, "&amp;"));
        xmlTemplateFile = xmlTemplateFile.replace('${address}', subaddress.replace(/&/g, "&amp;"));
      }
      renderer.templateContent = xmlTemplateFile;

      renderer.addCustomDataSource({
        format:render.DataSource.OBJECT,
        alias: 'results',
        data: finalArray,
        data: {results: finalArray}
      });

      var coverfile = renderer.renderAsPdf();

      // output=fileid mode: called server-side by the combine-attachments
      // Suitelet (bc_sl_compile_line_files_invc). Save the rendered PDF into
      // the folder it tells us (folderID), flip it online so the BFO <pdfset>
      // merge can fetch its URL, and respond with just the file internal id.
      if (context.request.parameters.output == 'fileid') {
        var saveFolderId = parseInt(context.request.parameters.folderID);
        if (!saveFolderId) {
          log.error('output=fileid', 'No folderID parameter passed - cannot save print PDF');
          response.write('');
          return;
        }

        coverfile.name = 'INV' + recId + '_PROJ' + projectId + ' - Invoice Print.pdf';
        coverfile.folder = saveFolderId;
        coverfile.isOnline = true;
        var savedFileId = coverfile.save();
        log.debug('output=fileid', 'Saved print PDF as file ' + savedFileId + ' in folder ' + saveFolderId);

        response.write(String(savedFileId));
        return;
      }

      response.writeFile({
        file: coverfile,
        isInline: true
      });

    }
  }

  function formatCurrency(value) {
    // Ensure the value is a number
    if(!value) value = 0;

    var number = parseFloat(value);

    // Convert number to a string with fixed two decimal places
    var currencyString = number.toFixed(2);

    // Split the number into integer and decimal parts
    var currencyParts = currencyString.split('.');
    var integerPart = currencyParts[0];
    var decimalPart = currencyParts[1];

    // Add commas to the integer part
    var withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Return formatted string with currency symbol and comma separation
    return withCommas + '.' + decimalPart;
  }

  function processData(data) {
    data = groupByProjectCostCodeDescriptionAndRate(data);
    data = groupByDirectLabor(data);
    log.debug('data', data)

    // Sort by group name, markup, and rate in descending order
    data.sort(function(a, b) {
        // First, sort by group (keeping empty groups at the end)
        var groupA = a.group || "zzz"; // Default to "zzz" for empty values
        var groupB = b.group || "zzz";
        var groupComparison = groupA.localeCompare(groupB);

        if (groupComparison != 0) {
            return groupComparison;
        }

        // If groups are the same, sort by markup
        var markupA = a.markup || "aaa"; // Default to "aaa" for empty values
        var markupB = b.markup || "aaa";
        var markupComparison = markupA.localeCompare(markupB);

        if (markupComparison != 0) {
            return markupComparison;
        }

        // If markup is also the same, sort by rate in descending order
        var rateA = parseFloat(a.rate) || 0;
        var rateB = parseFloat(b.rate) || 0;

        return rateB - rateA; // Descending order
    })

    var result = [];
    var currentGroup = null;
    var subtotal = 0;
    var markupamt = 0;
    var qty = 0;

    for (var i = 0; i < data.length; i++) {

      var item = data[i];

      if (item.group !== currentGroup && currentGroup !== null) {
        // Push subtotal after the group ends
        result.push({
          group: currentGroup,
          memo: "Final Total",
          markup: "Markup on " + currentGroup,
          markupamt: formatCurrency(markupamt.toFixed(2)),
          subtotal: formatCurrency(subtotal.toFixed(2)),
          qty: qty.toFixed(2)
        });

        subtotal = 0;
        markupamt = 0;
        qty = 0;
      }

      if (item.group !== currentGroup) {
        result.push({
          group: item.group,
          memo: "Group Name"
        });
      }

      // Update current group
      currentGroup = item.group;
      subtotal += parseFloat(item.amount);
      qty += parseFloat(item.qty) || 0;
      if (item.markup) markupamt += parseFloat(item.amount);
      item.amount = formatCurrency(item.amount);
      item.rate = formatCurrency(item.rate);
      item.qty = formatCurrency(item.qty);
      result.push(item);
    }

    // Handle the last group subtotal and markup
    if (currentGroup !== null) {
      result.push({
        group: currentGroup,
        memo: "Final Total",
        markup: "Markup on " + currentGroup,
        markupamt: formatCurrency(markupamt.toFixed(2)),
        qty: qty.toFixed(2),
        subtotal: formatCurrency(subtotal.toFixed(2))
      });
    }

    return result;
  }

  function groupByProjectCostCodeDescriptionAndRate(data) {
    var result = [];
    var groupedData = {};
    var groupedKeys = [];

    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      var rollupKey = getVendorBillRollupKey(item);

      if (!rollupKey) {
        result.push(item);
        continue;
      }

      if (!groupedData[rollupKey]) {
        groupedKeys.push(rollupKey);
        groupedData[rollupKey] = {
          line: item.line,
          group: item.group,
          memo: item.memo,
          descriptionKey: item.descriptionKey,
          markup: item.markup,
          qty: 0,
          rate: item.rate,
          amount: 0,
          project: item.project,
          costcode: item.costcode
        };
      }

      groupedData[rollupKey].qty += parseNumber(item.qty);
      groupedData[rollupKey].amount += parseNumber(item.amount);
      if (groupedData[rollupKey].qty) {
  groupedData[rollupKey].rate = groupedData[rollupKey].amount / groupedData[rollupKey].qty;
}
      
    }

    for (var keyIndex = 0; keyIndex < groupedKeys.length; keyIndex++) {
      result.push(groupedData[groupedKeys[keyIndex]]);
    }

    log.debug('projectCostCodeDescriptionRateGroupedData', groupedData);
    return result;
  }

  function getVendorBillRollupKey(item) {
    if (!item || item.group == "Direct Labor" || item.markup) return '';
    if (!item.project || !item.costcode || !item.descriptionKey) return '';
    if (isNaN(parseFloat(item.qty)) || isNaN(parseFloat(item.amount))) return '';

    

return [
  normalizeRollupValue(item.project),
  normalizeRollupValue(item.costcode),
  item.descriptionKey
].join('|');

  }

  function normalizeRollupValue(value) {
    if (value == null) return '';

    return String(value)
      .replace(/&amp;/g, '&')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/---\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeRateForRollup(value) {
    var number = parseFloat(value);

    if (isNaN(number)) return normalizeRollupValue(value);
    return String(number);
  }

  function parseNumber(value) {
    var number = parseFloat(value);

    if (isNaN(number)) return 0;
    return number;
  }

  function groupByDirectLabor(data) {
    var result = [];
    var groupedData = {};

    for (var i = 0; i < data.length; i++) {
        var item = data[i];

        log.debug('item', item);

        // Ensure we only group "Direct Labor" with a valid memo
        if (item.group == "Direct Labor" && item.memo) {
            var key = item.memo + "_" + item.rate; // Unique key combining memo and rate

            if (!groupedData[key]) {
                groupedData[key] = {
                    memo: item.memo,
                    qty: 0,
                    amount: 0,
                    rate: item.rate,
                    group: item.group,
                    markup: item.markup
                };
            }

            groupedData[key].qty += parseFloat(item.qty);
            groupedData[key].amount += parseFloat(item.amount);
        } else {
            result.push(item);
        }
    }

    log.debug('groupedData', groupedData);

    // Convert the grouped data back to an array
    for (var key in groupedData) {
        result.push({
            group: groupedData[key].group,
            markup: groupedData[key].markup,
            memo: groupedData[key].memo,
            qty: groupedData[key].qty,
            rate: groupedData[key].rate,
            amount: groupedData[key].amount
        });
    }

    return result;
  }

  return {
    onRequest: onRequest
  };
});
