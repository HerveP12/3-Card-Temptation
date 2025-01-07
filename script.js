/*********************************************
 * GLOBAL VARIABLES & SETUP
 *********************************************/
let playerBalance = 10000;
let totalBetArray = [];
let gameActive = false;

// Dealing
let deck = [];
let dealerCards = [];
let playerCards = [];
let currentDealerReveal = 2;

// Toggle to see logs for debugging
const DEBUG_LOGGING = false;

/*********************************************
 * PAGE LOAD SETUP
 *********************************************/
window.onload = () => {
  updateBalanceDisplay();
  attachChipClickHandlers();
};

/*********************************************
 * UTILITY / DISPLAY FUNCTIONS
 *********************************************/
function updateBalanceDisplay() {
  document.getElementById(
    "balance"
  ).innerText = `$${playerBalance.toLocaleString()}`;
}

function toggleGameInfo() {
  const rulesSection = document.getElementById("rules-and-paytable");
  if (rulesSection.style.display === "none") {
    rulesSection.style.display = "block";
  } else {
    rulesSection.style.display = "none";
  }
}

function debugLog(...args) {
  if (DEBUG_LOGGING) console.log(...args);
}

/*********************************************
 * CHIP HANDLING
 *********************************************/
function attachChipClickHandlers() {
  const allChips = document.querySelectorAll(".casino-chip");
  allChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      handleChipClick(chip);
    });
  });
}

function handleChipClick(chipElement) {
  if (gameActive) {
    document.getElementById("result").innerText =
      "Cannot add chips once the round has started.";
    return;
  }

  const chipValue = parseInt(chipElement.getAttribute("data-value"));
  const totalCost = chipValue * 4; // must place same bet on circles 2,3,4,5

  if (playerBalance < totalCost) {
    document.getElementById("result").innerText =
      "Not enough balance to place that chip on all circles.";
    return;
  }

  // Deduct from player's balance
  playerBalance -= totalCost;
  updateBalanceDisplay();
  document.getElementById("result").innerText = "";

  // Track this chip in totalBetArray
  totalBetArray.push(chipValue);

  // Replicate color from the big chip
  const computedStyle = window.getComputedStyle(chipElement, null);
  const chipBG = computedStyle.getPropertyValue("background-color");

  [2, 3, 4, 5].forEach((circleNum) => {
    addChipToCircle(chipValue, circleNum, chipBG);
  });

  updateBetAmounts();
}

function addChipToCircle(chipValue, circleNum, color) {
  const stackDiv = document.getElementById(`stack${circleNum}`);
  const chipImg = document.createElement("div");
  chipImg.classList.add("bet-chip-img");
  chipImg.innerText = `$${chipValue}`;
  chipImg.style.backgroundColor = color;
  stackDiv.appendChild(chipImg);
}

function updateBetAmounts() {
  const perCircleSum = totalBetArray.reduce((acc, val) => acc + val, 0);
  document.getElementById("amount2").innerText = `$${perCircleSum}`;
  document.getElementById("amount3").innerText = `$${perCircleSum}`;
  document.getElementById("amount4").innerText = `$${perCircleSum}`;
  document.getElementById("amount5").innerText = `$${perCircleSum}`;
}

/*********************************************
 * DEAL & GAME FLOW
 *********************************************/
function lockBetsAndDeal() {
  if (totalBetArray.length === 0) {
    document.getElementById("result").innerText =
      "Please select at least one chip before dealing.";
    return;
  }
  startGame();
}

function startGame() {
  gameActive = true;
  document.getElementById("action-buttons").style.display = "none";
  document.getElementById("deal-section").style.display = "none";
  currentDealerReveal = 2;
  document.getElementById("result").innerText = "";

  // Build + Shuffle
  initializeDeck();
  shuffleDeck();

  debugLog("Deck size:", deck.length, "Unique:", new Set(deck).size);
  debugLog("Shuffled Deck:", deck.join(", "));

  // Deal: first 5 -> dealer, next 3 -> player
  dealerCards = deck.slice(0, 5);
  playerCards = deck.slice(5, 8);

  debugLog("Dealer Cards (full):", dealerCards);
  debugLog("Player Cards:", playerCards);

  showCards("player-hand", playerCards);
  showDealerPartial(2);

  // Compare 2-card dealer vs 3-card player
  const outcome = compareHands(dealerCards.slice(0, 2), playerCards);
  if (outcome < 0) {
    document.getElementById("result").innerText =
      "Dealer’s 2-card partial beats you! All bets lost.";
    endHand();
  } else if (outcome > 0) {
    document.getElementById("result").innerText =
      "You beat Dealer’s 2-card partial! Take Win or Continue?";
    document.getElementById("action-buttons").style.display = "block";
  } else {
    document.getElementById("result").innerText =
      "Tie at the 2-card stage. You may continue.";
    document.getElementById("action-buttons").style.display = "block";
  }
}

