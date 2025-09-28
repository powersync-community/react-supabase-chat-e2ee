import { expect, test } from "@playwright/test";
import { BASE_HTTP } from "../playwright.config";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("guest can create a vault and start a chat", async ({ page }) => {
  const passphrase = `pw-${unique()}`;
  const roomName = `Playwright Room ${unique()}`;
  const roomTopic = "Automated testing room";
  const messageText = `Hello from Playwright ${unique()}`;
  await page.goto(BASE_HTTP);

  await expect(page.getByTestId("auth-heading")).toBeVisible({
    timeout: 15_000,
  });

  const guestButton = page.getByTestId("guest-continue-button");
  await expect(guestButton).toBeEnabled({ timeout: 15_000 });
  await guestButton.click();

  await expect(page.getByTestId("vault-heading")).toBeVisible({
    timeout: 20_000,
  });

  const createPassphraseInput = page.getByTestId("vault-passphrase-input");
  const canCreateVault = await createPassphraseInput.isVisible({
    timeout: 1_000,
  });

  if (!canCreateVault) {
    throw new Error(
      'Expected a fresh guest session with the "Create Vault" flow. Clear existing vault records before running this test.',
    );
  }

  await createPassphraseInput.fill(passphrase);
  await page.getByTestId("vault-submit-button").click();

  await expect(page.getByTestId("app-heading")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("rooms-heading")).toBeVisible({
    timeout: 15_000,
  });

  await page.getByTestId("rooms-create-button").click();
  const roomNameInput = page.getByTestId("room-name-input");
  await expect(roomNameInput).toBeEnabled({ timeout: 25_000 });
  await roomNameInput.fill(roomName);

  const topicInput = page.getByTestId("room-topic-input");
  await topicInput.fill(roomTopic);

  await page.getByTestId("create-room-button").click();
  const createdRoomTile = page
    .getByTestId("room-list-item")
    .filter({ hasText: roomName });
  await expect(createdRoomTile).toBeVisible({ timeout: 30_000 });
  await createdRoomTile.click();

  await expect(page.getByTestId("active-room-heading")).toHaveText(roomName, {
    timeout: 30_000,
  });

  const messageBox = page.getByTestId("message-input");
  await expect(messageBox).toBeEnabled({ timeout: 25_000 });
  await messageBox.fill(messageText);

  await page.getByTestId("send-message-button").click();

  const sentMessage = page
    .getByTestId("message-text")
    .filter({ hasText: messageText });
  await expect(sentMessage).toBeVisible({ timeout: 25_000 });

  await page.getByTestId("user-menu-button").click();
  const userIdLabel = (await page.getByTestId("user-id").textContent())?.trim();
  await page.getByTestId("user-menu-button").click();// close menu
  if (!userIdLabel) {
    throw new Error('Failed to read user ID from menu.');
  }

  const latestMessage = page.getByTestId("chat-message").last();
  await latestMessage.getByTestId("message-avatar").click();
  const idToast = page.getByTestId("avatar-id-toast");
  await expect(idToast).toBeVisible({ timeout: 5_000 });
  await expect(idToast).toContainText(userIdLabel);

  await page.getByTestId("user-menu-button").click();
  const signOutButton = page.getByTestId("chat-sign-out-button");
  await signOutButton.click();

  await expect(page.getByTestId("auth-heading")).toBeVisible({
    timeout: 20_000,
  });
});
