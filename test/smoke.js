const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createDownloadHelpers } = require('../src/main/download-utils');
const { createTaskRuntime } = require('../src/main/task-runtime');
const { createTaskState } = require('../src/main/task-state');
const { resolveHttpUri, resolveMediaUri, resolveKeyUri } = require('../src/main/url-resolver');
const { taskStatus, percentFormat } = require('../static/scripts/global-vars');

function run() {
    assert.strictEqual(resolveHttpUri('https://a.com/x/index.m3u8', 'seg.ts'), 'https://a.com/x/seg.ts');
    assert.strictEqual(resolveHttpUri('https://a.com/x/index.m3u8', '/seg.ts'), 'https://a.com/seg.ts');
    assert.strictEqual(resolveHttpUri('https://a.com/x/index.m3u8', 'https://b.com/seg.ts'), 'https://b.com/seg.ts');

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm3u8-smoke-'));
    const localM3u8 = path.join(tmp, 'index.m3u8');
    const localSeg = path.join(tmp, 'seg.ts');
    const localKey = path.join(tmp, 'aes.key');
    fs.writeFileSync(localM3u8, '#EXTM3U');
    fs.writeFileSync(localSeg, 'data');
    fs.writeFileSync(localKey, 'key');
    assert.ok(resolveMediaUri(`file:///${localM3u8}`, '', 'seg.ts').endsWith('/seg.ts') || resolveMediaUri(`file:///${localM3u8}`, '', 'seg.ts').endsWith('\\seg.ts'));
    assert.ok(resolveKeyUri(`file:///${localM3u8}`, '', 'aes.key').includes('aes.key'));

    const runtime = createTaskRuntime();
    runtime.resetFromTasks([{ id: 1 }], false);
    assert.strictEqual(runtime.has(1), true);
    assert.strictEqual(runtime.isActive(1), false);
    runtime.start(1);
    assert.strictEqual(runtime.isActive(1), true);
    runtime.remove(1);
    assert.strictEqual(runtime.has(1), false);

    const helpers = createDownloadHelpers({ logger: console, isTaskActive: () => true });
    assert.strictEqual(helpers.getTaskDir(path.join(tmp, 'movie'), 'movie'), path.join(tmp, 'movie'));
    assert.strictEqual(helpers.getTaskDir(tmp, 'movie'), path.join(tmp, 'movie'));
    helpers.safeRemoveDir(tmp);
    assert.strictEqual(fs.existsSync(tmp), false);

    const state = createTaskState({
        taskStatus,
        i18n: { t: key => key },
        percentFormat
    });
    assert.strictEqual(state.canRestoreAsPaused(taskStatus.downloading), true);
    assert.strictEqual(state.canRestoreAsPaused(taskStatus.done), false);

    console.log('smoke ok');
}

run();
