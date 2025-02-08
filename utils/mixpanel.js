// components/utils/mixpanel.js
import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

/**
 * Utility function to determine if the current environment is local.
 * It checks for common local hostnames.
 */
const isLocalhost = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  );
};

/**
 * Initialize Mixpanel only if:
 * - The code is running in the browser (window is defined)
 * - A Mixpanel token is provided
 * - The environment is NOT local (to prevent tracking during development)
 */
if (typeof window !== 'undefined' && MIXPANEL_TOKEN && !isLocalhost()) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === 'development', // Enables debug mode in development if desired
    ignore_dnt: true, // Ignores "Do Not Track" browser settings
  });
  console.log('Mixpanel initialized successfully.');
} else {
  if (!MIXPANEL_TOKEN) {
    console.error('Mixpanel token is missing.');
  }
  if (isLocalhost()) {
    console.log('Mixpanel tracking is disabled on localhost.');
  }
  if (typeof window === 'undefined') {
    console.error('Mixpanel not initialized: window is undefined.');
  }
}

/**
 * Tracks an event with Mixpanel if Mixpanel is initialized and not on localhost.
 * @param {string} name - The name of the event.
 * @param {object} props - Additional properties for the event.
 */
export const trackEvent = (name, props = {}) => {
  if (mixpanel && MIXPANEL_TOKEN && !isLocalhost()) {
    mixpanel.track(name, props);
  } else {
    console.log(`Mixpanel trackEvent skipped: "${name}"`, props);
  }
};

/**
 * Identifies a user in Mixpanel if Mixpanel is initialized and not on localhost.
 * @param {string} id - The unique identifier for the user.
 */
export const identifyUser = (id) => {
  if (mixpanel && MIXPANEL_TOKEN && !isLocalhost()) {
    mixpanel.identify(id);
  } else {
    console.log(`Mixpanel identifyUser skipped: "${id}"`);
  }
};

/**
 * Sets user properties in Mixpanel if Mixpanel is initialized and not on localhost.
 * @param {object} props - The properties to set for the user.
 */
export const setUserProperties = (props) => {
  if (mixpanel && MIXPANEL_TOKEN && !isLocalhost()) {
    mixpanel.people.set(props);
  } else {
    console.log('Mixpanel setUserProperties skipped:', props);
  }
};

export default mixpanel;
