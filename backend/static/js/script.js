// Fetch TLE data and detect collisions
function fetchTLE() {
  const mode = document.getElementById('mode').value;
  const group = document.getElementById('group').value;
  const threshold = parseFloat(document.getElementById('threshold').value);
  const results = document.getElementById('results');
  results.innerHTML = `
    <div class="card info">
      <div class="card-header">
        <span class="icon">⏳</span>
        <strong>Checking for possible satellite collisions</strong>
      </div>
    </div>
  `;

  // Call Flask backend to get TLE data
  fetch(`/tle?mode=${mode}&group=${group}`)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        results.innerHTML = `
          <div class="card error">
            <div class="card-header">
              <span class="icon">❌</span>
              <strong>Error loading satellite data</strong>
            </div>
          </div>`;
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
            results.innerHTML = `
              <div class="card success">
                <div class="card-header">
                  <span class="icon">✅</span>
                  <strong>All Clear!</strong>
                </div>
                <div class="card-message">
                  No potential satellite collisions detected. All satellites are on a safe path.
                </div>
              </div>`;
          } else {
            resData.forEach(c => {
              // All collisions are "Danger" with space/purple colors
              const tcaMin = Math.floor(c.tca / 60);
              const tcaSec = Math.round(c.tca % 60);

              results.innerHTML += `
                <div class="card danger">
                  <div class="card-header">
                    <span class="icon">🚨</span>
                    <strong>Danger</strong>
                  </div>
                  <div class="card-message">
                    <ul class="card-list">
                      <li>
                        <strong>Satellites involved:</strong>
                        <span>${c.sat1} &amp; ${c.sat2}</span>
                      </li>
                      <li>
                        <strong>Closest distance:</strong>
                        <span>${c.distance.toFixed(2)} km</span>
                      </li>
                      <li>
                        <strong>Time until closest point:</strong>
                        <span>${tcaMin > 0 ? `${tcaMin} min ` : ''}${tcaSec} sec from now</span>
                      </li>
                      <li>
                        <strong>Recommended speed change:</strong>
                        <span>${c.delta_v.map(v => v.toFixed(5)).join(', ')} km/s</span>
                      </li>
                    </ul>
                  </div>
                </div>
              `;
            });
          }
        })
        .catch(() => {
          results.innerHTML = `
            <div class="card error">
              <div class="card-header">
                <span class="icon">❌</span>
                <strong>Failed to check collisions</strong>
              </div>
            </div>`;
        });
    })
    .catch(() => {
      results.innerHTML = `
        <div class="card error">
          <div class="card-header">
            <span class="icon">❌</span>
            <strong>Something went wrong</strong>
          </div>
        </div>`;
    });
}