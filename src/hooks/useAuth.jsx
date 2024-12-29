import { AuthContext } from '../contexts/AuthContext.jsx';
import { useContext } from 'react';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const signInWithNostr = async () => {
  try {
    // Use the nostr-login library's built-in login flow
    const loginEvent = new CustomEvent('nl-login', {
      detail: {
        type: 'login'
      }
    });
    document.dispatchEvent(loginEvent);
  } catch (error) {
    console.error('Error initiating Nostr login:', error);
    throw error;
  }
}; 