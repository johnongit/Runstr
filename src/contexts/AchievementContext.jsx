import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  checkAchievements, 
  calculateTotalXP, 
  calculateLevel, 
  xpForNextLevel 
} from '../utils/achievements';
import { AchievementContext } from './achievementContext';

export function AchievementProvider({ children }) {
  const [unlockedAchievements, setUnlockedAchievements] = useState(() => {
    const saved = localStorage.getItem('unlockedAchievements');
    return saved ? JSON.parse(saved) : [];
  });

  const [totalXP, setTotalXP] = useState(() => {
    return calculateTotalXP(unlockedAchievements);
  });

  const [level, setLevel] = useState(() => calculateLevel(totalXP));
  const [xpToNext, setXpToNext] = useState(() => xpForNextLevel(totalXP));
  const [recentAchievements, setRecentAchievements] = useState([]);

  useEffect(() => {
    localStorage.setItem('unlockedAchievements', JSON.stringify(unlockedAchievements));
    const newTotalXP = calculateTotalXP(unlockedAchievements);
    setTotalXP(newTotalXP);
    setLevel(calculateLevel(newTotalXP));
    setXpToNext(xpForNextLevel(newTotalXP));
  }, [unlockedAchievements]);

  const checkForAchievements = (stats) => {
    const newAchievements = checkAchievements(stats, unlockedAchievements);
    if (newAchievements.length > 0) {
      setUnlockedAchievements(prev => [...prev, ...newAchievements.map(a => a.id)]);
      setRecentAchievements(newAchievements);
      return newAchievements;
    }
    return [];
  };

  const clearRecentAchievements = () => {
    setRecentAchievements([]);
  };

  const value = {
    unlockedAchievements,
    totalXP,
    level,
    xpToNext,
    recentAchievements,
    checkForAchievements,
    clearRecentAchievements
  };

  return (
    <AchievementContext.Provider value={value}>
      {children}
    </AchievementContext.Provider>
  );
}

AchievementProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 