function showDealerPartial(numToShow) {
  const dealerHandDiv = document.getElementById("dealer-hand");
  dealerHandDiv.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const cardDiv = document.createElement("div");
    cardDiv.classList.add("card");
    if (i < numToShow) {
      cardDiv.innerText = dealerCards[i];
    } else {
      cardDiv.innerText = "?";
    }
    dealerHandDiv.appendChild(cardDiv);
  }
}

function showCards(containerId, cards) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  cards.forEach((c) => {
    const cardDiv = document.createElement("div");
    cardDiv.classList.add("card");
    cardDiv.innerText = c;
    container.appendChild(cardDiv);
  });
}

function playerContinue() {
  if (!gameActive) return;
  currentDealerReveal++;
  if (currentDealerReveal > 5) return;

  showDealerPartial(currentDealerReveal);

  const dealerSub = dealerCards.slice(0, currentDealerReveal);
  const outcome = compareHands(dealerSub, playerCards);

  if (outcome < 0) {
    document.getElementById(
      "result"
    ).innerText = `Dealer’s ${currentDealerReveal}-card best beats you! All bets lost.`;
    endHand();
  } else if (outcome > 0) {
    if (currentDealerReveal === 3) {
      document.getElementById("result").innerText =
        "You beat Dealer’s 3-card hand! Take Win on (2,3) or Continue?";
      document.getElementById("action-buttons").style.display = "block";
    } else if (currentDealerReveal === 4) {
      document.getElementById("result").innerText =
        "You beat Dealer’s 4-card best! Take Win on (2,3,4) or Continue?";
      document.getElementById("action-buttons").style.display = "block";
    } else if (currentDealerReveal === 5) {
      document.getElementById("result").innerText =
        "You beat Dealer’s final 5-card hand! Full payout applies.";
      applyPayout(5);
      endHand();
    }
  } else {
    // tie
    if (currentDealerReveal === 5) {
      document.getElementById("result").innerText =
        "Tie at the final 5-card stage. Round ends.";
      endHand();
    } else {
      document.getElementById(
        "result"
      ).innerText = `Tie at the ${currentDealerReveal}-card stage. Continue?`;
    }
  }
}

function playerTakeWin() {
  if (!gameActive) return;
  applyPayout(currentDealerReveal);
  endHand();
}

/*********************************************
 * HAND COMPARISON & RANKING
 *********************************************/
function compareHands(dealerArray, playerArray) {
  const dealerScore = rankPokerHand(dealerArray);
  const playerScore = rankPokerHand(playerArray);

  debugLog(
    "Dealer partial:",
    dealerArray,
    "->",
    dealerScore,
    "| Player:",
    playerArray,
    "->",
    playerScore
  );

  // outcome < 0 => Dealer wins, > 0 => Player wins, = 0 => tie
  if (playerScore > dealerScore) return 1;
  if (playerScore < dealerScore) return -1;
  return 0;
}

/**
 * rankPokerHand(cards):
 * - Covers Royal Flush, Straight Flush, 4oak, Full House, Flush, Straight,
 *   3oak, 2pair, 1pair, High Card
 * - Adapts to 2..5 cards.
 * - Aces can be high or low (A-2-3-4-5).
 * - Returns integer "score" (bigger = stronger).
 */
