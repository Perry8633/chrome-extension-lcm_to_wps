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
  if (info.menuItemId === "extractTable") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractTableData
    });
  }
});

// 注入到页面的函数
function extractTableData() {
  // 查找鼠标右键点击位置附近的表格
  const tables = document.querySelectorAll('table');
  let targetTable = null;
  
  // 如果只有一个表格，直接选择
  if (tables.length === 1) {
    targetTable = tables[0];
  } else if (tables.length > 1) {
    // 多个表格时，让用户选择或找到最近的表格
    targetTable = findClosestTable();
  }
  
  if (!targetTable) {
    alert('未找到表格，请确保页面中包含表格元素');
    return;
  }
  
  // 提取表格数据
  const tableData = extractTableContent(targetTable);
  
  // 转换为CSV格式
  const csvContent = convertToCSV(tableData);
  
  // 下载文件
  downloadCSV(csvContent, 'table_data.csv');
}

function findClosestTable() {
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

function extractTableContent(table) {
  const rows = [];
  const tableRows = table.querySelectorAll('tr');
  
  tableRows.forEach(row => {
    const cells = [];
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