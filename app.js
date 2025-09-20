// Music Bingo v8 — clickable preview option; yout-ube -> youtube at runtime
const els = {
  csvFile: document.getElementById('csvFile'),
  loadSample: document.getElementById('loadSample'),
  csvText: document.getElementById('csvText'),
  parseCsv: document.getElementById('parseCsv'),
  downloadCsv: document.getElementById('downloadCsv'),
  songCount: document.getElementById('songCount'),
  minInfo: document.getElementById('minInfo'),
  liveCounter: document.getElementById('liveCounter'),
  reqCount: document.getElementById('reqCount'),
  progressBar: document.getElementById('progressBar'),
  boardSize: document.getElementById('boardSize'),
  freeCenter: document.getElementById('freeCenter'),
  cardCount: document.getElementById('cardCount'),
  cardTitle: document.getElementById('cardTitle'),
  winRule: document.getElementById('winRule'),
  generateCards: document.getElementById('generateCards'),
  printCards: document.getElementById('printCards'),
  cardStatus: document.getElementById('cardStatus'),
  printArea: document.getElementById('printArea'),
  startGame: document.getElementById('startGame'),
  drawNext: document.getElementById('drawNext'),
  nowPlaying: document.getElementById('nowPlaying'),
  drawnCount: document.getElementById('drawnCount'),
  remainingCount: document.getElementById('remainingCount'),
  drawnList: document.getElementById('drawnList'),
  remainingList: document.getElementById('remainingList'),
  ruleLabel: document.getElementById('ruleLabel'),
  checkCardId: document.getElementById('checkCardId'),
  checkCardBtn: document.getElementById('checkCardBtn'),
  checkResult: document.getElementById('checkResult'),
  // settings
  logoUpload: document.getElementById('logoUpload'),
  logoUrl: document.getElementById('logoUrl'),
  logoImg: document.getElementById('logoImg'),
  accentColor: document.getElementById('accentColor'),
  clickablePreview: document.getElementById('clickablePreview'),
};

let SONGS = []; // {title, artist, preview_url?, key}
let DRAW_ORDER = [];
let DRAWN_KEYS = new Set();
let CARDS = []; // [{id, size, cells: [songKey|null], freeCenter}]

function setAccent(color){
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('MB_ACCENT', color);
}
function setLogo(src){
  if (src){
    els.logoImg.src = src;
    els.logoImg.style.display = 'block';
    localStorage.setItem('MB_LOGO_SRC', src);
  } else {
    els.logoImg.removeAttribute('src');
    els.logoImg.style.display = 'none';
    localStorage.removeItem('MB_LOGO_SRC');
  }
}
els.accentColor.addEventListener('input', (e)=> setAccent(e.target.value));
els.logoUrl.addEventListener('change', (e)=> setLogo(e.target.value.trim()));
els.logoUpload.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ()=> setLogo(reader.result);
  reader.readAsDataURL(file);
});

els.clickablePreview.addEventListener('change', ()=>{
  localStorage.setItem('MB_CLICKABLE', els.clickablePreview.checked ? '1' : '0');
});

function sanitizeUrl(u){
  if (!u) return u;
  return u.replace(/youtube/gi, 'yout-ube');
}

function playbackUrl(u){
  if (!u) return '';
  // If clickable toggle is ON, convert yout-ube -> youtube for href
  if (els.clickablePreview.checked) return u.replace(/yout-ube/gi, 'youtube');
  return ''; // return empty to hide link when off
}

function csvToRows(csv) {
  return csv
    .split(/\r?\n/)
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => r.split(',').map(c => c.trim()));
}

