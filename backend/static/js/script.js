// Fetch TLE data and detect collisions
function fetchTLE() {
  const mode = document.getElementById('mode').value;
  const group = document.getElementById('group').value;
  const threshold = parseFloat(document.getElementById('threshold').value);
  const results = document.getElementById('results');
  results.innerHTML = '<div class="card yellow"><span class="icon">⏳</span>Loading...</div>';

  // Call Flask backend to get TLE data
  fetch(`/tle?mode=${mode}&group=${group}`)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        results.innerHTML = '<div class="card red"><span class="icon">❌</span>Error loading TLE data.</div>';
        return;
      }

      // Call backend collision detection API
      fetch("/collisions", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sats: data, threshold: threshold })
      })
        .then(res => res.json())
        .then(resData => {
          results.innerHTML = '';
          if (resData.length === 0) {
            results.innerHTML = '<div class="card green"><span class="icon">✅</span>No potential collisions detected.</div>';
          } else {
            resData.forEach(c => {
              const color = c.risky ? 'yellow' : 'red';
              results.innerHTML += `
                <div class="card ${color}">
                  <span class="icon">🚨</span><strong>${c.sat1}</strong> & <strong>${c.sat2}</strong><br>
                  <span class="icon">📏</span>Distance: <strong>${c.distance.toFixed(2)} km</strong><br>
                  <span class="icon">⏱️</span>tCA: <strong>${c.tca.toFixed(1)} s</strong><br>
                  <span class="icon">🛰️</span>Δv: <strong>${c.delta_v.map(v => v.toFixed(5)).join(', ')}</strong> km/s<br>
                  ${c.risky ? '<span class="icon">⚠️</span>Secondary collision risk!' : '<span class="icon">🟢</span>Maneuver safe.'}
                </div>`;
            });
          }
        })
        .catch(() => {
          results.innerHTML = '<div class="card red"><span class="icon">❌</span>Failed to check collisions.</div>';
        });
    })
    .catch(() => {
      results.innerHTML = '<div class="card red"><span class="icon">❌</span>Something went wrong. Please try again.</div>';
    });
}

