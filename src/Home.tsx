import { catalog, frontView } from "./catalog";
import { freshDesign, starterDesign, starters } from "./design";
import WalletSvg from "./WalletSvg";

// Less is more: one line, one wallet, the wallets to start from, one line on the craft.
export default function Home() {
  return (
    <div className="home">
      <header className="nav">
        <a href="#/" className="brand">{catalog.site.name}</a>
        <a href="#/design" className="nav-link">Design yours</a>
      </header>

      <section className="hero">
        <p className="eyebrow">Handmade leather</p>
        <h1>
          Made by hand.
          <br />
          <em>Made for you.</em>
        </h1>
        <a href="#/design" className="btn btn-line">Design yours</a>
        <div className="hero-art" aria-hidden="true">
          <WalletSvg design={freshDesign("bifold", "Mosto")} view={frontView(catalog.products.bifold)} />
        </div>
      </section>

      <section className="range">
        {starters.map((id) => (
          <a key={id} href={`#/design/${id}`} className="range-item">
            <WalletSvg design={starterDesign(id)} view={frontView(catalog.products[id])} />
            <span>{catalog.products[id].label}</span>
          </a>
        ))}
      </section>

      <section className="craft">
        <p>Cut, stitched and burnished by hand, one wallet at a time.</p>
      </section>

      <footer className="footer">
        <span className="brand">{catalog.site.name}</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
