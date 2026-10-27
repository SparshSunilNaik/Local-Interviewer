import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('onboarding reports local privacy and readiness', async ({ page }) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', {name: 'Set up your private studio'})).toBeVisible()
  await expect(page.getByText(/No cloud authentication/)).toBeVisible()
  await expect(page.getByText(/Ready and bound/)).toBeVisible()
})

test('landing has no serious automated accessibility violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({page}).analyze()
  expect(results.violations.filter(item => ['critical', 'serious'].includes(item.impact || ''))).toEqual([])
})

test('mocked microphone utterance can be reviewed and submitted', async ({ page, request }) => {
  const created = await request.post('http://127.0.0.1:8000/api/v1/interviews', {data:{
    interview_type:'Behavioral', difficulty:'Beginner', duration_minutes:10,
    target_role:'Product Engineer', mode:'push-to-talk', provider_id:null,
  }})
  const session = await created.json()
  await page.route('**/api/v1/stt/transcribe', route => route.fulfill({
    status: 200, contentType:'application/json', body:JSON.stringify({text:'I clarified ownership, aligned the team, and documented the decision.',confidence:.9,latency_ms:120}),
  }))
  await page.goto(`/interview/${session.id}`)
  await page.getByRole('button', {name:'Start recording'}).click()
  await expect(page.getByRole('button', {name:'Stop recording'})).toBeVisible()
  await page.getByRole('button', {name:'Stop recording'}).click()
  await expect(page.getByLabel('Your answer')).toHaveValue(/clarified ownership/)
  await page.getByRole('button', {name:'Submit answer'}).click()
  await expect(page.getByText(/walk me through|Tell me about|What is one skill/i).first()).toBeVisible()
  await request.delete(`http://127.0.0.1:8000/api/v1/interviews/${session.id}`)
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
  await expect(page.getByRole('heading', {name:'Backend Engineer', exact:true})).not.toBeVisible()
})

test('provider failure is actionable and does not break settings', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', {name: /Add profile/}).click()
  await page.getByLabel('Profile name').fill('Unavailable test')
  await page.getByLabel('Ollama base URL').fill('http://127.0.0.1:9')
  await page.getByLabel('Model').fill('missing:model')
  await page.getByRole('button', {name: 'Save profile'}).click()
  await expect(page.getByText('Unavailable test').first()).toBeVisible()
  const row = page.locator('.provider-row').filter({hasText:'Unavailable test'}).first()
  await row.getByRole('button', {name:'Test'}).click()
  await expect(page.getByText(/Could not connect|timed out/)).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', {name:'Delete all data'}).click()
  await expect(page.getByText(/All local application data was deleted/)).toBeVisible()
})
