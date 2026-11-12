import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, configured } from './supabase';
import './style.css';
import './sage-theme.css';

const demo = {
  mine: {
    balance: 12450,
    spent: 2180,
    budget: 4000,
    goals: 4700,
    goalTarget: 14000,
    wishes: 2700,
  },
  partner: {
    balance: 9800,
    spent: 1540,
    budget: 3000,
    goals: 3900,
    goalTarget: 12000,
    wishes: 1800,
  },
  shared: {
    balance: 4600,
    spent: 1120,
    budget: 2500,
    goals: 1800,
    goalTarget: 6000,
    wishes: 2400,
  },
};
const money = (n) =>
  'RM ' +
  Number(n || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
};
const Progress = ({ value, max }) => (
  <div className="progress">
    <span
      style={{ width: `${max > 0 ? Math.min(100, (100 * value) / max) : 0}%` }}
    />
  </div>
);
const emptyTransaction = () => ({
  kind: 'expense',
  account_id: '',
  to_account_id: '',
  amount: '',
  category: 'Food & drinks',
  note: '',
  transaction_date: todayLocal(),
});
const categories = [
  'Food & drinks',
  'Groceries',
  'Transport',
  'Bills',
  'Shopping',
  'Health',
  'Entertainment',
  'Salary',
  'Bonus',
  'Refund',
  'Gift',
  'Other',
];
const budgetCategories = categories.filter((c) => !['Salary', 'Bonus', 'Refund'].includes(c));
const emptyBudget = () => ({ category: 'Food & drinks', amount: '', visibility: 'personal' });

const emptyAccount = () => ({
  name: '',
  account_type: 'savings',
  visibility: 'personal',
  opening_date: todayLocal(),
  opening_balance: '0',
  credit_limit: '',
});

