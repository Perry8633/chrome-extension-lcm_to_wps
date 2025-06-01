// 工具函数库
const TableExtractor = {
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