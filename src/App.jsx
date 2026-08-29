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

const tabs = [
  ["work", "Work"],
  ["nest", "Nest"],
  ["save", "Save"],
  ["home", "Home"]
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

function BottomNav({ active, onChange }) {
  return (
    <nav className="nia-save__nav" aria-label="Member sections">
      {tabs.map(([id, label]) => (
        <button key={id} className={active === id ? "is-active" : ""} onClick={() => onChange(id)}>
          <Icon name={id} size={24} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function ProductCard({ product, onOpen, onAdd }) {
  return (
    <article className="nia-save__product-card">
      <button className="nia-save__product-open" onClick={() => onOpen(product.id)} aria-label={`View ${product.name}`}>
        <span className="nia-save__pack-plate"><img src={product.image} alt={product.name} /></span>
        <span className="nia-save__product-name">{product.name}</span>
        <span className="nia-save__product-hindi">{product.hindi}</span>
        <span className="nia-save__product-size">{product.size}</span>
      </button>
      <div className="nia-save__product-price">
        <strong>{formatRupees(product.price)}</strong>
        <s>{formatRupees(product.mrp)}</s>
      </div>
      <button className="nia-save__add" onClick={() => onAdd(product.id)} disabled={product.outOfStock}>
        {product.outOfStock ? "Out" : "Add"}
        {!product.outOfStock ? <Icon name="plus" size={18} /> : null}
      </button>
    </article>
  );
}

function SaveShop({ catalog, bagCount, onBag, onAdd, onOpenProduct, onOpenSavings }) {
  const [query, setQuery] = useState("");
  const products = catalog.products.filter((product) => {
    const haystack = [product.name, product.hindi, product.size, ...(product.searchTerms || [])].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="nia-save__screen">
      <Header title="NiaSave" bagCount={bagCount} onBag={onBag} />
      <main className="nia-save__content nia-save__shop">
        <div className="nia-save__where">
          <p><Icon name="location" size={20} /><span>{catalog.studioName} · {catalog.deliveryTime}</span></p>
          <p><Icon name="studio" size={20} /><span>Delivered to your Studio</span></p>
        </div>
        <button className="nia-save__saving-line" onClick={onOpenSavings}>
          <Icon name="save" size={28} />
          <span><strong>{formatRupees(catalog.weeklySavings)}</strong> kept this week</span>
          <Icon name="chevron" size={18} />
        </button>
        <p className="nia-save__fever"><Icon name="shield" size={22} />{catalog.feverPerk}</p>
        <label className="nia-save__search">
          <Icon name="search" size={22} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Salt, oil, Maggi" aria-label="Search products" />
        </label>
        <section className="nia-save__product-grid" aria-label="Essentials">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={onOpenProduct} onAdd={onAdd} />
          ))}
        </section>
        {products.length === 0 ? <p className="nia-save__empty">No pack found. Try salt, oil, or Maggi.</p> : null}
      </main>
    </div>
  );
}

function ProductDetail({ product, bagCount, onBag, onBack, onAdd }) {
  return (
    <div className="nia-save__screen">
      <Header title={product.name} bagCount={bagCount} onBag={onBag} onBack={onBack} />
      <main className="nia-save__content nia-save__detail">
        <div className="nia-save__detail-plate"><img src={product.image} alt={product.name} /></div>
        <p className="nia-save__detail-hindi">{product.hindi}</p>
        <p className="nia-save__detail-size">{product.size}</p>
        <div className="nia-save__detail-price"><strong>{formatRupees(product.price)}</strong><s>{formatRupees(product.mrp)}</s></div>
        <p className="nia-save__keep">You keep {formatRupees(product.mrp - product.price)} on this pack.</p>
        <button className="nia-save__primary" onClick={() => onAdd(product.id)}>Add to bag</button>
      </main>
    </div>
  );
}

function Checkout({ cart, products, total, onClose, onComplete }) {
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
        setError("This phone is not with Nia.");
      } else {
        setMember(result.member);
        setStep("member");
      }
    } catch {
      setError("Could not check this phone. Try again.");
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
      setError("Payment did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nia-save__sheet-backdrop" role="presentation">
      <section className="nia-save__sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        {step !== "success" ? (
          <button className="nia-save__sheet-close" onClick={onClose} aria-label="Close checkout"><Icon name="close" /></button>
        ) : null}
        {step === "phone" ? (
          <>
            <span className="nia-save__step">Phone</span>
            <h2 id="checkout-title">Which phone is with Nia?</h2>
            <input className="nia-save__phone-input" autoFocus inputMode="numeric" maxLength="10" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="10-digit phone" aria-label="10-digit phone" />
            {error ? <p className="nia-save__error">{error}</p> : null}
            <button className="nia-save__primary" disabled={phone.length !== 10 || busy} onClick={validatePhone}>{busy ? "Checking…" : "Continue"}</button>
          </>
        ) : null}
        {step === "member" ? (
          <>
            <span className="nia-save__step">Your Studio</span>
            <h2 id="checkout-title">This is you?</h2>
            <div className="nia-save__member-card"><Icon name="check" /><div><strong>{member.name}</strong><span>{member.studio}</span></div></div>
            <button className="nia-save__primary" onClick={() => setStep("upi")}>Continue to UPI</button>
          </>
        ) : null}
        {step === "upi" ? (
          <>
            <span className="nia-save__step">UPI</span>
            <h2 id="checkout-title">Pay {formatRupees(total)}</h2>
            <div className="nia-save__upi"><Icon name="upi" size={32} /><div><strong>UPI</strong><span>Prepaid · no cash</span></div></div>
            {error ? <p className="nia-save__error">{error}</p> : null}
            <button className="nia-save__primary" disabled={busy} onClick={pay}>{busy ? "Paying…" : `Pay ${formatRupees(total)}`}</button>
          </>
        ) : null}
        {step === "success" ? (
          <div className="nia-save__success">
            <span className="nia-save__success-icon"><Icon name="check" size={32} /></span>
            <h2 id="checkout-title">Hub has your bag.</h2>
            <p>Delivered to your Studio at 5:15 PM.</p>
            <button className="nia-save__primary" onClick={onComplete}>Done</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Bag({ cart, products, bagCount, onBag, onBack, onAdjust, onCheckout, checkoutOpen, onCheckoutClose, onCheckoutComplete }) {
  const lines = products.filter((product) => cart[product.id]);
  const total = lines.reduce((sum, product) => sum + product.price * cart[product.id], 0);
  return (
    <div className="nia-save__screen">
      <Header title="Your bag" bagCount={bagCount} onBag={onBag} onBack={onBack} />
      <main className="nia-save__content nia-save__bag-view">
        {lines.length === 0 ? (
          <div className="nia-save__empty-bag"><Icon name="bag" size={44} /><h2>Your bag is empty</h2><button className="nia-save__primary" onClick={onBack}>Shop</button></div>
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
            <div className="nia-save__bag-total"><span>Total</span><strong>{formatRupees(total)}</strong></div>
            <p className="nia-save__bag-route">Phone → UPI → Studio</p>
            <button className="nia-save__primary" onClick={onCheckout}>Continue to phone</button>
          </>
        )}
      </main>
      {checkoutOpen ? <Checkout cart={cart} products={products} total={total} onClose={onCheckoutClose} onComplete={onCheckoutComplete} /> : null}
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

function Work({ data, bagCount, onBag, onUpdate }) {
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
      setError("Could not save your choice. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="nia-save__screen">
      <Header title="Work" bagCount={bagCount} onBag={onBag} />
      <main className="nia-save__content nia-save__info-screen">
        <p className="nia-save__subhead">{data.role}</p>
        <section className="nia-save__money-card"><span>This week</span><strong>{formatRupees(data.week.in)}</strong><p>{data.week.due} {formatRupees(data.week.dueAmount)} · no cut.</p></section>
        <section className="nia-save__today">
          <h2>Today</h2><p><strong>8:00–5:00</strong><span>· {data.today.place}</span></p>
          <Row icon="bus" title="Bus" text={`${data.today.bus} · ${data.today.distance}`} action={() => {}} />
          <Row icon="person" title={`${data.help.name} · Help`} action={() => {}} />
        </section>
        <section className="nia-save__extra">
          <span>Extra</span><h2>Tonight 6–8 PM · Studio</h2><p>keep {formatRupees(data.extra.keep)} · To {formatRupees(data.extra.weekIfTaken)}</p>
          {status === "open" ? <div className="nia-save__choice"><button className="nia-save__primary" disabled={busy} onClick={() => decide("take")}>Take</button><button className="nia-save__secondary" disabled={busy} onClick={() => decide("no")}>No</button></div> : <p className="nia-save__decision"><Icon name="check" size={18} />{status === "taken" ? "Extra shift taken" : "Extra shift passed"}</p>}
          {error ? <p className="nia-save__error">{error}</p> : null}
        </section>
        <section className="nia-save__next"><strong>{data.next.days} days</strong><span>→ {data.next.role} · +{formatRupees(data.next.monthly)}/mo.</span><i><b /></i></section>
      </main>
    </div>
  );
}

function Nest({ data, bagCount, onBag, onUpdate }) {
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
  const included = [["bed", "Bed"], ["power", "Electricity"], ["water", "Water"], ["clean", "Cleaning"], ["wifi", "Wi-Fi"]];
  return (
    <div className="nia-save__screen">
      <Header title="Nest" bagCount={bagCount} onBag={onBag} />
      <main className="nia-save__content nia-save__info-screen">
        <section className="nia-save__nest-lead"><span>Your Nest</span><strong>{formatRupees(data.rupee)}</strong><p>Bed 12 · 12 min</p></section>
        <section className="nia-save__included"><h2>Included</h2>{included.map(([icon, label]) => <Row key={label} icon={icon} title={label} />)}</section>
        <section className="nia-save__event"><div><h2>Bada Khaana</h2><p>Sunday 7 PM</p></div><button className="nia-save__primary nia-save__primary--small" disabled={busy || data.event.mine} onClick={rsvp}>{data.event.mine ? "Coming" : "I’m coming"}</button></section>
        <div className="nia-save__service-list">
          <Row icon="laundry" title="Laundry" text="back 6 PM" action={() => {}} />
          <Row icon="trim" title="Trim" text="₹80" action={() => {}} />
          <Row icon="wrench" title="Something wrong" text="Satish is on it · by 9 PM." action={() => {}} />
        </div>
      </main>
    </div>
  );
}

function Home({ data, bagCount, onBag }) {
  const [message, setMessage] = useState("");
  async function sendHome() {
    setMessage("");
    try {
      await api.transferHome();
    } catch (error) {
      setMessage(error.status === 501 ? "Send-home rail is not configured yet." : "Could not start send home. Try again.");
    }
  }
  const available = data.leftover.available;
  const progress = Math.min(100, Math.round((data.goal.current / data.goal.target) * 100));
  return (
    <div className="nia-save__screen">
      <Header title="Home" bagCount={bagCount} onBag={onBag} />
      <main className="nia-save__content nia-save__info-screen">
        <section className="nia-save__home-lead">
          <h2>{data.family.name} · {data.family.place}</h2>
          <p><strong>{formatRupees(available)}</strong> can reach Maa.</p>
          <span>No fee.</span>
          <button className="nia-save__primary" onClick={sendHome}>Send home</button>
          {message ? <p className="nia-save__rail-message">{message}</p> : null}
        </section>
        <section className="nia-save__home-list">
          <div className="nia-save__goal-row"><span className="nia-save__row-icon"><Icon name="roof" size={27} /></span><div><span>Roof</span><strong>{formatRupees(data.goal.target)}</strong><i><b style={{ width: `${progress}%` }} /></i></div><Icon name="chevron" size={20} /></div>
          <Row icon="phone" title="Recharge" text={formatRupees(data.recharge.amount)} action={() => {}} />
          <Row icon="ledger" title="12 Aug · ₹2,500" action={() => {}} />
          <details className="nia-save__family"><summary><span className="nia-save__row-icon"><Icon name="family" size={25} /></span><strong>Family safety</strong><Icon name="chevron" size={20} /></summary><p>Maa is your family contact.</p></details>
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

  useEffect(() => {
    api.catalog().then((value) => setCatalog(normalizeCatalog(value))).catch(() => {});
    api.work().then(setWork).catch(() => {});
    api.nest().then(setNest).catch(() => {});
    api.home().then(setHome).catch(() => {});
  }, []);

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
  if (activeTab === "work") screen = <Work data={work} bagCount={bagCount} onBag={openBag} onUpdate={setWork} />;
  if (activeTab === "nest") screen = <Nest data={nest} bagCount={bagCount} onBag={openBag} onUpdate={setNest} />;
  if (activeTab === "home") screen = <Home data={home} bagCount={bagCount} onBag={openBag} />;
  if (activeTab === "save" && saveView === "shop") screen = <SaveShop catalog={catalog} bagCount={bagCount} onBag={openBag} onAdd={add} onOpenProduct={(id) => { setSelectedProductId(id); setSaveView("detail"); }} onOpenSavings={() => setActiveTab("home")} />;
  if (activeTab === "save" && saveView === "detail" && selectedProduct) screen = <ProductDetail product={selectedProduct} bagCount={bagCount} onBag={openBag} onBack={() => setSaveView("shop")} onAdd={add} />;
  if (activeTab === "save" && saveView === "bag") screen = <Bag cart={cart} products={catalog.products} bagCount={bagCount} onBag={openBag} onBack={() => setSaveView("shop")} onAdjust={adjust} onCheckout={() => setCheckoutOpen(true)} checkoutOpen={checkoutOpen} onCheckoutClose={() => setCheckoutOpen(false)} onCheckoutComplete={() => { setCart({}); setCheckoutOpen(false); setSaveView("shop"); }} />;

  const showNav = !(activeTab === "save" && saveView !== "shop");
  return (
    <div className="nia-save">
      <div className="nia-save__app">
        {screen}
        {showNav ? <BottomNav active={activeTab} onChange={changeTab} /> : null}
      </div>
    </div>
  );
}
