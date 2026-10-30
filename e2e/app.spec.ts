import { expect, test, type Page } from '@playwright/test';

test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});

async function create(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skapa en övning', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Övningens namn', exact: true })).toBeVisible();
}

async function place(page: Page, tool: string, x: number, y: number) {
  await page.getByRole('button', { name: tool, exact: true }).click();
  const board = page.locator('.canvas-surface svg.board');
  const box = await board.boundingBox();
  if (!box) throw new Error('Ritytan saknas');
  await board.click({ position: { x: box.width * x, y: box.height * y } });
}

test('create, draw, undo, animate, persist, export and import', async ({ page }) => {
  await create(page);
  await page.getByRole('textbox', { name: 'Övningens namn', exact: true }).fill('Passning och löpning');
  await place(page, 'Spelare', .3, .5);
  await page.getByLabel('Spelarnummer', { exact: true }).fill('7');
  await place(page, 'Boll', .35, .5);
  await place(page, 'Kon', .5, .7);
  await expect(page.locator('.canvas-surface [data-object-id]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Ångra', exact: true }).click();
  await expect(page.locator('.canvas-surface [data-object-id]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Gör om', exact: true }).click();
  await expect(page.locator('.canvas-surface [data-object-id]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Kopiera till nästa steg', exact: true }).click();
  await page.getByLabel('Markerat objekt', { exact: true }).selectOption({ label: 'Spelare 7 · grön' });
  await page.getByLabel('Position X', { exact: true }).fill('700');
  await page.getByLabel('Steglängd i sekunder', { exact: true }).fill('.5');
  await page.getByRole('button', { name: 'Visa steg 1', exact: true }).click();
  await page.getByLabel('Steglängd i sekunder', { exact: true }).fill('.5');
  await expect(page.getByRole('status').filter({ hasText: 'Sparat på enheten' })).toBeVisible();

  await page.getByRole('button', { name: 'Spela upp', exact: true }).click();
  const player = page.locator('.player-panel [data-object-id]').filter({ has: page.locator('text') }).first();
  const start = await player.locator('circle').first().getAttribute('cx');
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await expect(page.getByText('Steg 2 av 2', { exact: true })).toBeVisible();
  expect(await player.locator('circle').first().getAttribute('cx')).not.toBe(start);
  await page.getByRole('button', { name: 'Till redigering', exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportera fil', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Exportfil saknas');
  await page.reload();
  await page.getByRole('button', { name: 'Öppna Passning och löpning', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Visa steg 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bibliotek', exact: true }).click();
  await page.getByLabel('Importera övningsfil', { exact: true }).setInputFiles(path);
  await page.getByRole('button', { name: 'Importera som kopior', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Öppna Passning och löpning (kopia)', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.exercise-card')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('works offline after caching, including persisted editing and playback', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByRole('button', { name: 'Prova ett exempel', exact: false }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sparat på enheten' })).toBeVisible();
  await page.getByRole('button', { name: 'Bibliotek', exact: true }).click();
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Öppna Passa, löp, avsluta', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Öppna Passa, löp, avsluta', exact: true }).click();
  await page.getByRole('textbox', { name: 'Övningens namn', exact: true }).fill('Offlineövning');
  await place(page, 'Kon', .6, .75);
  await expect(page.getByRole('status').filter({ hasText: 'Sparat på enheten' })).toBeVisible();
  await page.getByRole('button', { name: 'Spela upp', exact: true }).click();
  await page.getByRole('button', { name: 'Nästa steg', exact: true }).click();
  await expect(page.getByText('Steg 2 av 4', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Till redigering', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportera fil', exact: true }).click();
  const path = await (await pending).path();
  if (!path) throw new Error('Offline-export saknas');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Öppna Offlineövning', exact: true })).toBeVisible();
  await page.getByLabel('Importera övningsfil', { exact: true }).setInputFiles(path);
  await page.getByRole('button', { name: 'Importera som kopior', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Öppna Offlineövning (kopia)', exact: true })).toBeVisible();
});

test('rejects an invalid import without changing the library', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Importera övningsfil', { exact: true }).setInputFiles({
    name: 'invalid.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'planverket', version: 99, exercises: [] })),
  });
  await expect(page.getByRole('alert')).toContainText('filversion');
  await expect(page.locator('.exercise-card')).toHaveCount(0);
});

test('pointer drag commits once and keyboard movement is undoable', async ({ page, isMobile }) => {
  await create(page);
  await place(page, 'Spelare', .3, .5);
  const board = page.locator('.canvas-surface svg.board');
  const object = board.locator('[data-object-id]').first();
  const before = await object.locator('circle').last().getAttribute('cx');
  const box = await object.boundingBox();
  if (!box) throw new Error('Spelaren saknas');
  if (!isMobile) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    expect(await object.locator('circle').last().getAttribute('cx')).not.toBe(before);
    await page.getByRole('button', { name: 'Ångra', exact: true }).click();
    await object.click();
    expect(await object.locator('circle').last().getAttribute('cx')).toBe(before);
  }
  await board.focus();
  await page.keyboard.press('ArrowRight');
  expect(Number(await object.locator('circle').last().getAttribute('cx'))).toBe(Number(before) + 5);
  await page.getByRole('button', { name: 'Ångra', exact: true }).click();
  expect(await object.locator('circle').last().getAttribute('cx')).toBe(before);
});

test('reports unavailable local storage and retains export access', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Lagring blockerad i test'); } });
  });
  await create(page);
  await expect(page.getByRole('alert')).toContainText('Lagring blockerad');
  await page.getByRole('textbox', { name: 'Övningens namn', exact: true }).fill('Osparad övning');
  await expect(page.locator('.save-state')).toContainText('Inte sparat');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportera fil', exact: true }).click();
  expect((await pending).suggestedFilename()).toContain('Osparad');
});

