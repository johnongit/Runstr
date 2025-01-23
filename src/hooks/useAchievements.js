import { useContext } from 'react';
import { AchievementContext } from '../contexts/AchievementContext.jsx';

export function useAchievements() {
  return useContext(AchievementContext);
} 