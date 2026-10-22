window.Pomodoro = (() => {
  let interval = null, running = false, mode = "focus", remaining = 25 * 60, endAt = 0;
  const $ = id => document.getElementById(id);
  function display() {
    const mins = Math.floor(remaining / 60), secs = remaining % 60;
    $("timer-display").textContent = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
    $("timer-status").textContent = running ? (mode === "focus" ? "You’re doing beautifully. Keep going ♡" : "Take a gentle little break ♡") : (mode === "focus" ? "Ready when you are" : "Rest and recharge");
    $("timer-start").textContent = running ? "Pause timer" : (remaining === 0 ? "Start again" : mode === "focus" ? "Start focus" : "Start break");
  }
  function stopInterval() { if (interval) clearInterval(interval); interval = null; }
  function tick() {
    remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (remaining <= 0) {
      stopInterval(); running = false;
      const focus = Number($("focus-minutes").value) || 25;
      const rest = Number($("break-minutes").value) || 5;
      mode = mode === "focus" ? "break" : "focus";
      remaining = (mode === "focus" ? focus : rest) * 60;
      display();
      $("timer-status").textContent = mode === "break" ? "Focus complete! Time for a break ♡" : "Break complete! Ready for another round?";
      toast(mode === "break" ? "Focus session complete — lovely work! ♡" : "Break finished — ready when you are ♡");
      return;
    }
    display();
  }
  function startPause() {
    if (running) { running = false; stopInterval(); display(); return; }
    if (remaining <= 0) remaining = (mode === "focus" ? Number($("focus-minutes").value) || 25 : Number($("break-minutes").value) || 5) * 60;
    running = true; endAt = Date.now() + remaining * 1000;
    stopInterval(); interval = setInterval(tick, 250); display();
  }
  function reset() { running = false; stopInterval(); mode = "focus"; remaining = (Number($("focus-minutes").value) || 25) * 60; display(); }
  function open() { $("timer-dialog").showModal(); display(); }
  function toast(message) {
    const el = document.createElement("div"); el.className = "toast"; el.textContent = message; document.body.appendChild(el); setTimeout(() => el.remove(), 3200);
  }
  function init() {
    $("timer-start").addEventListener("click", startPause);
    $("timer-reset").addEventListener("click", reset);
    $("focus-minutes").addEventListener("change", () => { if (!running && mode === "focus") reset(); });
    $("break-minutes").addEventListener("change", () => { if (!running && mode === "break") { remaining = (Number($("break-minutes").value) || 5) * 60; display(); } });
    display();
  }
  return {init, open, toast};
})();