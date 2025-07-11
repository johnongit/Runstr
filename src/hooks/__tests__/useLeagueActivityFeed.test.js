import { renderHook } from '@testing-library/react';
import { useLeagueActivityFeed } from '../useLeagueActivityFeed';
import { NostrContext } from '../../contexts/NostrContext';
import { ActivityModeContext } from '../../contexts/ActivityModeContext';

// Mock the context providers
const mockNostrContext = {
  ndk: {
    // Mock NDK instance
    ready: true
  }
};

const mockActivityModeContext = {
  mode: 'run'
};

// Mock the seasonPassService
jest.mock('../../services/seasonPassService', () => ({
  getParticipantsWithDates: jest.fn(() => [
    { pubkey: 'test-pubkey-1', paymentDate: '2024-01-01T00:00:00Z' },
    { pubkey: 'test-pubkey-2', paymentDate: '2024-01-02T00:00:00Z' }
  ])
}));

// Mock the nostr utils
jest.mock('../../utils/nostr', () => ({
  fetchEvents: jest.fn(() => Promise.resolve([
    {
      id: 'test-event-1',
      pubkey: 'test-pubkey-1',
      created_at: Math.floor(Date.now() / 1000),
      content: 'Test run content',
      tags: [
        ['exercise', 'run'],
        ['distance', '5', 'km'],
        ['title', 'Morning Run'],
        ['duration', '30:00']
      ]
    }
  ]))
}));

// Mock REWARDS config
jest.mock('../../config/rewardsConfig', () => ({
  REWARDS: {
    SEASON_1: {
      startUtc: '2024-01-01T00:00:00Z',
      endUtc: '2024-12-31T23:59:59Z'
    }
  }
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('useLeagueActivityFeed', () => {
  const wrapper = ({ children }) => (
    <NostrContext.Provider value={mockNostrContext}>
      <ActivityModeContext.Provider value={mockActivityModeContext}>
        {children}
      </ActivityModeContext.Provider>
    </NostrContext.Provider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should compile and return expected data structure', () => {
    const { result } = renderHook(() => useLeagueActivityFeed(), { wrapper });
    
    // Verify the hook returns the expected structure
    expect(result.current).toMatchObject({
      feedEvents: expect.any(Array),
      isLoading: expect.any(Boolean),
      error: null,
      refresh: expect.any(Function),
      lastUpdated: expect.any(Object),
      activityMode: 'run',
      loadingProgress: expect.objectContaining({
        phase: expect.any(String),
        participantCount: expect.any(Number),
        processedEvents: expect.any(Number),
        totalEvents: expect.any(Number),
        message: expect.any(String)
      })
    });
  });

  it('should start with loading state', () => {
    const { result } = renderHook(() => useLeagueActivityFeed(), { wrapper });
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.feedEvents).toEqual([]);
  });

  it('should have refresh function', () => {
    const { result } = renderHook(() => useLeagueActivityFeed(), { wrapper });
    
    expect(typeof result.current.refresh).toBe('function');
  });

  it('should return activity mode from context', () => {
    const { result } = renderHook(() => useLeagueActivityFeed(), { wrapper });
    
    expect(result.current.activityMode).toBe('run');
  });

  it('should initialize with correct loading progress structure', () => {
    const { result } = renderHook(() => useLeagueActivityFeed(), { wrapper });
    
    expect(result.current.loadingProgress).toMatchObject({
      phase: 'initializing',
      participantCount: 0,
      processedEvents: 0,
      totalEvents: 0,
      message: 'Loading participants...'
    });
  });
}); 