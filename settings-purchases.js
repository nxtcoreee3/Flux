import { getPurchaseHistory, revertGamePurchase } from './firebase-auth.js';

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
let purchaseRecords = [];
let selectedGameIds = new Set();
let activeUser = null;

function purchaseTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleFor(record) {
  if (record?.title) return record.title;
  return String(record?.gameId || 'Unknown game').replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function isEligible(record) {
  const purchasedAt = purchaseTimestampMillis(record?.purchasedAt);
  const age = Date.now() - purchasedAt;
  return purchasedAt > 0 && age >= 0 && age <= REFUND_WINDOW_MS;
}

function dateFor(record) {
  const milliseconds = purchaseTimestampMillis(record?.purchasedAt);
  if (!milliseconds) return 'Purchase date unavailable';
  return new Date(milliseconds).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function setMessage(text, tone = 'info') {
  const message = document.getElementById('purchase-management-message');
  if (!message) return;
  const tones = {
    info: { color: 'var(--muted)', background: 'transparent' },
    success: { color: '#15803d', background: 'rgba(34,197,94,0.08)' },
    error: { color: '#b91c1c', background: 'rgba(239,68,68,0.08)' },
  };
  const style = tones[tone] || tones.info;
  message.style.display = 'block';
  message.style.color = style.color;
  message.style.background = style.background;
  message.textContent = text;
}

function refreshButtons() {
  const eligible = purchaseRecords.filter(isEligible);
  const selectedEligible = eligible.filter(record => selectedGameIds.has(record.gameId));
  const selectAll = document.getElementById('select-all-purchases-btn');
  const revertSelected = document.getElementById('revert-selected-purchases-btn');
  const revertAll = document.getElementById('revert-all-purchases-btn');
  const allSelected = eligible.length > 0 && selectedEligible.length === eligible.length;
  if (selectAll) {
    selectAll.disabled = eligible.length === 0;
    selectAll.textContent = allSelected ? 'Clear selection' : 'Select all eligible';
  }
  if (revertSelected) {
    revertSelected.disabled = selectedEligible.length === 0;
    revertSelected.textContent = selectedEligible.length ? `Revert selected (${selectedEligible.length})` : 'Revert selected';
  }
  if (revertAll) revertAll.disabled = eligible.length === 0;
  document.querySelectorAll('#purchase-history-list input[data-purchase-game]').forEach(input => {
    input.checked = selectedGameIds.has(input.dataset.purchaseGame);
  });
}

function renderHistory() {
  const list = document.getElementById('purchase-history-list');
  if (!list) return;
  list.innerHTML = '';
  if (!activeUser || activeUser.isAnonymous) {
    list.innerHTML = '<div class="purchase-management-empty">Sign in to view and manage your game purchases.</div>';
    refreshButtons();
    return;
  }
  if (!purchaseRecords.length) {
    list.innerHTML = '<div class="purchase-management-empty">No recorded game purchases yet.</div>';
    refreshButtons();
    return;
  }

  const eligible = purchaseRecords.filter(isEligible);
  const expired = purchaseRecords.filter(record => !isEligible(record));
  const addGroup = (records, eligibleGroup) => {
    records.forEach(record => {
      const row = document.createElement('label');
      row.className = `purchase-history-row${eligibleGroup ? '' : ' is-expired'}`;
      row.innerHTML = `
        <span class="purchase-history-check">${eligibleGroup ? `<input type="checkbox" data-purchase-game="${String(record.gameId).replace(/"/g, '&quot;')}" aria-label="Select ${titleFor(record)} for reversal">` : '<span class="purchase-history-check-placeholder" aria-hidden="true"></span>'}</span>
        <span class="purchase-history-copy">
          <strong>${titleFor(record)}</strong>
          <small>Purchased ${dateFor(record)}</small>
        </span>
        <span class="purchase-history-result ${eligibleGroup ? 'is-eligible' : 'is-expired'}">${eligibleGroup ? `+${Math.max(0, Number(record.cost) || 0)} pts · Eligible` : 'Outside 7 days'}</span>
      `;
      if (eligibleGroup) {
        const checkbox = row.querySelector('input');
        checkbox.addEventListener('click', event => event.stopPropagation());
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selectedGameIds.add(record.gameId);
          else selectedGameIds.delete(record.gameId);
          refreshButtons();
        });
      }
      list.appendChild(row);
    });
  };
  addGroup(eligible, true);
  addGroup(expired, false);
  if (!eligible.length) {
    const note = document.createElement('div');
    note.className = 'purchase-management-empty purchase-management-empty--compact';
    note.textContent = 'No purchases are currently within the seven-day reversal window.';
    list.prepend(note);
  }
  refreshButtons();
}

async function loadPurchaseManagement(user) {
  activeUser = user;
  selectedGameIds = new Set();
  if (!user || user.isAnonymous) {
    purchaseRecords = [];
    renderHistory();
    return;
  }
  const list = document.getElementById('purchase-history-list');
  if (list) list.innerHTML = '<div class="purchase-management-empty">Loading purchase history…</div>';
  purchaseRecords = await getPurchaseHistory();
  renderHistory();
}

async function revertSelected(records) {
  const eligibleRecords = records.filter(isEligible);
  if (!eligibleRecords.length) {
    setMessage('There are no purchases within the seven-day reversal window.', 'error');
    return;
  }
  const titles = eligibleRecords.map(titleFor).join(', ');
  const confirmed = window.confirm(`Revert ${eligibleRecords.length === 1 ? 'this purchase' : 'these purchases'}?\n\n${titles}\n\nFlux points will be returned and the selected games will be locked again. Points cannot be exchanged for real money.`);
  if (!confirmed) return;

  const selectAll = document.getElementById('select-all-purchases-btn');
  const revertSelectedButton = document.getElementById('revert-selected-purchases-btn');
  const revertAll = document.getElementById('revert-all-purchases-btn');
  [selectAll, revertSelectedButton, revertAll].forEach(button => { if (button) button.disabled = true; });
  setMessage('Reverting selected purchases…', 'info');

  let successCount = 0;
  let returnedPoints = 0;
  const successfulGameIds = [];
  const errors = [];
  for (const record of eligibleRecords) {
    const result = await revertGamePurchase(record.gameId);
    if (result.ok) {
      successCount += 1;
      returnedPoints += result.refundPoints || 0;
      successfulGameIds.push(record.gameId);
      selectedGameIds.delete(record.gameId);
    } else {
      errors.push(`${titleFor(record)}: ${result.error || 'reversal failed'}`);
    }
  }

  if (successCount) {
    setMessage(`${successCount} purchase${successCount === 1 ? '' : 's'} reverted. ${returnedPoints} Flux point${returnedPoints === 1 ? '' : 's'} returned.`, 'success');
    window.dispatchEvent(new CustomEvent('flux:purchases-changed', { detail: { gameIds: successfulGameIds } }));
  }
  if (errors.length) setMessage(`${successCount ? 'Some reversals completed. ' : ''}${errors.join(' ')}`, 'error');
  purchaseRecords = await getPurchaseHistory();
  renderHistory();
}

function initPurchaseManagement() {
  document.getElementById('select-all-purchases-btn')?.addEventListener('click', () => {
    const eligible = purchaseRecords.filter(isEligible);
    const allSelected = eligible.length > 0 && eligible.every(record => selectedGameIds.has(record.gameId));
    selectedGameIds = allSelected ? new Set() : new Set(eligible.map(record => record.gameId));
    refreshButtons();
  });
  document.getElementById('revert-selected-purchases-btn')?.addEventListener('click', () => {
    revertSelected(purchaseRecords.filter(record => selectedGameIds.has(record.gameId)));
  });
  document.getElementById('revert-all-purchases-btn')?.addEventListener('click', () => {
    revertSelected(purchaseRecords.filter(isEligible));
  });
  renderHistory();
}

window.loadPurchaseManagement = loadPurchaseManagement;
window.initPurchaseManagement = initPurchaseManagement;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPurchaseManagement, { once: true });
else initPurchaseManagement();
