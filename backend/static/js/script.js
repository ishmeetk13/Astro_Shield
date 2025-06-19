// Fetch TLE data and detect collisions
function fetchTLE() {
  const mode = document.getElementById('mode').value;
  const group = document.getElementById('group').value;
  const threshold = parseFloat(document.getElementById('threshold').value);
  const results = document.getElementById('results');
  results.innerHTML = '<p>Loading...</p>';

  // Call Flask backend to get TLE data
  fetch(`/tle?mode=${mode}&group=${group}`)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        results.innerHTML = '<p>Error loading TLE data.</p>';
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
            results.innerHTML = '<div class="card green">✅ No potential collisions detected.</div>';
          } else {
            resData.forEach(c => {
              const color = c.risky ? 'yellow' : 'red';
              results.innerHTML += `
                <div class="card ${color}">
                  🚨 <strong>${c.sat1}</strong> & <strong>${c.sat2}</strong><br>
                  📏 Distance: ${c.distance.toFixed(2)} km<br>
                  ⏱️ tCA: ${c.tca.toFixed(1)} s<br>
                  🛰️ Δv: ${c.delta_v.map(v => v.toFixed(5)).join(', ')} km/s<br>
                  ${c.risky ? '⚠️ Secondary collision risk!' : '✅ Maneuver safe.'}
                </div>`;
            });
          }
        });
    })
    .catch(() => {
      results.innerHTML = '<p>Something went wrong. Please try again.</p>';
    });
}

// Toggle between light and dark mode
function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
}
