import {test, expect} from '@playwright/test';

const url = new URL('../../docs/architecture/index.html', import.meta.url).href;

async function expectAligned(page) {
  const result = await page.locator('#graph').evaluate(graph => {
    const svg = graph.querySelector('svg');
    const matrix = svg.getScreenCTM();
    const nodes = [...graph.querySelectorAll('.node')].map(node => node.getBoundingClientRect());
    const paths = [...svg.querySelectorAll('path')];
    const errors = paths.flatMap(path => {
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(path.getTotalLength());
      const a = new DOMPoint(start.x, start.y).matrixTransform(matrix);
      const b = new DOMPoint(end.x, end.y).matrixTransform(matrix);
      return [
        Math.min(...nodes.map(node => Math.hypot(node.right - a.x, node.top + node.height / 2 - a.y))),
        Math.min(...nodes.map(node => Math.hypot(node.left - b.x, node.top + node.height / 2 - b.y))),
      ];
    });
    return {edges: paths.length, nodes: nodes.length, error: Math.max(...errors)};
  });
  expect(result.nodes).toBeGreaterThan(2);
  expect(result.edges).toBe(result.nodes - 1);
  expect(result.error, 'Every SVG endpoint must touch a node edge at its vertical center').toBeLessThan(0.75);
}

test('all features connect to node centers at this viewport', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const features = await page.locator('#mobile-select option').evaluateAll(options => options.map(option => ({id: option.value, name: option.textContent})));
  expect(features.length).toBeGreaterThan(0);
  for (const feature of features) {
    if (await page.locator('#mobile-select').isVisible()) {
      await page.locator('#mobile-select').selectOption(feature.id);
    } else {
      await page.locator('#feature-list').getByRole('button', {name: feature.name, exact: true}).click();
    }
    await expect(page.locator('#title')).toHaveText(feature.name);
    await expect(page).toHaveURL(`${url}#${feature.id}`);
    await expectAligned(page);
  }
  expect(errors).toEqual([]);
});

test('old URL, search, detail links and resizing remain usable', async ({page}) => {
  await page.goto(new URL('../../docs/aee-architecture.html#transform', import.meta.url).href);
  await expect(page).toHaveURL(`${url}#transform`);
  await expect(page.locator('#title')).toHaveText('位移、旋轉與任意變形');
  await page.locator('.node').filter({hasText: 'hooks/renderHooks.ts'}).click();
  await expect(page.locator('#detail a')).toHaveAttribute('href', '../../src/hooks/renderHooks.ts');
  await page.getByLabel('搜尋功能', {exact: true}).fill('不存在的功能');
  await expect(page.locator('#feature-list button')).toHaveCount(0);
  await expect(page.locator('#mobile-select option')).toHaveCount(0);
  await page.getByLabel('搜尋功能', {exact: true}).fill('');
  for (const width of [1600, 960, 390]) {
    await page.setViewportSize({width, height: 900});
    await expectAligned(page);
  }
});
