window.onerror = function(message, source, lineno, colno, error) {
  var box = document.getElementById('error-box');
  box.style.display = 'block';
  box.innerHTML += '<b>Error:</b> ' + message + '<br><b>Source:</b> ' + source + ' (' + lineno + ':' + colno + ')<br><hr>';
};
window.addEventListener("unhandledrejection", function(event) {
  var box = document.getElementById('error-box');
  box.style.display = 'block';
  box.innerHTML += '<b>Unhandled Promise Rejection:</b> ' + (event.reason && event.reason.stack ? event.reason.stack : event.reason) + '<br><hr>';
});
