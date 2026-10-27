import { expect, test } from '@playwright/test'

test('onboarding reports local privacy and readiness', async ({ page }) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', {name: 'Set up your private studio'})).toBeVisible()
  await expect(page.getByText(/No cloud authentication/)).toBeVisible()
  await expect(page.getByText(/Ready and bound/)).toBeVisible()
})

test('complete persisted text interview, evaluate, export, and delete', async ({ page, request }) => {
  await page.goto('/new?quick=true')
  await page.getByLabel('Target role').fill('Backend Engineer')
  await page.getByRole('button', {name: /Enter interview room/}).click()
  await expect(page.getByText(/ASTRA · LISTENING/)).toBeVisible()

  await page.getByLabel('Your answer').fill('I build Python APIs and recently reduced queue latency by measuring lock contention, changing the worker design, and validating a forty percent improvement.')
  await page.getByRole('button', {name: 'Submit answer'}).click()
  await expect(page.getByText(/concrete example|systematic approach|object model/i).first()).toBeVisible()

  await page.getByRole('button', {name: /Pause/}).click()
  await expect(page.getByText(/ASTRA · PAUSED/)).toBeVisible()
  await page.getByRole('button', {name: /Resume/}).click()
  await expect(page.getByText(/ASTRA · LISTENING/)).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', {name: 'End interview'}).click()
  await expect(page.getByRole('heading', {name: /Backend Engineer/})).toBeVisible()
  await page.getByRole('button', {name: /Generate evaluation/}).click()
  await expect(page.getByText(/OVERALL PERFORMANCE/)).toBeVisible()
  const reportId = page.url().split('/').pop()!
  expect((await request.get(`http://127.0.0.1:8000/api/v1/interviews/${reportId}/export/json`)).ok()).toBeTruthy()

  await page.goto('/history')
  await expect(page.getByText('Backend Engineer').first()).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', {name: 'Delete interview'}).first().click()
  await expect(page.getByText('Backend Engineer')).not.toBeVisible()
})

test('provider failure is actionable and does not break settings', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', {name: /Add profile/}).click()
  await page.getByLabel('Profile name').fill('Unavailable test')
  await page.getByLabel('Ollama base URL').fill('http://127.0.0.1:9')
  await page.getByLabel('Model').fill('missing:model')
  await page.getByRole('button', {name: 'Save profile'}).click()
  await expect(page.getByText('Unavailable test')).toBeVisible()
  const row = page.locator('.provider-row').filter({hasText:'Unavailable test'})
  await row.getByRole('button', {name:'Test'}).click()
  await expect(page.getByText(/Could not connect|timed out/)).toBeVisible()
})
