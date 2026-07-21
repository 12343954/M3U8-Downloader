const path = require('path');
const fs = require('fs');
const download = require('download');
const filenamify = require('filenamify');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createDownloadHelpers({ logger, isTaskActive }) {
    function safeUnlink(filePath) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.rmSync(filePath, { force: true });
            }
        } catch (error) {
            logger && logger.error(error);
        }
    }

    function safeRemoveDir(dir) {
        try {
            if (dir && fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch (error) {
            logger && logger.error(error);
        }
    }

    function getTaskDir(baseDir, taskName) {
        const safeTaskName = filenamify(taskName, { replacement: '_' });
        return path.basename(baseDir) == safeTaskName ? baseDir : path.join(baseDir, safeTaskName);
    }

    async function downloadFileWithRetry(uri, dir, options, taskId, maxRetries = 10) {
        const filePath = path.join(dir, options.filename);
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (taskId != null && isTaskActive && !isTaskActive(taskId)) {
                return { ok: false, canceled: true };
            }
            try {
                const task = download(uri, dir, options);
                task.on('request', req => {
                    const interval = setInterval(() => {
                        if (taskId != null && isTaskActive && !isTaskActive(taskId)) {
                            req.destroy();
                            clearInterval(interval);
                        }
                    }, 100);
                    req.once('close', () => clearInterval(interval));
                    req.once('error', () => clearInterval(interval));
                });
                await task;
                if (!fs.existsSync(filePath) || fs.statSync(filePath).size <= 0) {
                    throw new Error(`downloaded file is empty: ${filePath}`);
                }
                return { ok: true };
            } catch (err) {
                logger && logger.error(`download failed, attempt=${attempt}/${maxRetries}, url=${uri}, error=${err && (err.code || err.message || err)}`);
                safeUnlink(filePath);
                if (taskId != null && isTaskActive && !isTaskActive(taskId)) {
                    return { ok: false, canceled: true, error: err };
                }
                if (attempt >= maxRetries) return { ok: false, error: err };
                await delay(Math.min(30000, 1000 * attempt * attempt));
            }
        }
        return { ok: false };
    }

    return {
        safeUnlink,
        safeRemoveDir,
        getTaskDir,
        downloadFileWithRetry
    };
}

module.exports = {
    createDownloadHelpers
};
