// 設定：シンボル、出現重み、配当
const SYMBOLS = [
  { emoji: '日', weight: 2, payout: 50, icon: 'sun.svg' },
  { emoji: '水', weight: 4, payout: 25, icon: 'mercury.svg' },
  { emoji: '金', weight: 7, payout: 15, icon: 'venus.svg' },
  { emoji: '地', weight: 8, payout: 12, icon: 'earth.svg' },
  { emoji: '月', weight: 10, payout: 10, icon: 'moon.svg' },
  { emoji: '火', weight: 12, payout: 8, icon: 'mars.svg' },
  { emoji: '木', weight: 16, payout: 6, icon: 'jupiter.svg' },
  { emoji: '土', weight: 20, payout: 5, icon: 'saturn.svg' }
];

// 状態
let credit = 20.0;
let spinning = false;
let stopIndex = 0;
let finalSyms = [];
let finals = [];

// 要素取得
const $credit = document.getElementById('credit');
const $bet = document.getElementById('bet');
const $spin = document.getElementById('spin');
const $reset = document.getElementById('reset');
const $msg = document.getElementById('msg');
const $last = document.getElementById('last');
const reels = [0,1,2].map(i => document.getElementById('reel' + i));

// 初期表示
updateCredit(0);

// ユーティリティ：重み付き乱数抽選
function pickWeighted() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    if ((r -= sym.weight) < 0) return sym;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

// メッセージ表示
function setMessage(text, tone = '') {
  $msg.textContent = text;
  $msg.classList.remove('good', 'bad');
  if (tone) $msg.classList.add(tone);
}

// クレジット更新（差分）
function updateCredit(delta) {
  delta = Number(delta);
  delta = Math.round(delta * 10) / 10;
  credit += delta;
  $credit.textContent = credit.toFixed(1);
}

// リールのローリング演出
function rollReel($reel, finalEmoji) {
  return new Promise(resolve => {
    $reel.classList.add('rolling');
    const $cell = $reel.querySelector('.cell');
    let alive = true;

    const tick = () => {
      if (!alive) return;
      /*
      const rand = SYMBOLS[(Math.random() * SYMBOLS.length) | 0].emoji;
      $cell.textContent = rand;
      /*/
      const randSym = SYMBOLS[(Math.random() * SYMBOLS.length) | 0];
      $cell.innerHTML = `<img src="./imgs/${randSym.icon}" alt="${randSym.emoji}" width="64" height="64">`;
      //*/
      requestAnimationFrame(() => setTimeout(tick, 60));
    };
    tick();

    $reel.stop = () => {
      alive = false;
      /*
      $cell.textContent = finalEmoji;
      /*/
      const finalSym = SYMBOLS.find(s => s.emoji === finalEmoji);
      $cell.innerHTML = `<img src="./imgs/${finalSym.icon}" alt="${finalSym.emoji}" width="64" height="64">`;
      //*/
      $reel.classList.remove('rolling');
      resolve();
    };
  });
}

// 当たり判定
function evaluate(resultEmojis, bet) {
  const counts = {};
  for (const e of resultEmojis) {
    counts[e] = (counts[e] || 0) + 1;
  }

  let is3inRow = false;
  let is2inRow = false;
  let isMoon = false;
  let matchedPayout = 0;

  for (const sym of SYMBOLS) {
    if (counts[sym.emoji] === 3) {
      is3inRow = true;
      matchedPayout = sym.payout;
      break;
    }
  }

  if (!is3inRow) {
    for (const sym of SYMBOLS) {
      if (counts[sym.emoji] === 2) {
        is2inRow = true;
        matchedPayout = sym.payout / 5;
        break;
      }
    }
  }

  if ((counts['月'] || 0) >= 1) {
    isMoon = true;
  }

  const bonusR = matchedPayout;
  const bonusM = isMoon ? 1.5 : 0;

  if (bonusR > 0 && bonusR >= bonusM) {
    return {
      win: bet * bonusR,
      label: is3inRow ? `3つ揃い! x${bonusR}` : `2つ揃い! x${bonusR}`
    };
  } else if (bonusM > 0) {
    return {
      win: bet * bonusM,
      label: `月が1つ! x${bonusM}`
    };
  } else {
    return {
      win: 0,
      label: 'はずれ'
    };
  }
}

