// Share Module for Search with SEM
// Social sharing functionality

import { logEvent, EVENT_TYPES } from './analytics.js';

/**
 * Share topic via native share dialog or clipboard
 * @param {Object} topic - Topic data to share
 * @param {string} topic.title - Topic title
 * @param {string} [topic.summary] - Topic summary
 * @param {string} [topic.url] - Topic URL
 * @returns {Promise<void>}
 */
export async function shareTopic(topic) {
  const shareData = {
    title: `Search with SEM: ${topic.title}`,
    text: createShareText(topic),
    url: topic.url || `https://searchwithsem.afric.site/?topic=${encodeURIComponent(topic.title)}`
  };

  try {
    // Try native share first
    if (navigator.share) {
      await navigator.share(shareData);
      logEvent(EVENT_TYPES.SEM_SHARE, { topic: topic.title });
      return;
    }
    
    // Fallback to clipboard
    await navigator.clipboard.writeText(shareData.text + '\n' + shareData.url);
    showToast('Link copied to clipboard! Share it anywhere.');
    logEvent(EVENT_TYPES.SEM_SHARE, { topic: topic.title, method: 'clipboard' });
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Share failed:', error);
      // Try clipboard as fallback
      try {
        await navigator.clipboard.writeText(shareData.text + '\n' + shareData.url);
        showToast('Link copied to clipboard!');
      } catch (clipboardError) {
        console.error('Clipboard fallback also failed:', clipboardError);
        showToast('Unable to share. Please try again.');
      }
    }
  }
}

/**
 * Create share text for a topic
 * @param {Object} topic - Topic data
 * @returns {string} Formatted share text
 */
function createShareText(topic) {
  const text = topic.summary || topic.title;
  const preview = text.length > 200 ? text.substring(0, 200) + '...' : text;
  return `${topic.title}\n\n${preview}`;
}

/**
 * Share to specific platform
 * @param {string} platform - Platform name ('whatsapp', 'twitter', 'email', etc.)
 * @param {Object} topic - Topic data
 * @returns {void}
 */
export function shareToPlatform(platform, topic) {
  const shareData = {
    title: `Search with SEM: ${topic.title}`,
    text: createShareText(topic),
    url: topic.url || `https://searchwithsem.afric.site/?topic=${encodeURIComponent(topic.title)}`
  };

  let url;

  switch (platform) {
    case 'whatsapp':
      url = `https://wa.me/?text=${encodeURIComponent(shareData.text + '\n' + shareData.url)}`;
      break;
    case 'twitter':
    case 'x':
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text + '\n' + shareData.url)}`;
      break;
    case 'facebook':
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}&quote=${encodeURIComponent(shareData.text)}`;
      break;
    case 'email':
      url = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(shareData.text + '\n\n' + shareData.url)}`;
      break;
    case 'telegram':
      url = `https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`;
      break;
    case 'linkedin':
      url = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareData.url)}&title=${encodeURIComponent(shareData.title)}&summary=${encodeURIComponent(shareData.text)}`;
      break;
    default:
      // Use native share if available
      if (navigator.share) {
        navigator.share(shareData).catch(() => {});
      }
      return;
  }

  // Open the URL in a new tab
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noreferrer noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 300);

  logEvent(EVENT_TYPES.SEM_SHARE, { topic: topic.title, platform });
}

/**
 * Generate a shareable image card
 * @param {Object} topic - Topic data
 * @param {string} [coverImage] - Cover image URL
 * @returns {Promise<string>} Data URL of the generated image
 */
export async function generateShareImage(topic, coverImage = '') {
  // Create a canvas to draw the share card
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#4285f4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cover image
  if (coverImage) {
    try {
      const img = await loadImage(coverImage);
      const aspectRatio = img.width / img.height;
      const imgHeight = canvas.height * 0.6;
      const imgWidth = imgHeight * aspectRatio;
      const x = (canvas.width - imgWidth) / 2;
      const y = 20;
      
      ctx.drawImage(img, x, y, imgWidth, imgHeight);
    } catch {
      // Image failed to load, continue without it
    }
  }

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  const title = topic.title || 'Search with SEM';
  const titleY = coverImage ? 240 : 40;
  
  // Wrap text if needed
  const maxWidth = canvas.width - 40;
  const words = title.split(' ');
  let line = '';
  let y = titleY;
  
  words.forEach(word => {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line.length > 0) {
      ctx.fillText(line, canvas.width / 2, y);
      line = word + ' ';
      y += 30;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line, canvas.width / 2, y);

  // Summary
  ctx.font = '16px Arial, sans-serif';
  ctx.fillStyle = '#e8eaed';
  const summary = topic.summary || topic.title || 'Read more on Search with SEM';
  const summaryPreview = summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
  
  const summaryY = coverImage ? y + 20 : y + 30;
  wrapText(ctx, summaryPreview, canvas.width / 2, summaryY, maxWidth, 20);

  // App name
  ctx.font = 'italic 14px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('Search with SEM', canvas.width / 2, canvas.height - 30);

  // Return as data URL
  return canvas.toDataURL('image/png');
}

/**
 * Load an image from URL
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>} Loaded image element
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Wrap text on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} maxWidth - Maximum width
 * @param {number} lineHeight - Line height
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  
  words.forEach(word => {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y);
      line = word + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line, x, y);
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {number} [duration] - Duration in milliseconds
 */
function showToast(message, duration = 3000) {
  // Check if there's already a toast
  const existingToast = document.querySelector('.sem-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'sem-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 74px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--text, #202124);
    color: var(--bg, #ffffff);
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 4000;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    pointer-events: none;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}