function rankPokerHand(cards) {
  const parsed = cards.map(parseCard);
  // Sort descending by rank
  parsed.sort((a, b) => b.rankVal - a.rankVal);

  const n = parsed.length; // 2..5
  let suits = parsed.map((c) => c.suit);
  let ranks = parsed.map((c) => c.rankVal);

  // Check for A-2-3-4-5 "wheel" possibility if n>=3
  // If top is Ace and next ranks descend, handle it carefully in checkStraight
  let freq = {};
  for (let r of ranks) {
    freq[r] = (freq[r] || 0) + 1;
  }
  let countsArr = Object.values(freq).sort((a, b) => b - a);

  const allSameSuit = suits.every((s) => s === suits[0]);
  const isStraightVal = checkStraight(ranks); // might handle A-5 inside

  let categoryCode = 0,
    tieBreak = 0;

  // 10: Royal, 9: SF, 8: 4oak, 7: FH, 6: Flush, 5: Straight,
  // 4: 3oak, 3: 2pair, 2: 1pair, 1: High Card

  // Royal Flush (need 5)
  if (
    n === 5 &&
    allSameSuit &&
    isStraightVal &&
    topCard(ranks) === 14 &&
    ranks.includes(13)
  ) {
    // Must be 14,13,12,11,10
    if (lowestCard(ranks) === 10) {
      categoryCode = 10;
      tieBreak = 14;
    } else {
      // If it had Ace-high but wasn't exactly 14,13,12,11,10, then it's a normal straight flush
      categoryCode = 9;
      tieBreak = topCard(ranks);
    }
  }
  // Straight Flush (need 5)
  else if (n === 5 && allSameSuit && isStraightVal) {
    categoryCode = 9;
    tieBreak = topCard(ranks); // top card in the straight
  }
  // Four of a Kind (n>=4)
  else if (n >= 4 && countsArr[0] === 4) {
    categoryCode = 8;
    let quadRank = parseInt(Object.keys(freq).find((r) => freq[r] === 4));
    tieBreak = quadRank;
  }
  // Full House (need 5)
  else if (n === 5 && countsArr[0] === 3 && countsArr[1] === 2) {
    categoryCode = 7;
    let tripleRank = parseInt(Object.keys(freq).find((r) => freq[r] === 3));
    let pairRank = parseInt(Object.keys(freq).find((r) => freq[r] === 2));
    tieBreak = tripleRank * 15 + pairRank;
  }
  // Flush (n>=3)
  else if (allSameSuit && n >= 3) {
    categoryCode = 6;
    tieBreak = rankArrayTieBreak(ranks);
  }
  // Straight (n>=3)
  else if (isStraightVal && n >= 3) {
    categoryCode = 5;
    // If A-2-3 for example, topCard(ranks) might be 5 if it's A-5
    tieBreak = topCard(ranks);
  }
  // Three of a Kind (n>=3)
  else if (countsArr[0] === 3) {
    categoryCode = 4;
    let tripleRank = parseInt(Object.keys(freq).find((r) => freq[r] === 3));
    tieBreak = tripleRank;
  }
  // Two Pair (n>=4)
  else if (n >= 4 && countsArr[0] === 2 && countsArr[1] === 2) {
    categoryCode = 3;
    let pairRanks = Object.keys(freq)
      .filter((r) => freq[r] === 2)
      .map((x) => parseInt(x))
      .sort((a, b) => b - a);
    tieBreak = pairRanks[0] * 15 + pairRanks[1];
  }
  // One Pair (n>=2)
  else if (countsArr[0] === 2) {
    categoryCode = 2;
    let pairRank = parseInt(Object.keys(freq).find((r) => freq[r] === 2));
    tieBreak = pairRank;
  }
  // High Card
  else {
    categoryCode = 1;
    tieBreak = rankArrayTieBreak(ranks);
  }

  return categoryCode * 1_000_000 + tieBreak;
}

/**
 * parseCard("A♠") -> {rankVal:14, suit:'♠'}
 */
function parseCard(cardStr) {
  const suit = cardStr.slice(-1);
  let rankPart = cardStr.slice(0, -1);
  let val = 0;
  switch (rankPart) {
    case "A":
      val = 14;
      break;
    case "K":
      val = 13;
      break;
    case "Q":
      val = 12;
      break;
    case "J":
      val = 11;
      break;
    default:
      val = parseInt(rankPart, 10); // 2..10
      break;
  }
  return { rankVal: val, suit };
}

/**
 * checkStraight(ranksDesc):
 *  - ranks are descending e.g. [14,13,12,11,10] or [14,5,4,3,2] for A-5.
 *  - Returns true if these ranks form a straight.
 *  - For partial sets (2..4 cards), if they're consecutive descending, it's "straight enough."
 */
function checkStraight(ranks) {
  if (ranks.length < 3) return false;

  // Special A-5 check:
  // If we have an Ace and the rest form 5..4..3..2, it's also a straight.
  // e.g. [14,5,4,3,2]
  if (ranks.includes(14)) {
    // Check if we have 5,4,3,2
    let has5 = ranks.includes(5);
    let has4 = ranks.includes(4);
    let has3 = ranks.includes(3);
    let has2 = ranks.includes(2);

    if (has5 && has4 && has3 && has2 && ranks.length === 5) {
      return true;
    }
    // For a smaller set (like 3 or 4 cards), we still handle the logic if it's consecutive
  }

  // Normal consecutive check
  for (let i = 0; i < ranks.length - 1; i++) {
    if (ranks[i] - ranks[i + 1] !== 1) return false;
  }
  return true;
}

