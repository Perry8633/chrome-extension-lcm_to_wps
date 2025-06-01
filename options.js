// options.js
const NUM_KEYWORDS = 9;

// Function to update visibility of extraction option dropdowns
function updateKeywordRowDisplay(index) {
  const directionSelect = document.getElementById(`direction${index}`);
  const extractBelowSelect = document.getElementById(`extractBelow${index}`);
  const extractRightSelect = document.getElementById(`extractRight${index}`);

  // It's possible elements are not yet created when restoreOptions initially calls this
  if (!directionSelect || !extractBelowSelect || !extractRightSelect) return;

  const selectedDirection = directionSelect.value;

  extractBelowSelect.style.display = (selectedDirection === 'Below') ? 'block' : 'none';
  extractRightSelect.style.display = (selectedDirection === 'Right') ? 'block' : 'none';
}

// Save settings
function saveOptions() {
  const filename = document.getElementById('filename').value;
  const dateFormat = document.getElementById('dateFormat').value === 'true';
  const autoDetect = document.getElementById('autoDetect').value === 'true';
  const includeHeaders = document.getElementById('includeHeaders').value === 'true';

  const keywordSettings = [];
  for (let i = 0; i < NUM_KEYWORDS; i++) {
    const keywordInput = document.getElementById(`keyword${i}`);
    const directionSelect = document.getElementById(`direction${i}`);
    const extractBelowSelect = document.getElementById(`extractBelow${i}`);
    const extractRightSelect = document.getElementById(`extractRight${i}`);

    // Ensure elements exist before accessing their properties,
    // which should be the case if restoreOptions ran correctly.
    const keyword = keywordInput ? keywordInput.value : '';
    const direction = directionSelect ? directionSelect.value : 'None';
    const extractBelow = extractBelowSelect ? extractBelowSelect.value : 'Single Cell';
    const extractRight = extractRightSelect ? extractRightSelect.value : 'Single Cell';

    keywordSettings.push({ keyword, direction, extractBelow, extractRight });
  }

  chrome.storage.sync.set({
    filename: filename,
    dateFormat: dateFormat,
    autoDetect: autoDetect,
    includeHeaders: includeHeaders,
    keywordSettings: keywordSettings // Add new settings
  }, function() {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = '设置已保存！'; // Settings saved!
      status.className = 'status success';
      status.style.display = 'block';

      setTimeout(function() {
        status.style.display = 'none';
      }, 2000);
    } else {
      console.error("Status element not found");
    }
  });
}

// Restore settings
function restoreOptions() {
  chrome.storage.sync.get({
    filename: 'table_data',
    dateFormat: false,
    autoDetect: true,
    includeHeaders: true,
    keywordSettings: [] // Default to empty array for keyword settings
  }, function(items) {
    const filenameEl = document.getElementById('filename');
    const dateFormatEl = document.getElementById('dateFormat');
    const autoDetectEl = document.getElementById('autoDetect');
    const includeHeadersEl = document.getElementById('includeHeaders');

    if (filenameEl) filenameEl.value = items.filename;
    if (dateFormatEl) dateFormatEl.value = items.dateFormat.toString();
    if (autoDetectEl) autoDetectEl.value = items.autoDetect.toString();
    if (includeHeadersEl) includeHeadersEl.value = items.includeHeaders.toString();

    const keywordsTbody = document.getElementById('keywordsTbody');
    if (!keywordsTbody) {
        console.error("keywordsTbody element not found in options.html. Cannot restore keyword settings.");
        return;
    }
    keywordsTbody.innerHTML = ''; // Clear existing rows to prevent duplication

    for (let i = 0; i < NUM_KEYWORDS; i++) {
      const setting = items.keywordSettings[i] || { keyword: '', direction: 'None', extractBelow: 'Single Cell', extractRight: 'Single Cell' };

      const row = keywordsTbody.insertRow();
      // Keyword Input
      const keywordCell = row.insertCell();
      keywordCell.innerHTML = `<input type="text" id="keyword${i}" value="${setting.keyword}" style="width: 95%; padding: 6px; box-sizing: border-box;">`;

      // Direction Select
      const directionCell = row.insertCell();
      directionCell.innerHTML = `
        <select id="direction${i}" style="padding: 6px; min-width: 80px;">
          <option value="None" ${setting.direction === 'None' ? 'selected' : ''}>None</option>
          <option value="Above" ${setting.direction === 'Above' ? 'selected' : ''}>Above</option>
          <option value="Below" ${setting.direction === 'Below' ? 'selected' : ''}>Below</option>
          <option value="Right" ${setting.direction === 'Right' ? 'selected' : ''}>Right</option>
        </select>`;

      // Extract Below Select
      const extractBelowCell = row.insertCell();
      extractBelowCell.innerHTML = `
        <select id="extractBelow${i}" style="display: none; padding: 6px; min-width: 100px;">
          <option value="Single Cell" ${setting.extractBelow === 'Single Cell' ? 'selected' : ''}>Single Cell</option>
          <option value="Entire Column" ${setting.extractBelow === 'Entire Column' ? 'selected' : ''}>Entire Column</option>
        </select>`;

      // Extract Right Select
      const extractRightCell = row.insertCell();
      extractRightCell.innerHTML = `
        <select id="extractRight${i}" style="display: none; padding: 6px; min-width: 100px;">
          <option value="Single Cell" ${setting.extractRight === 'Single Cell' ? 'selected' : ''}>Single Cell</option>
          <option value="Entire Row" ${setting.extractRight === 'Entire Row' ? 'selected' : ''}>Entire Row</option>
        </select>`;

      // Add event listener for direction change
      const directionSelect = document.getElementById(`direction${i}`);
      if (directionSelect) {
        directionSelect.addEventListener('change', function() {
          updateKeywordRowDisplay(i);
        });
      }

      // Initial display update for the row
      updateKeywordRowDisplay(i);
    }
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
const saveButton = document.getElementById('save');
if (saveButton) {
    saveButton.addEventListener('click', saveOptions);
} else {
    console.error("Save button element not found in options.html.");
}