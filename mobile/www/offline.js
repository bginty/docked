const retryUrl = __DOCKED_RETRY_URL__;
let opening = false;
function reconnect() {
  if (!retryUrl || opening) return;
  opening = true;
  document.getElementById("connection-status").textContent = "Opening Docked Preview…";
  window.location.replace(retryUrl);
}
document.getElementById("retry").addEventListener("click", reconnect);
window.addEventListener("online", reconnect);