// 効果音
function beep(type = 'ok') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'square';
    const now = ctx.currentTime;
    if (type === 'ok') o.frequency.setValueAtTime(880, now);
    if (type === 'bad') o.frequency.setValueAtTime(220, now);
    if (type === 'good') o.frequency.setValueAtTime(1320, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o.start(now); o.stop(now + 0.14);
  } catch {}
}

// SPINボタン処理
$spin.addEventListener('click', async () => {
  if (!spinning) {
    let betInput = $bet.value;
    let bet = betInput === "all" ? credit : parseFloat(betInput);
    if (isNaN(bet) || credit < bet || bet <= 0) {
      setMessage('エネルギーが足りません。', 'bad');
      beep('bad');
      return;
    }

    spinning = true;
    stopIndex = 0;
    $spin.textContent = 'STOP';
    setMessage('回転中…');
    updateCredit(-bet);

    finalSyms = [pickWeighted(), pickWeighted(), pickWeighted()];
    finals = finalSyms.map(s => s.emoji);

    await Promise.all([
      rollReel(reels[0], finals[0]),
      rollReel(reels[1], finals[1]),
      rollReel(reels[2], finals[2])
    ]);
  } else {
    if (stopIndex < reels.length) {
      reels[stopIndex].stop();
      stopIndex++;
      if (stopIndex === reels.length) {
        finishSpin();
      }
    }
  }
});

// Enterキー対応
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $spin.click();
});

// スピン終了処理
function finishSpin() {
  const result = evaluate(finals, parseFloat($bet.value === "all" ? credit : $bet.value));
  /*
  $last.textContent = finals.join(' ');
  /*/
  $last.innerHTML = '';
  for (let i = 0; i < finals.length; i++) {
    const finalSym = SYMBOLS.find(s => s.emoji === finals[i]);
    $last.innerHTML += `<img src="./imgs/${finalSym.icon}" alt="${finalSym.emoji}" width="64" height="64">`;
  }
  //*/
  if (result.win > 0) {
    result.win = Math.floor(result.win * 10) / 10;
    updateCredit(result.win);
    setMessage(`当たり！ ${result.label} | +${result.win}`, 'good');
    beep('good');
  } else {
    setMessage('残念！ また挑戦しよう。', 'bad');
    beep('bad');
  }
  spinning = false;
  $spin.textContent = 'SPIN';
}

// リセット
$reset.addEventListener('click', () => {
  if (spinning) return;
  credit = 20;
  updateCredit(0);
  setMessage('エネルギーを20にリセットしました。');
  beep('ok');
});


/*
// 以下、絵文字をアイコンに置換するスクリプト
// SVGタグ生成
function createIcon(emoji) {
  const sym = SYMBOLS.find(s => s.emoji === emoji);
  if (!sym) return null;
  const img = document.createElement('img');
  img.src = `./imgs/${sym.icon}`;
  img.alt = emoji;
  img.width = 32;
  img.height = 32;
  return img;
}

// テキストノードを走査して置換
function walkAndReplace(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    const parent = node.parentNode;
    let replaced = false;

    SYMBOLS.forEach(sym => {
      if (text.includes(sym.emoji)) {
        const parts = text.split(sym.emoji);
        for (let i = 0; i < parts.length; i++) {
          parent.insertBefore(document.createTextNode(parts[i]), node);
          if (i < parts.length - 1) {
            const icon = createIcon(sym.emoji);
            if (icon) parent.insertBefore(icon, node);
          }
        }
        replaced = true;
      }
    });

    if (replaced) parent.removeChild(node);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    for (const child of Array.from(node.childNodes)) {
      walkAndReplace(child);
    }
  }
}

// ページ全体を走査して置換
walkAndReplace(document.body);
*/