function toCsv(rows){
  return rows.map(r => r.map(x => {
    const s = String(x ?? '');
    return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',')).join('\n');
}

function parseSongs(csv) {
  const rows = csvToRows(csv);
  if (!rows.length) return [];
  const header = rows[0].map(h => h.toLowerCase());
  const idxTitle = header.indexOf('title');
  const idxArtist = header.indexOf('artist');
  const idxPrev = header.indexOf('preview_url');
  const out = [];
  for (let i=1;i<rows.length;i++) {
    const r = rows[i];
    const title = idxTitle>=0 ? r[idxTitle] : r[0];
    const artist = idxArtist>=0 ? r[idxArtist] : '';
    let preview_url = idxPrev>=0 ? r[idxPrev] : '';
    if (!title) continue;
    if (preview_url) preview_url = sanitizeUrl(preview_url);
    out.push({title, artist, preview_url, key: `${title} — ${artist}`.trim()});
  }
  return out;
}

function exportSanitizedCsv(){
  if (!SONGS.length) return;
  const rows = [['title','artist','preview_url']];
  SONGS.forEach(s => rows.push([s.title, s.artist, s.preview_url || '']));
  const csv = toCsv(rows);
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'songs_sanitized.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

function requiredByBoard(){
  const size = parseInt(els.boardSize.value,10);
  return size===5 ? 75 : 50;
}

function updateLiveCounter(){
  const have = SONGS.length;
  const need = requiredByBoard();
  const pct = Math.max(0, Math.min(100, Math.round((have/need)*100)));
  els.reqCount.textContent = String(need);
  els.liveCounter.querySelector('strong').textContent = String(have);
  els.liveCounter.classList.remove('good','warn','bad');
  if (have >= need) els.liveCounter.classList.add('good');
  else if (have >= Math.ceil(need*0.6)) els.liveCounter.classList.add('warn');
  else els.liveCounter.classList.add('bad');
  els.progressBar.style.width = pct + '%';
}

function updateSongCount() {
  els.songCount.textContent = `${SONGS.length} songs geladen`;
  els.downloadCsv.disabled = SONGS.length === 0;
  updateMinInfo();
  updateLiveCounter();
}

function updateMinInfo(){
  const size = parseInt(els.boardSize.value,10);
  const needMin = requiredByBoard();
  els.minInfo.textContent = `Minimum voor ${size}×${size}: ${needMin} songs (klassieke bingo).`;
}

async function readFileAsText(file) {
  return new Promise((res,rej)=>{
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsText(file);
  });
}

els.loadSample.addEventListener('click', async ()=>{
  const sample = `title,artist,preview_url
Dancing Queen,ABBA,https://www.youtube.com/watch?v=xFrGuyw1V8s
Livin' on a Prayer,Bon Jovi,https://www.youtube.com/watch?v=lDK9QqIzhwk
Shape of You,Ed Sheeran,https://www.youtube.com/watch?v=JGwWNGJdvx8
Uptown Funk,Mark Ronson ft. Bruno Mars,https://www.youtube.com/watch?v=OPf0YbXqDm0
Bohemian Rhapsody,Queen,https://www.youtube.com/watch?v=fJ9rUzIMcZQ`;
  els.csvText.value = sample;
});

els.parseCsv.addEventListener('click', async ()=>{
  let txt = els.csvText.value.trim();
  if (!txt && els.csvFile.files[0]) {
    txt = await readFileAsText(els.csvFile.files[0]);
  }
  if (!txt) {
    alert('Geef een CSV of plak tekst.');
    return;
  }
  SONGS = parseSongs(txt);
  if (SONGS.length === 0) {
    alert('Geen songs gevonden. Zorg voor minstens een "title" kolom.');
    return;
  }
  updateSongCount();
  localStorage.setItem('MB_SONGS', JSON.stringify(SONGS));
});

els.downloadCsv.addEventListener('click', exportSanitizedCsv);

function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function generateCards(){
  const size = parseInt(els.boardSize.value,10);
  const need = parseInt(els.cardCount.value,10);
  const freeCenter = els.freeCenter.checked && size===5;
  const minSongs = (size===5) ? 75 : 50;
  if (SONGS.length < minSongs){
    alert(`Voor een ${size}×${size} bingo heb je minstens ${minSongs} unieke songs nodig (klassieke regel). Je hebt nu ${SONGS.length}.`);
    return;
  }

  const cellsPerCard = size*size - (freeCenter?1:0);
  if (SONGS.length < cellsPerCard) {
    alert(`Je hebt minstens ${cellsPerCard} songs nodig voor een ${size}×${size} bord.`);
    return;
  }

  CARDS = [];
  const usedSets = new Set();
  for (let n=0; n<need; n++){
    const pool = shuffle(SONGS);
    const picks = pool.slice(0, cellsPerCard).map(s => s.key);
    const fingerprint = picks.slice().sort().join('|');
    if (usedSets.has(fingerprint)) { n--; continue; }
    usedSets.add(fingerprint);
    const id = `C-${String(n+1).padStart(4,'0')}`;
    CARDS.push({id, size, cells: picks, freeCenter});
  }
  renderCards();
  els.cardStatus.textContent = `Gegenereerd: ${CARDS.length} unieke kaarten.`;
  els.printCards.disabled = CARDS.length===0;
  localStorage.setItem('MB_CARDS', JSON.stringify(CARDS));
  localStorage.setItem('MB_CARD_TITLE', els.cardTitle.value);
  localStorage.setItem('MB_BOARD_SIZE', size);
  markCards();
}

function chunk(arr, n){
  const out = [];
  for (let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n));
  return out;
}

function renderCards(){
  const title = els.cardTitle.value || 'MUSIC BINGO';
  const container = els.printArea;
  container.innerHTML = '';
  const perSheet = 2;
  const sheets = chunk(CARDS, perSheet);
  sheets.forEach((cards)=>{
    const sheet = document.createElement('div');
    sheet.className = 'card-sheet';
    cards.forEach(card => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <div class="card-header">${escapeHtml(title)}</div>
        <div class="meta"><span>ID: ${card.id}</span><span>Grid: ${card.size}×${card.size}</span></div>
        <div class="board size-${card.size}"></div>`;
      const board = el.querySelector('.board');
      const size = card.size;
      const freeCenter = card.freeCenter;
      const cells = card.cells.slice();
      let cellIdx = 0;
      for (let r=0; r<size; r++){
        for (let c=0; c<size; c++){
          const mid = Math.floor(size/2);
          const isCenter = freeCenter && r===mid && c===mid;
          const cell = document.createElement('div');
          cell.className = 'tile';
          if (isCenter){
            cell.innerHTML = '<div class="free">FREE</div>';
            cell.dataset.key = '__FREE__';
          } else {
            const key = cells[cellIdx++];
            const song = SONGS.find(s => s.key === key);
            const text = song ? (song.title + (song.artist? ' — ' + song.artist : '')) : key;
            cell.innerHTML = `<div class="small">${escapeHtml(text)}</div>`;
            cell.dataset.key = key;
          }
          board.appendChild(cell);
        }
      }
      sheet.appendChild(el);
    });
    container.appendChild(sheet);
  });
  updateRuleLabel();
}

function updateRuleLabel(){
  if (!els.ruleLabel) return;
  const map = {
    line: 'Lijn (rij/kolom/diagonaal)',
    corners: 'Vier hoeken',
    cross: 'Kruis (X)',
    full: 'Volle kaart'
  };
  els.ruleLabel.textContent = map[els.winRule.value] || 'Lijn (rij/kolom/diagonaal)';
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

// Auto-marking of tiles based on DRAWN_KEYS
function markCards(){
  const tiles = document.querySelectorAll('.tile');
  tiles.forEach(t => {
    const key = t.dataset.key;
    const mark = (key === '__FREE__') || (key && DRAWN_KEYS.has(key));
    t.classList.toggle('marked', !!mark);
  });
}

// Printing
els.printCards.addEventListener('click', ()=>{
  if (!CARDS.length) return;
  window.print();
});

els.generateCards.addEventListener('click', generateCards);
els.winRule.addEventListener('change', ()=>{
  updateRuleLabel();
});

els.boardSize.addEventListener('change', ()=>{
  updateMinInfo();
  updateLiveCounter();
});

// Host / Caller
els.startGame.addEventListener('click', ()=>{
  if (!SONGS.length){
    alert('Laad eerst songs.');
    return;
  }
  const size = parseInt(els.boardSize.value,10);
  const minSongs = (size===5) ? 75 : 50;
  if (SONGS.length < minSongs){
    alert(`Voor een ${size}×${size} bingo heb je minstens ${minSongs} unieke songs nodig (klassieke regel). Je hebt nu ${SONGS.length}.`);
    return;
  }

  const order = shuffle(SONGS.map(s => s.key));
  DRAW_ORDER = order;
  DRAWN_KEYS = new Set();
  els.drawNext.disabled = false;
  renderHost();
  els.nowPlaying.innerHTML = '<em>Ready. Klik “Trek volgend liedje”.</em>';
  saveState();
  markCards();
});

els.drawNext.addEventListener('click', ()=>{
  if (!DRAW_ORDER.length){
    els.drawNext.disabled = true;
    return;
  }
  const next = DRAW_ORDER.shift();
  DRAWN_KEYS.add(next);
  renderHost(next);
  saveState();
  markCards();
});

function renderHost(nowKey){
  const drawn = Array.from(DRAWN_KEYS);
  const remaining = DRAW_ORDER.slice();
  els.drawnCount.textContent = String(drawn.length);
  els.remainingCount.textContent = String(remaining.length);
  els.drawnList.innerHTML = '';
  els.remainingList.innerHTML = '';

  drawn.forEach(key => {
    const li = document.createElement('li');
    const s = SONGS.find(s => s.key===key);
    const t = s ? `${s.title}${s.artist? ' — ' + s.artist : ''}` : key;
    li.textContent = t;
    els.drawnList.appendChild(li);
  });
  remaining.forEach(key => {
    const li = document.createElement('li');
    const s = SONGS.find(s => s.key===key);
    const t = s ? `${s.title}${s.artist? ' — ' + s.artist : ''}` : key;
    li.textContent = t;
    els.remainingList.appendChild(li);
  });

  if (nowKey){
    const s = SONGS.find(x => x.key===nowKey);
    const title = s ? `${s.title}${s.artist? ' — ' + s.artist : ''}` : nowKey;
    let openBtn = '';
    if (s && s.preview_url){
      const href = playbackUrl(s.preview_url);
      if (href){
        openBtn = `<a target="_blank" rel="noopener" href="${escapeHtml(href)}">Open preview</a>`;
      }
    }
    els.nowPlaying.innerHTML = `<strong>Now:</strong> ${escapeHtml(title)} ${openBtn? ' • ' + openBtn : ''}`;
  }
}

// Rule-based checker
function evaluateCard(card, drawnKeysSet){
  const size = card.size;
  const freeCenter = card.freeCenter;
  const board = Array(size * size).fill(null);
  let idx = 0;
  for (let i=0;i<board.length;i++){
    const r = Math.floor(i/size), c = i%size;
    const mid = Math.floor(size/2);
    const isCenter = freeCenter && r===mid && c===mid;
    if (isCenter){
      board[i] = '__FREE__';
    } else {
      board[i] = card.cells[idx++];
    }
  }
  const marked = board.map(k => k==='__FREE__' ? true : drawnKeysSet.has(k));

  const rule = els.winRule.value || 'line';

  function hasAnyLine(){
    for (let r=0;r<size;r++){
      let ok = true;
      for (let c=0;c<size;c++) ok = ok && marked[r*size+c];
      if (ok) return true;
    }
    for (let c=0;c<size;c++){
      let ok = true;
      for (let r=0;r<size;r++) ok = ok && marked[r*size+c];
      if (ok) return true;
    }
    let ok1 = true, ok2 = true;
    for (let i=0;i<size;i++){
      ok1 = ok1 && marked[i*size+i];
      ok2 = ok2 && marked[i*size+(size-1-i)];
    }
    return ok1 || ok2;
  }

  function hasCorners(){
    const last = size-1;
    return marked[0] && marked[last] && marked[last*size] && marked[last*size+last];
  }

  function hasCross(){
    let ok1 = true, ok2 = true;
    for (let i=0;i<size;i++){
      ok1 = ok1 && marked[i*size+i];
      ok2 = ok2 && marked[i*size+(size-1-i)];
    }
    return ok1 && ok2;
  }

  function isFull(){
    return marked.every(Boolean);
  }

  switch(rule){
    case 'corners': return hasCorners();
    case 'cross': return hasCross();
    case 'full': return isFull();
    case 'line':
    default: return hasAnyLine();
  }
}

els.checkCardBtn.addEventListener('click', ()=>{
  const id = els.checkCardId.value.trim();
  const card = CARDS.find(c => c.id.toLowerCase() === id.toLowerCase());
  if (!card) { els.checkResult.textContent = 'Kaart niet gevonden in deze sessie.'; return; }
  const ok = evaluateCard(card, DRAWN_KEYS);
  const map = { line:'Lijn', corners:'Vier hoeken', cross:'Kruis (X)', full:'Volle kaart' };
  els.checkResult.textContent = ok ? `✅ BINGO! (${map[els.winRule.value]||'Lijn'})`
                                   : `❌ Nog geen bingo. (${map[els.winRule.value]||'Lijn'})`;
});

// Persist basics
function saveState(){
  localStorage.setItem('MB_DRAW_ORDER', JSON.stringify(DRAW_ORDER));
  localStorage.setItem('MB_DRAWN', JSON.stringify(Array.from(DRAWN_KEYS)));
  localStorage.setItem('MB_WIN_RULE', els.winRule.value);
  localStorage.setItem('MB_BOARD_SIZE', els.boardSize.value);
  localStorage.setItem('MB_SONGS_COUNT', SONGS.length);
  localStorage.setItem('MB_CLICKABLE', els.clickablePreview.checked ? '1' : '0');
}

function loadState(){
  try{
    const s = localStorage.getItem('MB_SONGS');
    if (s) SONGS = JSON.parse(s);
    const cards = localStorage.getItem('MB_CARDS');
    if (cards) CARDS = JSON.parse(cards);
    const title = localStorage.getItem('MB_CARD_TITLE');
    if (title) els.cardTitle.value = title;
    const order = localStorage.getItem('MB_DRAW_ORDER');
    const drawn = localStorage.getItem('MB_DRAWN');
    const rule = localStorage.getItem('MB_WIN_RULE');
    const bs = localStorage.getItem('MB_BOARD_SIZE');
    const accent = localStorage.getItem('MB_ACCENT');
    const logoSrc = localStorage.getItem('MB_LOGO_SRC');
    const clickable = localStorage.getItem('MB_CLICKABLE');
    if (order) DRAW_ORDER = JSON.parse(order);
    if (drawn) DRAWN_KEYS = new Set(JSON.parse(drawn));
    if (rule) els.winRule.value = rule;
    if (bs) els.boardSize.value = bs;
    if (accent) { els.accentColor.value = accent; setAccent(accent); }
    if (logoSrc) { setLogo(logoSrc); }
    if (clickable) els.clickablePreview.checked = (clickable === '1');
    updateSongCount();
    if (CARDS.length) { renderCards(); els.printCards.disabled = false; markCards(); }
    if (SONGS.length && (DRAW_ORDER.length || DRAWN_KEYS.size)){
      renderHost();
      els.drawNext.disabled = false;
    }
    updateRuleLabel();
    updateMinInfo();
    updateLiveCounter();
  }catch(e){ console.warn('Failed to restore state', e); }
}

loadState();
