# Deckster

Create flashcards. Share a link. Study anywhere.

## What is this?

Deckster is a flashcard app that lives entirely in the browser. No accounts, no
databases, no tracking. When you create a deck, the entire thing gets encoded
into the URL — so sharing a deck means sharing a link.

## Files

| File | What it does |
|------|-------------|
| `index.html` | Page structure (all four screens) |
| `style.css` | Visual design |
| `app.js` | All the logic |

## How to use

### Running locally
Double-click `index.html`. Done.

### Creating a deck
1. Click "Create a new deck"
2. Give it a title
3. Add cards one by one, or paste a bulk list (from a spreadsheet, etc.)
4. Click "Generate shareable link"
5. Copy the link and share it

### Studying a deck
- Open a deck link, or paste one into the home screen
- Flip cards by clicking/tapping
- Navigate with ← → buttons (or arrow keys on desktop)
- Mark cards as learned to track progress
- Shuffle for variety

### Bulk import format
One card per line, with front and back separated by:
- **Tab** (copy from a spreadsheet — this is the easiest)
- **Semicolon** (;)
- **Pipe** (|)

Example:
```
mitochondria; powerhouse of the cell
photosynthesis; process by which plants convert light to energy
osmosis; movement of water through a membrane
```

### Keyboard shortcuts (desktop)
- **Space** — flip card
- **← →** — previous / next
- **L** — mark as learned

## How sharing works

The deck data (title + all cards) is JSON-encoded and packed into the URL hash:

```
https://deckster.app/#deck=eyJ0aXRsZSI6Ik15IERlY2siLC...
```

This means:
- No server needed — the link IS the deck
- Works offline once loaded
- No sign-up, no cookies, no tracking
- The tradeoff: very large decks (200+ cards) create very long URLs

## Hosting

This is a static site — just HTML, CSS, and JS. Host it anywhere:
- **Netlify** (recommended, free): connect a GitHub repo
- **Vercel** (free): same idea
- **GitHub Pages** (free): push to a repo, enable Pages
- Or just send someone the folder and they double-click index.html

## What's next (future ideas)
- Scannable QR codes (needs a QR library)
- Audio pronunciation
- Spaced repetition algorithm
- Dark mode toggle
- Deck templates / examples on the home screen
- Export to CSV
