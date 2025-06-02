// 工具函数库
const TableExtractor = {
  
  // 检测表格质量
  assessTableQuality: function(table) {
    const rows = table.querySelectorAll('tr');
    const cells = table.querySelectorAll('td, th');
    
    return {
      rowCount: rows.length,
      cellCount: cells.length,
      hasHeaders: table.querySelectorAll('th').length > 0,
      isVisible: this.isElementVisible(table)
    };
  },
  
  // 检查元素是否可见
  isElementVisible: function(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           window.getComputedStyle(element).display !== 'none';
  },
  
  // 智能表格检测
  findBestTable: function(clickX, clickY) {
    const tables = document.querySelectorAll('table');
    let bestTable = null;
    let bestScore = 0;
    
    tables.forEach(table => {
      const quality = this.assessTableQuality(table);
      const rect = table.getBoundingClientRect();
      
      // 计算距离点击位置的距离
      const distance = Math.sqrt(
        Math.pow(clickX - (rect.left + rect.width / 2), 2) +
        Math.pow(clickY - (rect.top + rect.height / 2), 2)
      );
      
      // 计算评分（考虑表格质量和距离）
      let score = quality.cellCount * 0.5 + quality.rowCount * 0.3;
      if (quality.hasHeaders) score += 10;
      if (quality.isVisible) score += 20;
      score = score / (distance + 1); // 距离越近分数越高
      
      if (score > bestScore) {
        bestScore = score;
        bestTable = table;
      }
    });
    
    return bestTable;
  },
  
  // 格式化日期时间
  formatDateTime: function() {
    const now = new Date();
    return now.getFullYear() + '-' + 
           String(now.getMonth() + 1).padStart(2, '0') + '-' +
           String(now.getDate()).padStart(2, '0') + '_' +
           String(now.getHours()).padStart(2, '0') + '-' +
           String(now.getMinutes()).padStart(2, '0') + '-' +
           String(now.getSeconds()).padStart(2, '0');
  }
};