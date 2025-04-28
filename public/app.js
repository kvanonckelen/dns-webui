document.addEventListener('DOMContentLoaded', function () {
    const loadingPage = document.getElementById('loading-page');
    const zonesContainer = document.getElementById('zones-container');
    const emptyState = document.getElementById('empty-state');
    const tableBody = document.querySelector('#zones-table tbody');

    // Hide content until loaded
    zonesContainer.style.display = 'none';
    emptyState.style.display = 'none';

    // ✅ First: check if user is logged in
    checkLoginStatus();

    function checkLoginStatus() {
      fetch('/api/whoami')
        .then(res => res.json())
        .then(data => {
          if (!data.loggedIn) {
            window.location.href = '/login.html';
          } else {
            updateWelcomeBadge(data.user.username); // Show welcome badge
            loadZones(); // ✅ Only now load zones!
          }
        })
        .catch(err => {
          console.error('Error checking session', err);
          window.location.href = '/login.html';
        });
    }

    function updateWelcomeBadge(username) {
      const welcomeDiv = document.getElementById('welcome-badge');
      if (welcomeDiv) {
        welcomeDiv.innerHTML = `Welcome, <strong>${username}</strong>`;
      }
    }

    function loadZones() {
      fetch('/api/zones')
        .then(response => response.json())
        .then(zones => {
          if (zones.length === 0) {
            emptyState.style.display = 'block';
          } else {
            tableBody.innerHTML = '';
            zones.forEach(item => {
              const row = document.createElement('tr');
              row.innerHTML = `
                <td>
                  <div><strong>${item.zone}</strong></div>
                  <div class="text-muted small">Last updated: ${item.lastUpdated}</div>
                </td>
                <td>
                  <a href="/zone.html?zone=${item.zone}" class="btn btn-primary btn-sm">Manage</a>
                  <button class="btn btn-danger btn-sm" onclick="deleteZone('${item.zone}')">Delete</button>
                </td>
              `;
              tableBody.appendChild(row);
            });
            zonesContainer.style.display = 'block';
          }
        })
        .catch(error => {
          console.error('Error loading zones:', error);
          showToast('Failed to load zones.', 'error');
          emptyState.style.display = 'block';
        })
        .finally(() => {
          loadingPage.style.opacity = '0';
          setTimeout(() => {
            loadingPage.style.display = 'none';
          }, 500);
        });
    }

    function openCreateZoneModal() {
      const modal = document.getElementById('createZoneModal');
      const modalContent = modal.querySelector('.modal-content');
      document.getElementById('create-zone-form').reset();
      modal.style.display = 'flex';
      setTimeout(() => {
        modalContent.style.opacity = '1';
        modalContent.style.transform = 'scale(1)';
      }, 50);
    }

    function closeCreateZoneModal() {
      const modal = document.getElementById('createZoneModal');
      const modalContent = modal.querySelector('.modal-content');
      modalContent.style.opacity = '0';
      modalContent.style.transform = 'scale(0.95)';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
    }

    document.getElementById('create-zone-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const formData = new FormData(this);
      const zoneName = formData.get('zone');
      fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: zoneName })
      })
      .then(response => response.json())
      .then(result => {
        if (result.status) {
          showToast('Zone created!', 'success');
          window.location.href = `/zone.html?zone=${zoneName}`;
        } else {
          showToast('Error creating zone', 'error');
        }
      });
      closeCreateZoneModal();
    });

    function deleteZone(zoneName) {
      if (confirm(`Are you sure you want to delete the entire zone "${zoneName}"?`)) {
        fetch(`/api/zones/${zoneName}`, {
          method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
          if (data.status) {
            showToast('Zone deleted successfully!', 'success');
            loadZones(); // reload
          } else {
            showToast('Failed to delete zone.', 'error');
          }
        })
        .catch(err => {
          console.error(err);
          showToast('Error deleting zone.', 'error');
        });
      }
    }

    function showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = `toast show bg-${type === 'success' ? 'success' : 'danger'} text-white mb-2`;
      toast.setAttribute('role', 'alert');
      toast.innerHTML = `<div class="toast-body">${message}</div>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }

});


function logout() {
    fetch('/api/logout', { method: 'POST' })
      .then(() => window.location.href = '/login.html')
      .catch(err => console.error('Logout error', err));
  }