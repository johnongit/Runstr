import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from '../pages/Profile';
import { publishHealthProfile } from '../utils/nostrHealth';

// Mock the health profile functions
vi.mock('../utils/nostrHealth', () => ({
  publishHealthProfile: vi.fn().mockResolvedValue({
    totalMetrics: 5,
    published: 5,
    failed: 0,
    results: [
      { kind: 1351, success: true },
      { kind: 1352, success: true },
      { kind: 1353, success: true },
      { kind: 1354, success: true },
      { kind: 1355, success: true }
    ]
  })
}));

// Mock the useRunProfile hook
vi.mock('../hooks/useRunProfile', () => ({
  useRunProfile: vi.fn().mockReturnValue({
    userProfile: {
      weight: 70,
      heightFeet: 5,
      heightInches: 9,
      heightCm: 175,
      gender: 'male',
      age: 30,
      fitnessLevel: 'intermediate'
    },
    handleProfileChange: vi.fn(),
    handleProfileSubmit: vi.fn()
  })
}));

// Mock Android environment
window.Android = {
  showToast: vi.fn()
};

describe('Profile Nostr Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Render the Profile component within a Router
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );
  });

  test('renders the Save Health Profile to Nostr button', () => {
    expect(screen.getByText('Save Health Profile to Nostr')).toBeInTheDocument();
  });

  test('publishes health profile to Nostr when button is clicked', async () => {
    // Find and click the Nostr publish button
    const publishButton = screen.getByText('Save Health Profile to Nostr');
    fireEvent.click(publishButton);

    // Verify that the button shows publishing state
    expect(screen.getByText('Publishing...')).toBeInTheDocument();

    // Wait for the publishing to complete
    await waitFor(() => {
      // Verify that publishHealthProfile was called
      expect(publishHealthProfile).toHaveBeenCalled();
      
      // Verify the button is back to original state
      expect(screen.getByText('Save Health Profile to Nostr')).toBeInTheDocument();
      
      // Verify that Android toast was shown with success message
      expect(window.Android.showToast).toHaveBeenCalledWith(
        'Health profile published to Nostr! (5/5 metrics)'
      );
    });
  });

  test('handles errors during publishing', async () => {
    // Mock the publishHealthProfile to reject with an error
    publishHealthProfile.mockRejectedValueOnce(new Error('Network error'));

    // Find and click the Nostr publish button
    const publishButton = screen.getByText('Save Health Profile to Nostr');
    fireEvent.click(publishButton);

    // Wait for the error handling to complete
    await waitFor(() => {
      // Verify the button is back to original state
      expect(screen.getByText('Save Health Profile to Nostr')).toBeInTheDocument();
      
      // Verify that Android toast was shown with error message
      expect(window.Android.showToast).toHaveBeenCalledWith(
        'Failed to publish profile: Network error'
      );
    });
  });

  test('can toggle between unit systems', () => {
    // Find unit toggle buttons
    const kgButton = screen.getByText('kg');
    const lbButton = screen.getByText('lb');
    const cmButton = screen.getByText('cm');
    const ftInButton = screen.getByText('ft/in');

    // Test switching weight units
    fireEvent.click(lbButton);
    expect(lbButton).toHaveClass('active');
    expect(kgButton).not.toHaveClass('active');
    
    fireEvent.click(kgButton);
    expect(kgButton).toHaveClass('active');
    expect(lbButton).not.toHaveClass('active');

    // Test switching height units
    fireEvent.click(ftInButton);
    expect(ftInButton).toHaveClass('active');
    expect(cmButton).not.toHaveClass('active');
    
    fireEvent.click(cmButton);
    expect(cmButton).toHaveClass('active');
    expect(ftInButton).not.toHaveClass('active');
  });
}); 