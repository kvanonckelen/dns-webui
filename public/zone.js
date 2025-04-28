// zone.js
const urlParams = new URLSearchParams(window.location.search);
const zoneName = urlParams.get('zone');
let editingRecord = null;

// On DOM ready
document.addEventListener('DOMContentLoaded', function () {
  if (!zoneName) {
    showToast('No zone selected. Redirecting...', 'error');
    setTimeout(() => window.location.href = '/', 2000);
    return;
  }

  document.getElementById('zone-title').textContent = `Zone: ${zoneName}`;

  loadZoneRecords();

  document.getElementById('add-record-form').addEventListener('submit', function (e) {
    e.preventDefault();
    submitRecordForm();
  });
});

function loadZoneRecords() {
  fetch(`/api/zones/${zoneName}/records`)
    .then(response => response.json())
    .then(records => {
      const tableBody = document.querySelector('#records-table tbody');
      tableBody.innerHTML = '';

      records.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${record.name}</td>
          <td>${record.ttl || ''}</td>
          <td>${record.class || 'IN'}</td>
          <td>${record.type}</td>
          <td>${record.value}</td>
          <td>
            <button class="btn btn-sm btn-warning me-2" onclick="openEditRecordModal('${record.name}', '${record.type}', '${record.value}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('${record.name}', '${record.type}')">Delete</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
      const loadingPage = document.getElementById('loading-page');
      if (loadingPage) {
        loadingPage.style.opacity = '0';
        setTimeout(() => {
          loadingPage.style.display = 'none';
        }, 500); // match your CSS transition
      }
    });
}

function submitRecordForm() {
  const form = document.getElementById('add-record-form');
  const submitButton = form.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

  const formData = new FormData(form);
  const data = {
    name: formData.get('name'),
    ttl: formData.get('ttl'),
    class: formData.get('class'),
    type: formData.get('type'),
    value: formData.get('value')
  };

  let url = `/api/zones/${zoneName}/records`;
  let method = 'POST';

  if (editingRecord) {
    data.oldName = editingRecord.name;
    data.oldType = editingRecord.type;
    method = 'PUT';
  }

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(response => response.json())
    .then(result => {
      if (result.status) {
        showToast(editingRecord ? 'Record updated!' : 'Record added!', 'success');
        reloadIfNeeded();
        loadZoneRecords();
        closeAddRecordModal();
      } else {
        showToast('Error saving record', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Error saving record', 'error');
    })
    .finally(() => {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Save';
    });
}

function openAddRecordModal() {
  editingRecord = null;
  const form = document.getElementById('add-record-form');
  const modal = document.getElementById('addRecordModal');
  const modalContent = modal.querySelector('.modal-content');
  modal.style.display = 'flex';
  setTimeout(() => {
    modalContent.style.opacity = '1';
    modalContent.style.transform = 'scale(1)';
}, 50); // slight delay to trigger the CSS transition
  form.reset(); // Reset the form
  // Set default values manually after reset
  form.class.value = 'IN'; // prefill Class
  form.ttl.value = '3600'; // ✅ prefill TTL
  form.type.value = 'A';   // optional: default type to A
  setTimeout(() => {
    document.querySelector('#add-record-form input[name=\"name\"]').focus();
  }, 100);
}

function openEditRecordModal(name, type, value) {
  editingRecord = { name, type };

  const form = document.getElementById('add-record-form');
  form.name.value = name;
  form.type.value = type;
  form.value.value = value;

  document.getElementById('addRecordModal').style.display = 'block';
}

function closeAddRecordModal() {
  document.getElementById('addRecordModal').style.display = 'none';
}

function deleteRecord(name, type) {
  if (!zoneName) return;

  if (!confirm(`Are you sure you want to delete record ${name} (${type})?`)) return;

  fetch(`/api/zones/${zoneName}/records`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type })
  })
    .then(res => res.json())
    .then(data => {
      if (data.status) {
        showToast('Record deleted successfully!', 'success');
        reloadIfNeeded();
        loadZoneRecords();
      } else {
        showToast('Failed to delete record.', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Error deleting record.', 'error');
    });
}

function reloadIfNeeded() {
  const autoReload = document.getElementById('autoReloadToggle')?.checked;
  if (!autoReload) return;

  fetch('/api/reload', { method: 'POST' })
    .then(response => response.json())
    .then(result => {
      if (result.status) {
        showToast('BIND reloaded successfully!', 'success');
      } else {
        showToast('Error reloading BIND', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Error contacting server for reload', 'error');
    });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast show bg-${type === 'success' ? 'success' : 'danger'} text-white mb-2`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<div class="toast-body">${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
      .then(() => window.location.href = '/login.html')
      .catch(err => console.error('Logout error', err));
  }
  
