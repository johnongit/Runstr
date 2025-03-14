import { useState } from 'react';
import { Link } from 'react-router-dom';

export const MenuBar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
<<<<<<< HEAD
    { name: 'Dashboard', path: '/' },
    { name: 'Run History', path: '/history' },
    { name: 'Achievements', path: '/achievements' },
    { name: 'Run Club', path: '/club' },
    { name: 'Music', path: '/music' },
    { name: 'Wallet', path: '/nwc' }
=======
    { name: 'DASHBOARD', path: '/' },
    { name: 'STATS', path: '/history' },
    { name: 'GOALS', path: '/goals' },
    { name: 'RUNSTR FEED', path: '/club' },
    //{ name: 'RUN CLUB', path: '/team' },
    //{ name: 'COMPETITIONS', path: '/events' },
    { name: 'WAVLAKE', path: '/music' },
    { name: 'WALLET', path: '/nwc' }
>>>>>>> Simple-updates
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
<<<<<<< HEAD
  };

  return (
    <>
      <h1 className="app-title">NOSTR RUN CLUB</h1>
=======
    // Prevent body scrolling when menu is open
    document.body.style.overflow = isOpen ? 'auto' : 'hidden';
  };

  // Ensure body scrolling is restored when component unmounts
  const closeMenu = () => {
    setIsOpen(false);
    document.body.style.overflow = 'auto';
  };

  return (
    <header className="menu-header">
      <h1 className="app-title">RUNSTR</h1>
>>>>>>> Simple-updates

      <button
        className="hamburger-menu"
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav className={`sidebar-nav ${isOpen ? 'open' : ''}`}>
        <ul className="menu-list">
          {menuItems.map((item) => (
            <li key={item.name} className="menu-item">
<<<<<<< HEAD
              <Link to={item.path} onClick={() => setIsOpen(false)}>
=======
              <Link to={item.path} onClick={closeMenu}>
>>>>>>> Simple-updates
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

<<<<<<< HEAD
      {isOpen && <div className="overlay" onClick={toggleMenu}></div>}
    </>
=======
      {isOpen && <div className="overlay" onClick={closeMenu}></div>}
    </header>
>>>>>>> Simple-updates
  );
};
