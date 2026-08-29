import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import {
  fallbackCatalog,
  fallbackHome,
  fallbackNest,
  fallbackWork,
  formatRupees,
  normalizeCatalog
} from "./data";
import { Icon } from "./icons";
import { getCopy, languageOptions } from "./i18n";

const tabs = [
  ["work", "work"],
  ["nest", "live"],
  ["save", "save"],
  ["home", "send"]
];

function Header({ title, bagCount, onBag, onBack }) {
  return (
    <header className="nia-save__header">
      {onBack ? (
        <button className="nia-save__icon-button" onClick={onBack} aria-label="Go back">
          <Icon name="back" />
        </button>
      ) : null}
      <h1>{title}</h1>
      <button className="nia-save__bag" onClick={onBag} aria-label={`Open bag, ${bagCount} items`}>
        <Icon name="bag" size={29} />
        {bagCount > 0 ? <span>{bagCount}</span> : null}
      </button>
    </header>
  );
}

function BottomNav({ active, onChange, t }) {
  return (
    <nav className="nia-save__nav" aria-label="Member sections">
      {tabs.map(([id, icon]) => (
        <button key={id} className={active === id ? "is-active" : ""} onClick={() => onChange(id)}>
          <Icon name={icon} size={25} strokeWidth={2.2} />
          <span>{t.nav[id]}</span>
        </button>
      ))}
    </nav>
  );
}

