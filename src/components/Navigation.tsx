import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, signOut } from 'deepspace'
import { DecisionBrand } from './DecisionBrand'
export default function Navigation() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  const [auth, setAuth] = useState(false)
  return <header className="dr-topbar" data-testid="app-navigation"><DecisionBrand />
    <div className="dr-nav-actions"><Link to="/home">My rooms</Link>
      {isSignedIn ? <><span className="dr-avatar" aria-hidden="true">{(user?.name || 'M').slice(0, 1)}</span><span data-testid="nav-user-name">{user?.name || 'Member'}</span><span className="sr-only" data-testid="nav-user-email">{user?.email}</span><button className="dr-text-button" onClick={() => signOut()}>Sign out</button></>
        : <button className="dr-button" data-testid="nav-sign-in-button" onClick={() => setAuth(true)}>Sign in</button>}
    </div>{auth && <AuthOverlay onClose={() => setAuth(false)} />}
  </header>
}
