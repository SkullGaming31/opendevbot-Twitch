import axios from 'axios';

/**
 * Axios instances for calling Twitch API interactions
 */

const authURL = axios.create({
  baseURL: 'https://id.twitch.tv/oauth2',
  headers: {
    'Content-Type': 'application/json',
  }
});

const helix = axios.create({
  baseURL: 'https://api.twitch.tv/helix',
  headers: {
    'Content-Type': 'application/json',
  }
});

export { authURL, helix };