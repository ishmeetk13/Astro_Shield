// Fetch TLE data and detect collisions
function fetchTLE() {
  const mode = document.getElementById('mode').value;
  const group = document.getElementById('group').value;
  const threshold = parseFloat(document.getElementById('threshold').value);
  const results = document.getElementById('results');
  results.innerHTML = `
    <div class="card yellow">
      <div class="card-header">
        <span class="icon">⏳</span>
        <strong>Checking for possible satellite collisions...</strong>
      </div>
    </div>
  `;

  // Call Flask backend to get TLE data
  fetch(`/tle?mode=${mode}&group=${group}`)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        results.innerHTML = `
          <div class="card red">
            <div class="card-header">
              <span class="icon">❌</span>
              <strong>Error loading satellite data</strong>
            </div>
            <div class="card-body">
              Unable to get satellite information. Please try again later.
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
              <div class="card green">
                <div class="card-header">
                  <span class="icon">✅</span>
                  <strong>All Clear!</strong>
                </div>
                <div class="card-body">
                  No potential satellite collisions detected. All satellites are on a safe path.
                </div>
              </div>`;
          } else {
            resData.forEach(c => {
              // Interpret values for users
              const color = c.risky ? 'yellow' : 'red';
              const riskLabel = c.risky ? '⚠️ Warning' : '🚨 Danger';
              const riskText = c.risky
                ? 'These satellites could come close enough to risk a collision. Please monitor closely.'
                : 'These satellites are on a dangerous collision course. Immediate action is recommended!';
              // Turn seconds into minutes/seconds for tCA
              const tcaMin = Math.floor(c.tca / 60);
              const tcaSec = Math.round(c.tca % 60);

              results.innerHTML += `
                <div class="card ${color}">
                  <div class="card-header">
                    <span class="icon">${riskLabel}</span>
                    <strong>Possible Satellite Collision Detected</strong>
                  </div>
                  <div class="card-body">
                    <ul class="card-list">
                      <li>
                        <strong>Satellites involved:</strong>
                        <span>${c.sat1} &amp; ${c.sat2}</span>
                      </li>
                      <li>
                        <strong>Closest distance:</strong>
                        <span>${c.distance.toFixed(2)} km</span>
                        <span class="card-help">(How close the satellites will get)</span>
                      </li>
                      <li>
                        <strong>Time until closest point:</strong>
                        <span>${tcaMin > 0 ? `${tcaMin} min ` : ''}${tcaSec} sec from now</span>
                        <span class="card-help">(When they’ll be closest together)</span>
                      </li>
                      <li>
                        <strong>Recommended speed change:</strong>
                        <span>${c.delta_v.map(v => v.toFixed(5)).join(', ')} km/s</span>
                        <span class="card-help">(Adjustment needed to avoid collision)</span>
                      </li>
                    </ul>
                    <div class="card-summary">${riskText}</div>
                  </div>
                </div>
              `;
            });
          }
        })
        .catch(() => {
          results.innerHTML = `
            <div class="card red">
              <div class="card-header">
                <span class="icon">❌</span>
                <strong>Failed to check collisions</strong>
              </div>
              <div class="card-body">
                An error occurred while checking for satellite collisions.
              </div>
            </div>`;
        });
    })
    .catch(() => {
      results.innerHTML = `
        <div class="card red">
          <div class="card-header">
            <span class="icon">❌</span>
            <strong>Something went wrong</strong>
          </div>
          <div class="card-body">
            Please try again.
          </div>
        </div>`;
    });
}
