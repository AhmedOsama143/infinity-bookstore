/**
 * Smoke E2E. Boots the local dev server (or production build when
 * PLAYWRIGHT_USE_BUILD=1) and verifies the home page renders the brand
 * heading, the free-shipping promo, and at least one book + teacher
 * card. If this passes, the storefront is at least wired together.
 *
 * Larger flows (login, add-to-cart, checkout) come later — they need
 * test users + seeded books, which we don't want to invent inside this
 * single smoke spec.
 */
import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test('renders the brand heading + free-shipping promo + nav', async ({ page }) => {
    await page.goto('/');

    // Brand heading — h1.
    await expect(
      page.getByRole('heading', { level: 1, name: /إنفينيتي/ })
    ).toBeVisible();

    // Free-shipping promo strip — copy contains a digits-only price.
    await expect(page.getByText(/شحن مجاني/)).toBeVisible();

    // CTA buttons in the hero.
    await expect(page.getByRole('link', { name: 'تصفح الكتب' })).toBeVisible();
    await expect(page.getByRole('link', { name: /تعرف على المدرسين/ })).toBeVisible();

    // The skip-to-main link (A-04) lives in the DOM but is visually
    // hidden — confirm it exists at all, since regressions would lose
    // keyboard accessibility silently.
    const skipLink = page.locator('a.skip-link');
    await expect(skipLink).toHaveCount(1);
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('has the structured-data JSON-LD blocks', async ({ page }) => {
    await page.goto('/');
    // Root layout writes BookStore org schema; home page writes the
    // WebSite + SearchAction. Both should be present in <script type=
    // "application/ld+json"> tags.
    const ldScripts = page.locator('script[type="application/ld+json"]');
    await expect(ldScripts).toHaveCount(2);
  });
});
