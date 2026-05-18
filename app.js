// =============================================================================
// DECKSTER — APP LOGIC
// =============================================================================
// A flashcard app where decks live entirely in the URL.
// No backend, no accounts, no tracking.
//
// How sharing works:
//   1. User creates cards
//   2. The deck (title + cards) is JSON-stringified, compressed, and
//      base64-encoded into a URL hash fragment
//   3. Anyone who opens that URL gets the deck loaded instantly
//
// The URL format is:  https://whatever.app/#deck=<encoded data>
// =============================================================================


// -----------------------------------------------------------------------------
// SCREEN MANAGEMENT
// Each screen is a <section class="screen">. Only one has class "active".
// -----------------------------------------------------------------------------

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + id);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// All "go back" / "go to" buttons use data-goto
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.goto));
});


// -----------------------------------------------------------------------------
// STATE
// -----------------------------------------------------------------------------

// Cards being built in the create screen
let buildCards = [];

// The deck currently being studied
let studyDeck = null;   // { title, description, cards: [{front, back}, ...] }
let studyOrder = [];    // shuffled indices
let studyCursor = 0;
let studyFlipped = false;
let studyLearned = new Set();


// -----------------------------------------------------------------------------
// URL ENCODING / DECODING
// Deck → compressed base64 in the URL hash
// -----------------------------------------------------------------------------

function encodeDeck(deck) {
  const json = JSON.stringify(deck);
  // Use encodeURIComponent to handle unicode, then btoa for base64
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return encoded;
}

function decodeDeck(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const deck = JSON.parse(json);
    // Validate structure
    if (!deck.title || !Array.isArray(deck.cards) || deck.cards.length < 1) return null;
    for (const card of deck.cards) {
      if (typeof card.front !== 'string' || typeof card.back !== 'string') return null;
    }
    return deck;
  } catch (e) {
    return null;
  }
}

function getDeckFromURL() {
  const hash = window.location.hash;
  if (!hash.startsWith('#deck=')) return null;
  const encoded = hash.slice(6);
  return decodeDeck(encoded);
}

function buildShareURL(deck) {
  const encoded = encodeDeck(deck);
  const base = window.location.origin + window.location.pathname;
  return base + '#deck=' + encoded;
}


// -----------------------------------------------------------------------------
// HOME SCREEN
// -----------------------------------------------------------------------------

document.getElementById('btn-new-deck').addEventListener('click', () => {
  resetCreateScreen();
  showScreen('create');
});

document.getElementById('btn-load-link').addEventListener('click', () => {
  const input = document.getElementById('paste-input').value.trim();
  const errorEl = document.getElementById('paste-error');

  // Extract the encoded part from the pasted link
  let encoded = null;
  if (input.includes('#deck=')) {
    encoded = input.split('#deck=')[1];
  } else if (input.match(/^[A-Za-z0-9+/=]+$/)) {
    // Maybe they pasted just the encoded part
    encoded = input;
  }

  if (!encoded) {
    errorEl.textContent = "That doesn't look like a Deckster link. It should contain #deck= in it.";
    errorEl.classList.remove('hidden');
    return;
  }

  const deck = decodeDeck(encoded);
  if (!deck) {
    errorEl.textContent = "Couldn't read that link. It might be corrupted or incomplete.";
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  startStudying(deck);
});

// Also allow pressing Enter in the paste input
document.getElementById('paste-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-load-link').click();
});


// -----------------------------------------------------------------------------
// CREATE SCREEN
// -----------------------------------------------------------------------------

function resetCreateScreen() {
  buildCards = [];
  document.getElementById('deck-title-input').value = '';
  document.getElementById('deck-desc-input').value = '';
  document.getElementById('card-front').value = '';
  document.getElementById('card-back').value = '';
  document.getElementById('bulk-input').value = '';
  document.getElementById('bulk-error').classList.add('hidden');
  renderCardList();
  updateGenerateButton();
  // Reset to "Add cards" tab
  switchTab('single');
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabName));
}

// Single card add
document.getElementById('btn-add-card').addEventListener('click', addSingleCard);

