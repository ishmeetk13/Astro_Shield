// Utility: Toggle options panel
function toggleOptionsPanel() {
  const panel = document.getElementById('optionsPanel');
  panel.classList.toggle('open');
}

// Mode buttons logic
function setupModeButtons() {
  const liveBtn = document.getElementById('liveModeBtn');
  const demoBtn = document.getElementById('demoModeBtn');
  let mode = "live";
  liveBtn.addEventListener('click', function() {
    liveBtn.classList.add('selected');
    demoBtn.classList.remove('selected');
    mode = "live";
    document.getElementById('mode').value = "live";
  });
  demoBtn.addEventListener('click', function() {
    demoBtn.classList.add('selected');
    liveBtn.classList.remove('selected');
    mode = "demo";
    document.getElementById('mode').value = "demo";
  });
}

// Fetch TLE data and detect collisions (MAIN FUNCTION)
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

// Show result (danger or all clear, with one-by-one card navigation)
function showResult(resData) {
  const results = document.getElementById('results');
  results.innerHTML = '';

  if (!Array.isArray(resData) || resData.length === 0) {
    // All clear
    results.innerHTML = `
      <div class="card success">
        <div class="card-header">
          <span class="icon">✅</span>
          <strong>ALL CLEAR</strong>
        </div>
        <div class="card-message">
          No satellite collision risks detected.
        </div>
      </div>`;
    const card = results.querySelector('.card.success');
    if (card) animateCard(card);
    return;
  }

  // Show summary
  const total = resData.length;
  const summary = document.createElement('div');
  summary.className = "card";
  summary.style.marginBottom = "1.2em";
  summary.innerHTML = `<strong>${total} collision risk${total > 1 ? "s" : ""} detected.</strong>`;
  results.appendChild(summary);

  // Card container
  const cardContainer = document.createElement('div');
  cardContainer.id = "collision-card-container";
  results.appendChild(cardContainer);

  function renderCard(idx) {
    cardContainer.innerHTML = "";
    const c = resData[idx];
    const tcaMin = Math.floor(c.tca / 60);
    const tcaSec = Math.round(c.tca % 60);
    let timeStr = tcaMin > 0 ? `${tcaMin} min` : '';
    if (tcaSec > 0) timeStr += (timeStr ? ' ' : '') + `${tcaSec} sec`;
    const maneuverId = `maneuver-${idx}`;
    const isLast = idx === resData.length - 1;

    const cardDiv = document.createElement('div');
    cardDiv.className = "card danger";
    cardDiv.innerHTML = `
      <div class="card-header">
        COLLISION RISK DETECTED <span class="icon">🚨</span>
      </div>
      <div class="card-message">
        ${c.sat1} and ${c.sat2} will come within ${c.distance.toFixed(2)}km in ${timeStr || '1 sec'}.
      </div>
      <div class="card-message immediate-action">
        Immediate action needed.
      </div>
      <button class="collapse-toggle" type="button" data-target="${maneuverId}">
        Show Maneuver Suggestion ▼
      </button>
      <div class="collapse-maneuver" id="${maneuverId}">
        Recommend a velocity adjustment (Δv) of
        <b>${c.delta_v && c.delta_v[0] ? c.delta_v[0].toFixed(5) : '---'} km/s</b> to ${c.sat1}
        and <b>${c.delta_v && c.delta_v[1] ? c.delta_v[1].toFixed(5) : '---'} km/s</b> to ${c.sat2}
        to ensure safe separation.
      </div>
      <div class="card-nav-row">
        ${!isLast
          ? `<button class="next-btn" type="button">Next →</button>`
          : ``
        }
      </div>
    `;
    cardContainer.appendChild(cardDiv);

    animateCard(cardDiv);

    // Collapse logic
    cardDiv.querySelector('.collapse-toggle').addEventListener('click', function () {
      const target = document.getElementById(maneuverId);
      if (target) target.classList.toggle('open');
      this.textContent = target.classList.contains('open')
        ? 'Hide Maneuver Suggestion ▲'
        : 'Show Maneuver Suggestion ▼';
    });

    // Next logic
    const nextBtn = cardDiv.querySelector('.next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        // Card fade out
        cardDiv.style.transition = "opacity 0.4s";
        cardDiv.style.opacity = 0;
        setTimeout(() => {
          renderCard(idx + 1);
        }, 400);
      });
    }
  }

  // Start with the first card
  renderCard(0);
}

// Simple animation for cards
function animateCard(card) {
  card.style.opacity = 0;
  card.style.transform = "translateY(30px) scale(0.98)";
  setTimeout(() => {
    card.style.transition = "all 0.7s cubic-bezier(.48,1.41,.66,.97)";
    card.style.opacity = 1;
    card.style.transform = "none";
  }, 40);
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

document.addEventListener('DOMContentLoaded', function() {
  // Hide/show options panel
  const optionsBtn = document.getElementById('optionsBtn');
  if (optionsBtn) {
    optionsBtn.addEventListener('click', toggleOptionsPanel);
  }

  // Setup mode buttons
  setupModeButtons();

  // Setup threshold tooltip
  if (document.querySelector('.threshold-help')) showThresholdTooltip();

  // Set up hidden <select> for mode (for form compatibility)
  if (!document.getElementById('mode')) {
    const hiddenModeInput = document.createElement('input');
    hiddenModeInput.type = "hidden";
    hiddenModeInput.id = "mode";
    hiddenModeInput.name = "mode";
    hiddenModeInput.value = "live";
    document.getElementById('astroForm').appendChild(hiddenModeInput);
  }

  // Set up form
  const form = document.getElementById('astroForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      fetchTLE();
    });
  }
});
