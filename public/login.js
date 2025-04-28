document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
  
    const formData = new FormData(this);
  
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password')
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'forceChange') {
        window.location.href = '/change-password.html';
      } else if (data.status === 'ok') {
        window.location.href = '/';
      } else {
        alert('Invalid credentials');
      }
    })
    .catch(error => {
      console.error('Login error:', error);
      alert('Login error.');
    });
  });
  