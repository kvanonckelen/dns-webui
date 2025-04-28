document.getElementById('change-password-form').addEventListener('submit', function(e) {
    e.preventDefault();
  
    const formData = new FormData(this);
  
    fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldPassword: formData.get('oldPassword'),
        newPassword: formData.get('newPassword')
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          alert('Password changed successfully!');
          window.location.href = '/';
        } else {
          alert('Error changing password.');
        }
      });
  });
  