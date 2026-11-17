import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Link2, Users, ArrowRight } from 'lucide-react'
import { Seo } from '../components/Seo'
import { seo } from '../seo'
import { DecisionBrand } from '../components/DecisionBrand'
import '../decisionroom/decisionroom.css'
export default function Landing() {
  return <div className="dr-site" data-testid="static-landing"><Seo {...seo} path="/" />
    <header className="dr-topbar"><DecisionBrand /><Link className="dr-button dr-button-light" to="/home">Open workspace <ArrowUpRight size={16} /></Link></header>
    <main className="dr-landing"><section className="dr-hero">
      <div className="dr-hero-copy"><p className="dr-eyebrow"><span className="dr-live-dot" /> LESS BACK-AND-FORTH. MORE CLARITY.</p>
        <h1>A good decision<br />has <em>receipts.</em></h1>
        <p className="dr-hero-description">Bring the options. Gather the evidence. Make the call together — and remember why.</p>
        <Link className="dr-button dr-button-large" to="/home">Start a decision <ArrowRight size={18} /></Link>
        <p className="dr-small dr-muted">A focused workspace for small teams with a choice to make.</p></div>
      <div className="dr-preview" aria-label="Illustrative decision room, not live data">
        <div className="dr-preview-top"><span className="dr-kicker">THE READING CLUB</span><span className="dr-pill">Illustrative example</span></div>
        <h2>What should we read next?</h2><p className="dr-muted">One month. Three books. A little evidence.</p>
        <div className="dr-preview-options"><div><span>01</span><strong>The Design of<br />Everyday Things</strong><small>Design & observation</small></div><div className="dr-preview-selected"><span>02 <Check size={16} /></span><strong>Thinking<br />in Systems</strong><small>Patterns & feedback</small></div><div><span>03</span><strong>A Philosophy<br />of Software Design</strong><small>Complexity & craft</small></div></div>
        <div className="dr-preview-evidence"><span className="dr-paper-icon"><Link2 size={18} /></span><div><strong>Evidence before opinions</strong><p>Keep the source attached to the claim.</p></div><ArrowUpRight size={18} /></div>
        <div className="dr-preview-footer"><div className="dr-avatar-stack"><span>A</span><span>J</span><span>M</span></div><span>Different perspectives. One shared record.</span></div>
      </div></section>
      <section className="dr-how"><div><span className="dr-step">01 / FRAME IT</span><h3>Give the choice some shape.</h3><p>Two or three options. Clear constraints. A room for the people who care.</p></div><div><span className="dr-step">02 / FIND THE SIGNAL</span><h3>Put your sources on the table.</h3><p>Save evidence, search for more, and compare with AI drafts that cite their sources.</p></div><div><span className="dr-step">03 / MAKE THE CALL</span><h3>Leave a trail worth revisiting.</h3><p>Vote, record the reasoning, and take a decision brief into your next conversation.</p></div></section>
      <div className="dr-landing-note"><Users size={18} /><span>Private by default. Shared by invitation. Human judgment at the center.</span></div>
    </main><footer className="dr-footer"><span>DecisionRoom / built for considered choices</span><span>Powered by DeepSpace</span></footer>
  </div>
}