function App() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(configured),
    [tab, setTab] = useState('home'),
    [view, setView] = useState('mine');
  const [authMode, setAuthMode] = useState('password'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [profile, setProfile] = useState(null),
    [household, setHousehold] = useState(null);
  const [inviteMethod, setInviteMethod] = useState('code'),
    [inviteCode, setInviteCode] = useState(''),
    [inviteEmail, setInviteEmail] = useState(''),
    [joinCode, setJoinCode] = useState(''),
    [householdName, setHouseholdName] = useState('Our Household');
  const [msg, setMsg] = useState(''),
    [busy, setBusy] = useState(false),
    [showAuth, setShowAuth] = useState(false),
    [showHouse, setShowHouse] = useState(false);
  const [accounts, setAccounts] = useState([]),
    [accountsLoading, setAccountsLoading] = useState(false),
    [accountsError, setAccountsError] = useState('');
  const [showArchived, setShowArchived] = useState(false),
    [editingAccount, setEditingAccount] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(false),
    [accountForm, setAccountForm] = useState(emptyAccount),
    [accountError, setAccountError] = useState(''),
    [accountSaving, setAccountSaving] = useState(false);
  const [transactions, setTransactions] = useState([]),
    [txLoading, setTxLoading] = useState(false),
    [txError, setTxError] = useState('');
  const [showTx, setShowTx] = useState(false),
    [editingTx, setEditingTx] = useState(null),
    [txForm, setTxForm] = useState(emptyTransaction),
    [txSaving, setTxSaving] = useState(false),
    [txFormError, setTxFormError] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsError, setBudgetsError] = useState('');
  const [budgetMonth, setBudgetMonth] = useState(todayLocal().slice(0, 7));
  const shiftBudgetMonth = (offset) => {
    setBudgetMonth((current) => {
      const [year, month] = current.split('-').map(Number);
      const next = new Date(year, month - 1 + offset, 1);
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    });
  };
  const budgetMonthLabel = new Date(`${budgetMonth}-01T12:00:00`).toLocaleDateString('en-MY', {
    month: 'long', year: 'numeric'
  });
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetForm, setBudgetForm] = useState(emptyBudget);
  const [budgetFormError, setBudgetFormError] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);
  const user = session?.user;

  async function refresh(userId) {
    if (!supabase || !userId) return;
    const [p, m] = await Promise.all([
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('household_members')
        .select('household_id,households(id,name)')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
    ]);
    if (p.error) setMsg(p.error.message);
    setProfile(p.data);
    setName(p.data?.display_name || '');
    setHousehold(m.data?.households || null);
  }
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) refresh(data.session.user.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) setTimeout(() => refresh(s.user.id), 0);
      else {
        setProfile(null);
        setHousehold(null);
        setAccounts([]);
        setTransactions([]);
        setBudgets([]);
        setShowAddAccount(false);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  async function action(fn) {
    setBusy(true);
    setMsg('');
    try {
      const r = await fn();
      if (r?.error) throw r.error;
      if (r?.data?.message) setMsg(r.data.message);
      return r;
    } catch (e) {
      setMsg(e.message || 'Something went wrong');
      return null;
    } finally {
      setBusy(false);
    }
  }
  const auth = async (signUp = false) =>
    action(async () => {
      let r;
      if (authMode === 'link')
        r = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
      else if (signUp)
        r = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
      else r = await supabase.auth.signInWithPassword({ email, password });
      if (!r.error && !r.data?.session) setMsg('Check your email to continue.');
      return r;
    });
  const saveProfile = () =>
    action(async () => {
      const r = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: name.trim() });
      if (!r.error) await refresh(user.id);
      return r;
    });
  const createHouse = () =>
    action(async () => {
      const r = await supabase.rpc('create_household', {
        household_name: householdName,
      });
      if (!r.error) await refresh(user.id);
      return r;
    });
  const joinHouse = () =>
    action(async () => {
      const r = await supabase.rpc('accept_household_invite', {
        raw_code: joinCode.trim(),
      });
      if (!r.error) {
        setMsg('Household joined successfully.');
        await refresh(user.id);
      }
      return r;
    });
  const makeInvite = () =>
    action(async () => {
      const r = await supabase.rpc('create_household_invite', {
        target_email: inviteMethod === 'email' ? inviteEmail.trim() : null,
      });
      if (!r.error) {
        setInviteCode(r.data);
        setMsg(
          inviteMethod === 'email'
            ? 'Invite created. Copy and share the code securely with the intended email recipient. Automatic email delivery requires a separate server-side email integration.'
            : 'One-time code generated. Share it securely with your partner.'
        );
      }
      return r;
    });

  async function loadAccounts(userId) {
    if (!supabase || !userId) {
      setAccounts([]);
      return;
    }
    setAccountsLoading(true);
    setAccountsError('');
    const { data, error } = await supabase
      .from('accounts')
      .select(
        'id,name,account_type,visibility,opening_date,opening_balance,credit_limit,owner_id,archived_at'
      )
      .order('created_at', { ascending: true });
    if (error) {
      setAccountsError(error.message);
      setAccounts([]);
    } else setAccounts(data || []);
    setAccountsLoading(false);
  }
  async function loadFinance(userId) {
    if (!supabase || !userId) {
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
      return;
    }

    setAccountsLoading(true);
    setTxLoading(true);
    setBudgetsLoading(true);
    setBudgetsError('');
    setAccountsError('');
    setTxError('');
    const [a, t, b] = await Promise.all([
      supabase
        .from('accounts')
        .select(
          'id,name,account_type,visibility,opening_date,opening_balance,credit_limit,owner_id,archived_at'
        )
        .order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select(
          'id,account_id,created_by,kind,amount,category,note,transaction_date,transfer_group,created_at'
        )
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('budgets').select('id,household_id,owner_id,visibility,month,category,amount,created_at').order('category'),
    ]);
    if (a.error) {
      setAccountsError(a.error.message);
      setAccounts([]);
    } else setAccounts(a.data || []);
    if (t.error) {
      setTxError(t.error.message);
      setTransactions([]);
    } else setTransactions(t.data || []);
    if (b.error) { setBudgetsError(b.error.message); setBudgets([]); }
    else setBudgets(b.data || []);
    setBudgetsLoading(false);
    setAccountsLoading(false);
    setTxLoading(false);
  }
  useEffect(() => {
    if (user?.id) loadFinance(user.id);
    else {
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
    }
  }, [user?.id]);

  const changeAccount = (key, value) =>
    setAccountForm((prev) => ({ ...prev, [key]: value }));
  function openAccountForm() {
    setEditingAccount(null);
    setAccountForm(emptyAccount());
    setAccountError('');
    setShowAddAccount(true);
  }
  function editAccount(a) {
    setEditingAccount(a);
    setAccountForm({
      name: a.name,
      account_type: a.account_type,
      visibility: a.visibility,
      opening_date: a.opening_date,
      opening_balance: String(a.opening_balance),
      credit_limit: a.credit_limit == null ? '' : String(a.credit_limit),
    });
    setAccountError('');
    setShowAddAccount(true);
  }
  async function setArchived(a, archive) {
    const question = archive
      ? `Archive ${a.name}? You can restore it later, and its history will be preserved.`
      : `Restore ${a.name}?`;
    if (!window.confirm(question)) return;
    setAccountsError('');
    const { error } = await supabase
      .from('accounts')
      .update({
        archived_at: archive ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', a.id);
    if (error) {
      setAccountsError(error.message);
      return;
    }
    setMsg(archive ? 'Account archived.' : 'Account restored.');
    await loadFinance(user.id);
  }
  async function saveAccount(e) {
    e.preventDefault();
    if (accountSaving) return;
    setAccountError('');
    const f = accountForm;
    const opening = Number(f.opening_balance),
      limit = Number(f.credit_limit);
    if (!f.name.trim()) {
      setAccountError('Enter an account name.');
      return;
    }
    if (!f.opening_date) {
      setAccountError('Choose an opening date.');
      return;
    }
    if (!Number.isFinite(opening) || f.opening_balance.trim() === '') {
      setAccountError('Enter a valid opening balance.');
      return;
    }
    if (
      f.account_type === 'credit_card' &&
      (opening < 0 || !Number.isFinite(limit) || limit <= 0)
    ) {
      setAccountError(
        'Credit cards need a non-negative amount owed and a credit limit above zero.'
      );
      return;
    }
    setAccountSaving(true);
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !currentUser) throw new Error('Please sign in first.');
      const { data: householdId, error: householdError } = await supabase.rpc(
        'my_household_id'
      );
      if (householdError) throw householdError;
      if (!householdId)
        throw new Error('Join or create a household before adding accounts.');
      const payload = {
        household_id: householdId,
        owner_id: currentUser.id,
        visibility: f.visibility,
        name: f.name.trim(),
        account_type: f.account_type,
        opening_date: f.opening_date,
        opening_balance: opening,
        credit_limit: f.account_type === 'credit_card' ? limit : null,
      };
      let writeError;
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: payload.name,
            opening_date: payload.opening_date,
            opening_balance: payload.opening_balance,
            credit_limit: payload.credit_limit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAccount.id);
        writeError = error;
      } else {
        const { error } = await supabase.from('accounts').insert(payload);
        writeError = error;
      }
      if (writeError) throw writeError;
      setShowAddAccount(false);
      setMsg(
        editingAccount
          ? 'Account updated successfully.'
          : 'Account created successfully.'
      );
      setEditingAccount(null);
      await loadFinance(currentUser.id);
    } catch (err) {
      setAccountError(err.message || 'Could not create account.');
    } finally {
      setAccountSaving(false);
    }
  }

  const accountById = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const accountBalance = (a) => {
    const card = a.account_type === 'credit_card';
    const opening = Math.round(Number(a.opening_balance) * 100);
    const change = transactions
      .filter((t) => t.account_id === a.id)
      .reduce((sum, t) => {
        const amount = Math.round(Number(t.amount) * 100);
        const inflow = t.kind === 'income' || t.kind === 'transfer_in';
        return (
          sum + (card ? (inflow ? -amount : amount) : inflow ? amount : -amount)
        );
      }, 0);
    return (opening + change) / 100;
  };
  const activeAccounts = accounts.filter((a) => !a.archived_at);
  const visibleTransactions = transactions.filter(
    (t) => accountById[t.account_id]
  );
  const thisMonth = todayLocal().slice(0, 7);
  const budgetScope = (a, scope) => a && (scope === 'shared'
    ? a.visibility === 'shared'
    : a.visibility === 'personal' && a.owner_id === user?.id);
  const scopeBudgets = (scope, month) => budgets.filter((b) =>
    b.month === month && b.visibility === (scope === 'shared' ? 'shared' : 'personal') &&
    (scope === 'shared' || b.owner_id === user?.id));
  const spentInCategory = (scope, month, category) => Math.round(
    visibleTransactions.filter((t) => t.kind === 'expense' &&
      t.transaction_date?.startsWith(month) && t.category === category &&
      budgetScope(accountById[t.account_id], scope))
      .reduce((sum, t) => sum + Math.round(Number(t.amount) * 100), 0)) / 100;
  const budgetSummary = (scope, month) => {
    const items = scopeBudgets(scope, month);
    const limit = items.reduce((sum, b) => sum + Number(b.amount), 0);
    const spent = items.reduce((sum, b) => sum + spentInCategory(scope, month, b.category), 0);
    return { items, limit, spent, remaining: limit - spent };
  };
  function openBudgetForm(b = null) {
    setEditingBudget(b);
    setBudgetForm(b ? { category: b.category, amount: String(b.amount), visibility: b.visibility }
      : { ...emptyBudget(), visibility: view === 'shared' ? 'shared' : 'personal' });
    setBudgetFormError('');
    setShowBudgetForm(true);
  }
  async function saveBudget(e) {
    e.preventDefault();
    if (budgetSaving || !user) return;
    const amount = Number(budgetForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(budgetForm.amount.trim())) {
      setBudgetFormError('Enter a positive budget amount with up to 2 decimal places.'); return;
    }
    setBudgetSaving(true);
    setBudgetFormError('');
    try {
      let r;
      if (editingBudget) {
        r = await supabase.from('budgets').update({ amount, updated_at: new Date().toISOString() })
          .eq('id', editingBudget.id).eq('owner_id', user.id);
      } else {
        const { data: householdId, error: householdError } = await supabase.rpc('my_household_id');
        if (householdError) throw householdError;
        if (!householdId) throw new Error('Create or join a household first.');
        r = await supabase.from('budgets').insert({ household_id: householdId,
          owner_id: user.id, visibility: budgetForm.visibility, month: budgetMonth,
          category: budgetForm.category, amount });
      }
      if (r.error) throw r.error;
      setShowBudgetForm(false);
      setMsg(editingBudget ? 'Budget updated.' : 'Budget created.');
      await loadFinance(user.id);
    } catch (err) {
      setBudgetFormError(err.code === '23505' ? 'A budget already exists for this category and month.' : (err.message || 'Could not save budget.'));
    } finally { setBudgetSaving(false); }
  }
  async function deleteBudget(b) {
    if (!user || b.owner_id !== user.id || !window.confirm(`Delete ${b.category} budget for ${b.month}?`)) return;
    const { error } = await supabase.from('budgets').delete().eq('id', b.id).eq('owner_id', user.id);
    if (error) setBudgetsError(error.message);
    else { setMsg('Budget deleted.'); await loadFinance(user.id); }
  }

  const expenseTotal = (filter) =>
    visibleTransactions
      .filter(
        (t) =>
          t.kind === 'expense' &&
          t.transaction_date.startsWith(thisMonth) &&
          filter(accountById[t.account_id])
      )
      .reduce((n, t) => n + Number(t.amount), 0);
  const cashTotal = (filter) =>
    activeAccounts
      .filter((a) => a.account_type !== 'credit_card' && filter(a))
      .reduce((n, a) => n + accountBalance(a), 0);
  function openTxForm(kind = 'expense', accountId = '') {
    setEditingTx(null);
    setTxForm({
      ...emptyTransaction(),
      kind,
      account_id: accountId || activeAccounts[0]?.id || '',
      to_account_id: '',
    });
    setTxFormError('');
    setShowTx(true);
  }
  function editTransaction(t) {
    if (t.kind.startsWith('transfer')) return;
    setEditingTx(t);
    setTxForm({
      kind: t.kind,
      account_id: t.account_id,
      to_account_id: '',
      amount: String(t.amount),
      category: t.category,
      note: t.note,
      transaction_date: t.transaction_date,
    });
    setTxFormError('');
    setShowTx(true);
  }
  async function saveTransaction(e) {
    e.preventDefault();
    if (txSaving) return;
    setTxFormError('');
    const f = txForm,
      amount = Number(f.amount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(f.amount.trim())
    ) {
      setTxFormError('Enter a positive amount with up to 2 decimal places.');
      return;
    }
    if (!f.account_id || !f.transaction_date) {
      setTxFormError('Choose an account and date.');
      return;
    }
    if (
      f.kind === 'transfer' &&
      (!f.to_account_id || f.account_id === f.to_account_id)
    ) {
      setTxFormError('Choose a different destination account.');
      return;
    }
    setTxSaving(true);
    try {
      let r;
      if (f.kind === 'transfer') {
        r = await supabase.rpc('sage_make_transfer', {
          p_from: f.account_id,
          p_to: f.to_account_id,
          p_amount: amount,
          p_date: f.transaction_date,
          p_note: f.note.trim(),
        });
      } else if (editingTx) {
        r = await supabase
          .from('transactions')
          .update({
            amount,
            category: f.category,
            note: f.note.trim(),
            transaction_date: f.transaction_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTx.id);
      } else {
        r = await supabase
          .from('transactions')
          .insert({
            account_id: f.account_id,
            created_by: user.id,
            kind: f.kind,
            amount,
            category: f.category,
            note: f.note.trim(),
            transaction_date: f.transaction_date,
          });
      }
      if (r.error) throw r.error;
      setShowTx(false);
      setMsg(editingTx ? 'Transaction updated.' : 'Transaction saved.');
      await loadFinance(user.id);
    } catch (err) {
      setTxFormError(err.message || 'Could not save transaction.');
    } finally {
      setTxSaving(false);
    }
  }
  async function deleteTransaction(t) {
    if (t.kind.startsWith('transfer')) return;
    if (
      !window.confirm(
        'Delete this transaction? This changes the account balance.'
      )
    )
      return;
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', t.id);
    if (error) setTxError(error.message);
    else {
      setMsg('Transaction deleted.');
      await loadFinance(user.id);
    }
  }
  const txLabel = (t) =>
    t.kind === 'transfer_in'
      ? 'Transfer received'
      : t.kind === 'transfer_out'
      ? 'Transfer sent'
      : t.category;
  const txSign = (t) => {
    const card = accountById[t.account_id]?.account_type === 'credit_card';
    const incoming = t.kind === 'income' || t.kind === 'transfer_in';
    return (card ? !incoming : incoming) ? '+' : '−';
  };
  const txList = (items) =>
    items.length === 0 ? (
      <div className="card">
        <p className="muted">No transactions yet.</p>
      </div>
    ) : (
      items.map((t) => (
        <div className="card" key={t.id} style={{ marginBottom: 10 }}>
          <div className="card-head">
            <strong>{txLabel(t)}</strong>
            <strong>
              {txSign(t)} {money(t.amount)}
            </strong>
          </div>
          <p className="muted" style={{ margin: '5px 0' }}>
            {accountById[t.account_id]?.name || 'Account'} ·{' '}
            {t.transaction_date}
          </p>
          {t.note && <p style={{ margin: '6px 0' }}>{t.note}</p>}
          {!t.kind.startsWith('transfer') && t.created_by === user?.id && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="secondary" onClick={() => editTransaction(t)}>
                Edit
              </button>
              <button
                className="secondary"
                onClick={() => deleteTransaction(t)}
              >
                Delete
              </button>
            </div>
          )}
          {t.kind.startsWith('transfer') && (
            <small className="muted">
              Linked transfer · edit and delete disabled to preserve both sides
            </small>
          )}
        </div>
      ))
    );
  const transactionsPage = (
    <>
      <div className="hero">
        <small>Recorded transactions</small>
        <div className="balance">{visibleTransactions.length}</div>
        <small>Across your accessible accounts</small>
      </div>
      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
      >
        {[
          ['expense', '− Expense'],
          ['income', '+ Income'],
          ['transfer', '⇄ Transfer'],
        ].map(([k, l]) => (
          <button className="primary" key={k} onClick={() => openTxForm(k)}>
            {l}
          </button>
        ))}
      </div>
      {txError && (
        <div className="notice" role="alert">
          {txError}. Run Sage_transactions_setup.sql in Supabase if you haven't
          already.
        </div>
      )}
      {txLoading ? (
        <div className="card">Loading transactions…</div>
      ) : (
        txList(visibleTransactions)
      )}
    </>
  );
  const d = demo[view],
    privatePartner = view === 'partner';
  const homeBudget = user && view !== 'partner' ? budgetSummary(view, thisMonth) : null;
  const card = (children) => <div className="card">{children}</div>;
  const head = (title, link, fn) => (
    <div className="section-head">
      <h2>{title}</h2>
      {link && <button onClick={fn}>{link} →</button>}
    </div>
  );
  const home = (
    <>
      <div className="hero">
        <small>
          {view === 'mine'
            ? 'Total balance'
            : privatePartner
            ? 'Partner balance summary'
            : 'Shared balance'}
        </small>
        <div className="balance">
          {user && !accountsError
            ? money(
                cashTotal((a) =>
                  view === 'mine'
                    ? a.visibility === 'personal' && a.owner_id === user.id
                    : view === 'shared'
                    ? a.visibility === 'shared'
                    : false
                )
              )
            : money(d.balance)}
        </div>
        <div className="hero-bottom">
          <div className="metric">
            <small>Monthly spending</small>
            <strong>
              {user && !txError
                ? money(
                    expenseTotal((a) =>
                      view === 'mine'
                        ? a.visibility === 'personal' && a.owner_id === user.id
                        : view === 'shared'
                        ? a.visibility === 'shared'
                        : false
                    )
                  )
                : money(d.spent)}
            </strong>
          </div>
          <div className="metric">
            <small>Budget remaining</small>
            <strong>{homeBudget && !budgetsError ? money(homeBudget.remaining) : '—'}</strong>
          </div>
        </div>
      </div>
      {head('Budget remaining', 'View budget', () => setTab('budget'))}
      {card(
        <>
          <div className="card-head">
            <strong>{homeBudget && !budgetsError && homeBudget.items.length ? `${money(homeBudget.remaining)} left this month` : 'No budget set'}</strong>
            <span className="muted">
              {homeBudget && homeBudget.limit > 0 ? `${Math.round((homeBudget.spent / homeBudget.limit) * 100)}% used` : '—'}
            </span>
          </div>
          <Progress value={homeBudget?.spent || 0} max={homeBudget?.limit || 0} />
        </>
      )}
      {head('Savings goals', 'View goals', () => setTab('goals'))}
      {card(
        <>
          <div className="card-head">
            <strong>{money(d.goals)} saved</strong>
            <span className="muted">
              {Math.round((d.goals / d.goalTarget) * 100)}%
            </span>
          </div>
          <Progress value={d.goals} max={d.goalTarget} />
        </>
      )}
      {head('Cards', null)}
      <div className="two-cards">
        <div className="card mini">
          <small>Debit · Available</small>
          <strong>RM 2,450</strong>
        </div>
        <div className="card mini">
          <small>Credit · Used</small>
          <strong>RM 1,280</strong>
        </div>
      </div>
      <p className="muted">
        Card amounts are sample placeholders. Live tracking is reserved for
        Phase 3.
      </p>
      {head('Recent transactions', 'See all', () => setTab('transactions'))}
      {privatePartner
        ? card(
            <div className="notice">
              Private partner transactions are hidden.
            </div>
          )
        : txList(
            visibleTransactions
              .filter((t) => {
                const a = accountById[t.account_id];
                return (
                  a &&
                  (view === 'shared'
                    ? a.visibility === 'shared'
                    : a.visibility === 'personal' && a.owner_id === user?.id)
                );
              })
              .slice(0, 3)
          )}
      {head('Wishlist preview', 'View wishlist', () => setTab('wishlist'))}
      {card(
        <>
          <div className="card-head">
            <strong>Wishlist</strong>
            <span className="muted">{money(d.wishes)} planned</span>
          </div>
          <div className="wishlist">
            <div className="wish">
              👟<strong>Running shoes</strong>
              <small>RM 450</small>
            </div>
            <div className="wish">
              ✈️<strong>Weekend trip</strong>
              <small>RM 1,500</small>
            </div>
          </div>
        </>
      )}
    </>
  );
  const typeNames = {
    savings: 'Savings account',
    current: 'Current account',
    credit_card: 'Credit card',
    ewallet: 'E-wallet',
    cash: 'Cash',
  };
  const displayedAccounts = accounts.filter(
    (a) => Boolean(a.archived_at) === showArchived
  );
  const accountsPage = (
    <>
      <div className="hero">
        <small>
          {showArchived ? 'Archived accounts' : 'Your visible accounts'}
        </small>
        <div className="balance">
          {displayedAccounts.length}{' '}
          {displayedAccounts.length === 1 ? 'account' : 'accounts'}
        </div>
        <small>Personal and shared accounts</small>
      </div>
      <div className="section-head">
        <h2>Accounts</h2>
        <button
          disabled={!user || accountsLoading}
          onClick={() => loadAccounts(user?.id)}
        >
          Refresh ↻
        </button>
      </div>
      {user && (
        <>
          <button
            className="primary"
            onClick={openAccountForm}
            style={{ marginBottom: 12, width: '100%' }}
          >
            + Add account
          </button>
          <div className="switcher" style={{ marginBottom: 16 }}>
            <button
              className={!showArchived ? 'active' : ''}
              onClick={() => setShowArchived(false)}
            >
              Active
            </button>
            <button
              className={showArchived ? 'active' : ''}
              onClick={() => setShowArchived(true)}
            >
              Archived ({accounts.filter((a) => a.archived_at).length})
            </button>
          </div>
        </>
      )}
      {!user ? (
        <div className="card">
          <strong>Sign in to see your accounts</strong>
          <p className="muted">
            Your accounts are stored securely in Supabase.
          </p>
          <button className="primary" onClick={() => setShowAuth(true)}>
            Sign in
          </button>
        </div>
      ) : accountsLoading ? (
        <div className="card">Loading accounts...</div>
      ) : accountsError ? (
        <div className="card" role="alert">
          <strong>Unable to manage accounts</strong>
          <p>{accountsError}</p>
        </div>
      ) : displayedAccounts.length === 0 ? (
        <div className="card">
          <strong>
            {showArchived ? 'No archived accounts' : 'No active accounts yet'}
          </strong>
          <p className="muted">
            {showArchived
              ? 'Archived accounts will appear here and can be restored.'
              : 'Add a savings, current, credit card, e-wallet or cash account to get started.'}
          </p>
        </div>
      ) : (
        displayedAccounts.map((a) => (
          <div className="card" key={a.id}>
            <div className="card-head">
              <strong>{a.name}</strong>
              <span className="muted">
                {a.visibility === 'shared' ? 'Shared' : 'Personal'}
              </span>
            </div>
            <p className="muted">
              {typeNames[a.account_type] || a.account_type}
            </p>
            <small className="muted">
              {a.account_type === 'credit_card'
                ? 'Opening amount owed'
                : 'Opening balance'}
            </small>
            <div
              className="balance"
              style={{ fontSize: 26, marginTop: 6, marginBottom: 8 }}
            >
              {money(accountBalance(a))}
            </div>
            {a.account_type === 'credit_card' && (
              <p className="muted">Credit limit: {money(a.credit_limit)}</p>
            )}
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 12,
              }}
            >
              {!a.archived_at && (
                <>
                  <button
                    className="secondary"
                    style={{ flex: 1 }}
                    onClick={() => editAccount(a)}
                  >
                    Edit
                  </button>
                  <button
                    className="secondary"
                    style={{ flex: 1 }}
                    onClick={() => openTxForm('expense', a.id)}
                  >
                    + Transaction
                  </button>
                </>
              )}
              <button
                className="secondary"
                style={{ flex: 1 }}
                onClick={() => setArchived(a, !a.archived_at)}
              >
                {a.archived_at ? 'Restore' : 'Archive'}
              </button>
            </div>
          </div>
        ))
      )}
      <p className="muted">
        Archive preserves account history. Account type and visibility cannot be
        changed after creation under the current database permissions. Balances
        include recorded transactions. Credit-card balances represent amounts
        owed.
      </p>
    </>
  );
  const other =
    tab === 'budget' ? (
      <>
        
<div className="card" style={{ marginBottom: 14 }}>
  <div
    className="muted"
    style={{ fontSize: 12, fontWeight: 650, marginBottom: 16 }}
  >
    BUDGET MONTH
  </div>

  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    }}
  >
    <button
      type="button"
      className="secondary"
      aria-label="Previous month"
      onClick={() => shiftBudgetMonth(-1)}
      style={{
        width: 44,
        height: 44,
        minWidth: 44,
        flex: '0 0 44px',
        padding: 0,
        fontSize: 24,
        borderRadius: 14,
      }}
    >
      ‹
    </button>

    <strong
      style={{
        textAlign: 'center',
        fontSize: 17,
        width: 145,
        flexShrink: 0,
      }}
    >
      {budgetMonthLabel}
    </strong>

    <button
      type="button"
      className="secondary"
      aria-label="Next month"
      onClick={() => shiftBudgetMonth(1)}
      style={{
        width: 44,
        height: 44,
        minWidth: 44,
        flex: '0 0 44px',
        padding: 0,
        fontSize: 24,
        borderRadius: 14,
      }}
    >
      ›
    </button>
  </div>
