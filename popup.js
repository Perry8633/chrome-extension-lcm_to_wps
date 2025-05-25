document.addEventListener('DOMContentLoaded', function() {
  const openOptionsBtn = document.getElementById('openOptions');
  
  openOptionsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});