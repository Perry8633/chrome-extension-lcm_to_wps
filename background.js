// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "extractTable",
    title: "提取表格数据",
    contexts: ["all"]
  });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "extractTable" && tab) {
    chrome.tabs.sendMessage(tab.id, { action: "getRightClickedTableInfo" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Error sending message to content script (getRightClickedTableInfo):", chrome.runtime.lastError.message);
        // Proceed without tableSelector, extraction will use fallback.
        fetchSettingsAndInject(tab.id, null);
        return;
      }

      const tableSelector = response && response.success && response.tableFound ? response.selector : null;
      fetchSettingsAndInject(tab.id, tableSelector);
    });
  }
});

function fetchSettingsAndInject(tabId, tableSelector) {
  chrome.storage.sync.get(['keywordSettings', 'filename', 'dateFormat', 'includeHeaders', 'autoDetect'], (settings) => {
    const keywordSettings = settings.keywordSettings || [];
    const filename = settings.filename || 'table_data';
    const dateFormat = settings.dateFormat !== undefined ? settings.dateFormat : false;
    const includeHeaders = settings.includeHeaders !== undefined ? settings.includeHeaders : true;
    const autoDetect = settings.autoDetect !== undefined ? settings.autoDetect : true;

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: extractTableData,
      args: [tableSelector, keywordSettings, filename, dateFormat, includeHeaders, autoDetect]
    });
  });
}

// Helper function to get clean text from a cell
function getCellText(cell) {
  if (!cell) return '';
  let text = cell.textContent || cell.innerText || '';
  return text.trim().replace(/\s+/g, ' ');
}

// Helper function to find a keyword in a table
// Searches th first, then td. Case-insensitive.
function findKeywordCellInfo(table, keyword) {
  if (!table || !keyword) return null;
  const rows = table.rows;
  const lowerKeyword = keyword.toLowerCase();

  // Pass 1: Search <th> elements
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].cells;
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j];
      if (cell.tagName === 'TH') {
        const cellText = getCellText(cell);
        if (cellText.toLowerCase().includes(lowerKeyword)) {
          return { cellElement: cell, rowIndex: i, colIndex: j };
        }
      }
    }
  }
  // Pass 2: Search <td> elements if not found in <th>
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].cells;
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j];
      if (cell.tagName === 'TD') {
        const cellText = getCellText(cell);
        if (cellText.toLowerCase().includes(lowerKeyword)) {
          return { cellElement: cell, rowIndex: i, colIndex: j };
        }
      }
    }
  }
  return null;
}

// Helper to get content from cell above
function getAboveCell(table, rowIndex, colIndex) {
  if (rowIndex > 0 && table.rows[rowIndex - 1] && table.rows[rowIndex - 1].cells[colIndex]) {
    return [getCellText(table.rows[rowIndex - 1].cells[colIndex])];
  }
  return ['']; // Return a single-element array for consistency
}

// Helper to get content from cell(s) below
function getBelowCellOrColumn(table, rowIndex, colIndex, extractType) {
  const result = [];
  if (extractType === "Single Cell") {
    if (rowIndex + 1 < table.rows.length && table.rows[rowIndex + 1] && table.rows[rowIndex + 1].cells[colIndex]) {
      result.push(getCellText(table.rows[rowIndex + 1].cells[colIndex]));
    } else {
      result.push(''); // Push empty if cell doesn't exist
    }
  } else if (extractType === "Entire Column") {
    for (let i = rowIndex + 1; i < table.rows.length; i++) {
      if (table.rows[i] && table.rows[i].cells[colIndex]) {
        result.push(getCellText(table.rows[i].cells[colIndex]));
      } else {
        result.push('');
      }
    }
  }
  // Ensure a single empty string is returned if no data, to represent an empty cell/column
  return result.length > 0 ? result : [''];
}


