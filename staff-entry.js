// The 401 document contains only the existing staff login, never desk data.
// The API sets an HttpOnly page cookie after checking the bearer credential.
window.NIA_STAFF_READY.then(function () {
  if (sessionStorage.getItem('niaStaffEntryRetry') === location.pathname) {
    sessionStorage.removeItem('niaStaffEntryRetry');
    document.getElementById('staff-entry-status').textContent = 'Your browser could not open this desk. Allow cookies for this website, then reload.';
    return;
  }
  sessionStorage.setItem('niaStaffEntryRetry', location.pathname);
  location.reload();
}).catch(function () {
  document.getElementById('staff-entry-status').textContent = 'Desk access is unavailable. Please reload and try again.';
});