function LanguageMenu({ language, onChange, t }) {
  const [open, setOpen] = useState(false);
  const selected = languageOptions.find((option) => option.id === language) || languageOptions[0];
  return (
    <div className="nia-save__language">
      <button className="nia-save__language-trigger" onClick={() => setOpen((value) => !value)} aria-label={t.language} aria-expanded={open}>
        {selected.code}<Icon name="chevron" size={14} />
      </button>
      {open ? (
        <div className="nia-save__language-menu" role="menu">
          {languageOptions.map((option) => (
            <button key={option.id} className={option.id === language ? "is-active" : ""} onClick={() => { onChange(option.id); setOpen(false); }} role="menuitem">
              <span>{option.label}</span><small>{option.code}</small>{option.id === language ? <Icon name="check" size={17} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductCard({ product, onOpen, onAdd, t }) {
  const saving = Math.max(0, product.mrp - product.price);
  return (
    <article className="nia-save__product-card">
      <button className="nia-save__product-open" onClick={() => onOpen(product.id)} aria-label={`View ${product.name}`}>
        <span className={`nia-save__pack-plate${product.id === "navratna" ? " nia-save__pack-plate--contain" : ""}`}>
          <span className="nia-save__price-proof">{t.checked}</span>
          <img src={product.image} alt={product.name} />
        </span>
        <span className="nia-save__product-name">{product.name}</span>
        <span className="nia-save__product-meta">{product.hindi} · {product.size}</span>
        {product.id === "soap" ? <span className="nia-save__product-tagline">{t.soapWeek}</span> : null}
      </button>
      <div className="nia-save__product-price">
        <span><strong>{formatRupees(product.price)}</strong><s>{formatRupees(product.mrp)}</s></span>
        <small>{t.saveWord} {formatRupees(saving)}</small>
      </div>
      <button className="nia-save__add" onClick={() => onAdd(product.id)} disabled={product.outOfStock}>
        {product.outOfStock ? t.out : t.add}
      </button>
    </article>
  );
}

function SaveShop({ catalog, bagCount, onBag, onAdd, onOpenProduct, onOpenSavings, language, onLanguage, t }) {
  const [query, setQuery] = useState("");
  const savingsGoal = 700;
  const savingsProgress = Math.min(100, Math.round((catalog.weeklySavings / savingsGoal) * 100));
  const products = catalog.products.filter((product) => {
    const haystack = [product.name, product.hindi, product.size, ...(product.searchTerms || [])].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="nia-save__screen nia-save__save-screen">
      <main className="nia-save__content nia-save__shop">
        <header className="nia-save__brand-bar">
          <h1>NiaSave</h1>
          <div className="nia-save__brand-actions">
            <LanguageMenu language={language} onChange={onLanguage} t={t} />
            <button className="nia-save__shop-bag" onClick={onBag} aria-label={`${t.bag}, ${bagCount}`}>
              <Icon name="bag" size={29} />
              {bagCount > 0 ? <span>{bagCount}</span> : null}
            </button>
          </div>
        </header>
        <section className="nia-save__promise" aria-label="Your NiaSave promise">
          <p><Icon name="location" size={22} /><span>{catalog.studioName} · {catalog.deliveryTime}</span></p>
          <p><Icon name="studio" size={22} /><span>{t.deliveredTo}</span></p>
          <button className="nia-save__weekly-progress" onClick={onOpenSavings}>
            <Icon name="save" size={32} />
            <span className="nia-save__weekly-progress-copy">
              <span><strong>{t.weeklySavings}</strong><b>{formatRupees(catalog.weeklySavings)} {t.savedOf} {formatRupees(savingsGoal)}</b></span>
              <span className="nia-save__progress-row"><i><b style={{ width: `${savingsProgress}%` }} /></i><em>{savingsProgress}%</em></span>
            </span>
          </button>
          <p className="nia-save__fever-promise"><Icon name="shield" size={28} /><strong>{t.fever}</strong></p>
        </section>
        <label className="nia-save__search">
          <Icon name="search" size={22} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
        </label>
        <div className="nia-save__section-title"><h2>{t.daily}</h2><button onClick={() => setQuery("")}>{t.seeAll}</button></div>
        <section className="nia-save__product-grid" aria-label="Essentials">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={onOpenProduct} onAdd={onAdd} t={t} />
          ))}
        </section>
        {products.length === 0 ? <p className="nia-save__empty">{t.noPack}</p> : null}
      </main>
    </div>
  );
}

function ProductDetail({ product, bagCount, onBag, onBack, onAdd, t }) {
  const saving = Math.max(0, product.mrp - product.price);
  return (
    <div className="nia-save__screen nia-save__save-screen">
      <main className="nia-save__content nia-save__detail">
        <header className="nia-save__detail-tools">
          <button className="nia-save__round-control" onClick={onBack} aria-label="Go back"><Icon name="back" size={21} /></button>
          <button className="nia-save__detail-bag" onClick={onBag} aria-label={`${t.bag}, ${bagCount}`}><Icon name="bag" size={19} /><span>{bagCount || t.bag}</span></button>
        </header>
        <div className={`nia-save__detail-plate${product.id === "navratna" ? " nia-save__detail-plate--contain" : ""}`}><span>{t.checked}</span><img src={product.image} alt={product.name} /></div>
        <h1>{product.name}</h1>
        <p className="nia-save__detail-meta">{product.hindi} · {product.size}</p>
        {product.id === "soap" ? <p className="nia-save__detail-tagline">{t.soapWeek}</p> : null}
        <div className="nia-save__detail-price"><strong>{formatRupees(product.price)}</strong><s>{formatRupees(product.mrp)} {t.atKirana}</s><span>{t.saveWord} {formatRupees(saving)}</span></div>
        <section className="nia-save__detail-proof"><Icon name="shield" size={23} /><div><strong>{t.priced}</strong><p>{t.proofA} {formatRupees(saving)} {t.proofB}</p></div></section>
        <button className="nia-save__primary" onClick={() => onAdd(product.id)}>{t.addToBag}</button>
      </main>
    </div>
  );
}

function Checkout({ cart, products, total, onClose, onComplete, t }) {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [member, setMember] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function validatePhone() {
    setBusy(true);
    setError("");
    try {
      const result = await api.lookup(phone);
      if (!result.member) {
        setError(t.wrongPhone);
      } else {
        setMember(result.member);
        setStep("member");
      }
    } catch {
      setError(t.phoneError);
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const lines = products.filter((product) => cart[product.id]).map((product) => ({
        productId: product.id,
        quantity: cart[product.id],
        price: product.price
      }));
      await api.checkout({ amount: total, cart: lines, memberId: member.id });
      setStep("success");
    } catch {
      setError(t.payError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nia-save__sheet-backdrop" role="presentation">
      <section className="nia-save__sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        {step !== "success" ? (
          <button className="nia-save__sheet-close" onClick={onClose} aria-label={t.close}><Icon name="close" /></button>
        ) : null}
        {step === "phone" ? (
          <>
            <span className="nia-save__step">{t.phone}</span>
            <h2 id="checkout-title">{t.phoneQuestion}</h2>
            <input className="nia-save__phone-input" autoFocus inputMode="numeric" maxLength="10" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder={t.phonePlaceholder} aria-label={t.phonePlaceholder} />
            {error ? <p className="nia-save__error">{error}</p> : null}
            <button className="nia-save__primary" disabled={phone.length !== 10 || busy} onClick={validatePhone}>{busy ? t.checking : t.continue}</button>
          </>
        ) : null}
        {step === "member" ? (
          <>
            <span className="nia-save__step">{t.yourStudio}</span>
            <h2 id="checkout-title">{t.isThisYou}</h2>
            <div className="nia-save__member-card"><Icon name="check" /><div><strong>{member.name}</strong><span>{member.studio}</span></div></div>
            <button className="nia-save__primary" onClick={() => setStep("upi")}>{t.continueUpi}</button>
          </>
        ) : null}
        {step === "upi" ? (
          <>
            <span className="nia-save__step">UPI</span>
            <h2 id="checkout-title">{t.pay} {formatRupees(total)}</h2>
            <div className="nia-save__upi"><Icon name="upi" size={32} /><div><strong>{t.upi}</strong><span>{t.prepaid}</span></div></div>
            {error ? <p className="nia-save__error">{error}</p> : null}
            <button className="nia-save__primary" disabled={busy} onClick={pay}>{busy ? t.paying : `${t.pay} ${formatRupees(total)}`}</button>
          </>
        ) : null}
        {step === "success" ? (
          <div className="nia-save__success">
            <span className="nia-save__success-icon"><Icon name="check" size={32} /></span>
            <h2 id="checkout-title">{t.hubBag}</h2>
            <p>{t.deliveredAt}</p>
            <button className="nia-save__primary" onClick={onComplete}>{t.done}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Bag({ cart, products, bagCount, onBag, onBack, onAdjust, onCheckout, checkoutOpen, onCheckoutClose, onCheckoutComplete, t }) {
  const lines = products.filter((product) => cart[product.id]);
  const total = lines.reduce((sum, product) => sum + product.price * cart[product.id], 0);
  return (
    <div className="nia-save__screen nia-save__save-screen">
      <Header title={t.yourBag} bagCount={bagCount} onBag={onBag} onBack={onBack} />
      <main className="nia-save__content nia-save__bag-view">
        {lines.length === 0 ? (
          <div className="nia-save__empty-bag"><Icon name="bag" size={44} /><h2>{t.emptyBag}</h2><button className="nia-save__primary" onClick={onBack}>{t.shop}</button></div>
        ) : (
          <>
            <div className="nia-save__bag-lines">
              {lines.map((product) => (
                <div className="nia-save__bag-line" key={product.id}>
                  <img src={product.image} alt="" />
                  <div><strong>{product.name}</strong><span>{product.hindi} · {product.size}</span>
                    <div className="nia-save__stepper">
                      <button onClick={() => onAdjust(product.id, -1)} aria-label={`Remove one ${product.name}`}><Icon name="minus" size={16} /></button>
                      <b>{cart[product.id]}</b>
                      <button onClick={() => onAdjust(product.id, 1)} aria-label={`Add one ${product.name}`}><Icon name="plus" size={16} /></button>
                    </div>
                  </div>
                  <b>{formatRupees(product.price * cart[product.id])}</b>
                </div>
              ))}
            </div>
            <div className="nia-save__bag-total"><span>{t.total}</span><strong>{formatRupees(total)}</strong></div>
            <p className="nia-save__bag-route">{t.bagRoute}</p>
            <button className="nia-save__primary" onClick={onCheckout}>{t.continuePhone}</button>
          </>
        )}
      </main>
      {checkoutOpen ? <Checkout cart={cart} products={products} total={total} onClose={onCheckoutClose} onComplete={onCheckoutComplete} t={t} /> : null}
    </div>
  );
}

function Row({ icon, title, text, action }) {
  const Wrapper = action ? "button" : "div";
  return (
    <Wrapper className="nia-save__row" onClick={action}>
      <span className="nia-save__row-icon"><Icon name={icon} size={24} /></span>
      <span className="nia-save__row-copy"><strong>{title}</strong>{text ? <small>{text}</small> : null}</span>
      {action ? <Icon name="chevron" size={20} /> : null}
    </Wrapper>
  );
}

function Work({ data, bagCount, onBag, onUpdate, t }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = data.extra.status;
  async function decide(decision) {
    setBusy(true);
    setError("");
    try {
      const result = await api.decideExtra(decision);
      onUpdate({ ...data, extra: { ...data.extra, status: result.status } });
    } catch {
      setError(t.choiceError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="nia-save__screen">
      <Header title={t.workTitle} bagCount={bagCount} onBag={onBag} />
      <main className="nia-save__content nia-save__info-screen">
        <p className="nia-save__subhead">{t.warehousePicker}</p>
        <section className="nia-save__money-card"><span>{t.thisWeek}</span><strong>{formatRupees(data.week.in)}</strong><p>{t.friday} {formatRupees(data.week.dueAmount)} · {t.noCut}.</p></section>
        <section className="nia-save__today">
          <h2>{t.today}</h2><p><strong>8:00–5:00</strong><span>· {data.today.place}</span></p>
          <Row icon="bus" title={t.bus} text={`${data.today.bus} · ${data.today.distance}`} action={() => {}} />
          <Row icon="person" title={`${data.help.name} · ${t.help}`} action={() => {}} />
        </section>
        <section className="nia-save__extra">
          <span>{t.extra}</span><h2>{t.tonightStudio}</h2><p>{t.keep} {formatRupees(data.extra.keep)} · {t.to} {formatRupees(data.extra.weekIfTaken)}</p>
          {status === "open" ? <div className="nia-save__choice"><button className="nia-save__primary" disabled={busy} onClick={() => decide("take")}>{t.take}</button><button className="nia-save__secondary" disabled={busy} onClick={() => decide("no")}>{t.no}</button></div> : <p className="nia-save__decision"><Icon name="check" size={18} />{status === "taken" ? t.extraTaken : t.extraPassed}</p>}
          {error ? <p className="nia-save__error">{error}</p> : null}
        </section>
        <section className="nia-save__next"><strong>{data.next.days} {t.days}</strong><span>→ {t.pickerPlus} · +{formatRupees(data.next.monthly)}/mo.</span><i><b /></i></section>
      </main>
    </div>
  );
}

function Nest({ data, bagCount, onBag, onUpdate, t }) {
  const [busy, setBusy] = useState(false);
  async function rsvp() {
    setBusy(true);
    try {
      const result = await api.rsvp(true);
      onUpdate({ ...data, event: { ...data.event, mine: result.mine } });
    } finally {
      setBusy(false);
    }
  }
  const included = [["bed", t.bed], ["power", t.electricity], ["water", t.water], ["clean", t.cleaning], ["wifi", t.wifi]];
  return (
    <div className="nia-save__screen">
      <Header title={t.liveTitle} bagCount={bagCount} onBag={onBag} />
      <main className="nia-save__content nia-save__info-screen">
        <section className="nia-save__nest-lead"><span>{t.yourNest}</span><strong>{formatRupees(data.rupee)}</strong><p>{t.bed} 12 · 12 min</p></section>
        <section className="nia-save__included"><h2>{t.included}</h2>{included.map(([icon, label]) => <Row key={label} icon={icon} title={label} />)}</section>
        <section className="nia-save__event"><div><h2>Bada Khaana</h2><p>Sunday 7 PM</p></div><button className="nia-save__primary nia-save__primary--small" disabled={busy || data.event.mine} onClick={rsvp}>{data.event.mine ? t.coming : t.imComing}</button></section>
        <div className="nia-save__service-list">
          <Row icon="laundry" title={t.laundry} text={t.back6} action={() => {}} />
          <Row icon="trim" title={t.trim} text="₹80" action={() => {}} />
          <Row icon="wrench" title={t.somethingWrong} text={t.satish} action={() => {}} />
        </div>
      </main>
    </div>
  );
}

function Home({ data, bagCount, onBag, t }) {
  const [message, setMessage] = useState("");
  async function sendHome() {
    setMessage("");
    try {
      await api.transferHome();
    } catch (error) {
      setMessage(error.status === 501 ? t.railMissing : t.sendError);
    }
  }
  const available = data.leftover.available;
  const progress = Math.min(100, Math.round((data.goal.current / data.goal.target) * 100));
  return (
    <div className="nia-save__screen">
      <Header title={t.sendTitle} bagCount={bagCount} onBag={onBag} />
      <main className="nia-save__content nia-save__info-screen">
        <section className="nia-save__home-lead">
          <h2>{data.family.name} · {data.family.place}</h2>
          <p><strong>{formatRupees(available)}</strong> {t.canReach}</p>
          <span>{t.noFee}</span>
          <button className="nia-save__primary" onClick={sendHome}>{t.sendHome}</button>
          {message ? <p className="nia-save__rail-message">{message}</p> : null}
        </section>
        <section className="nia-save__home-list">
          <div className="nia-save__goal-row"><span className="nia-save__row-icon"><Icon name="roof" size={27} /></span><div><span>{t.roof}</span><strong>{formatRupees(data.goal.target)}</strong><i><b style={{ width: `${progress}%` }} /></i></div><Icon name="chevron" size={20} /></div>
          <Row icon="phone" title={t.recharge} text={formatRupees(data.recharge.amount)} action={() => {}} />
          <Row icon="ledger" title="12 Aug · ₹2,500" action={() => {}} />
          <details className="nia-save__family"><summary><span className="nia-save__row-icon"><Icon name="family" size={25} /></span><strong>{t.familySafety}</strong><Icon name="chevron" size={20} /></summary><p>{t.familyContact}</p></details>
        </section>
      </main>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState("save");
  const [saveView, setSaveView] = useState("shop");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [cart, setCart] = useState({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [work, setWork] = useState(fallbackWork);
  const [nest, setNest] = useState(fallbackNest);
  const [home, setHome] = useState(fallbackHome);
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem("nia-save-language") || "en"; } catch { return "en"; }
  });
  const t = getCopy(language);

  useEffect(() => {
    api.catalog().then((value) => setCatalog(normalizeCatalog(value))).catch(() => {});
    api.work().then(setWork).catch(() => {});
    api.nest().then(setNest).catch(() => {});
    api.home().then(setHome).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem("nia-save-language", language); } catch {}
  }, [language]);

  const bagCount = useMemo(() => Object.values(cart).reduce((sum, count) => sum + count, 0), [cart]);
  const selectedProduct = catalog.products.find((product) => product.id === selectedProductId);

  function add(productId) {
    setCart((current) => ({ ...current, [productId]: (current[productId] || 0) + 1 }));
  }

  function adjust(productId, delta) {
    setCart((current) => ({ ...current, [productId]: Math.max(0, (current[productId] || 0) + delta) }));
  }

  function openBag() {
    setActiveTab("save");
    setSaveView("bag");
  }

  function changeTab(tab) {
    setActiveTab(tab);
    if (tab === "save") setSaveView("shop");
  }

  let screen;
  if (activeTab === "work") screen = <Work data={work} bagCount={bagCount} onBag={openBag} onUpdate={setWork} t={t} />;
  if (activeTab === "nest") screen = <Nest data={nest} bagCount={bagCount} onBag={openBag} onUpdate={setNest} t={t} />;
  if (activeTab === "home") screen = <Home data={home} bagCount={bagCount} onBag={openBag} t={t} />;
  if (activeTab === "save" && saveView === "shop") screen = <SaveShop catalog={catalog} bagCount={bagCount} onBag={openBag} onAdd={add} onOpenProduct={(id) => { setSelectedProductId(id); setSaveView("detail"); }} onOpenSavings={() => setActiveTab("home")} language={language} onLanguage={setLanguage} t={t} />;
  if (activeTab === "save" && saveView === "detail" && selectedProduct) screen = <ProductDetail product={selectedProduct} bagCount={bagCount} onBag={openBag} onBack={() => setSaveView("shop")} onAdd={add} t={t} />;
  if (activeTab === "save" && saveView === "bag") screen = <Bag cart={cart} products={catalog.products} bagCount={bagCount} onBag={openBag} onBack={() => setSaveView("shop")} onAdjust={adjust} onCheckout={() => setCheckoutOpen(true)} checkoutOpen={checkoutOpen} onCheckoutClose={() => setCheckoutOpen(false)} onCheckoutComplete={() => { setCart({}); setCheckoutOpen(false); setSaveView("shop"); }} t={t} />;

  const showNav = !(activeTab === "save" && saveView !== "shop");
  return (
    <div className="nia-save">
      <div className="nia-save__app">
        {screen}
        {showNav ? <BottomNav active={activeTab} onChange={changeTab} t={t} /> : null}
      </div>
    </div>
  );
}
