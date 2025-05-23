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
 * Create a workout intensity event (kind 1356)
 * @param {string} intensityValue - The intensity value (e.g., "7" or "high")
 * @param {string} scale - The scale used ("rpe10" or "keyword")
 * @param {Object} options - Optional parameters 
 * @param {string} [options.timestamp] - ISO8601 timestamp string
 * @param {string} [options.activityType] - E.g., "run", "bike"
 * @param {string} [options.zone] - E.g., "1"-"5"
 * @param {string} [options.source] - Source application name
 * @param {string} [options.workoutEventId] - ID of the related workout event for linking
 * @returns {Object|null} Event template for workout intensity or null if essential data missing
 */
export const createWorkoutIntensityEvent = (intensityValue, scale, options = {}) => {
  if (!intensityValue || !scale || !['rpe10', 'keyword'].includes(scale)) {
    console.warn('Missing or invalid intensityValue or scale for createWorkoutIntensityEvent');
    return null;
  }

  const tags = [
    ['t', 'health'],
    ['t', 'intensity'],
    ['scale', scale]
  ];

  if (options.timestamp) tags.push(['timestamp', options.timestamp]);
  if (options.activityType) tags.push(['activity', options.activityType]);
  if (options.zone) tags.push(['zone', options.zone]);
  if (options.source) tags.push(['source', options.source]);
  if (options.workoutEventId) tags.push(['e', options.workoutEventId, '', 'root']); // Assuming 'root' marker, adjust if needed

  return {
    kind: 1356,
    content: String(intensityValue),
    tags
  };
};

/**
 * Create a caloric data event (kind 1357)
 * @param {number|string} calories - Calories burned (kcal)
 * @param {Object} options - Optional parameters
 * @param {string} [options.timestamp] - ISO8601 timestamp string
 * @param {string} [options.source] - Source application name
 * @param {string} [options.accuracy] - "estimated" or "measured"
 * @param {string} [options.workoutEventId] - ID of the related workout event for linking
 * @returns {Object|null} Event template for caloric data or null if essential data missing
 */
export const createCaloricDataEvent = (calories, options = {}) => {
  if (calories === undefined || calories === null || calories === '') {
    console.warn('Missing calories for createCaloricDataEvent');
    return null;
  }

  const tags = [
    ['unit', 'kcal'],
    ['t', 'health'],
    ['t', 'calories']
  ];

  if (options.timestamp) tags.push(['timestamp', options.timestamp]);
  if (options.source) tags.push(['source', options.source]);
  if (options.accuracy) tags.push(['accuracy', options.accuracy]);
  if (options.workoutEventId) tags.push(['e', options.workoutEventId, '', 'root']); // Assuming 'root' marker, adjust if needed

  // Optional: Convert kcal to kJ for a converted_value tag if desired in the future
  // const kjValue = (parseFloat(calories) * 4.184).toFixed(0);
  // tags.push(['converted_value', kjValue, 'kJ']);

  return {
    kind: 1357,
    content: String(calories),
    tags
  };
};

/**
 * Create an activity duration event (kind 1358)
 * Adheres to NIP-101h.8 specification.
 *
 * @param {number|string} duration      Numeric duration value
 * @param {string} [unit='seconds']     Unit of measurement – 'seconds' | 'minutes' | 'hours'
 * @param {Object} options              Optional parameters
 * @param {string} [options.timestamp]  ISO8601 timestamp when duration was recorded
 * @param {string} [options.startTime]  ISO8601 activity start time
 * @param {string} [options.endTime]    ISO8601 activity end time
 * @param {string} [options.activityType]  Activity type e.g. 'running'
 * @param {string} [options.source]     Source application name
 * @param {string} [options.relatedEventId] Event id to link (workout summary etc.)
 * @returns {Object|null} Event template or null if essential data missing
 */
export const createActivityDurationEvent = (
  duration,
  unit = 'seconds',
  options = {}
) => {
  if (duration === undefined || duration === null || duration === '') {
    console.warn('Missing duration for createActivityDurationEvent');
    return null;
  }

  const allowedUnits = ['seconds', 'minutes', 'hours'];
  if (!allowedUnits.includes(unit)) {
    console.warn(`Invalid unit '${unit}' for createActivityDurationEvent – defaulting to 'seconds'`);
    unit = 'seconds';
  }

  const tags = [
    ['unit', unit],
    ['t', 'health'],
    ['t', 'activity_duration']
  ];

  if (options.activityType) tags.push(['activity', options.activityType]);
  if (options.timestamp) tags.push(['timestamp', options.timestamp]);
  if (options.startTime) tags.push(['start_time', options.startTime]);
  if (options.endTime) tags.push(['end_time', options.endTime]);
  if (options.source) tags.push(['source', options.source]);
  if (options.relatedEventId) tags.push(['related_event', options.relatedEventId]);

  return {
    kind: 1358,
    content: String(duration),
    tags
  };
};

/**
 * Publish all health profile metrics to Nostr
 * @param {Object} profile - User profile data
 * @param {Object} units - Unit preferences
 * @param {Object} opts - Additional options
 * @returns {Promise<Object>} Publishing results
 */
export const publishHealthProfile = async (profile, units = { weight: 'kg', height: 'metric' }, opts = {}) => {
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
      const result = await createAndPublishEvent(event, null, opts);
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

/**
 * Helper: build workout intensity event from a saved run record.
 * Returns null if run.intensity is missing.
 * @param {Object} run
 */
export const buildIntensityEvent = (run) => {
  if (!run || !run.intensity) return null;
  return createWorkoutIntensityEvent(run.intensity, 'keyword', {
    timestamp: new Date(run.timestamp || Date.now()).toISOString(),
    activityType: 'run',
    workoutEventId: run.nostrWorkoutEventId || undefined,
    source: 'RunstrApp'
  });
};

/**
 * Helper: build caloric data event from a saved run record.
 * Returns null if run.calories is missing.
 * @param {Object} run
 */
export const buildCalorieEvent = (run) => {
  if (!run || run.calories === undefined || run.calories === null) return null;
  return createCaloricDataEvent(run.calories, {
    timestamp: new Date(run.timestamp || Date.now()).toISOString(),
    workoutEventId: run.nostrWorkoutEventId || undefined,
    accuracy: 'estimated',
    source: 'RunstrApp'
  });
};

/**
 * Helper: build activity duration event from a saved run record.
 * Returns null if run.duration is missing.
 * @param {Object} run
 */
export const buildDurationEvent = (run) => {
  if (!run || run.duration === undefined || run.duration === null) return null;
  // Duration is expected in seconds within run record
  return createActivityDurationEvent(run.duration, 'seconds', {
    timestamp: new Date(run.timestamp || Date.now()).toISOString(),
    activityType: 'running',
    relatedEventId: run.nostrWorkoutEventId || undefined,
    source: 'RunstrApp'
  });
}; 