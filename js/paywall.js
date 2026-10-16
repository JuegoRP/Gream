// ═══════════════════════════════════
//  GREAM — paywall.js  (nabídka Gream Plus)
//  Roční předplatné zvýrazněné, měsíční vedle, „Obnovit nákupy“. Nákup jen za rodičovskou bránou.
//  Ceny z Google Play (Billing.price), jinak výchozí PRICES. Bez zapnutého placení se nic neukáže.
// ═══════════════════════════════════
import { Subscription, PRICES, TRIAL_DAYS } from './subscription.js';
import { Billing } from './billing.js';
import { ParentGate } from './parents.js';
import { tr } from './i18n.js';
import { Net } from './net.js';

const esc = (x) => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (msg) => window.App?._showToast?.(msg);

export const Paywall = {
  // reason: 'home' | 'battle' | 'difficulty' | 'profile' | 'pack' | 'family' | 'league' | undefined
  open(reason) {
    if (!Subscription.paywallEnabled()) return false;
    const t = tr(), sub = Subscription.get();
    document.getElementById('plusOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'plusOverlay'; ov.className = 'plus-overlay';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    const pm = Billing.price('monthly') || PRICES.monthly, py = Billing.price('yearly') || PRICES.yearly;
    const why = reason && t.plus_reason[reason];
    let plan = 'yearly';
    ov.innerHTML = `<div class="plus-card anim-pop" role="dialog" aria-label="${esc(t.plus_title)}">
      <button class="plus-x" aria-label="${esc(t.pg_cancel)}">✕</button>
      <div class="plus-star">⭐</div>
      <div class="plus-title">${esc(t.plus_title)}</div>
      <div class="plus-sub">${esc(t.plus_sub)}</div>
      ${why ? `<div class="plus-why">${esc(why)}</div>` : ''}
      ${sub.paid ? `<div class="plus-active">${esc(sub.promo ? t.plus_promo_active : t.plus_active)}</div>
        ${sub.promo ? '' : `<button class="btn-primary plus-manage">${esc(t.plus_manage)}</button>`}` : `
      <ul class="plus-feats">${t.plus_feats.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="plus-plans">
        <button class="plus-plan on" data-plan="yearly"><span class="plus-save">${esc(t.plus_save(PRICES.yearlySave))}</span>
          <b>${esc(t.plus_yearly)}</b><span>${esc(t.plus_per_year(py))}</span><small>${esc(t.plus_per_month(PRICES.yearlyPerMonth))}</small></button>
        <button class="plus-plan" data-plan="monthly"><b>${esc(t.plus_monthly)}</b><span>${esc(t.plus_per_month(pm))}</span></button>
      </div>
      <button class="btn-primary plus-buy">${esc(t.plus_buy)}</button>
      <div class="plus-links"><button class="plus-restore">${esc(t.plus_restore)}</button><button class="plus-code-btn">${esc(t.plus_code)}</button></div>
      <form class="plus-code" hidden><input class="plus-code-in" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(t.plus_code_ph)}" aria-label="${esc(t.plus_code_ph)}"><button class="btn-primary">OK</button></form>
      <div class="plus-free">${esc(t.plus_free_note)}</div>
      <div class="plus-legal">${esc(t.plus_legal)}</div>`}
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.plus-x').onclick = () => ov.remove();
    ov.querySelectorAll('.plus-plan').forEach(b => b.onclick = () => {
      plan = b.dataset.plan; ov.querySelectorAll('.plus-plan').forEach(x => x.classList.toggle('on', x === b));
    });
    ov.querySelector('.plus-manage')?.addEventListener('click', () => Billing.manage());
    ov.querySelector('.plus-restore')?.addEventListener('click', async () => {
      if (!Billing.available()) return toast(t.plus_unavailable);
      if (await Billing.restore()) { ov.remove(); toast(t.plus_thanks); window.App?.renderMap?.(); }
      else toast(t.plus_restored_none);
    });
    const form = ov.querySelector('.plus-code');
    ov.querySelector('.plus-code-btn')?.addEventListener('click', () => { form.hidden = false; form.querySelector('input').focus(); });
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inp = form.querySelector('input'), code = inp.value.trim(); if (!code) return;
      const btn = form.querySelector('button'); btn.disabled = true;
      const r = await this.redeem(code); btn.disabled = false;
      if (r === 'ok') { ov.remove(); toast(t.plus_code_ok); window.App?.renderMap?.(); }
      else { toast(r === 'used' ? t.plus_code_used : r === 'offline' ? t.plus_code_offline : t.plus_code_bad); inp.select(); }
    });
    ov.querySelector('.plus-buy')?.addEventListener('click', async () => {
      if (!Billing.available()) return toast(t.plus_unavailable);
      if (!(await ParentGate.ask(t.plus_parent))) return;
      const r = await Billing.buy(plan);
      if (r === 'ok') { ov.remove(); toast(t.plus_thanks); window.App?.renderMap?.(); }
      else if (r === 'unavailable') toast(t.plus_unavailable);
      else if (r === 'error') toast(t.plus_error);
    });
    return true;
  },

  // Promo kód → ověření na serveru; vrací 'ok' | 'invalid' | 'used' | 'offline'
  async redeem(code) {
    const r = await Net.promo(code);
    if (!r) return 'offline';
    if (r.ok) { Subscription.activatePromo(code); return 'ok'; }
    return r.error === 'used' ? 'used' : 'invalid';
  },

  // Upozornění na konec týdne zdarma: 5. den (zbývají 2 dny), poslední den, a jednou po skončení
  trialNotice() {
    if (!Subscription.paywallEnabled()) return;
    const sub = Subscription.get(); if (sub.paid) return;
    const key = 'gream_trial_notice', t = tr();
    let seen = ''; try { seen = localStorage.getItem(key) || ''; } catch {}
    const stage = sub.inTrial ? (sub.trialDaysLeft <= 1 ? 'last' : sub.trialDaysLeft <= 2 ? 'two' : '') : 'ended';
    if (!stage || seen.includes(stage)) return;
    try { localStorage.setItem(key, seen + ',' + stage); } catch {}
    if (stage === 'ended') {
      const ov = document.createElement('div'); ov.className = 'pg-overlay';
      ov.innerHTML = `<div class="pg-card anim-pop"><div class="pg-title">⭐ ${esc(t.plus_trial_title)}</div>
        <div class="pg-reason">${esc(t.plus_trial_end)}</div>
        <button class="btn-primary pl-more">${esc(t.plus_title)}</button><button class="pg-cancel">OK</button></div>`;
      document.body.appendChild(ov);
      ov.querySelector('.pl-more').onclick = () => { ov.remove(); this.open(); };
      ov.querySelector('.pg-cancel').onclick = () => ov.remove();
    } else toast('⭐ ' + t.plus_trial_banner(sub.trialDaysLeft));
  },
};
export { TRIAL_DAYS };
