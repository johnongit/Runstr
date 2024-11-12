import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithNostr, handleNostrCallback } from '../utils/nostr';

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
          // Store profile in localStorage or state management
          localStorage.setItem('nostrProfile', JSON.stringify(result.profile));
          navigate('/');
        }
      });
    }
  }, [location, navigate]);

  return (
    <div>
      <h2>Login</h2>
      {profile ? (
        <div>
          {profile.banner && <img src={profile.banner} alt="Profile Banner" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />}
          {profile.picture && <img src={profile.picture} alt="Profile Picture" style={{ width: '100px', height: '100px', borderRadius: '50%' }} />}
          <h3>{profile.name}</h3>
        </div>
      ) : (
        <button onClick={signInWithNostr}>Login with Nostr</button>
      )}
    </div>
  );
}; 