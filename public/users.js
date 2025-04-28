document.addEventListener('DOMContentLoaded', function () {
    loadUsers();
  
    document.getElementById('add-user-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const formData = new FormData(this);
  
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
          role: formData.get('role')
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          showToast('User created!', 'success');
          this.reset();
          loadUsers();
        } else {
          showToast(data.error || 'Error creating user', 'error');
        }
      });
    });
  });
  
  function loadUsers() {
    fetch('/api/users')
      .then(res => res.json())
      .then(users => {
        const tbody = document.querySelector('#users-table tbody');
        tbody.innerHTML = '';
        users.forEach(user => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.username}')">Delete</button>
            </td>
          `;
          tbody.appendChild(row);
        });
      });
  }
  
  function deleteUser(username) {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      fetch(`/api/users/${username}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
          if (data.status) {
            showToast('User deleted!', 'success');
            loadUsers();
          } else {
            showToast(data.error || 'Error deleting user', 'error');
          }
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
    setTimeout(() => toast.remove(), 3000);
  }
  