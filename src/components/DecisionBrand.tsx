import { Link } from 'react-router-dom'
export function DecisionBrand() {
  return <Link to="/" className="dr-brand" aria-label="DecisionRoom home"><span className="dr-logo" aria-hidden="true">d<span>r</span></span><span>DecisionRoom<span className="dr-brand-dot">.</span></span></Link>
}
