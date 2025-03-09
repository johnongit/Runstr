import { useState } from 'react';
import { Link } from 'react-router-dom';

export const MenuBar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: 'DASHBOARD', path: '/' },
    { name: 'STATS', path: '/history' },
    { name: 'GOALS', path: '/goals' },
    { name: 'RUNSTR FEED', path: '/club' },
    { name: 'RUN CLUB', path: '/team' },
    { name: 'COMPETITIONS', path: '/events' },
    { name: 'WAVLAKE', path: '/music' },
    { name: 'WALLET', path: '/nwc' }
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <h1 className="app-title">RUNSTR</h1>

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
              <Link to={item.path} onClick={() => setIsOpen(false)}>
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {isOpen && <div className="overlay" onClick={toggleMenu}></div>}
    </>
  );
};
