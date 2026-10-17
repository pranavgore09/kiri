import { STARTERS, starterDesign } from "./Builder";
import { catalog } from "./catalog";
import { freshDesign } from "./design";
import WalletSvg from "./WalletSvg";

const front = (product: string) => catalog.products[product].views.find((v) => v.face !== "back")!;
const hero = freshDesign("bifold", "Mosto");

// Less is more: one line, one wallet, the three wallets to start from, one line on the craft.
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
          <WalletSvg design={hero} view={front("bifold")} />
        </div>
      </section>

      <section className="range">
        {STARTERS.map((starter) => (
          <a key={starter.product} href={`#/design/${starter.product}`} className="range-item">
            <WalletSvg design={starterDesign(starter)} view={front(starter.product)} />
            <span>{starter.label}</span>
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
