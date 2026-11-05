const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const navMetrics = require('../miniprogram/shared/nav-metrics.js');

const mpRoot = path.join(__dirname, '..', 'miniprogram');
const PAGES = ['home', 'gushi', 'player', 'games'];

function read(rel) {
  return fs.readFileSync(path.join(mpRoot, rel), 'utf8');
}

function pageWxml(name) {
  return read(path.join('pages', name, name + '.wxml'));
}

test('导航栏尺寸按状态栏与胶囊位置反推', function () {
  const wxApi = {
    getWindowInfo: function () { return { statusBarHeight: 59, windowWidth: 390 }; },
    getMenuButtonBoundingClientRect: function () {
      return { top: 65, bottom: 97, left: 277, right: 364, width: 87, height: 32 };
    }
  };
  const m = navMetrics.metrics(wxApi);
  assert.equal(m.statusBarHeight, 59);
  assert.equal(m.contentHeight, 44);
  assert.equal(m.navHeight, 103);
  assert.equal(m.sideWidth, 113);
});

test('拿不到系统信息时走兜底尺寸且不抛错', function () {
  const m = navMetrics.metrics({});
  assert.equal(m.statusBarHeight, 20);
  assert.equal(m.contentHeight, 44);
  assert.equal(m.navHeight, 64);
  assert.ok(m.sideWidth >= 80);
});

test('四个页面都启用自定义导航栏并声明 nav-bar 组件', function () {
  const appJson = JSON.parse(read('app.json'));
  assert.equal(appJson.window.navigationStyle, 'custom');
  PAGES.forEach(function (name) {
    const json = JSON.parse(read(path.join('pages', name, name + '.json')));
    assert.equal(json.usingComponents['nav-bar'], '/components/nav-bar/index');
    const wxml = pageWxml(name);
    assert.match(wxml, /<nav-bar /);
    assert.match(wxml, /\{\{navHeight\}\}/);
  });
});

test('首页不显示回首页按钮，其余三页显示', function () {
  assert.match(pageWxml('home'), /showHome="\{\{false\}\}"/);
  ['gushi', 'player', 'games'].forEach(function (name) {
    assert.doesNotMatch(pageWxml(name), /showHome="\{\{false\}\}"/);
  });
});

test('绝对定位视图用 top 让位，文档流页面用 padding-top', function () {
  ['gushi', 'player'].forEach(function (name) {
    const wxml = pageWxml(name);
    assert.match(wxml, /class="view[^"]*" style="top: \{\{navHeight\}\}px"/);
  });
  ['home', 'games'].forEach(function (name) {
    const wxml = pageWxml(name);
    assert.match(wxml, /class="page" style="padding-top: \{\{navHeight\}\}px"/);
  });
});

test('导航栏组件自绘标题、首页入口并固定定位', function () {
  const wxml = read('components/nav-bar/index.wxml');
  const wxss = read('components/nav-bar/index.wxss');
  const js = read('components/nav-bar/index.js');
  const json = JSON.parse(read('components/nav-bar/index.json'));
  assert.equal(json.component, true);
  assert.match(wxml, /\{\{title\}\}/);
  assert.match(wxml, /bindtap="onHome"/);
  assert.match(wxml, /nav-side/);
  assert.match(wxss, /position: fixed/);
  assert.match(js, /navMetrics\.metrics\(\)/);
  assert.match(js, /navigateBack/);
  assert.match(js, /reLaunch/);
});

test('点首页入口优先返回上一页，无上一页时重开首页', function () {
  let cfg = null;
  const calls = [];
  global.Component = function (config) { cfg = config; };
  global.wx = {
    navigateBack: function () { calls.push('back'); },
    reLaunch: function () { calls.push('relaunch'); }
  };
  global.getCurrentPages = function () { return [{}, {}]; };
  try {
    delete require.cache[require.resolve('../miniprogram/components/nav-bar/index.js')];
    require('../miniprogram/components/nav-bar/index.js');
    cfg.methods.onHome.call({});
    assert.deepEqual(calls, ['back']);
    global.getCurrentPages = function () { return [{}]; };
    cfg.methods.onHome.call({});
    assert.deepEqual(calls, ['back', 'relaunch']);
  } finally {
    delete global.Component;
    delete global.wx;
    delete global.getCurrentPages;
  }
});