/**
 * rankArrayTieBreak: encode the ranks in base 15 to get a unique integer.
 */
function rankArrayTieBreak(rArr) {
  let result = 0;
  let base = 1;
  // from right to left
  for (let i = rArr.length - 1; i >= 0; i--) {
    result += rArr[i] * base;
    base *= 15;
  }
  return result;
}

/**
 * topCard(ranksDesc) => the highest card. Usually ranks[0].
 * But if we have an A-5 wheel, the "top" might be 5.
 * We'll handle that logic if we detect A-5 specifically.
 */
function topCard(ranksDesc) {
  // If ranksDesc includes [14,5,4,3,2], then top is 5
  if (
    ranksDesc.length === 5 &&
    ranksDesc[0] === 14 &&
    ranksDesc[1] === 5 &&
    ranksDesc[2] === 4 &&
    ranksDesc[3] === 3 &&
    ranksDesc[4] === 2
  ) {
    return 5; // A-5 wheel
  }
  return ranksDesc[0];
}

function lowestCard(ranksDesc) {
  return ranksDesc[ranksDesc.length - 1];
}

/*********************************************
 * DECK
 *********************************************/
function initializeDeck() {
  deck = [];
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
  ];
  for (let s of suits) {
    for (let r of ranks) {
      deck.push(r + s);
    }
  }
}

function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

/*********************************************
 * PAYOUT & ROUND END
 *********************************************/
function applyPayout(dealerRevealCount) {
  const perCircleBet = totalBetArray.reduce((acc, val) => acc + val, 0);
  if (perCircleBet === 0) return;

  let message = "";
  if (dealerRevealCount === 2) {
    // Bet 2 pays 1:1, 3/4/5 push
    const payout2 = perCircleBet * 2;
    playerBalance += payout2;
    playerBalance += perCircleBet * 3;
    message = `You took the 2-card stage win! (2) pays 1:1, (3)/(4)/(5) push.`;
  } else if (dealerRevealCount === 3) {
    // 2,3 pay 1:1, 4,5 push
    const payout2 = perCircleBet * 2;
    const payout3 = perCircleBet * 2;
    playerBalance += payout2 + payout3;
    playerBalance += perCircleBet * 2; // return 4,5
    message = `You took the 3-card stage win! (2)/(3) pay 1:1, (4)/(5) push.`;
  } else if (dealerRevealCount === 4) {
    // 2,3 pay 1:1, 4 pays 2:1, 5 push
    const payout2 = perCircleBet * 2;
    const payout3 = perCircleBet * 2;
    const payout4 = perCircleBet * 3; // 2:1
    playerBalance += payout2 + payout3 + payout4;
    playerBalance += perCircleBet;
    message = `You took the 4-card stage win! (2)/(3) pay 1:1, (4) pays 2:1, (5) push.`;
  } else if (dealerRevealCount === 5) {
    // final
    const payout2 = perCircleBet * 2;
    const payout3 = perCircleBet * 2;
    const payout4 = perCircleBet * 3;
    const payout5 = perCircleBet * 5; // 4:1
    playerBalance += payout2 + payout3 + payout4 + payout5;
    message = `You took the 5-card stage win! (2)/(3) pay 1:1, (4) pays 2:1, (5) pays 4:1.`;
  }
  document.getElementById("result").innerText = message;
  updateBalanceDisplay();
}

function endHand() {
  gameActive = false;
  document.getElementById("action-buttons").style.display = "none";
  setTimeout(resetGame, 3000);
}

function resetGame() {
  dealerCards = [];
  playerCards = [];
  currentDealerReveal = 2;
  totalBetArray = [];

  [2, 3, 4, 5].forEach((num) => {
    document.getElementById(`stack${num}`).innerHTML = "";
    document.getElementById(`amount${num}`).innerText = "$0";
  });

  document.getElementById("dealer-hand").innerHTML = "";
  document.getElementById("player-hand").innerHTML = "";
  document.getElementById("result").innerHTML = "";

  // Show Deal again
  document.getElementById("deal-section").style.display = "block";
}
