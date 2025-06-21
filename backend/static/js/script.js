// Fetch TLE data and detect collisions (MAIN FUNCTION - KEPT ON TOP)
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
          showResult(resData);
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

// Show help tooltip
function showHelpTooltip() {
  const helpBtn = document.querySelector('.help-btn');
  const helpTooltip = document.querySelector('.help-tooltip');
  helpBtn.addEventListener('focus', () => helpTooltip.style.display = 'block');
  helpBtn.addEventListener('blur', () => helpTooltip.style.display = 'none');
  helpBtn.addEventListener('mouseenter', () => helpTooltip.style.display = 'block');
  helpBtn.addEventListener('mouseleave', () => helpTooltip.style.display = 'none');
}

// Show threshold tooltip
function showThresholdTooltip() {
  const thresholdHelp = document.querySelector('.threshold-help');
  const thresholdTooltip = document.querySelector('.threshold-tooltip');
  thresholdHelp.addEventListener('focus', () => thresholdTooltip.style.display = 'block');
  thresholdHelp.addEventListener('blur', () => thresholdTooltip.style.display = 'none');
  thresholdHelp.addEventListener('mouseenter', () => thresholdTooltip.style.display = 'block');
  thresholdHelp.addEventListener('mouseleave', () => thresholdTooltip.style.display = 'none');
}

// Animate result card
function animateCard(card) {
  card.style.opacity = 0;
  card.style.transform = "translateY(30px) scale(0.98)";
  setTimeout(() => {
    card.style.transition = "all 0.7s cubic-bezier(.48,1.41,.66,.97)";
    card.style.opacity = 1;
    card.style.transform = "none";
  }, 50);
}

// Show result (danger or all clear)
function showResult(resData) {
  const results = document.getElementById('results');
  results.innerHTML = '';
  if (Array.isArray(resData) && resData.length === 0) {
    // All clear
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
    const card = results.querySelector('.card.success');
    if (card) animateCard(card);
    // Optional: confetti or animation here
  } else if (Array.isArray(resData)) {
    // Show each collision as a danger card
    resData.forEach(c => {
      const tcaMin = Math.floor(c.tca / 60);
      const tcaSec = Math.round(c.tca % 60);
      const cardHtml = `
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
      results.innerHTML += cardHtml;
    });
    // Animate all danger cards
    results.querySelectorAll('.card.danger').forEach(animateCard);
  }
}

// DOMContentLoaded and form submit setup
document.addEventListener('DOMContentLoaded', function() {
  // Help and threshold tooltip setup
  if (document.querySelector('.help-btn')) showHelpTooltip();
  if (document.querySelector('.threshold-help')) showThresholdTooltip();

  // Set up form
  const form = document.getElementById('astroForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      fetchTLE();
    });
  }

  // Optionally, show initial demo result for hackathon/demo mode
  // showResult([
  //   {
  //     sat1: "Starlink-123",
  //     sat2: "Starlink-456",
  //     distance: 1.2,
  //     tca: 180, // 3min
  //     delta_v: [0.00012, -0.00009, 0.00005]
  //   }
  // ]);
});