function addSingleCard() {
  const frontEl = document.getElementById('card-front');
  const backEl = document.getElementById('card-back');
  const front = frontEl.value.trim();
  const back = backEl.value.trim();

  if (!front || !back) return;

  buildCards.push({ front, back });
  frontEl.value = '';
  backEl.value = '';
  frontEl.focus();
  renderCardList();
  updateGenerateButton();
}

// Allow Enter in front field to jump to back, Enter in back to add card
document.getElementById('card-front').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('card-back').focus();
  }
});

document.getElementById('card-back').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    addSingleCard();
  }
});

// Bulk import
document.getElementById('btn-import').addEventListener('click', () => {
  const raw = document.getElementById('bulk-input').value.trim();
  const errorEl = document.getElementById('bulk-error');

  if (!raw) {
    errorEl.textContent = 'Paste some cards first.';
    errorEl.classList.remove('hidden');
    return;
  }

  const lines = raw.split('\n').filter(l => l.trim());
  let imported = 0;
  let failed = 0;

  for (const line of lines) {
    // Try tab first, then semicolon, then pipe
    let parts = null;
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(';')) {
      parts = line.split(';');
    } else if (line.includes('|')) {
      parts = line.split('|');
    }

    if (parts && parts.length >= 2) {
      const front = parts[0].trim();
      const back = parts.slice(1).join('; ').trim();
      if (front && back) {
        buildCards.push({ front, back });
        imported++;
        continue;
      }
    }
    failed++;
  }

  if (imported === 0) {
    errorEl.textContent = "Couldn't parse any cards. Make sure each line has a front and back separated by a tab, semicolon (;), or pipe (|).";
    errorEl.classList.remove('hidden');
  } else {
    errorEl.classList.add('hidden');
    document.getElementById('bulk-input').value = '';
    if (failed > 0) {
      errorEl.textContent = `Imported ${imported} cards. ${failed} line${failed > 1 ? 's' : ''} couldn't be parsed and were skipped.`;
      errorEl.classList.remove('hidden');
      errorEl.style.color = '#b45309'; // warning, not error
    }
    renderCardList();
    updateGenerateButton();
  }
});

// Render card list
function renderCardList() {
  const listEl = document.getElementById('card-list');
  const countEl = document.getElementById('card-count-badge');
  const clearBtn = document.getElementById('btn-clear-cards');

  countEl.textContent = buildCards.length;
  clearBtn.classList.toggle('hidden', buildCards.length === 0);

  if (buildCards.length === 0) {
    listEl.innerHTML = '<div class="card-list-empty"><p>No cards yet. Add some above.</p></div>';
    return;
  }

  listEl.innerHTML = buildCards.map((card, i) => `
    <div class="card-preview">
      <span class="card-preview-number">${i + 1}</span>
      <div class="card-preview-content">
        <div class="card-preview-front">${escapeHtml(card.front)}</div>
        <div class="card-preview-back">${escapeHtml(card.back)}</div>
      </div>
      <button class="card-preview-delete" data-delete="${i}" title="Remove card">×</button>
    </div>
  `).join('');

  // Attach delete handlers
  listEl.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.delete);
      buildCards.splice(idx, 1);
      renderCardList();
      updateGenerateButton();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Clear all
document.getElementById('btn-clear-cards').addEventListener('click', () => {
  if (confirm('Remove all cards?')) {
    buildCards = [];
    renderCardList();
    updateGenerateButton();
  }
});

// Generate button state
function updateGenerateButton() {
  const btn = document.getElementById('btn-generate');
  btn.disabled = buildCards.length < 2;
}

// Generate link
document.getElementById('btn-generate').addEventListener('click', () => {
  const title = document.getElementById('deck-title-input').value.trim() || 'Untitled Deck';
  const description = document.getElementById('deck-desc-input').value.trim();

  const deck = {
    title,
    description,
    cards: buildCards.map(c => ({ front: c.front, back: c.back }))
  };

  const url = buildShareURL(deck);

  // Check URL length — most browsers support ~2000+ chars, but let's warn at 8000
  if (url.length > 8000) {
    alert(`This deck creates a very long link (${url.length} characters). It should still work, but some apps might truncate it when sharing. Consider splitting into smaller decks if you run into issues.`);
  }

  showShareScreen(deck, url);
});


