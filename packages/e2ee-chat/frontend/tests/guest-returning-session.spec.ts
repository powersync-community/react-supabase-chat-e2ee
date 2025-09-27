import { chromium, expect, test as base } from '@playwright/test';
import { BASE_HTTP } from '../playwright.config';

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const test = base.extend({
  context: async ({}, use, testInfo) => {
    const userDataDir = testInfo.outputPath('guest-returning-user-data');
    const context = await chromium.launchPersistentContext(userDataDir, {
      // if we are debugging mode, then show the browser
      headless: false,
      viewport: { width: 1280, height: 800 },

    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'storage', {
        value: {
          ...navigator.storage,
          persist: async () => true,
          persisted: async () => true,
        },
        configurable: true,
      });
    });

    const origin = new URL(BASE_HTTP).origin;
    await context.grantPermissions(['storage-access'], { origin });

    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },
});

test('guest reconnecting with same passphrase sees existing room', async ({ page }) => {
  const passphrase = `pw-${unique()}`;
  const roomName = `Room ${unique()}`;
  const roomTopic = 'Returning session check';
  const messageText = `First session message ${unique()}`;

  await page.goto(BASE_HTTP);
  await expect(page.getByTestId('auth-heading')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('guest-continue-button').click();
  await expect(page.getByTestId('vault-heading')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('vault-passphrase-input').fill(passphrase);
  await page.getByTestId('vault-submit-button').click();
  await expect(page.getByTestId('app-heading')).toBeVisible({ timeout: 30_000 });

  const initialUserId = (await page.getByTestId('user-id').textContent())?.trim();
  if (!initialUserId) {
    throw new Error('Failed to read initial user ID');
  }

  const roomNameInput = page.getByTestId('room-name-input');
  await expect(roomNameInput).toBeEnabled({ timeout: 25_000 });
  await roomNameInput.fill(roomName);
  await page.getByTestId('room-topic-input').fill(roomTopic);
  await page.getByTestId('create-room-button').click();
  await expect(page.getByTestId('active-room-heading')).toHaveText(roomName, { timeout: 25_000 });

  const messageInput = page.getByTestId('message-input');
  await expect(messageInput).toBeEnabled({ timeout: 25_000 });
  await messageInput.fill(messageText);
  await page.getByTestId('send-message-button').click();
  await expect(page.getByTestId('message-text').filter({ hasText: messageText })).toBeVisible({ timeout: 25_000 });

  await page.reload();
  await expect(page.getByTestId('vault-heading')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('vault-passphrase-input').fill(passphrase);
  await page.getByTestId('vault-submit-button').click();
  await expect(page.getByTestId('app-heading')).toBeVisible({ timeout: 30_000 });

  const postReloadUserId = (await page.getByTestId('user-id').textContent())?.trim();
  await expect(postReloadUserId).toBe(initialUserId);

  await expect(page.getByTestId('room-list-item').filter({ hasText: roomName })).toBeVisible({ timeout: 30_000 });
  const roomTile = page.getByTestId('room-list-item').filter({ hasText: roomName });
  await roomTile.click();
  await expect(page.getByTestId('active-room-heading')).toHaveText(roomName, { timeout: 30_000 });
  await expect(page.getByTestId('message-text').filter({ hasText: messageText })).toBeVisible({ timeout: 30_000 });
});
