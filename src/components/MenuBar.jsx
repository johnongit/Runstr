import { useState } from 'react';
import { Link } from 'react-router-dom';

export const MenuBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  const menuItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Login', path: '/login' },
    { name: 'Run History', path: '/history' },
    { name: 'Achievements', path: '/achievements' },
    { name: 'Run Club', path: '/club' },
    { name: 'Music', path: '/music' },
    { name: 'NWC', path: '/nwc' }
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <h1 className="app-title">NOSTR RUN CLUB</h1>

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
              <Link 
                to={item.path} 
                onClick={() => setIsOpen(false)}
              >
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