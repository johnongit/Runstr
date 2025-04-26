import { vi, describe, test, expect } from 'vitest';
import { 
  createWeightEvent, 
  createHeightEvent, 
  createAgeEvent, 
  createGenderEvent, 
  createFitnessLevelEvent 
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
}); 