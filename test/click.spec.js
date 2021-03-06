/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const utils = require('./utils');

module.exports.describe = function({testRunner, expect, playwright, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Page.click', function() {
    it('should click the button', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.click('button');
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should click svg', async({page, server}) => {
      await page.setContent(`
        <svg height="100" width="100">
          <circle onclick="javascript:window.__CLICKED=42" cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
        </svg>
      `);
      await page.click('circle');
      expect(await page.evaluate(() => window.__CLICKED)).toBe(42);
    });
    it('should click the button if window.Node is removed', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.evaluate(() => delete window.Node);
      await page.click('button');
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4281
    it('should click on a span with an inline element inside', async({page, server}) => {
      await page.setContent(`
        <style>
        span::before {
          content: 'q';
        }
        </style>
        <span onclick='javascript:window.CLICKED=42'></span>
      `);
      await page.click('span');
      expect(await page.evaluate(() => window.CLICKED)).toBe(42);
    });
    it('should not throw UnhandledPromiseRejection when page closes', async({newContext, server}) => {
      const context = await newContext();
      const page = await context.newPage();
      await Promise.all([
        page.close(),
        page.mouse.click(1, 2),
      ]).catch(e => {});
    });
    it('should click the button after navigation ', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.click('button');
      await page.goto(server.PREFIX + '/input/button.html');
      await page.click('button');
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should click the button after a cross origin navigation ', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.click('button');
      await page.goto(server.CROSS_PROCESS_PREFIX + '/input/button.html');
      await page.click('button');
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should click with disabled javascript', async({newPage, server}) => {
      const page = await newPage({ javaScriptEnabled: false });
      await page.goto(server.PREFIX + '/wrappedlink.html');
      await Promise.all([
        page.click('a'),
        page.waitForNavigation()
      ]);
      expect(page.url()).toBe(server.PREFIX + '/wrappedlink.html#clicked');
    });
    it('should click when one of inline box children is outside of viewport', async({page, server}) => {
      await page.setContent(`
        <style>
        i {
          position: absolute;
          top: -1000px;
        }
        </style>
        <span onclick='javascript:window.CLICKED = 42;'><i>woof</i><b>doggo</b></span>
      `);
      await page.click('span');
      expect(await page.evaluate(() => window.CLICKED)).toBe(42);
    });
    it('should select the text by triple clicking', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      const text = 'This is the text that we are going to try to select. Let\'s see how it goes.';
      await page.fill('textarea', text);
      await page.tripleclick('textarea');
      expect(await page.evaluate(() => {
        const textarea = document.querySelector('textarea');
        return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      })).toBe(text);
    });
    it('should click offscreen buttons', async({page, server}) => {
      await page.goto(server.PREFIX + '/offscreenbuttons.html');
      const messages = [];
      page.on('console', msg => messages.push(msg.text()));
      for (let i = 0; i < 11; ++i) {
        // We might've scrolled to click a button - reset to (0, 0).
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.click(`#btn${i}`);
      }
      expect(messages).toEqual([
        'button #0 clicked',
        'button #1 clicked',
        'button #2 clicked',
        'button #3 clicked',
        'button #4 clicked',
        'button #5 clicked',
        'button #6 clicked',
        'button #7 clicked',
        'button #8 clicked',
        'button #9 clicked',
        'button #10 clicked'
      ]);
    });

    it('should waitFor visible when already visible', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.click('button');
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should waitFor hidden when already hidden', async({page, server}) => {
      let error = null;
      await page.goto(server.PREFIX + '/input/button.html');
      await page.$eval('button', b => b.style.display = 'none');
      await page.click('button', { waitFor: 'hidden' }).catch(e => error = e);
      expect(error.message).toBe('Node is either not visible or not an HTMLElement');
      expect(await page.evaluate(() => result)).toBe('Was not clicked');
    });
    it('should waitFor hidden', async({page, server}) => {
      let error = null;
      await page.goto(server.PREFIX + '/input/button.html');
      const clicked = page.click('button', { waitFor: 'hidden' }).catch(e => error = e);
      for (let i = 0; i < 5; i++)
        await page.evaluate('1'); // Do a round trip.
      expect(error).toBe(null);
      await page.$eval('button', b => b.style.display = 'none');
      await clicked;
      expect(error.message).toBe('Node is either not visible or not an HTMLElement');
      expect(await page.evaluate(() => result)).toBe('Was not clicked');
    });
    it('should waitFor visible', async({page, server}) => {
      let done = false;
      await page.goto(server.PREFIX + '/input/button.html');
      await page.$eval('button', b => b.style.display = 'none');
      const clicked = page.click('button').then(() => done = true);
      for (let i = 0; i < 5; i++)
        await page.evaluate('1'); // Do a round trip.
      expect(done).toBe(false);
      await page.$eval('button', b => b.style.display = 'block');
      await clicked;
      expect(done).toBe(true);
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });

    it('should click wrapped links', async({page, server}) => {
      await page.goto(server.PREFIX + '/wrappedlink.html');
      await page.click('a');
      expect(await page.evaluate(() => window.__clicked)).toBe(true);
    });

    it('should click on checkbox input and toggle', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/checkbox.html');
      expect(await page.evaluate(() => result.check)).toBe(null);
      await page.click('input#agree');
      expect(await page.evaluate(() => result.check)).toBe(true);
      expect(await page.evaluate(() => result.events)).toEqual([
        'mouseover',
        'mouseenter',
        'mousemove',
        'mousedown',
        'mouseup',
        'click',
        'input',
        'change',
      ]);
      await page.click('input#agree');
      expect(await page.evaluate(() => result.check)).toBe(false);
    });

    it('should click on checkbox label and toggle', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/checkbox.html');
      expect(await page.evaluate(() => result.check)).toBe(null);
      await page.click('label[for="agree"]');
      expect(await page.evaluate(() => result.check)).toBe(true);
      expect(await page.evaluate(() => result.events)).toEqual([
        'click',
        'input',
        'change',
      ]);
      await page.click('label[for="agree"]');
      expect(await page.evaluate(() => result.check)).toBe(false);
    });

    it('should fail to click a missing button', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      let error = null;
      await page.click('button.does-not-exist', { waitFor: 'nowait' }).catch(e => error = e);
      expect(error.message).toBe('No node found for selector: button.does-not-exist');
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/161
    it('should not hang with touch-enabled viewports', async({server, newContext}) => {
      const context = await newContext({ viewport: playwright.devices['iPhone 6'].viewport });
      const page = await context.newPage();
      await page.mouse.down();
      await page.mouse.move(100, 10);
      await page.mouse.up();
    });
    it('should scroll and click the button', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/scrollable.html');
      await page.click('#button-5');
      expect(await page.evaluate(() => document.querySelector('#button-5').textContent)).toBe('clicked');
      await page.click('#button-80');
      expect(await page.evaluate(() => document.querySelector('#button-80').textContent)).toBe('clicked');
    });
    it('should double click the button', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.evaluate(() => {
        window.double = false;
        const button = document.querySelector('button');
        button.addEventListener('dblclick', event => {
          window.double = true;
        });
      });
      await page.dblclick('button');
      expect(await page.evaluate('double')).toBe(true);
      expect(await page.evaluate('result')).toBe('Clicked');
    });
    it('should click a partially obscured button', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.evaluate(() => {
        const button = document.querySelector('button');
        button.textContent = 'Some really long text that will go offscreen';
        button.style.position = 'absolute';
        button.style.left = '368px';
      });
      await page.click('button');
      expect(await page.evaluate(() => window.result)).toBe('Clicked');
    });
    it('should click a rotated button', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/rotatedButton.html');
      await page.click('button');
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should fire contextmenu event on right click', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/scrollable.html');
      await page.click('#button-8', {button: 'right'});
      expect(await page.evaluate(() => document.querySelector('#button-8').textContent)).toBe('context menu');
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/206
    it('should click links which cause navigation', async({page, server}) => {
      await page.setContent(`<a href="${server.EMPTY_PAGE}">empty.html</a>`);
      // This await should not hang.
      await page.click('a');
    });
    it('should click the button inside an iframe', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent('<div style="width:100px;height:100px">spacer</div>');
      await utils.attachFrame(page, 'button-test', server.PREFIX + '/input/button.html');
      const frame = page.frames()[1];
      const button = await frame.$('button');
      await button.click();
      expect(await frame.evaluate(() => window.result)).toBe('Clicked');
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4110
    xit('should click the button with fixed position inside an iframe', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setViewportSize({width: 500, height: 500});
      await page.setContent('<div style="width:100px;height:2000px">spacer</div>');
      await utils.attachFrame(page, 'button-test', server.CROSS_PROCESS_PREFIX + '/input/button.html');
      const frame = page.frames()[1];
      await frame.$eval('button', button => button.style.setProperty('position', 'fixed'));
      await frame.click('button');
      expect(await frame.evaluate(() => window.result)).toBe('Clicked');
    });
    it('should click the button with deviceScaleFactor set', async({newContext, server}) => {
      const context = await newContext({ viewport: {width: 400, height: 400, deviceScaleFactor: 5} });
      const page = await context.newPage();
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(5);
      await page.setContent('<div style="width:100px;height:100px">spacer</div>');
      await utils.attachFrame(page, 'button-test', server.PREFIX + '/input/button.html');
      const frame = page.frames()[1];
      const button = await frame.$('button');
      await button.click();
      expect(await frame.evaluate(() => window.result)).toBe('Clicked');
    });
    it('should click the button with px border with relative point', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.$eval('button', button => button.style.borderWidth = '8px');
      await page.click('button', { relativePoint: { x: 20, y: 10 } });
      expect(await page.evaluate(() => result)).toBe('Clicked');
      // Safari reports border-relative offsetX/offsetY.
      expect(await page.evaluate(() => offsetX)).toBe(WEBKIT ? 20 + 8 : 20);
      expect(await page.evaluate(() => offsetY)).toBe(WEBKIT ? 10 + 8 : 10);
    });
    it('should click the button with em border with relative point', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.$eval('button', button => button.style.borderWidth = '2em');
      await page.$eval('button', button => button.style.fontSize = '12px');
      await page.click('button', { relativePoint: { x: 20, y: 10 } });
      expect(await page.evaluate(() => result)).toBe('Clicked');
      // Safari reports border-relative offsetX/offsetY.
      expect(await page.evaluate(() => offsetX)).toBe(WEBKIT ? 12 * 2 + 20 : 20);
      expect(await page.evaluate(() => offsetY)).toBe(WEBKIT ? 12 * 2 + 10 : 10);
    });
    it('should click a very large button with relative point', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.$eval('button', button => button.style.borderWidth = '8px');
      await page.$eval('button', button => button.style.height = button.style.width = '2000px');
      await page.click('button', { relativePoint: { x: 1900, y: 1910 } });
      expect(await page.evaluate(() => window.result)).toBe('Clicked');
      // Safari reports border-relative offsetX/offsetY.
      expect(await page.evaluate(() => offsetX)).toBe(WEBKIT ? 1900 + 8 : 1900);
      expect(await page.evaluate(() => offsetY)).toBe(WEBKIT ? 1910 + 8 : 1910);
    });
    xit('should click a button in scrolling container with relative point', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.$eval('button', button => {
        const container = document.createElement('div');
        container.style.overflow = 'auto';
        container.style.width = '200px';
        container.style.height = '200px';
        button.parentElement.insertBefore(container, button);
        container.appendChild(button);
        button.style.height = '2000px';
        button.style.width = '2000px';
      });
      await page.click('button', { relativePoint: { x: 1900, y: 1910 } });
      expect(await page.evaluate(() => window.result)).toBe('Clicked');
      expect(await page.evaluate(() => offsetX)).toBe(1900);
      expect(await page.evaluate(() => offsetY)).toBe(1910);
    });

    it('should update modifiers correctly', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.click('button', { modifiers: ['Shift'] });
      expect(await page.evaluate(() => shiftKey)).toBe(true);
      await page.click('button', { modifiers: [] });
      expect(await page.evaluate(() => shiftKey)).toBe(false);

      await page.keyboard.down('Shift');
      await page.click('button', { modifiers: [] });
      expect(await page.evaluate(() => shiftKey)).toBe(false);
      await page.click('button');
      expect(await page.evaluate(() => shiftKey)).toBe(true);
      await page.keyboard.up('Shift');
      await page.click('button');
      expect(await page.evaluate(() => shiftKey)).toBe(false);
    });
    it.skip(CHROMIUM)('should click an offscreen element when scroll-behavior is smooth', async({page}) => {
      await page.setContent(`
        <div style="border: 1px solid black; height: 500px; overflow: auto; width: 500px; scroll-behavior: smooth">
        <button style="margin-top: 2000px" onClick="window.clicked = true">hi</button>
        </div>
      `);
      await page.click('button');
      expect(await page.evaluate('window.clicked')).toBe(true);
    });
    it.skip(true)('should click on an animated button', async({page}) => {
      const buttonSize = 50;
      const containerWidth = 500;
      const transition = 500;
      await page.setContent(`
      <html>
      <body>
      <div style="border: 1px solid black; height: 50px; overflow: auto; width: ${containerWidth}px;">
      <button id="button" style="height: ${buttonSize}px; width: ${buttonSize}px; transition: left ${transition}ms linear 0s; left: 0; position: relative" onClick="window.clicked++">hi</button>
      </div>
      </body>
      <script>
      const animateLeft = () => {
        const button = document.querySelector('#button');
        document.querySelector('#button').style.left = button.style.left === '0px' ? '${containerWidth - buttonSize}px' : '0px';
      };
      window.clicked = 0;
      window.setTimeout(animateLeft, 0);
      window.setInterval(animateLeft, ${transition});
      </script>
      </html>
      `);
      await page.click('button');
      expect(await page.evaluate('window.clicked')).toBe(1);
      expect(await page.evaluate('document.querySelector("#button").style.left')).toBe(`${containerWidth - buttonSize}px`);
      await new Promise(resolve => setTimeout(resolve, 500));
      await page.click('button');
      expect(await page.evaluate('window.clicked')).toBe(2);
      expect(await page.evaluate('document.querySelector("#button").style.left')).toBe('0px');
    });
  });

  describe('Page.check', function() {
    it('should check the box', async({page}) => {
      await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
      await page.check('input');
      expect(await page.evaluate(() => checkbox.checked)).toBe(true);
    });
    it('should not check the checked box', async({page}) => {
      await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
      await page.check('input');
      expect(await page.evaluate(() => checkbox.checked)).toBe(true);
    });
    it('should uncheck the box', async({page}) => {
      await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
      await page.uncheck('input');
      expect(await page.evaluate(() => checkbox.checked)).toBe(false);
    });
    it('should not uncheck the unchecked box', async({page}) => {
      await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
      await page.uncheck('input');
      expect(await page.evaluate(() => checkbox.checked)).toBe(false);
    });
    it('should check the box by label', async({page}) => {
      await page.setContent(`<label for='checkbox'><input id='checkbox' type='checkbox'></input></label>`);
      await page.check('label');
      expect(await page.evaluate(() => checkbox.checked)).toBe(true);
    });
    it('should check the box outside label', async({page}) => {
      await page.setContent(`<label for='checkbox'>Text</label><div><input id='checkbox' type='checkbox'></input></div>`);
      await page.check('label');
      expect(await page.evaluate(() => checkbox.checked)).toBe(true);
    });
    it('should check the box inside label w/o id', async({page}) => {
      await page.setContent(`<label>Text<span><input id='checkbox' type='checkbox'></input></span></label>`);
      await page.check('label');
      expect(await page.evaluate(() => checkbox.checked)).toBe(true);
    });
    it('should check radio', async({page}) => {
      await page.setContent(`
        <input type='radio'>one</input>
        <input id='two' type='radio'>two</input>
        <input type='radio'>three</input>`);
      await page.check('#two');
      expect(await page.evaluate(() => two.checked)).toBe(true);
    });
    it('should check the box by aria role', async({page}) => {
      await page.setContent(`<div role='checkbox' id='checkbox'>CHECKBOX</div>
        <script>
          checkbox.addEventListener('click', () => checkbox.setAttribute('aria-checked', 'true'));
        </script>`);
      await page.check('div');
      expect(await page.evaluate(() => checkbox.getAttribute('aria-checked'))).toBe('true');
    });
  });
};
