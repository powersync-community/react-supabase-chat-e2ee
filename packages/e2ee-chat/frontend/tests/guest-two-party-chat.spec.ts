import { expect, Page, test } from '@playwright/test';
import { BASE_HTTP } from '../playwright.config';

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/* const shouldRunMultiUserTest = process.env.CHAT_E2E_MULTI_USER === '1';

test.skip(!shouldRunMultiUserTest, 'Set CHAT_E2E_MULTI_USER=1 to run the multi-session chat test.');
 */
async function bootstrapGuest(page: Page, passphrase: string) {
  await page.goto(BASE_HTTP);

  await expect(page.getByTestId('auth-heading')).toBeVisible({ timeout: 30_000 });

  const guestButton = page.getByTestId('guest-continue-button');
  await expect(guestButton).toBeEnabled({ timeout: 15_000 });
  await guestButton.click();

  await expect(page.getByTestId('vault-heading')).toBeVisible({ timeout: 45_000 });

  const passInput = page.getByTestId('vault-passphrase-input');
  await passInput.fill(passphrase);
  await page.getByTestId('vault-submit-button').click();

  await expect(page.getByTestId('app-heading')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('rooms-heading')).toBeVisible({ timeout: 30_000 });
}

test('two guests can exchange messages in real time', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  for (const [label, page] of [['A', pageA] as const, ['B', pageB] as const]) {
    page.on('console', (msg) => {
      console.log(`[console:${label}:${msg.type()}] ${msg.text()}`);
    });
  }

  const passphraseA = `pw-${unique()}`;
  const passphraseB = `pw-${unique()}`;
  const roomName = `Room ${unique()}`;
  const roomTopic = 'Cross-session chat';
  const firstMessage = `Hello from guest A ${unique()}`;
  const replyMessage = `Hello from guest B ${unique()}`;

  try {
    await bootstrapGuest(pageA, passphraseA);
    await bootstrapGuest(pageB, passphraseB);

    // Guest A creates a room.
    const roomNameInputA = pageA.getByTestId('room-name-input');
    await expect(roomNameInputA).toBeEnabled({ timeout: 60_000 });
    await roomNameInputA.fill(roomName);
    await pageA.getByTestId('room-topic-input').fill(roomTopic);
    await pageA.getByTestId('create-room-button').click();

    await expect(pageA.getByTestId('active-room-heading')).toHaveText(roomName, { timeout: 60_000 });

    // Guest A sends the first message in the room.
    const messageInputA = pageA.getByTestId('message-input');
    await expect(messageInputA).toBeEnabled({ timeout: 60_000 });
    await messageInputA.fill(firstMessage);
    await pageA.getByTestId('send-message-button').click();
    await expect(pageA.getByTestId('message-text').filter({ hasText: firstMessage })).toBeVisible({ timeout: 60_000 });

    // Capture Guest B's user ID from the header.
    const guestBId = (await pageB.getByTestId('user-id').textContent())?.trim();
    if (!guestBId) {
      throw new Error('Failed to read guest B user ID');
    }

    // Guest A invites Guest B by ID.
    const inviteInput = pageA.getByTestId('invite-user-input');
    const inviteButton = pageA.getByTestId('invite-user-button');
    const inviteErrorMessage = pageA.getByText('Target user has not published an identity key.', { exact: true });

    let invited = false;
    for (let attempt = 0; attempt < 5 && !invited; attempt += 1) {
      await expect(inviteButton).toBeEnabled({ timeout: 10_000 });
      await inviteInput.fill(guestBId);
      await inviteButton.click();
      await expect(inviteButton).toBeEnabled({ timeout: 10_000 });

      await pageA.waitForTimeout(1_000);
      const hadError = await inviteErrorMessage.isVisible().catch(() => false);
      if (!hadError) {
        invited = true;
      } else {
        if (attempt === 4) {
          throw new Error('Guest B identity key not available after retries.');
        }
        await pageA.waitForTimeout(5_000);
      }
    }

    // Guest B waits for the room to appear and opens it.
    const roomTileB = pageB.getByTestId('room-list-item').filter({ hasText: roomName });
    await expect(roomTileB).toBeVisible({ timeout: 3e4 });
    await roomTileB.click();

    // Guest B should receive the first message.
    const messageFromAOnB = pageB.getByTestId('message-text').filter({ hasText: firstMessage });
    await expect(messageFromAOnB).toBeVisible({ timeout: 3e4 });
    await expect(pageB.getByTestId('message-input')).toBeEnabled({ timeout: 1e4 });

    // Guest B replies.
    await pageB.getByTestId('message-input').fill(replyMessage);
    await pageB.getByTestId('send-message-button').click();
    await expect(pageB.getByTestId('message-text').filter({ hasText: replyMessage })).toBeVisible({ timeout: 60_000 });

    // Guest A sees the reply.
    const replyLocatorOnA = pageA.getByTestId('message-text').filter({ hasText: replyMessage });
    await expect(replyLocatorOnA).toBeVisible({ timeout: 90_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