</div>

        {view === 'partner' ? (
          <div className="card"><strong>Partner budgets are private</strong>
            <p className="muted">Only your partner can see their personal budgets. Switch to Shared to see your household budgets.</p>
          </div>
        ) : !user ? (
          <div className="card"><strong>Sign in to manage budgets</strong>
            <p className="muted">Your budgets are saved securely in Supabase.</p>
            <button className="primary" onClick={() => setShowAuth(true)}>Sign in</button>
          </div>
        ) : budgetsLoading ? (
          <div className="card">Loading budgets…</div>
        ) : budgetsError ? (
          <div className="card" role="alert"><strong>Could not load budgets</strong>
            <p className="muted">{budgetsError}</p>
            <p className="muted">Run Sage_budget_setup.sql in your Supabase SQL Editor, then refresh Sage.</p>
          </div>
        ) : (
          <>
            {(() => {
              const summary = budgetSummary(view, budgetMonth);
              return <>
                <div className="hero">
                  <small>{view === 'shared' ? 'Shared budget remaining' : 'Personal budget remaining'} · {budgetMonth}</small>
                  <div className="balance">{summary.items.length ? money(summary.remaining) : money(0)}</div>
                  <div className="hero-bottom">
                    <div className="metric"><small>Budgeted</small><strong>{money(summary.limit)}</strong></div>
                    <div className="metric"><small>Spent in budgeted categories</small><strong>{money(summary.spent)}</strong></div>
                  </div>
                </div>
                {summary.items.length > 0 && <div className="card" style={{ marginBottom: 14 }}>
                  <div className="card-head"><strong>Overall progress</strong>
                    <span className="muted">{summary.limit > 0 ? Math.round(summary.spent / summary.limit * 100) : 0}% used</span></div>
                  <Progress value={summary.spent} max={summary.limit} />
                </div>}
                <button className="primary" style={{ width: '100%', marginBottom: 14 }} onClick={() => openBudgetForm()}>
                  + Add category budget
                </button>
                {summary.items.length === 0 ? <div className="card"><strong>No budgets for this month yet</strong>
                  <p className="muted">Set a limit for each spending category. Sage will calculate spending from your recorded expenses automatically.</p>
                </div> : summary.items.map((b) => {
                  const spent = spentInCategory(view, budgetMonth, b.category);
                  const remaining = Number(b.amount) - spent;
                  return <div className="card" key={b.id} style={{ marginBottom: 10 }}>
                    <div className="card-head"><strong>{b.category}</strong>
                      <span className="muted">{money(spent)} / {money(b.amount)}</span></div>
                    <Progress value={spent} max={Number(b.amount)} />
                    <p className="muted" style={{ marginTop: 8, color: remaining < 0 ? '#a33a3a' : undefined }}>
                      {remaining < 0 ? `${money(-remaining)} over budget` : `${money(remaining)} remaining`}
                    </p>
                    {b.owner_id === user.id && <div style={{ display: 'flex', gap: 8 }}>
                      <button className="secondary" onClick={() => openBudgetForm(b)}>Edit</button>
                      <button className="secondary" onClick={() => deleteBudget(b)}>Delete</button>
                    </div>}
                  </div>;
                })}
                <p className="muted">Only expenses count towards budgets. Income and transfers are excluded. Spending outside budgeted categories is not included in the overall progress.</p>
              </>;
            })()}
          </>
        )}
      </>
    ) : tab === 'goals' ? (
      <>
        <div className="hero">
          <small>Total saved towards goals</small>
          <div className="balance">{money(d.goals)}</div>
          <small>Manual contributions</small>
        </div>
        {[
          ['Emergency fund', 3500, 10000],
          ['Holiday fund', 1200, 4000],
        ].map(([n, s, l]) => (
          <div className="card" key={n}>
            <div className="card-head">
              <strong>{n}</strong>
              <span className="muted">{Math.round((100 * s) / l)}%</span>
            </div>
            <Progress value={s} max={l} />
          </div>
        ))}
      </>
    ) : (
      <>
        <div className="hero">
          <small>Wishlist total</small>
          <div className="balance">{money(d.wishes)}</div>
          <small>Shopping cards</small>
        </div>
        <div className="wishlist">
          <div className="card wish-large">
            👟<strong>Running shoes</strong>
            <small>RM 450</small>
          </div>
          <div className="card wish-large">
            ✈️<strong>Weekend getaway</strong>
            <small>RM 1,500</small>
          </div>
        </div>
      </>
    );

  return (
    <main className="app" style={{ paddingBottom: 190 }}>
      {!configured && (
        <div className="banner">
          <strong>Preview mode</strong> · Add Supabase environment variables to
          enable real accounts. Dashboard financial figures are examples.
        </div>
      )}
      {loading ? (
        <p>Loading Sage…</p>
      ) : (
        <>
          <header className="header">
            <div>
              <div className="sage-brand">
                <span className="sage-brand-mark" aria-hidden="true">
                  S
                </span>
                <span className="sage-brand-name">sage.</span>
              </div>
              <div className="eyebrow">
                YOUR MONEY, TOGETHER. / {tab.toUpperCase()}
              </div>
              <h1>
                {tab === 'home'
                  ? `${greeting()}, ${profile?.display_name || 'there'}`
                  : {
                      accounts: 'Your accounts',
                      transactions: 'Transactions',
                      budget: 'Your budget',
                      goals: 'Savings goals',
                      wishlist: 'Wishlist',
                    }[tab]}
              </h1>
            </div>
            <button
              className="avatar"
              aria-label="Profile and household settings"
              onClick={() => setShowAuth(true)}
            >
              ◯
            </button>
          </header>
          <div className="switcher">
            {[
              ['mine', 'Mine'],
              ['partner', 'Partner'],
              ['shared', 'Shared'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={view === id ? 'active' : ''}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'home'
            ? home
            : tab === 'accounts'
            ? accountsPage
            : tab === 'transactions'
            ? transactionsPage
            : other}
          <div className="preview">
            {
              'Sage · Accounts, transactions and budgets are live · Goals and wishlist are sample data'
            }
          </div>
        </>
      )}
      {showAuth && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Account settings"
        >
          <div className="modal">
            <button
              className="close"
              onClick={() => {
                setShowAuth(false);
                setMsg('');
              }}
            >
              ×
            </button>
            <h2>{user ? 'Your Sage account' : 'Welcome to Sage'}</h2>
            {!configured ? (
              <div className="notice">
                Cloud sign-in is not configured. Set your Supabase URL and
                publishable key.
              </div>
            ) : !user ? (
              <>
                <div className="switcher">
                  <button
                    className={authMode === 'password' ? 'active' : ''}
                    onClick={() => setAuthMode('password')}
                  >
                    Password
                  </button>
                  <button
                    className={authMode === 'link' ? 'active' : ''}
                    onClick={() => setAuthMode('link')}
                  >
                    Email link
                  </button>
                </div>
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                {authMode === 'password' && (
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </label>
                )}
                <button
                  className="primary"
                  disabled={busy || !email}
                  onClick={() => auth(false)}
                >
                  {authMode === 'link' ? 'Send sign-in link' : 'Sign in'}
                </button>
                {authMode === 'password' && (
                  <button
                    className="secondary"
                    disabled={busy || !email || !password}
                    onClick={() => auth(true)}
                  >
                    Create account
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="muted">Signed in as {user.email}</p>
                <label>
                  Display name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  disabled={busy || !name.trim()}
                  onClick={saveProfile}
                >
                  Save profile
                </button>
                <button
                  className="secondary"
                  onClick={() => setShowHouse(true)}
                >
                  Manage household
                </button>
                <button
                  className="text-button"
                  onClick={() => supabase.auth.signOut()}
                >
                  Sign out
                </button>
              </>
            )}
            {msg && (
              <div className="notice" role="status">
                {msg}
              </div>
            )}
          </div>
        </div>
      )}
      {showHouse && user && (
        <div
          className="overlay top"
          role="dialog"
          aria-modal="true"
          aria-label="Household"
        >
          <div className="modal">
            <button className="close" onClick={() => setShowHouse(false)}>
              ×
            </button>
            <h2>Household sharing</h2>
            {household ? (
              <>
                <p>
                  Your household: <strong>{household.name}</strong>
                </p>
                <div className="switcher">
                  <button
                    className={inviteMethod === 'code' ? 'active' : ''}
                    onClick={() => setInviteMethod('code')}
                  >
                    Invite code
                  </button>
                  <button
                    className={inviteMethod === 'email' ? 'active' : ''}
                    onClick={() => setInviteMethod('email')}
                  >
                    Email invite
                  </button>
                </div>
                {inviteMethod === 'email' && (
                  <label>
                    Partner email
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </label>
                )}
                <button
                  className="primary"
                  disabled={busy || (inviteMethod === 'email' && !inviteEmail)}
                  onClick={makeInvite}
                >
                  Generate invitation
                </button>
                {inviteCode && (
                  <div className="notice">
                    <strong>Invite code: {inviteCode}</strong>
                    <button
                      className="secondary"
                      onClick={() => navigator.clipboard?.writeText(inviteCode)}
                    >
                      Copy code
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <label>
                  Household name
                  <input
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  disabled={busy || !householdName.trim()}
                  onClick={createHouse}
                >
                  Create household
                </button>
                <p className="muted">Or join an existing household:</p>
                <label>
                  Invite code
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  disabled={busy || !joinCode.trim()}
                  onClick={joinHouse}
                >
                  Join household
                </button>
              </>
            )}
            {msg && <div className="notice">{msg}</div>}
          </div>
        </div>
      )}
      {showBudgetForm && user && (
        <div className="overlay top" role="dialog" aria-modal="true" aria-label="Budget editor">
          <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <button className="close" type="button" onClick={() => setShowBudgetForm(false)} disabled={budgetSaving}>×</button>
            <h2>{editingBudget ? 'Edit budget' : 'Add category budget'}</h2>
            <p className="muted">{editingBudget?.month || budgetMonth} · {editingBudget?.visibility === 'shared' || (!editingBudget && budgetForm.visibility === 'shared') ? 'Shared' : 'Personal'}</p>
            <form onSubmit={saveBudget}>
              {!editingBudget && <>
                <label>Visibility
                  <select value={budgetForm.visibility} onChange={(e) => setBudgetForm((p) => ({ ...p, visibility: e.target.value }))}>
                    <option value="personal">Personal — only me</option>
                    <option value="shared">Shared — household</option>
                  </select>
                </label>
                <label>Category
                  <select value={budgetForm.category} onChange={(e) => setBudgetForm((p) => ({ ...p, category: e.target.value }))}>
                    {budgetCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </>}
              {editingBudget && <p><strong>{editingBudget.category}</strong></p>}
              <label>Monthly limit (RM)
                <input type="number" min="0.01" step="0.01" required value={budgetForm.amount}
                  onChange={(e) => setBudgetForm((p) => ({ ...p, amount: e.target.value }))} placeholder="e.g. 800.00" />
              </label>
              {budgetFormError && <div className="notice" role="alert">{budgetFormError}</div>}
              <button className="primary" type="submit" disabled={budgetSaving} style={{ width: '100%', marginTop: 12 }}>
                {budgetSaving ? 'Saving…' : editingBudget ? 'Save changes' : 'Create budget'}
              </button>
            </form>
          </div>
        </div>
      )}
      {showAddAccount && (
        <div
          className="overlay top"
          role="dialog"
          aria-modal="true"
          aria-label={editingAccount ? 'Edit account' : 'Add account'}
        >
          <div
            className="modal"
            style={{ maxHeight: '85vh', overflowY: 'auto' }}
          >
            <button
              type="button"
              className="close"
              disabled={accountSaving}
              onClick={() => setShowAddAccount(false)}
            >
              ×
            </button>
            <h2>{editingAccount ? 'Edit account' : 'Add account'}</h2>
            <p className="muted">
              {editingAccount
                ? 'Update account details.'
                : 'Create a personal or shared account.'}
            </p>
            <form onSubmit={saveAccount}>
              <label>
                Account name
                <input
                  required
                  maxLength={100}
                  placeholder="e.g. Maybank Savings"
                  value={accountForm.name}
                  onChange={(e) => changeAccount('name', e.target.value)}
                />
              </label>
              <div style={{ margin: '16px 0' }}>
                <div style={{ fontWeight: 650, marginBottom: 10 }}>
                  Account type
                </div>
                <div
                  role="group"
                  aria-label="Account type"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                    gap: 10,
                  }}
                >
                  {[
                    ['savings', '🐷', 'Savings'],
                    ['current', '🏦', 'Current'],
                    ['credit_card', '💳', 'Credit card'],
                    ['ewallet', '📱', 'E-wallet'],
                    ['cash', '💵', 'Cash'],
                  ].map(([value, icon, label]) => {
                    const selected = accountForm.account_type === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!!editingAccount}
                        aria-pressed={selected}
                        onClick={() => changeAccount('account_type', value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          textAlign: 'left',
                          padding: '13px 12px',
                          borderRadius: 14,
                          border: selected
                            ? '2px solid #648fa9'
                            : '1px solid #d8e4ec',
                          background: selected ? '#F5EFC6' : '#fff',
                          color: '#4A2E27',
                          fontWeight: selected ? 700 : 500,
                          cursor: 'pointer',
                          minWidth: 0,
                        }}
                      >
                        <span aria-hidden="true" style={{ fontSize: 20 }}>
                          {icon}
                        </span>
                        <span>{label}</span>
                        {selected && (
                          <span
                            aria-hidden="true"
                            style={{ marginLeft: 'auto' }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ margin: '18px 0' }}>
                <div style={{ fontWeight: 650, marginBottom: 10 }}>
                  Visibility
                </div>
                <div
                  role="group"
                  aria-label="Visibility"
                  style={{ display: 'grid', gap: 10 }}
                >
                  {[
                    [
                      'personal',
                      '🔒',
                      'Personal',
                      'Only you can view this account.',
                    ],
                    [
                      'shared',
                      '👥',
                      'Shared',
                      'Both household members can view this account.',
                    ],
                  ].map(([value, icon, label, description]) => {
                    const selected = accountForm.visibility === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!!editingAccount}
                        aria-pressed={selected}
                        onClick={() => changeAccount('visibility', value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          width: '100%',
                          textAlign: 'left',
                          padding: 14,
                          borderRadius: 14,
                          border: selected
                            ? '2px solid #648fa9'
                            : '1px solid #d8e4ec',
                          background: selected ? '#F5EFC6' : '#fff',
                          color: '#4A2E27',
                          cursor: 'pointer',
                        }}
                      >
                        <span aria-hidden="true" style={{ fontSize: 22 }}>
                          {icon}
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            flex: 1,
                          }}
                        >
                          <strong>{label}</strong>
                          <small
                            style={{
                              fontSize: 12,
                              color: '#6E5A53',
                              lineHeight: 1.4,
                            }}
                          >
                            {description}
                          </small>
                        </span>
                        {selected && <span aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label>
                Opening date
                <input
                  required
                  type="date"
                  value={accountForm.opening_date}
                  onChange={(e) =>
                    changeAccount('opening_date', e.target.value)
                  }
                />
              </label>
              <label>
                {accountForm.account_type === 'credit_card'
                  ? 'Opening amount owed (RM)'
                  : 'Opening balance (RM)'}
                <input
                  required
                  type="number"
                  step="0.01"
                  min={
                    accountForm.account_type === 'credit_card' ? '0' : undefined
                  }
                  value={accountForm.opening_balance}
                  onChange={(e) =>
                    changeAccount('opening_balance', e.target.value)
                  }
                />
              </label>
              {accountForm.account_type === 'credit_card' && (
                <label>
                  Credit limit (RM)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={accountForm.credit_limit}
                    onChange={(e) =>
                      changeAccount('credit_limit', e.target.value)
                    }
                  />
                </label>
              )}
              <p className="muted">
                {accountForm.visibility === 'personal'
                  ? 'Only you can view this account.'
                  : 'Both household members can view this account.'}{' '}
                Balances will be calculated from transactions in a later phase.
              </p>
              {accountError && (
                <div className="notice" role="alert">
                  {accountError}
                </div>
              )}
              <button
                type="submit"
                className="primary"
                disabled={accountSaving || !user}
              >
                {accountSaving
                  ? 'Saving…'
                  : editingAccount
                  ? 'Save changes'
                  : 'Save account'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={accountSaving}
                onClick={() => setShowAddAccount(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
      {showTx && (
        <div
          className="overlay top"
          role="dialog"
          aria-modal="true"
          aria-label="Record transaction"
        >
          <div
            className="modal"
            style={{ maxHeight: '85vh', overflowY: 'auto' }}
          >
            <button
              className="close"
              disabled={txSaving}
              onClick={() => setShowTx(false)}
            >
              ×
            </button>
            <h2>{editingTx ? 'Edit transaction' : 'Record transaction'}</h2>
            <form onSubmit={saveTransaction}>
              {!editingTx && (
                <div className="switcher">
                  {[
                    ['expense', 'Expense'],
                    ['income', 'Income'],
                    ['transfer', 'Transfer'],
                  ].map(([k, l]) => (
                    <button
                      type="button"
                      key={k}
                      className={txForm.kind === k ? 'active' : ''}
                      onClick={() =>
                        setTxForm((f) => ({
                          ...f,
                          kind: k,
                          category: k === 'income' ? 'Salary' : 'Food & drinks',
                        }))
                      }
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
              <label>
                {txForm.kind === 'transfer' ? 'From account' : 'Account'}
                <select
                  required
                  value={txForm.account_id}
                  disabled={!!editingTx}
                  onChange={(e) =>
                    setTxForm((f) => ({ ...f, account_id: e.target.value }))
                  }
                >
                  <option value="">Choose account</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.visibility})
                    </option>
                  ))}
                </select>
              </label>
              {txForm.kind === 'transfer' && (
                <label>
                  To account
                  <select
                    required
                    value={txForm.to_account_id}
                    onChange={(e) =>
                      setTxForm((f) => ({
                        ...f,
                        to_account_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Choose destination</option>
                    {activeAccounts
                      .filter((a) => a.id !== txForm.account_id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.visibility})
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Amount (RM)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={txForm.amount}
                  onChange={(e) =>
                    setTxForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </label>
              {txForm.kind !== 'transfer' && (
                <label>
                  Category
                  <select
                    value={txForm.category}
                    onChange={(e) =>
                      setTxForm((f) => ({ ...f, category: e.target.value }))
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Date
                <input
                  type="date"
                  required
                  value={txForm.transaction_date}
                  onChange={(e) =>
                    setTxForm((f) => ({
                      ...f,
                      transaction_date: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Note (optional)
                <input
                  maxLength={300}
                  value={txForm.note}
                  onChange={(e) =>
                    setTxForm((f) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="What was this for?"
                />
              </label>
              {txForm.kind === 'transfer' && (
                <p className="muted">
                  Transfers move balances without recording income or expenses.
                  Repay a credit card by transferring from a cash/bank account
                  to the credit-card account.
                </p>
              )}
              {txFormError && (
                <div className="notice" role="alert">
                  {txFormError}
                </div>
              )}
              <button
                type="submit"
                className="primary"
                disabled={txSaving || !user}
              >
                {txSaving ? 'Saving…' : 'Save transaction'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={txSaving}
                onClick={() => setShowTx(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
      <style>{`.nav .add { width:44px !important; height:44px !important; min-width:44px !important; min-height:44px !important; border-radius:50% !important; font-size:24px !important; padding:0 !important; }`}</style>
      <div className="nav-wrap">
        <nav
          className="nav"
          style={{ display: 'block', padding: '10px 12px 8px' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5,minmax(0,1fr))',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {[
              ['home', '⌂', 'Home'],
              ['accounts', '▣', 'Accounts'],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  minWidth: 0,
                  padding: '6px 2px',
                  border: 0,
                  background: 'transparent',
                  color: tab === id ? '#4D0E12' : '#655854',
                  fontWeight: tab === id ? 700 : 500,
                }}
                onClick={() => {
                  setTab(id);
                  window.scrollTo(0, 0);
                }}
              >
                <span style={{ fontSize: 21, lineHeight: 1.1 }}>{icon}</span>
                <span style={{ fontSize: 10 }}>{label}</span>
              </button>
            ))}
            <button
              className="add"
              aria-label="Quick Add transaction"
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                padding: 0,
                margin: '0 auto',
                borderRadius: '50%',
                fontSize: 24,
                fontWeight: 400,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
              onClick={() => {
                if (user) openTxForm();
                else setShowAuth(true);
              }}
            >
              +
            </button>
            {[
              ['transactions', '⇄', 'Activity'],
              ['budget', '▤', 'Budget'],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  minWidth: 0,
                  padding: '6px 2px',
                  border: 0,
                  background: 'transparent',
                  color: tab === id ? '#4D0E12' : '#655854',
                  fontWeight: tab === id ? 700 : 500,
                }}
                onClick={() => {
                  setTab(id);
                  window.scrollTo(0, 0);
                }}
              >
                <span style={{ fontSize: 21, lineHeight: 1.1 }}>{icon}</span>
                <span style={{ fontSize: 10 }}>{label}</span>
              </button>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
              padding: '3px 0 2px',
            }}
          >
            {[
              ['goals', '◎ Goals'],
              ['wishlist', '♧ Wishlist'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: '5px 7px',
                  fontSize: 11,
                  color: tab === id ? '#4D0E12' : '#655854',
                  fontWeight: tab === id ? 700 : 500,
                }}
                onClick={() => {
                  setTab(id);
                  window.scrollTo(0, 0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </div>
      {msg && !showAuth && !showHouse && !showAddAccount && !showTx && !showBudgetForm && (
        <div className="toast" role="status" onClick={() => setMsg('')}>
          {msg} ×
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