test('touch dragging preserves page scroll position and is undoable', async ({ page, context, browserName, isMobile }) => {
  test.skip(!isMobile || browserName !== 'chromium', 'Native touch dragging is checked through the Chromium touch protocol.');
  await create(page);
  await place(page, 'Spelare', .3, .5);
  const object = page.locator('.canvas-surface [data-object-id]').first();
  await object.scrollIntoViewIfNeeded();
  const box = await object.boundingBox();
  if (!box) throw new Error('Spelaren saknas');
  const before = await object.locator('circle').last().getAttribute('cy');
  const scroll = await page.evaluate(() => scrollY);
  const session = await context.newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 5; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 7, y: y + i * 5 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await object.locator('circle').last().getAttribute('cy')).not.toBe(before);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.getByRole('button', { name: 'Ångra', exact: true }).click();
  expect(await object.locator('circle').last().getAttribute('cy')).toBe(before);
});

test('half court, arrow endpoints, labels, teams and step deletion remain editable', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: 'Halvplan', exact: true }).click();
  await place(page, 'Pil', .25, .6);
  await page.getByLabel('Pilens slut X', { exact: true }).fill('420');
  await page.getByLabel('Pilens slut Y', { exact: true }).fill('100');
  await place(page, 'Text', .2, .2);
  await page.getByLabel('Text på planen', { exact: true }).fill('Passning');
  await place(page, 'Mål', .8, .5);
  await place(page, 'Spelare', .4, .5);
  await page.getByLabel('Lag', { exact: true }).selectOption('orange');
  await expect(page.locator('.canvas-surface circle[fill="#c7613f"]')).toHaveCount(1);
  await expect(page.locator('.canvas-surface text')).toContainText(['Passning', '1']);
  await page.getByRole('button', { name: 'Kopiera till nästa steg', exact: true }).click();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Ta bort steg', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Visa steg 2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ta bort steg', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ångra', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Visa steg 2', exact: true })).toBeVisible();
});

test('import replacement requires confirmation and does not create duplicates', async ({ page }) => {
  await create(page);
  await page.getByRole('textbox', { name: 'Övningens namn', exact: true }).fill('Ursprunglig övning');
  await expect(page.locator('.save-state')).toContainText('Sparat på enheten');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportera fil', exact: true }).click();
  const stream = await (await pending).createReadStream();
  if (!stream) throw new Error('Exportfil saknas');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  bundle.exercises[0].name = 'Uppdaterad övning';
  await page.getByRole('button', { name: 'Bibliotek', exact: true }).click();
  await page.getByLabel('Importera övningsfil', { exact: true }).setInputFiles({
    name: 'update.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.getByRole('dialog')).toContainText('samma ID');
  await expect(page.getByRole('button', { name: 'Öppna Ursprunglig övning', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ersätt befintliga', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Öppna Uppdaterad övning', exact: true })).toBeVisible();
  await expect(page.locator('.exercise-card')).toHaveCount(1);
});

test('narrow screen has no page overflow and help remains accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await create(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Så fungerar det', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toContainText('Pilar och text förklarar');
});
