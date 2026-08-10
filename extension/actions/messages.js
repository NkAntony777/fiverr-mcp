if (!self.FMcp) self.FMcp = {};

// The Fiverr inbox (/conversations → /inbox) is a React SPA.
// Contact list items: [data-testid="contact"] with .contact class.
// Username of the other party: data-track-value on the avatar element.
// Preview text: .contact-excerpt

async function waitForContacts(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const contacts = Array.from(document.querySelectorAll('[data-testid="contact"]'));
    if (contacts.length > 0) return contacts;
    await new Promise(r => setTimeout(r, 400));
  }
  return [];
}

function parseContact(el) {
  const username    = el.querySelector('[data-track-value]')?.getAttribute('data-track-value') ?? '';
  const displayName = el.querySelector('.user-info p, [data-track-tag="text"]')?.textContent.trim() ?? username;
  const preview     = el.querySelector('.contact-excerpt')?.textContent.trim() ?? '';
  const timeStr     = el.querySelector('time')?.textContent.trim() ?? '';
  // Unread badge: look for a pill / count indicator
  const unreadBadge = el.querySelector('[class*="unread"], [class*="badge"], [aria-label*="unread"]');
  const unreadCount = unreadBadge ? (parseInt(unreadBadge.textContent.trim(), 10) || 1) : 0;

  return {
    id:           username,          // username acts as conversation identifier
    with:         displayName,
    username:     username,
    preview:      preview,
    time:         timeStr,
    unread_count: unreadCount,
  };
}

self.FMcp.list_messages = async function({ unreadOnly } = {}) {
  const contacts = await waitForContacts();
  if (!contacts.length) return [];
  const result = contacts.map(parseContact);
  return unreadOnly ? result.filter(c => c.unread_count > 0) : result;
};

self.FMcp.get_conversation = async function({ conversationId }) {
  // The new inbox is an SPA — navigating to /inbox/{username} opens the thread directly.
  // The page keeps the conversation list; the thread URL is /inbox/{username}.
  await self.FMcp.waitFor('[data-testid="contact"], .inbox_perseus, #main-wrapper');

  const threadUrl = window.location.href;

  // Message selectors for the current inbox renderer (kept broad — structure varies)
  const threadSelectors = [
    '[data-testid="message"]',
    '[class*="message-bubble"]',
    '[class*="MessageBubble"]',
    '[class*="msg-row"]',
    '[class*="message-row"]',
    '[class*="chat"]',
    '.message',
  ];

  let messages = [];
  for (const sel of threadSelectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      messages = Array.from(els).map(m => ({
        text:   m.textContent.trim(),
        sender: m.getAttribute('data-sender') ?? (m.classList.contains('mine') ? 'me' : 'them'),
      }));
      break;
    }
  }

  if (messages.length) {
    return { conversationId, threadUrl, messages };
  }

  // No message elements — distinguish empty / dead-thread states
  const bodyText = document.body.innerText;
  if (bodyText.includes('is no longer available')) {
    return { conversationId, threadUrl, messages: [], note: 'Conversation is empty — the other party is no longer available on Fiverr' };
  }
  if (bodyText.includes('Something went wrong')) {
    return { conversationId, threadUrl, messages: [], note: 'Thread failed to load — try again' };
  }
  return { conversationId, threadUrl, messages: [], note: 'No messages found in this conversation' };
};
