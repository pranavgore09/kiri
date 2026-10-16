import { catalog } from "./catalog";
import { freshDesign } from "./design";
import WalletSvg from "./WalletSvg";

const showcase = freshDesign("bifold");
const showcaseView = catalog.products.bifold.views.find((v) => v.id === "inside")!;
const card = freshDesign("cardholder", "Ortensia");

export default function Home() {
  const year = new Date().getFullYear();
  return (
    <div className="home">
      <header className="nav">
        <a href="#/" className="brand">{catalog.site.name}</a>
        <a href="#/design" className="nav-link">Design yours</a>
      </header>

      <section className="hero">
        <p className="eyebrow">Handmade · Made to order</p>
        <h1>
          A wallet,
          <br />
          <em>made for you.</em>
        </h1>
        <p className="lede">
          Cut, stitched and finished by hand. Choose the pockets, the leather and the thread. I make the rest.
        </p>
        <a href="#/design" className="btn btn-primary">Design your wallet</a>

        <div className="hero-art" aria-hidden="true">
          <div className="art art-main">
            <WalletSvg design={showcase} view={showcaseView} />
          </div>
          <div className="art art-small">
            <WalletSvg design={card} view={catalog.products.cardholder.views[0]} />
          </div>
        </div>
      </section>

      <section className="craft">
        <h2>The craft</h2>
        <ol className="points">
          <li>
            <span>01</span>
            <h3>Cut by hand</h3>
            <p>Every piece is cut from a whole hide, one wallet at a time.</p>
          </li>
          <li>
            <span>02</span>
            <h3>Stitched by hand</h3>
            <p>Two needles, one thread, pulled tight stitch by stitch.</p>
          </li>
          <li>
            <span>03</span>
            <h3>Finished by hand</h3>
            <p>Edges sanded and polished until they shine.</p>
          </li>
        </ol>
      </section>

      <section className="how">
        <h2>How it works</h2>
        <ol className="steps">
          <li><strong>Design it here.</strong> Pockets, leather, thread — a few taps.</li>
          <li><strong>Save the picture.</strong> Send it to me.</li>
          <li><strong>I make it.</strong> By hand, just for you.</li>
        </ol>
      </section>

      <section className="cta">
        <p className="eyebrow">It starts with one question</p>
        <h2>Do you still carry cash?</h2>
        <a href="#/design" className="btn btn-primary">Start designing</a>
      </section>

      <footer className="footer">
        <span className="brand">{catalog.site.name}</span>
        <span>{catalog.site.tagline} · © {year}</span>
      </footer>
    </div>
  );
}
