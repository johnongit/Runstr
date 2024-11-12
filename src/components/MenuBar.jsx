import { Link } from 'react-router-dom';

export const MenuBar = () => {
  const menuItems = [
    { name: 'Run', path: '/' },
    { name: 'Login', path: '/login' },
    { name: 'Run History', path: '/history' },
    { name: 'Achievements', path: '/achievements' },
    { name: 'Run Club', path: '/club' },
    { name: 'Wallet', path: '/wallet' },
    { name: 'Music', path: '/music' }
  ];

  return (
    <nav style={styles.nav}>
      <ul style={styles.menuList}>
        {menuItems.map((item) => (
          <li key={item.name} style={styles.menuItem}>
            <Link to={item.path} style={styles.link}>
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const styles = {
  nav: {
    backgroundColor: '#1a1a1a',
    padding: '1rem',
    marginBottom: '2rem',
    width: '100%'
  },
  menuList: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    listStyle: 'none',
    margin: 0,
    padding: 0
  },
  menuItem: {
    cursor: 'pointer',
    color: '#fff',
    transition: 'color 0.3s ease',
    ':hover': {
      color: '#646cff'
    }
  },
  link: {
    color: '#fff',
    textDecoration: 'none',
    ':hover': {
      color: '#646cff'
    }
  }
}; 