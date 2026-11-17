import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const label = process.env.DR_TEST_LABEL
const usable = loadAllTestAccounts().filter(a => !label || a.label === label).length
test.skip(usable < 3, 'Needs three SDK test accounts; run node scripts/verify-online.mjs to provision isolated accounts and run the suite.')

async function call(page: Page, name: string, params: Record<string, unknown>) {
  return page.evaluate(async ({ name, params }) => {
    const path = '/src/decisionroom/client.ts'
    const module = await import(/* @vite-ignore */ path)
    try { return { success: true, data: await module.action(name, params) } }
    catch (e) { return { success: false, error: e instanceof Error ? e.message : 'Error' } }
  }, { name, params })
}

test('three users: private room, invitation, live evidence/votes, frozen final decision', async ({ users }) => {
  test.setTimeout(120000)
  const [host, guest, outsider] = await users(3, label ? { label } : undefined)
  await Promise.all([host.page.goto('/home'), guest.page.goto('/home'), outsider.page.goto('/home')])
  await host.page.getByRole('button', { name: 'New decision', exact: true }).click()
  const question = `Reading club ${randomUUID().slice(0, 8)}`
  await host.page.getByLabel('The question').fill(question)
  await host.page.getByLabel('Constraints & what matters').fill('Four weeks; mixed backgrounds')
  await host.page.getByLabel('Option 01').fill('Book A')
  await host.page.getByLabel('Option 02').fill('Book B')
  await host.page.getByRole('button', { name: 'Create private room' }).click()
  await expect(host.page.getByRole('heading', { name: question })).toBeVisible()
  const url = host.page.url()
  const roomId = new URL(url).searchParams.get('room')!
  await outsider.page.goto(url)
  await expect(outsider.page.getByRole('heading', { name: 'Room unavailable' })).toBeVisible()
  await expect(outsider.page.getByText(question, { exact: true })).toHaveCount(0)
  expect((await call(outsider.page, 'vote', { roomId, optionId: 'option-1' })).success).toBe(false)
  expect((await call(outsider.page, 'search', { roomId, query: 'book' })).success).toBe(false)

  await host.page.getByRole('button', { name: 'Invite', exact: true }).click()
  const invitation = await host.page.locator('.dr-invite-link').getAttribute('href')
  await guest.page.goto(invitation!)
  await guest.page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(guest.page.getByRole('heading', { name: question })).toBeVisible()
  await host.page.getByLabel('Source title').fill('Publisher overview')
  await host.page.getByLabel('Source URL').fill('https://example.com/book')
  await host.page.getByLabel('What does this source establish?').fill('An illustrative source note used only for verification.')
  await host.page.getByRole('button', { name: 'Save evidence' }).click()
  await expect(guest.page.getByRole('link', { name: 'Publisher overview' })).toBeVisible()
  await guest.page.locator('.dr-option').filter({ hasText: 'Book B' }).getByRole('button').click()
  await expect(host.page.locator('.dr-option').filter({ hasText: 'Book B' })).toContainText('1 votes')
  // Changing a vote replaces it, rather than creating a second row.
  await guest.page.locator('.dr-option').filter({ hasText: 'Book A' }).getByRole('button').click()
  await expect(host.page.locator('.dr-option').filter({ hasText: 'Book A' })).toContainText('1 votes')
  await expect(host.page.locator('.dr-option').filter({ hasText: 'Book B' })).toContainText('0 votes')
  expect((await call(guest.page, 'finalize', { roomId, optionId: 'option-2', rationale: 'Unauthorized' })).success).toBe(false)
  expect((await call(guest.page, 'search', { roomId, query: 'book' })).success).toBe(false)

  await host.page.getByRole('tab', { name: '03 / Decision' }).click()
  await host.page.getByRole('combobox', { name: 'The decision', exact: true }).selectOption('option-1')
  await host.page.getByLabel('Why this choice?').fill('A human-reviewed choice based on our reading constraints.')
  await host.page.getByRole('button', { name: 'Review final decision' }).click()
  await host.page.getByRole('button', { name: 'Confirm & close decision' }).click()
  await expect(guest.page.getByText('THE CALL WE MADE')).toBeVisible()
  await expect(guest.page.getByRole('button', { name: 'Vote for this option' })).toHaveCount(0)
  expect((await call(guest.page, 'vote', { roomId, optionId: 'option-2' })).success).toBe(false)
  await host.page.reload()
  await expect(host.page.getByText('A human-reviewed choice based on our reading constraints.')).toBeVisible()
  // Export must contain the real decision and source, not just download a file.
  const [download] = await Promise.all([host.page.waitForEvent('download'), host.page.getByRole('button', { name: 'Export brief' }).click()])
  const path = await download.path()
  const { readFile } = await import('node:fs/promises')
  const brief = await readFile(path!, 'utf8')
  expect(brief).toContain('Decision: Book A')
  expect(brief).toContain('https://example.com/book')
})
