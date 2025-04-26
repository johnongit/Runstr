import { createAndPublishEvent } from './nostr';

/**
 * Create a weight event (kind 1351)
 * @param {number} weight - The weight value
 * @param {string} unit - The unit of measurement ('kg' or 'lb')
 * @returns {Object} Event template for weight
 */
export const createWeightEvent = (weight, unit = 'kg') => {
  if (!weight) return null;
  
  const tags = [
    ['unit', unit],
    ['t', 'health'],
    ['t', 'weight']
  ];
  
  // Add converted value tag for unit interoperability
  if (unit === 'lb') {
    const kgValue = (weight * 0.453592).toFixed(2);
    tags.push(['converted_value', kgValue, 'kg']);
  }
  
  return {
    kind: 1351,
    content: String(weight),
    tags
  };
};

/**
 * Create a height event (kind 1352)
 * @param {Object} height - Height data object
 * @param {string} preferredUnit - Preferred unit system ('metric' or 'imperial')
 * @returns {Object} Event template for height
 */
export const createHeightEvent = (height, preferredUnit = 'metric') => {
  if (!height) return null;
  
  const tags = [
    ['t', 'health'],
    ['t', 'height']
  ];
  
  let content;
  
  if (preferredUnit === 'imperial' && height.heightFeet !== undefined && height.heightInches !== undefined) {
    // Format as imperial
    content = JSON.stringify({
      feet: height.heightFeet,
      inches: height.heightInches
    });
    tags.push(['unit', 'imperial']);
    
    // Add converted cm value for interoperability
    if (height.heightCm) {
      tags.push(['converted_value', String(height.heightCm), 'cm']);
    }
  } else {
    // Format as metric
    if (!height.heightCm) return null;
    
    content = String(height.heightCm);
    tags.push(['unit', 'cm']);
  }
  
  return {
    kind: 1352,
    content,
    tags
  };
};

/**
 * Create an age event (kind 1353)
 * @param {number} age - The user's age
 * @returns {Object} Event template for age
 */
export const createAgeEvent = (age) => {
  if (!age) return null;
  
  return {
    kind: 1353,
    content: String(age),
    tags: [
      ['unit', 'years'],
      ['t', 'health'],
      ['t', 'age']
    ]
  };
};

/**
 * Create a gender event (kind 1354)
 * @param {string} gender - The user's gender
 * @returns {Object} Event template for gender
 */
export const createGenderEvent = (gender) => {
  if (!gender) return null;
  
  return {
    kind: 1354,
    content: gender,
    tags: [
      ['t', 'health'],
      ['t', 'gender']
    ]
  };
};

/**
 * Create a fitness level event (kind 1355)
 * @param {string} level - The user's fitness level
 * @returns {Object} Event template for fitness level
 */
export const createFitnessLevelEvent = (level) => {
  if (!level) return null;
  
  return {
    kind: 1355,
    content: level,
    tags: [
      ['t', 'health'],
      ['t', 'fitness'],
      ['t', 'level']
    ]
  };
};

/**
 * Publish all health profile metrics to Nostr
 * @param {Object} profile - User profile data
 * @param {Object} units - Unit preferences
 * @returns {Promise<Object>} Publishing results
 */
export const publishHealthProfile = async (profile, units = { weight: 'kg', height: 'metric' }) => {
  if (!profile) {
    throw new Error('No profile data provided');
  }
  
  // Create events for each health metric
  const events = [];
  
  // Weight event
  const weightEvent = createWeightEvent(profile.weight, units.weight);
  if (weightEvent) events.push(weightEvent);
  
  // Height event
  const heightEvent = createHeightEvent(profile, units.height);
  if (heightEvent) events.push(heightEvent);
  
  // Age event
  const ageEvent = createAgeEvent(profile.age);
  if (ageEvent) events.push(ageEvent);
  
  // Gender event
  const genderEvent = createGenderEvent(profile.gender);
  if (genderEvent) events.push(genderEvent);
  
  // Fitness level event
  const fitnessEvent = createFitnessLevelEvent(profile.fitnessLevel);
  if (fitnessEvent) events.push(fitnessEvent);
  
  // Publish all events
  const results = [];
  for (const event of events) {
    try {
      const result = await createAndPublishEvent(event);
      results.push({
        kind: event.kind,
        success: true,
        result
      });
    } catch (error) {
      results.push({
        kind: event.kind,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    totalMetrics: events.length,
    published: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}; 