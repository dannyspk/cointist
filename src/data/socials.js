// Centralized list of social profile URLs used across the site.
// The Topbar contains the canonical set; other components import this file
// so every social icon points to the same destinations.
const SOCIALS = [
  { name: 'X', url: 'https://x.com/cointistmedia', img: '/assets/twitter.webp', aria: 'X/Twitter' },
  { name: 'YouTube', url: 'https://youtube.com/@Cointist', img: '/assets/youtube.webp', aria: 'YouTube' },
  { name: 'Instagram', url: 'https://instagram.com/cointistmedia', img: '/assets/instagram.webp', aria: 'Instagram' },
  { name: 'Telegram', url: 'https://t.me/@Cointist', img: '/assets/telegram.webp', aria: 'Telegram' }
];

export default SOCIALS;
