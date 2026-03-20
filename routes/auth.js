/** Handle login form submit */
async function doLogin() {
  const emailEl  = document.getElementById('lemail');
  const passEl   = document.getElementById('lpass');
  const btn      = document.getElementById('lbtn');

  const email    = emailEl && emailEl.value ? String(emailEl.value).trim().toLowerCase() : '';
  const password = passEl && passEl.value ? String(passEl.value) : '';

  clearErrors();

  if (!email) {
    document.getElementById('eerr').classList.add('show');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    // Call backend API
    const response = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    // Store token
    authToken = response.token;
    localStorage.setItem('authToken', authToken);

    // Store user data
    currentUser = response.user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    resetBtn(btn);
    applyRoleToUI(currentUser);
    transitionToApp();
    loadInitialData();  // ← NOW CALL AFTER LOGIN AND TOKEN IS SET
    addLog('LOGIN', currentUser.name, 'Signed In', currentUser.role);
    showT(`Welcome back, ${currentUser.name.split(' ')[0]}`, 'success');

  } catch (err) {
    resetBtn(btn);
    // Updated to show the exact error from the backend
    showError('gerr', err.message || 'Login failed. Please try again.');
    console.error('Login error:', err);
  }
}