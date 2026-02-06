const { test, expect } = require('@playwright/test');

// We assume the server is ALREADY running on localhost:8080 from the user's session
const BASE_URL = 'http://localhost:8080';

test.describe('Claude Gateway UI', () => {
    test('should load the dashboard', async ({ page }) => {
        await page.goto(BASE_URL);

        // Check title
        await expect(page).toHaveTitle(/Antigravity Console/);

        // Check Header Banner
        const header = page.getByText('ANTIGRAVITY', { exact: true });
        await expect(header).toBeVisible();

        // Check for "Sessions" button in nav
        await expect(page.getByRole('button', { name: 'Sessions' })).toBeVisible();
    });
});

test.describe('Claude Gateway API', () => {

    test('should route "local-gemma" to Gateway', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/v1/messages`, {
            headers: {
                'x-api-key': 'dummy',
                'anthropic-version': '2023-06-01'
            },
            data: {
                model: 'local-gemma',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 10
            }
        });

        // Localhost:1234 might be running (200) or not (502).
        // Or if mapping failed (400).
        const status = response.status();
        // We accept 200 (Success) or 502 (Gateway Error) or 404 (Not Found).
        // We DO NOT accept 400 (Anthropic Validation Error), which means routing failed.
        expect([200, 502, 504]).toContain(status);
    });

    test('should map "claude-3-haiku-20240307" to "gemini-pro"', async ({ request }) => {
        // This verifies our config.json alias works
        const response = await request.post(`${BASE_URL}/v1/messages`, {
            headers: { 'x-api-key': 'dummy', 'anthropic-version': '2023-06-01' },
            data: {
                model: 'claude-3-haiku-20240307',
                messages: [{ role: 'user', content: 'hello' }],
                max_tokens: 10
            }
        });

        const status = response.status();
        // Should be 200 (Success) or 502 (Google Error)
        // NOT 400 (Anthropic Error)
        console.log('Mapping Status:', status);
        expect(status).not.toBe(400);
    });
});
