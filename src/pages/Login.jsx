import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithNostr, handleNostrCallback, fetchUserProfile } from '../utils/nostr';

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const eventParam = searchParams.get('event');
    
    if (eventParam) {
      handleNostrCallback(eventParam).then(result => {
        if (result && result.profile) {
          setProfile(result.profile);
          localStorage.setItem('nostrProfile', JSON.stringify(result.profile));
          navigate('/');
        }
      });
    }

    // Listen for nostr-login auth events
    const handleAuth = (e) => {
      if (e.detail.type === 'login' || e.detail.type === 'signup') {
        window.nostr.getPublicKey().then(async (pubkey) => {
          const profile = await fetchUserProfile(pubkey);
          setProfile(profile);
          localStorage.setItem('nostrProfile', JSON.stringify(profile));
          navigate('/');
        });
      } else if (e.detail.type === 'logout') {
        setProfile(null);
        localStorage.removeItem('nostrProfile');
      }
    };

    document.addEventListener('nlAuth', handleAuth);
    return () => document.removeEventListener('nlAuth', handleAuth);
  }, [location, navigate]);

  const checkAmberInstalled = () => {
    // Check if running on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Check if running on Android
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS || isAndroid) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 2500);

        window.addEventListener('blur', () => {
          clearTimeout(timeout);
          resolve(true);
        }, { once: true });
      });
    }
    return Promise.resolve(true);
  };

  const handleNostrLogin = async () => {
    const hasAmber = await checkAmberInstalled();
    
    if (!hasAmber) {
      const installAmber = window.confirm('Amber does not appear to be installed. Would you like to install it now?');
      if (installAmber) {
        window.location.href = 'https://amber.nostr.app';
      }
      return;
    }
    
    try {
      await signInWithNostr();
    } catch (error) {
      console.error('Nostr login error:', error);
      alert('Failed to open Amber. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      {profile ? (
        <div className="profile-card">
          {profile.banner && (
            <img 
              src={profile.banner} 
              alt="Profile Banner" 
              className="profile-banner" 
            />
          )}
          {profile.picture && (
            <img 
              src={profile.picture} 
              alt="Profile Picture" 
              className="profile-picture" 
            />
          )}
          <h3>{profile.name}</h3>
        </div>
      ) : (
        <div className="login-options">
          <button onClick={handleNostrLogin} className="login-btn nostr-connect">
            Login with Nostr Connect
          </button>
          <div className="divider">or</div>
          <button onClick={signInWithNostr} className="login-btn nostr-signer">
            Login with Nostr Signer
          </button>
        </div>
      )}
    </div>
  );
}; 