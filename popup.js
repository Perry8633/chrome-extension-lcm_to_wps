document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentKeywords = [];
  const SAVED_RECORDS_KEY = 'savedKeywordRecords';

  // DOM Elements
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordBtn = document.getElementById('addKeyword');
  const keywordListDiv = document.getElementById('keywordList');
  const clearKeywordsBtn = document.getElementById('clearKeywords');

  const recordNameInput = document.getElementById('recordName');
  const saveRecordBtn = document.getElementById('saveRecord');
  const savedRecordsSelect = document.getElementById('savedRecords');
  const loadRecordBtn = document.getElementById('loadRecord');
  const deleteRecordBtn = document.getElementById('deleteRecord');

  const processTextBtn = document.getElementById('processText');
  const statusDiv = document.getElementById('status');

  // --- Status Function ---
  function showStatus(message, isError = false) {
    if (!statusDiv) return; // Guard against missing statusDiv
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? 'red' : 'green';
    setTimeout(() => {
      if (statusDiv.textContent === message) { // Clear only if message hasn't changed
        statusDiv.textContent = '';
      }
    }, 3000);
  }

  // --- Keyword Management ---
  function updateKeywordDisplay() {
    if (!keywordListDiv) return;
    keywordListDiv.innerHTML = ''; // Clear current list
    currentKeywords.forEach((keyword, index) => {
      const item = document.createElement('div');
      item.className = 'keyword-item';

      const keywordSpan = document.createElement('span');
      keywordSpan.textContent = keyword;

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', () => {
        removeKeyword(index);
      });

      item.appendChild(keywordSpan);
      item.appendChild(deleteBtn);
      keywordListDiv.appendChild(item);
    });
  }

  function addKeywordHandler() {
    if (!keywordInput) return;
    const keyword = keywordInput.value.trim();
    if (keyword) {
      if (!currentKeywords.includes(keyword)) {
        currentKeywords.push(keyword);
        updateKeywordDisplay();
        keywordInput.value = '';
      } else {
        showStatus('Keyword already exists.', true);
      }
    }
  }

  function removeKeyword(index) {
    if (index >= 0 && index < currentKeywords.length) {
      currentKeywords.splice(index, 1);
      updateKeywordDisplay();
    }
  }

  function clearKeywordsHandler() {
    currentKeywords = [];
    updateKeywordDisplay();
    showStatus('Keywords cleared.');
  }

  // --- Record Management ---
  function loadSavedRecordsDropdown() {
    if(!savedRecordsSelect) return;
    chrome.storage.local.get([SAVED_RECORDS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        showStatus('Error loading records: ' + chrome.runtime.lastError.message, true);
        return;
      }
      const records = result[SAVED_RECORDS_KEY] || {};
      savedRecordsSelect.innerHTML = '<option value="">-- Select a record --</option>'; // Reset
      for (const recordName in records) {
        const option = document.createElement('option');
        option.value = recordName;
        option.textContent = recordName;
        savedRecordsSelect.appendChild(option);
      }
    });
  }

  function saveRecordHandler() {
    if (!recordNameInput) return;
    const name = recordNameInput.value.trim();
    if (!name) {
      showStatus('Please enter a record name.', true);
      return;
    }
    if (currentKeywords.length === 0) {
      showStatus('No keywords to save.', true);
      return;
    }

    chrome.storage.local.get([SAVED_RECORDS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving record (get phase): ' + chrome.runtime.lastError.message, true);
        return;
      }
      const records = result[SAVED_RECORDS_KEY] || {};
      records[name] = [...currentKeywords]; // Save a copy
      chrome.storage.local.set({ [SAVED_RECORDS_KEY]: records }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving record (set phase): ' + chrome.runtime.lastError.message, true);
          return;
        }
        showStatus(`Record "${name}" saved.`);
        loadSavedRecordsDropdown();
        recordNameInput.value = '';
      });
    });
  }

  function loadRecordHandler() {
    if (!savedRecordsSelect) return;
    const selectedName = savedRecordsSelect.value;
    if (!selectedName) {
      showStatus('Please select a record to load.', true);
      return;
    }
    chrome.storage.local.get([SAVED_RECORDS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        showStatus('Error loading record: ' + chrome.runtime.lastError.message, true);
        return;
      }
      const records = result[SAVED_RECORDS_KEY];
      if (records && records[selectedName]) {
        currentKeywords = [...records[selectedName]]; // Load a copy
        updateKeywordDisplay();
        showStatus(`Record "${selectedName}" loaded.`);
      } else {
        showStatus(`Error: Record "${selectedName}" not found.`, true);
      }
    });
  }

  function deleteRecordHandler() {
    if (!savedRecordsSelect) return;
    const selectedName = savedRecordsSelect.value;
    if (!selectedName) {
      showStatus('Please select a record to delete.', true);
      return;
    }
    chrome.storage.local.get([SAVED_RECORDS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        showStatus('Error deleting record (get phase): ' + chrome.runtime.lastError.message, true);
        return;
      }
      let records = result[SAVED_RECORDS_KEY];
      if (records && records[selectedName]) {
        delete records[selectedName];
        chrome.storage.local.set({ [SAVED_RECORDS_KEY]: records }, () => {
          if (chrome.runtime.lastError) {
            showStatus('Error deleting record (set phase): ' + chrome.runtime.lastError.message, true);
            return;
          }
          showStatus(`Record "${selectedName}" deleted.`);
          loadSavedRecordsDropdown();
        });
      } else {
        showStatus(`Error: Record "${selectedName}" not found for deletion.`, true);
      }
    });
  }

  // --- Process Text ---
  function processTextHandler() {
    if (currentKeywords.length < 2) {
      showStatus('Please add at least two keywords to process.', true);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        showStatus('Error querying tabs: ' + chrome.runtime.lastError.message, true);
        return;
      }
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        showStatus('Cannot find active tab to send message.', true);
        return;
      }
      const activeTabId = tabs[0].id;
      const activeTabUrl = tabs[0].url;

      // Prevent execution on chrome://, edge://, about: URLs or other non-http/https pages
      if (!activeTabUrl || !activeTabUrl.match(/^https?:\/\//)) {
          showStatus('Cannot process text on this type of page. Please use on http/https pages.', true);
          return;
      }

      chrome.tabs.sendMessage(activeTabId, { action: 'getSelectedText' }, (response) => {
        if (chrome.runtime.lastError) {
          let errorMsg = 'Error communicating with the page. ';
          if (chrome.runtime.lastError.message.includes("No matching message handler")) {
             errorMsg += 'Content script may not be injected or active. Try reloading the page or checking extension permissions for this site.';
          } else if (chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
             errorMsg += 'The content script is not running on the page. Please ensure you are on a valid page (*.zte.com.cn) and reload the page.';
          } else {
             errorMsg += 'Details: ' + chrome.runtime.lastError.message;
          }
          showStatus(errorMsg, true);
          return;
        }

        if (response && response.selectedText && response.selectedText.trim() !== "") {
          showStatus('Processing text...');
          chrome.runtime.sendMessage({
            action: 'processTextToXlsx',
            text: response.selectedText,
            keywords: currentKeywords
          }, (bgResponse) => {
            if (chrome.runtime.lastError) {
              showStatus('Error during background processing: ' + chrome.runtime.lastError.message, true);
            } else if (bgResponse) {
              if (bgResponse.success) {
                showStatus(bgResponse.message || 'Text processed and XLSX exported!');
              } else {
                showStatus(bgResponse.message || 'Processing failed in background.', true);
              }
            } else {
                 showStatus('No response from background script. Processing might have failed silently.', true);
            }
          });
        } else {
          showStatus('No text selected on the page, or selection is empty. Please select the text you want to process.', true);
        }
      });
    });
  }

  // --- Event Listeners ---
  if(addKeywordBtn) addKeywordBtn.addEventListener('click', addKeywordHandler);
  if(clearKeywordsBtn) clearKeywordsBtn.addEventListener('click', clearKeywordsHandler);
  if(saveRecordBtn) saveRecordBtn.addEventListener('click', saveRecordHandler);
  if(loadRecordBtn) loadRecordBtn.addEventListener('click', loadRecordHandler);
  if(deleteRecordBtn) deleteRecordBtn.addEventListener('click', deleteRecordHandler);
  if(processTextBtn) processTextBtn.addEventListener('click', processTextHandler);

  // Initial Load
  loadSavedRecordsDropdown();
  updateKeywordDisplay();
});