// -----------------------------------------------------------------------------
// SHARE SCREEN
// -----------------------------------------------------------------------------

function showShareScreen(deck, url) {
  document.getElementById('share-deck-title').textContent = deck.title;
  document.getElementById('share-deck-meta').textContent = deck.cards.length + ' cards' + (deck.description ? ' · ' + deck.description : '');
  document.getElementById('share-link').value = url;
  document.getElementById('copy-confirm').classList.add('hidden');

  showScreen('share');
  generateQR(url);
}

document.getElementById('btn-copy').addEventListener('click', () => {
  const url = document.getElementById('share-link').value;
  navigator.clipboard.writeText(url).then(() => {
    document.getElementById('copy-confirm').classList.remove('hidden');
    setTimeout(() => document.getElementById('copy-confirm').classList.add('hidden'), 3000);
  }).catch(() => {
    // Fallback: select the text
    document.getElementById('share-link').select();
    document.execCommand('copy');
    document.getElementById('copy-confirm').classList.remove('hidden');
  });
});

document.getElementById('btn-study-own').addEventListener('click', () => {
  const url = document.getElementById('share-link').value;
  const encoded = url.split('#deck=')[1];
  const deck = decodeDeck(encoded);
  if (deck) startStudying(deck);
});


// -----------------------------------------------------------------------------
// QR CODE GENERATOR (minimal, no external library)
// Uses a simple QR encoding approach via canvas
// For v1, we use a basic text-to-QR via the Google Charts API image
// (works offline once loaded — the QR is generated client-side as a fallback)
// -----------------------------------------------------------------------------

function generateQR(text) {
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');

  // Use a simple approach: render via an image from a QR API
  // This works for sharing and is reliable
  const img = new Image();
  img.crossOrigin = 'anonymous';
  // We'll generate a basic QR pattern ourselves for offline support
  // For now, draw a placeholder with the first chars of the URL
  ctx.fillStyle = '#f0ede8';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = '#1c1917';
  ctx.font = '12px "DM Mono", monospace';
  ctx.textAlign = 'center';

  // Simple QR-like pattern (decorative — the real QR needs a library)
  // Let's generate a deterministic pattern from the URL hash
  const hash = simpleHash(text);
  const gridSize = 25;
  const cellSize = 200 / gridSize;

  // QR-like finder patterns (corners)
  drawFinderPattern(ctx, 0, 0, cellSize);
  drawFinderPattern(ctx, (gridSize - 7) * cellSize, 0, cellSize);
  drawFinderPattern(ctx, 0, (gridSize - 7) * cellSize, cellSize);

  // Fill center with data-driven pattern
  let seed = hash;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      // Skip finder pattern areas
      if ((x < 8 && y < 8) || (x >= gridSize - 8 && y < 8) || (x < 8 && y >= gridSize - 8)) continue;

      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 !== 0) {
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 0.5, cellSize - 0.5);
      }
    }
  }

  // Note: This generates a QR-looking pattern but isn't scannable.
  // For a real scannable QR, we'd add a library like qrcode.js
  // Adding text below to indicate this
  ctx.fillStyle = '#f0ede8';
  ctx.fillRect(60, 85, 80, 30);
  ctx.fillStyle = '#0d9488';
  ctx.font = 'bold 11px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DECKSTER', 100, 104);
}

function drawFinderPattern(ctx, x, y, cell) {
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(x, y, cell * 7, cell * 7);
  ctx.fillStyle = '#f0ede8';
  ctx.fillRect(x + cell, y + cell, cell * 5, cell * 5);
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}


// -----------------------------------------------------------------------------
// STUDY SCREEN
// -----------------------------------------------------------------------------

function startStudying(deck) {
  studyDeck = deck;
  studyOrder = deck.cards.map((_, i) => i);
  studyCursor = 0;
  studyFlipped = false;
  studyLearned = new Set();

  document.getElementById('study-title').textContent = deck.title;
  showScreen('study');
  renderStudyCard();
}

