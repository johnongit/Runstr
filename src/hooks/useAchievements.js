import { useContext } from 'react';
import { AchievementContext } from '../contexts/AchievementContext';

export function useAchievements() {
  return useContext(AchievementContext);
} 