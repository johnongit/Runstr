import { vi, describe, test, expect } from 'vitest';
import { 
  createWeightEvent, 
  createHeightEvent, 
  createAgeEvent, 
  createGenderEvent, 
  createFitnessLevelEvent,
  createWorkoutIntensityEvent,
  createCaloricDataEvent
} from '../utils/nostrHealth';

// Mock createAndPublishEvent
vi.mock('../utils/nostr', () => ({
  createAndPublishEvent: vi.fn().mockResolvedValue({ id: 'test-event-id' })
}));

describe('Nostr Health Events', () => {
  test('creates weight event with kg unit', () => {
    const event = createWeightEvent(70, 'kg');
    expect(event.kind).toBe(1351);
    expect(event.content).toBe('70');
    expect(event.tags).toContainEqual(['unit', 'kg']);
    expect(event.tags).toContainEqual(['t', 'health']);
    expect(event.tags).toContainEqual(['t', 'weight']);
  });

  test('creates weight event with lb unit and conversion', () => {
    const event = createWeightEvent(150, 'lb');
    expect(event.kind).toBe(1351);
    expect(event.content).toBe('150');
    expect(event.tags).toContainEqual(['unit', 'lb']);
    
    // Find the converted value tag
    const convertedTag = event.tags.find(tag => tag[0] === 'converted_value');
    expect(convertedTag).toBeDefined();
    expect(convertedTag[1]).toBe('68.04');
    expect(convertedTag[2]).toBe('kg');
  });

  test('returns null for weight event with missing weight', () => {
    const event = createWeightEvent(null, 'kg');
    expect(event).toBeNull();
  });

  test('creates height event in metric format', () => {
    const profile = { heightCm: 175 };
    const event = createHeightEvent(profile, 'metric');
    expect(event.kind).toBe(1352);
    expect(event.content).toBe('175');
    expect(event.tags).toContainEqual(['unit', 'cm']);
  });

  test('creates height event in imperial format with conversion', () => {
    const profile = { heightFeet: 5, heightInches: 9, heightCm: 175 };
    const event = createHeightEvent(profile, 'imperial');
    expect(event.kind).toBe(1352);
    expect(JSON.parse(event.content)).toEqual({ feet: 5, inches: 9 });
    expect(event.tags).toContainEqual(['unit', 'imperial']);
    expect(event.tags).toContainEqual(['converted_value', '175', 'cm']);
  });

  test('returns null for height event with missing height data', () => {
    const event = createHeightEvent({}, 'metric');
    expect(event).toBeNull();
  });

  test('creates age event', () => {
    const event = createAgeEvent(30);
    expect(event.kind).toBe(1353);
    expect(event.content).toBe('30');
    expect(event.tags).toContainEqual(['unit', 'years']);
    expect(event.tags).toContainEqual(['t', 'health']);
    expect(event.tags).toContainEqual(['t', 'age']);
  });

  test('returns null for age event with missing age', () => {
    const event = createAgeEvent(null);
    expect(event).toBeNull();
  });

  test('creates gender event', () => {
    const event = createGenderEvent('male');
    expect(event.kind).toBe(1354);
    expect(event.content).toBe('male');
    expect(event.tags).toContainEqual(['t', 'health']);
    expect(event.tags).toContainEqual(['t', 'gender']);
  });

  test('returns null for gender event with missing gender', () => {
    const event = createGenderEvent(null);
    expect(event).toBeNull();
  });

  test('creates fitness level event', () => {
    const event = createFitnessLevelEvent('intermediate');
    expect(event.kind).toBe(1355);
    expect(event.content).toBe('intermediate');
    expect(event.tags).toContainEqual(['t', 'health']);
    expect(event.tags).toContainEqual(['t', 'fitness']);
    expect(event.tags).toContainEqual(['t', 'level']);
  });

  test('returns null for fitness level event with missing level', () => {
    const event = createFitnessLevelEvent(null);
    expect(event).toBeNull();
  });

  // Tests for createWorkoutIntensityEvent (kind 1356)
  describe('createWorkoutIntensityEvent', () => {
    test('creates intensity event with rpe10 scale', () => {
      const event = createWorkoutIntensityEvent('7', 'rpe10');
      expect(event.kind).toBe(1356);
      expect(event.content).toBe('7');
      expect(event.tags).toContainEqual(['t', 'health']);
      expect(event.tags).toContainEqual(['t', 'intensity']);
      expect(event.tags).toContainEqual(['scale', 'rpe10']);
    });

    test('creates intensity event with keyword scale', () => {
      const event = createWorkoutIntensityEvent('high', 'keyword');
      expect(event.kind).toBe(1356);
      expect(event.content).toBe('high');
      expect(event.tags).toContainEqual(['scale', 'keyword']);
    });

    test('creates intensity event with all optional tags', () => {
      const options = {
        timestamp: '2023-01-01T12:00:00Z',
        activityType: 'run',
        zone: '3',
        source: 'RunstrApp',
        workoutEventId: 'test-workout-event'
      };
      const event = createWorkoutIntensityEvent('5', 'rpe10', options);
      expect(event.tags).toContainEqual(['timestamp', '2023-01-01T12:00:00Z']);
      expect(event.tags).toContainEqual(['activity', 'run']);
      expect(event.tags).toContainEqual(['zone', '3']);
      expect(event.tags).toContainEqual(['source', 'RunstrApp']);
      expect(event.tags).toContainEqual(['e', 'test-workout-event', '', 'root']);
    });

    test('returns null for intensity event with missing intensityValue', () => {
      const event = createWorkoutIntensityEvent(null, 'rpe10');
      expect(event).toBeNull();
    });

    test('returns null for intensity event with missing scale', () => {
      const event = createWorkoutIntensityEvent('7', null);
      expect(event).toBeNull();
    });

    test('returns null for intensity event with invalid scale', () => {
      const event = createWorkoutIntensityEvent('7', 'invalidScale');
      expect(event).toBeNull();
    });
  });

  // Tests for createCaloricDataEvent (kind 1357)
  describe('createCaloricDataEvent', () => {
    test('creates caloric data event with basic info', () => {
      const event = createCaloricDataEvent(500);
      expect(event.kind).toBe(1357);
      expect(event.content).toBe('500');
      expect(event.tags).toContainEqual(['unit', 'kcal']);
      expect(event.tags).toContainEqual(['t', 'health']);
      expect(event.tags).toContainEqual(['t', 'calories']);
    });

    test('creates caloric data event with all optional tags', () => {
      const options = {
        timestamp: '2023-01-01T13:00:00Z',
        source: 'MyFitnessPal',
        accuracy: 'estimated',
        workoutEventId: 'another-workout-id'
      };
      const event = createCaloricDataEvent('650', options);
      expect(event.tags).toContainEqual(['timestamp', '2023-01-01T13:00:00Z']);
      expect(event.tags).toContainEqual(['source', 'MyFitnessPal']);
      expect(event.tags).toContainEqual(['accuracy', 'estimated']);
      expect(event.tags).toContainEqual(['e', 'another-workout-id', '', 'root']);
    });

    test('returns null for caloric data event with missing calories', () => {
      const event = createCaloricDataEvent(null);
      expect(event).toBeNull();
    });

    test('returns null for caloric data event with empty string calories', () => {
      const event = createCaloricDataEvent('');
      expect(event).toBeNull();
    });
  });
}); 