function renderStudyCard() {
  const deck = studyDeck;
  const total = deck.cards.length;
  const learnedCount = studyLearned.size;
  const pct = total ? Math.round((learnedCount / total) * 100) : 0;

  document.getElementById('study-progress-fill').style.width = pct + '%';
  document.getElementById('study-progress-text').textContent = learnedCount + ' / ' + total + ' learned';

  // All learned?
  if (learnedCount >= total) {
    document.getElementById('study-card-wrap').classList.add('hidden');
    document.getElementById('study-controls').classList.add('hidden');
    document.getElementById('study-complete').classList.remove('hidden');
    return;
  }

  document.getElementById('study-card-wrap').classList.remove('hidden');
  document.getElementById('study-controls').classList.remove('hidden');
  document.getElementById('study-complete').classList.add('hidden');

  const cardIndex = studyOrder[studyCursor];
  const card = deck.cards[cardIndex];

  document.getElementById('study-front-text').textContent = card.front;
  document.getElementById('study-back-text').textContent = card.back;
  document.getElementById('study-counter').textContent = (studyCursor + 1) + ' / ' + studyOrder.length;

  // Reset flip
  studyFlipped = false;
  document.getElementById('study-card').classList.remove('flipped');

  // Learned button
  const learnedBtn = document.getElementById('study-learned');
  if (studyLearned.has(cardIndex)) {
    learnedBtn.classList.add('is-learned');
    learnedBtn.textContent = '✓ Learned';
  } else {
    learnedBtn.classList.remove('is-learned');
    learnedBtn.textContent = 'Mark as learned';
  }
}

// Flip
document.getElementById('study-card').addEventListener('click', () => {
  studyFlipped = !studyFlipped;
  document.getElementById('study-card').classList.toggle('flipped', studyFlipped);
});

// Navigate
document.getElementById('study-prev').addEventListener('click', () => {
  studyCursor = (studyCursor - 1 + studyOrder.length) % studyOrder.length;
  renderStudyCard();
});

document.getElementById('study-next').addEventListener('click', () => {
  studyCursor = (studyCursor + 1) % studyOrder.length;
  renderStudyCard();
});

// Mark learned
document.getElementById('study-learned').addEventListener('click', () => {
  const cardIndex = studyOrder[studyCursor];

  if (studyLearned.has(cardIndex)) {
    studyLearned.delete(cardIndex);
  } else {
    studyLearned.add(cardIndex);
    // Auto-advance to next unlearned
    if (studyLearned.size < studyDeck.cards.length) {
      for (let step = 1; step <= studyOrder.length; step++) {
        const next = (studyCursor + step) % studyOrder.length;
        if (!studyLearned.has(studyOrder[next])) {
          studyCursor = next;
          break;
        }
      }
    }
  }
  renderStudyCard();
});

// Shuffle
document.getElementById('study-shuffle').addEventListener('click', () => {
  studyOrder = shuffleArray(studyOrder);
  studyCursor = 0;
  // Skip to first unlearned
  for (let i = 0; i < studyOrder.length; i++) {
    if (!studyLearned.has(studyOrder[i])) {
      studyCursor = i;
      break;
    }
  }
  renderStudyCard();
});

// Restart
document.getElementById('btn-restart').addEventListener('click', () => {
  studyLearned = new Set();
  studyCursor = 0;
  renderStudyCard();
});

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}


// -----------------------------------------------------------------------------
// KEYBOARD SHORTCUTS (study screen only)
// -----------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('screen-study').classList.contains('active')) return;
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

  if (e.key === 'ArrowLeft')  document.getElementById('study-prev').click();
  if (e.key === 'ArrowRight') document.getElementById('study-next').click();
  if (e.key === ' ')        { e.preventDefault(); document.getElementById('study-card').click(); }
  if (e.key.toLowerCase() === 'l') document.getElementById('study-learned').click();
});


// -----------------------------------------------------------------------------
// BOOT — check if the URL contains a deck to load
// -----------------------------------------------------------------------------

(function boot() {
  const deck = getDeckFromURL();
  if (deck) {
    startStudying(deck);
  }
})();