// Helper to get content from cell(s) to the right
function getRightCellOrRow(table, rowIndex, colIndex, extractType) {
  const result = [];
  const sourceRow = table.rows[rowIndex];
  if (!sourceRow) return [''];

  if (extractType === "Single Cell") {
    if (colIndex + 1 < sourceRow.cells.length && sourceRow.cells[colIndex + 1]) {
      result.push(getCellText(sourceRow.cells[colIndex + 1]));
    } else {
      result.push('');
    }
  } else if (extractType === "Entire Row") {
    for (let i = colIndex + 1; i < sourceRow.cells.length; i++) {
      if (sourceRow.cells[i]) {
        result.push(getCellText(sourceRow.cells[i]));
      } else {
        result.push('');
      }
    }
  }
  return result.length > 0 ? result : [''];
}

// 注入到页面的函数
function extractTableData(tableSelector, keywordSettings, filename, dateFormat, includeHeaders, autoDetect) {
  console.log("Received tableSelector:", tableSelector);
  console.log("Received keywordSettings:", keywordSettings);
  // Other console logs for settings can remain if needed

  let targetTable = null;

  if (tableSelector) {
    targetTable = document.querySelector(tableSelector);
    if (targetTable) {
      console.log("Table found using selector from content script:", targetTable);
      // Send message to content script to clear attribute and highlight
      // This is fire-and-forget from the injected script's perspective.
      chrome.runtime.sendMessage({ action: 'clearTableHighlightAndAttribute' }, response => {
        if (chrome.runtime.lastError) {
            console.warn("Error sending clearTableHighlightAndAttribute message:", chrome.runtime.lastError.message);
        } else if (response && !response.success) {
            console.warn("Failed to clear highlight/attribute:", response.message);
        } else {
            console.log("Table highlight/attribute cleared by content script.");
        }
      });
    } else {
      console.warn(`Table selector "${tableSelector}" provided, but table not found. Falling back.`);
    }
  }

  if (!targetTable) {
    const tables = document.querySelectorAll('table');
    if (tables.length === 0) {
      alert('未找到表格，请确保页面中包含表格元素 (No tables found)');
      return;
    }
    if (tables.length === 1) {
      targetTable = tables[0];
      console.log("Only one table on page, using it.");
    } else {
      console.log("Multiple tables on page or no specific table selected, using findClosestTable.");
      targetTable = findClosestTable(autoDetect);
    }
  }

  if (!targetTable) { // Should be redundant if above logic is sound, but as a safeguard.
    alert('无法确定目标表格 (Could not determine target table).');
    return;
  }
  
  // --- The rest of the extraction logic remains largely the same ---
  let tableData = [];
  const activeKeywords = keywordSettings.filter(ks => ks.keyword && ks.keyword.trim() !== '' && ks.direction !== "None");

  if (activeKeywords.length > 0) {
    console.log("Active keywords found, processing:", activeKeywords);
    let keywordBasedDataFoundAtLeastOnce = false;

    activeKeywords.forEach(setting => {
      const keywordCellInfo = findKeywordCellInfo(targetTable, setting.keyword);

      if (keywordCellInfo) {
        console.log(`Keyword "${setting.keyword}" found at r:${keywordCellInfo.rowIndex}, c:${keywordCellInfo.colIndex}`);
        let extractedValues = [];

        switch (setting.direction) {
          case "Above":
            extractedValues = getAboveCell(targetTable, keywordCellInfo.rowIndex, keywordCellInfo.colIndex);
            break;
          case "Below":
            extractedValues = getBelowCellOrColumn(targetTable, keywordCellInfo.rowIndex, keywordCellInfo.colIndex, setting.extractBelow);
            break;
          case "Right":
            extractedValues = getRightCellOrRow(targetTable, keywordCellInfo.rowIndex, keywordCellInfo.colIndex, setting.extractRight);
            break;
        }

        // Check if extractedValues actually contains meaningful data (not just a single empty string)
        if (extractedValues.length > 0 && (extractedValues.length > 1 || extractedValues[0] !== '')) {
          keywordBasedDataFoundAtLeastOnce = true;
          if (setting.direction === "Below" && setting.extractBelow === "Entire Column") {
            extractedValues.forEach(value => {
                tableData.push([setting.keyword, value]);
            });
          } else if (setting.direction === "Right" && setting.extractRight === "Entire Row") {
            tableData.push([setting.keyword, ...extractedValues]);
          } else {
            tableData.push([setting.keyword, ...extractedValues]);
          }
        } else {
           // Keyword found, but no data extracted (e.g. cell above was empty, or end of table)
           console.log(`Keyword "${setting.keyword}" processed, but no data extracted for direction "${setting.direction}".`);
           tableData.push([setting.keyword, '']); // Add keyword with an empty value
           keywordBasedDataFoundAtLeastOnce = true; // Still counts as "found" for fallback logic
        }
      } else {
        console.log(`Keyword "${setting.keyword}" not found in table.`);
        tableData.push([setting.keyword, "KEYWORD_NOT_FOUND"]);
      }
    });

    if (!keywordBasedDataFoundAtLeastOnce && activeKeywords.length > 0) {
      // This case means keywords were active, but NONE of them were found or yielded data.
      // The user might want to know this, instead of a full table dump.
      // However, current spec is to fallback.
      console.log("No active keywords led to data extraction. Falling back to full table extraction.");
      tableData = extractTableContent(targetTable, includeHeaders);
    } else if (!keywordBasedDataFoundAtLeastOnce && activeKeywords.length === 0) {
      // No active keywords to begin with
      console.log("No active keywords. Falling back to full table extraction.");
      tableData = extractTableContent(targetTable, includeHeaders);
    }
    // If keywordBasedDataFoundAtLeastOnce is true, tableData will contain the keyword results.

  } else {
    console.log("No active keywords defined. Falling back to full table extraction.");
    tableData = extractTableContent(targetTable, includeHeaders);
  }
  
  if (tableData.length === 0) {
    // If after all processing, tableData is empty (e.g. keywords found no data, and fallback was also empty)
    alert('No data extracted. The table might be empty or keywords did not yield results.');
    return;
  }

  const csvContent = convertToCSV(tableData);
  
  // Construct filename based on settings
  let fullFilename = filename;
  if (dateFormat) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}`;
    fullFilename += `_${formattedDate}`;
  }
  fullFilename += '.csv';

  // 下载文件
  downloadCSV(csvContent, fullFilename);
}

// Modified to accept includeHeaders, though not fully implemented in this version of extractTableContent
function findClosestTable(autoDetectEnabled = true) { // Added autoDetectEnabled, not fully used yet
  const tables = document.querySelectorAll('table');
  // 简单实现：返回第一个可见的表格
  for (let table of tables) {
    const rect = table.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return table;
    }
  }
  return tables[0];
}

function extractTableContent(table, includeHeaders) {
  const rows = [];
  // Determine which rows to select (all, or skip header if !includeHeaders)
  // This is a simplified version; proper header skipping might need more context
  const tableRows = table.querySelectorAll('tr');
  
  let isFirstRow = true;
  tableRows.forEach(row => {
    // Basic header skipping logic - might need refinement
    if (!includeHeaders && isFirstRow && row.querySelectorAll('th').length > 0) {
        isFirstRow = false;
        return; // Skip header row if includeHeaders is false and it looks like a header
    }
    isFirstRow = false;

    const cells = [];
    // If includeHeaders is true, get th and td. If false, ideally only td, but current selector gets both.
    const tableCells = row.querySelectorAll('td, th');
    
    tableCells.forEach(cell => {
      // 清理文本内容
      let text = cell.textContent || cell.innerText || '';
      text = text.trim().replace(/\s+/g, ' ');
      cells.push(text);
    });
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  });
  
  return rows;
}

function convertToCSV(data) {
  return data.map(row => {
    return row.map(cell => {
      // 处理包含逗号、引号或换行符的单元格
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return '"' + cell.replace(/"/g, '""') + '"';
      }
      return cell;
    }).join(',');
  }).join('\n');
}

function downloadCSV(csvContent, filename) {
  // 添加BOM以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  alert('表格数据已成功导出为CSV文件！');
}