// 保存设置
function saveOptions() {
  const filename = document.getElementById('filename').value;
  const dateFormat = document.getElementById('dateFormat').value === 'true';
  const autoDetect = document.getElementById('autoDetect').value === 'true';
  const includeHeaders = document.getElementById('includeHeaders').value === 'true';
  
  chrome.storage.sync.set({
    filename: filename,
    dateFormat: dateFormat,
    autoDetect: autoDetect,
    includeHeaders: includeHeaders
  }, function() {
    const status = document.getElementById('status');
    status.textContent = '设置已保存！';
    status.className = 'status success';
    status.style.display = 'block';
    
    setTimeout(function() {
      status.style.display = 'none';
    }, 2000);
  });
}

// 恢复设置
function restoreOptions() {
  chrome.storage.sync.get({
    filename: 'table_data',
    dateFormat: false,
    autoDetect: true,
    includeHeaders: true
  }, function(items) {
    document.getElementById('filename').value = items.filename;
    document.getElementById('dateFormat').value = items.dateFormat.toString();
    document.getElementById('autoDetect').value = items.autoDetect.toString();
    document.getElementById('includeHeaders').value = items.includeHeaders.toString();
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);